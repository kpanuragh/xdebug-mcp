/**
 * DBGp Proxy Client
 * Registers the MCP server with a DBGp proxy using proxyinit/proxystop.
 */

import * as net from 'net';
import { XMLParser } from 'fast-xml-parser';

/**
 * Connection settings for the external DBGp proxy.
 */
export interface DbgpProxyConfig {
  host: string;
  port: number;
  ideKey: string;
}

/**
 * Successful proxy registration details returned by the proxy server.
 */
export interface ProxyRegistration {
  ideKey: string;
  address?: string;
  port?: number;
}

type ProxyCommandName = 'proxyinit' | 'proxystop';

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

type ProxyResponseEnvelope = Partial<Record<ProxyCommandName, ProxyXmlResponse>> & Record<string, unknown>;

/**
 * Register and unregister this MCP server against a DBGp proxy.
 */
export class DbgpProxyClient {
  private readonly xmlParser: XMLParser;
  private registration: ProxyRegistration | null = null;

  constructor(
    private readonly config: DbgpProxyConfig,
    private readonly commandTimeout: number = 10000
  ) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: false,
      trimValues: true,
    });
  }

  /**
   * Whether the client currently has an active proxy registration.
   */
  get isRegistered(): boolean {
    return this.registration !== null;
  }

  /**
   * Return the active registration details when registration succeeded.
   */
  get currentRegistration(): ProxyRegistration | null {
    return this.registration;
  }

  /**
   * Register the current IDE key with the proxy so incoming Xdebug sessions are routed here.
   */
  async register(listenPort: number, supportsMultipleSessions: boolean): Promise<ProxyRegistration> {
    const multipleSessionsFlag = supportsMultipleSessions ? '1' : '0';
    const ideKey = this.validateIdeKey(this.config.ideKey);
    const response = await this.sendProxyCommand(
      `proxyinit -p ${listenPort} -k ${ideKey} -m ${multipleSessionsFlag}`
    );

    const proxyInit = this.getResponseNode(response, 'proxyinit');
    const success = proxyInit['@_success'] ?? proxyInit.success ?? '0';
    if (success !== '1') {
      throw new Error(this.getErrorMessage(proxyInit, 'DBGp proxy registration failed'));
    }

    this.registration = {
      ideKey: proxyInit['@_idekey'] || this.config.ideKey,
      address: proxyInit['@_address'],
      port: this.parseOptionalPort(proxyInit['@_port']),
    };

    return this.registration;
  }

  /**
   * Remove the current registration from the proxy before shutting down the local listener.
   */
  async unregister(): Promise<void> {
    if (!this.registration) {
      return;
    }

    const ideKey = this.validateIdeKey(this.registration.ideKey);
    const response = await this.sendProxyCommand(
      `proxystop -k ${ideKey}`
    );

    const proxyStop = this.getResponseNode(response, 'proxystop');
    const success = proxyStop['@_success'] ?? proxyStop.success ?? '0';
    if (success !== '1') {
      throw new Error(this.getErrorMessage(proxyStop, 'DBGp proxy unregistration failed'));
    }

    this.registration = null;
  }

  /**
   * Send a single proxy command and parse the XML payload returned by the proxy server.
   */
  private async sendProxyCommand(command: string): Promise<ProxyResponseEnvelope> {
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
      }, this.commandTimeout);

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

      // Some proxies close immediately after the NULL-terminated payload, so accept either event.
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

  /**
   * Parse the proxy XML payload into a typed envelope once transport framing is removed.
   */
  private parseResponse(response: string): ProxyResponseEnvelope {
    const payload = response.replace(/\0/g, '').trim();
    if (!payload) {
      throw new Error('DBGp proxy returned an empty response');
    }

    return this.xmlParser.parse(payload) as ProxyResponseEnvelope;
  }

  /**
   * Extract the command response node even when proxies wrap it inside an outer document element.
   */
  private getResponseNode(response: ProxyResponseEnvelope, key: ProxyCommandName): ProxyXmlResponse {
    const directNode = response[key];
    if (this.isObjectRecord(directNode)) {
      return directNode as ProxyXmlResponse;
    }

    for (const value of Object.values(response)) {
      if (!this.isObjectRecord(value)) {
        continue;
      }

      const nestedNode = value[key];
      if (this.isObjectRecord(nestedNode)) {
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

  /**
   * Reject malformed proxy port values early so registration logs do not contain a fake port number.
   */
  private parseOptionalPort(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const port = parseInt(value, 10);
    if (Number.isNaN(port) || port <= 0) {
      throw new Error(`DBGp proxy returned an invalid port: ${value}`);
    }

    return port;
  }

  /**
   * Narrow unknown parser output to a plain object before reading XML attributes from it.
   */
  private isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Keep IDE keys compatible with the reference proxy, which splits on spaces and does not unescape quoted values.
   */
  private validateIdeKey(value: string): string {
    if (value.includes('\0')) {
      throw new Error('DBGp proxy arguments cannot contain null bytes');
    }
    if (/[\s"\\]/.test(value)) {
      throw new Error(
        'DBGp proxy IDE keys must not contain spaces, quotes, or backslashes because the reference proxy does not parse escaped arguments.'
      );
    }

    return value;
  }
}
