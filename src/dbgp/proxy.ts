/**
 * DBGp Proxy Client
 * Registers the MCP server with a DBGp proxy using proxyinit/proxystop.
 */

import * as net from 'net';
import { XMLParser } from 'fast-xml-parser';

export interface DbgpProxyConfig {
  host: string;
  port: number;
  ideKey: string;
}

export interface ProxyRegistration {
  ideKey: string;
  address?: string;
  port?: number;
}

interface ProxyXmlResponse {
  success?: string;
  '@_success'?: string;
  '@_idekey'?: string;
  '@_address'?: string;
  '@_port'?: string;
  error?: {
    '@_id'?: string;
    message?: string | { '#text'?: string };
  };
}

export class DbgpProxyClient {
  private readonly xmlParser: XMLParser;
  private registration: ProxyRegistration | null = null;

  constructor(private readonly config: DbgpProxyConfig) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: false,
      trimValues: true,
    });
  }

  get isRegistered(): boolean {
    return this.registration !== null;
  }

  get currentRegistration(): ProxyRegistration | null {
    return this.registration;
  }

  async register(listenPort: number, supportsMultipleSessions: boolean): Promise<ProxyRegistration> {
    const multipleSessionsFlag = supportsMultipleSessions ? '1' : '0';
    const response = await this.sendProxyCommand(
      `proxyinit -p ${listenPort} -k ${this.escapeArg(this.config.ideKey)} -m ${multipleSessionsFlag}`
    );

    const proxyInit = this.getResponseNode(response, 'proxyinit');
    const success = proxyInit['@_success'] ?? proxyInit.success ?? '0';
    if (success !== '1') {
      throw new Error(this.getErrorMessage(proxyInit, 'DBGp proxy registration failed'));
    }

    this.registration = {
      ideKey: proxyInit['@_idekey'] || this.config.ideKey,
      address: proxyInit['@_address'],
      port: proxyInit['@_port'] ? parseInt(proxyInit['@_port'], 10) : undefined,
    };

    return this.registration;
  }

  async unregister(): Promise<void> {
    if (!this.registration) {
      return;
    }

    const response = await this.sendProxyCommand(
      `proxystop -k ${this.escapeArg(this.registration.ideKey)}`
    );

    const proxyStop = this.getResponseNode(response, 'proxystop');
    const success = proxyStop['@_success'] ?? proxyStop.success ?? '0';
    if (success !== '1') {
      throw new Error(this.getErrorMessage(proxyStop, 'DBGp proxy unregistration failed'));
    }

    this.registration = null;
  }

  private async sendProxyCommand(command: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const commandName = command.split(' ', 1)[0] || 'DBGp proxy command';
      const socket = net.createConnection(
        {
          host: this.config.host,
          port: this.config.port,
        },
        () => {
          socket.write(`${command}\0`);
        }
      );

      let response = '';
      let settled = false;

      const finish = (handler: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        handler();
      };

      const resolveResponse = (destroySocket: boolean) => {
        finish(() => {
          try {
            const parsedResponse = this.parseResponse(response);
            if (destroySocket) {
              socket.destroy();
            }
            resolve(parsedResponse);
          } catch (error) {
            if (destroySocket) {
              socket.destroy();
            }
            reject(error);
          }
        });
      };

      const timeout = setTimeout(() => {
        finish(() => {
          socket.destroy();
          reject(new Error(`${commandName} timed out waiting for a DBGp proxy response`));
        });
      }, 10000);

      socket.setEncoding('utf8');

      socket.on('data', (chunk) => {
        response += chunk;
        if (!response.includes('\0')) {
          return;
        }
        resolveResponse(true);
      });

      socket.on('error', (error) => {
        finish(() => {
          reject(error);
        });
      });

      socket.on('end', () => {
        resolveResponse(false);
      });

      socket.on('close', (hadError) => {
        if (hadError || settled) {
          return;
        }

        resolveResponse(false);
      });
    });
  }

  private parseResponse(response: string): Record<string, unknown> {
    const payload = response.replace(/\0/g, '').trim();
    if (!payload) {
      throw new Error('DBGp proxy returned an empty response');
    }

    return this.xmlParser.parse(payload) as Record<string, unknown>;
  }

  private getResponseNode(response: Record<string, unknown>, key: string): ProxyXmlResponse {
    const directNode = response[key];
    if (directNode && !Array.isArray(directNode) && typeof directNode === 'object') {
      return directNode as ProxyXmlResponse;
    }

    for (const value of Object.values(response)) {
      if (!value || Array.isArray(value) || typeof value !== 'object') {
        continue;
      }

      const nestedNode = (value as Record<string, unknown>)[key];
      if (nestedNode && !Array.isArray(nestedNode) && typeof nestedNode === 'object') {
        return nestedNode as ProxyXmlResponse;
      }
    }

    throw new Error(`Unexpected DBGp proxy response: missing <${key}> root element`);
  }

  private getErrorMessage(response: ProxyXmlResponse, fallbackMessage: string): string {
    const error = response.error;
    if (!error) {
      return fallbackMessage;
    }

    const message = typeof error.message === 'string' ? error.message : error.message?.['#text'];
    const errorId = error['@_id'];
    if (message && errorId) {
      return `${fallbackMessage} (${errorId}): ${message}`;
    }
    if (message) {
      return `${fallbackMessage}: ${message}`;
    }
    return fallbackMessage;
  }

  private escapeArg(value: string): string {
    if (value.includes('\0')) {
      throw new Error('DBGp proxy arguments cannot contain null bytes');
    }
    if (/[\s"\\]/.test(value)) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }

    return value;
  }
}
