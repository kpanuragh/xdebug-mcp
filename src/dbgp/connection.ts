/**
 * DBGp Connection Handler
 * Handles a single Xdebug connection with message parsing and command sending.
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { XMLParser } from 'fast-xml-parser';
import {
  DbgpResponse,
  DbgpError,
  InitPacket,
  StackFrame,
  Context,
  Property,
  Breakpoint,
  BreakpointType,
  BreakpointState,
  HitCondition,
  StreamData,
} from './types.js';
import { logger } from '../utils/logger.js';

enum ParserState {
  DataLength,
  Response,
}

interface PendingCommand {
  resolve: (response: DbgpResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface DbgpConnectionEvents {
  init: (packet: InitPacket) => void;
  response: (response: DbgpResponse) => void;
  stream: (data: StreamData) => void;
  close: () => void;
  error: (error: Error) => void;
}

export class DbgpConnection extends EventEmitter {
  private buffer: Buffer = Buffer.alloc(0);
  private parserState: ParserState = ParserState.DataLength;
  private expectedLength: number = 0;
  private transactionId: number = 0;
  private pendingCommands: Map<number, PendingCommand> = new Map();
  private commandQueue: Array<() => void> = [];
  private xmlParser: XMLParser;
  private closed: boolean = false;

  public initPacket: InitPacket | null = null;
  public readonly id: string;
  public readonly remoteAddress: string;

  constructor(
    private socket: net.Socket,
    private commandTimeout: number = 30000
  ) {
    super();
    this.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;

    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: false,
      trimValues: true,
    });

    this.socket.on('data', (data) => this.handleData(data));
    this.socket.on('close', () => this.handleClose());
    this.socket.on('error', (err) => this.emit('error', err));
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    this.processBuffer();
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      if (this.parserState === ParserState.DataLength) {
        // Look for NULL byte delimiter between length and data
        const nullIndex = this.buffer.indexOf(0);
        if (nullIndex === -1) return;

        const lengthStr = this.buffer.subarray(0, nullIndex).toString('utf8');
        this.expectedLength = parseInt(lengthStr, 10);

        if (isNaN(this.expectedLength) || this.expectedLength <= 0) {
          logger.error('Invalid message length:', lengthStr);
          this.buffer = this.buffer.subarray(nullIndex + 1);
          continue;
        }

        this.buffer = this.buffer.subarray(nullIndex + 1);
        this.parserState = ParserState.Response;
      }

      if (this.parserState === ParserState.Response) {
        // Wait for full response + trailing NULL byte
        if (this.buffer.length < this.expectedLength + 1) return;

        const xmlData = this.buffer.subarray(0, this.expectedLength).toString('utf8');
        this.buffer = this.buffer.subarray(this.expectedLength + 1);
        this.parserState = ParserState.DataLength;

        this.handleMessage(xmlData);
      }
    }
  }

  private handleMessage(xmlData: string): void {
    try {
      logger.debug('Received XML:', xmlData);
      const parsed = this.xmlParser.parse(xmlData);

      // Handle init packet (first message from Xdebug)
      if (parsed.init) {
        this.initPacket = this.parseInitPacket(parsed.init);
        logger.info(`Debug session initialized: ${this.initPacket.fileUri}`);
        this.emit('init', this.initPacket);
        return;
      }

      // Handle regular response
      if (parsed.response) {
        const response = this.parseResponse(parsed.response);
        const txId = response.transactionId;
        const pending = this.pendingCommands.get(txId);

        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingCommands.delete(txId);
          pending.resolve(response);
        }

        this.emit('response', response);
        this.processQueue();
      }

      // Handle stream output (stdout/stderr)
      if (parsed.stream) {
        const streamData = this.parseStream(parsed.stream);
        this.emit('stream', streamData);
      }
    } catch (error) {
      logger.error('Error parsing message:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private parseInitPacket(init: Record<string, unknown>): InitPacket {
    const attrs = init as Record<string, string>;
    return {
      appId: attrs['@_appid'] || '',
      ideKey: attrs['@_idekey'] || '',
      session: attrs['@_session'] || '',
      thread: attrs['@_thread'] || '',
      language: attrs['@_language'] || 'PHP',
      protocolVersion: attrs['@_protocol_version'] || '1.0',
      fileUri: attrs['@_fileuri'] || '',
      engine: init['engine']
        ? {
            name: (init['engine'] as Record<string, string>)['#text'] || '',
            version: (init['engine'] as Record<string, string>)['@_version'] || '',
          }
        : undefined,
    };
  }

  private parseResponse(response: Record<string, unknown>): DbgpResponse {
    const attrs = response as Record<string, string>;
    const result: DbgpResponse = {
      command: attrs['@_command'] || '',
      transactionId: parseInt(attrs['@_transaction_id'] || '0', 10),
      status: attrs['@_status'] as DbgpResponse['status'],
      reason: attrs['@_reason'] as DbgpResponse['reason'],
      success: attrs['@_success'] === '1',
      data: {},
    };

    // Parse error if present
    if (response['error']) {
      const error = response['error'] as Record<string, unknown>;
      result.error = {
        code: parseInt((error['@_code'] as string) || '0', 10),
        message: (error['message'] as Record<string, string>)?.['#text'] || '',
      };
    }

    // Parse message (location info after step commands)
    const xdebugMessage = response['xdebug:message'] || response['message'];
    if (xdebugMessage) {
      const msg = xdebugMessage as Record<string, string>;
      result.message = {
        filename: msg['@_filename'] || '',
        lineno: parseInt(msg['@_lineno'] || '0', 10),
        exception: msg['@_exception'],
      };
    }

    // Store raw data for further parsing by specific handlers
    result.data = response;

    return result;
  }

  private parseStream(stream: Record<string, unknown>): StreamData {
    const attrs = stream as Record<string, string>;
    const encoding = attrs['@_encoding'] || 'base64';
    let content = attrs['#text'] || '';

    if (encoding === 'base64' && content) {
      content = Buffer.from(content, 'base64').toString('utf8');
    }

    return {
      type: attrs['@_type'] as 'stdout' | 'stderr',
      encoding,
      content,
    };
  }

  async sendCommand(
    command: string,
    args?: Record<string, string>,
    data?: string
  ): Promise<DbgpResponse> {
    if (this.closed) {
      throw new Error('Connection is closed');
    }

    return new Promise((resolve, reject) => {
      const execute = () => {
        const txId = ++this.transactionId;
        let cmdStr = `${command} -i ${txId}`;

        if (args) {
          for (const [key, value] of Object.entries(args)) {
            cmdStr += ` -${key} ${this.escapeArg(value)}`;
          }
        }

        if (data !== undefined) {
          const base64Data = Buffer.from(data).toString('base64');
          cmdStr += ` -- ${base64Data}`;
        }

        cmdStr += '\0';

        const timeout = setTimeout(() => {
          this.pendingCommands.delete(txId);
          reject(new Error(`Command timeout: ${command}`));
          this.processQueue();
        }, this.commandTimeout);

        this.pendingCommands.set(txId, { resolve, reject, timeout });

        logger.debug('Sending command:', cmdStr.replace('\0', '\\0'));
        this.socket.write(cmdStr);
      };

      // DBGp doesn't support concurrent commands - queue them
      if (this.pendingCommands.size > 0) {
        this.commandQueue.push(execute);
      } else {
        execute();
      }
    });
  }

  private processQueue(): void {
    if (this.commandQueue.length > 0 && this.pendingCommands.size === 0) {
      const next = this.commandQueue.shift();
      if (next) next();
    }
  }

  private escapeArg(value: string): string {
    // If value contains spaces or special chars, quote it
    if (/[\s"\\]/.test(value)) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  private handleClose(): void {
    this.closed = true;

    // Reject all pending commands
    for (const [txId, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingCommands.clear();
    this.commandQueue = [];

    this.emit('close');
  }

  close(): void {
    if (!this.closed) {
      this.socket.destroy();
    }
  }

  get isConnected(): boolean {
    return !this.closed && !this.socket.destroyed;
  }

  // === Response Parsing Helpers ===

  parseStackFrames(response: DbgpResponse): StackFrame[] {
    const data = response.data as Record<string, unknown>;
    const stackData = data['stack'];

    if (!stackData) return [];

    const frames = Array.isArray(stackData) ? stackData : [stackData];
    return frames.map((frame: Record<string, string>) => ({
      level: parseInt(frame['@_level'] || '0', 10),
      type: (frame['@_type'] || 'file') as 'file' | 'eval',
      filename: frame['@_filename'] || '',
      lineno: parseInt(frame['@_lineno'] || '0', 10),
      where: frame['@_where'],
      cmdbegin: frame['@_cmdbegin'],
      cmdend: frame['@_cmdend'],
    }));
  }

  parseContexts(response: DbgpResponse): Context[] {
    const data = response.data as Record<string, unknown>;
    const contextData = data['context'];

    if (!contextData) return [];

    const contexts = Array.isArray(contextData) ? contextData : [contextData];
    return contexts.map((ctx: Record<string, string>) => ({
      id: parseInt(ctx['@_id'] || '0', 10),
      name: ctx['@_name'] || '',
    }));
  }

  parseProperties(response: DbgpResponse): Property[] {
    const data = response.data as Record<string, unknown>;
    const propertyData = data['property'];

    if (!propertyData) return [];

    const properties = Array.isArray(propertyData) ? propertyData : [propertyData];
    return properties.map((prop) => this.parsePropertyNode(prop));
  }

  parseProperty(response: DbgpResponse): Property | null {
    const data = response.data as Record<string, unknown>;
    const propertyData = data['property'];

    if (!propertyData) return null;

    return this.parsePropertyNode(propertyData as Record<string, unknown>);
  }

  private parsePropertyNode(prop: Record<string, unknown>): Property {
    const attrs = prop as Record<string, string>;
    const property: Property = {
      name: attrs['@_name'] || '',
      fullname: attrs['@_fullname'] || attrs['@_name'] || '',
      type: attrs['@_type'] || 'unknown',
    };

    if (attrs['@_classname']) property.classname = attrs['@_classname'];
    if (attrs['@_facet']) property.facet = attrs['@_facet'];
    if (attrs['@_constant'] === '1') property.constant = true;
    if (attrs['@_children'] === '1') property.children = true;
    if (attrs['@_numchildren']) property.numchildren = parseInt(attrs['@_numchildren'], 10);
    if (attrs['@_size']) property.size = parseInt(attrs['@_size'], 10);
    if (attrs['@_page']) property.page = parseInt(attrs['@_page'], 10);
    if (attrs['@_pagesize']) property.pagesize = parseInt(attrs['@_pagesize'], 10);
    if (attrs['@_address']) property.address = attrs['@_address'];
    if (attrs['@_key']) property.key = attrs['@_key'];
    if (attrs['@_encoding']) property.encoding = attrs['@_encoding'];

    // Get value
    const textValue = prop['#text'] as string | undefined;
    if (textValue !== undefined) {
      if (attrs['@_encoding'] === 'base64') {
        property.value = Buffer.from(textValue, 'base64').toString('utf8');
      } else {
        property.value = textValue;
      }
    }

    // Parse nested properties
    const nestedProps = prop['property'];
    if (nestedProps) {
      const nested = Array.isArray(nestedProps) ? nestedProps : [nestedProps];
      property.properties = nested.map((p) =>
        this.parsePropertyNode(p as Record<string, unknown>)
      );
    }

    return property;
  }

  parseBreakpoints(response: DbgpResponse): Breakpoint[] {
    const data = response.data as Record<string, unknown>;
    const bpData = data['breakpoint'];

    if (!bpData) return [];

    const breakpoints = Array.isArray(bpData) ? bpData : [bpData];
    return breakpoints.map((bp: Record<string, string>) => ({
      id: bp['@_id'] || '',
      type: (bp['@_type'] || 'line') as BreakpointType,
      state: (bp['@_state'] || 'enabled') as BreakpointState,
      resolved: bp['@_resolved'] === '1',
      filename: bp['@_filename'],
      lineno: bp['@_lineno'] ? parseInt(bp['@_lineno'], 10) : undefined,
      function: bp['@_function'],
      exception: bp['@_exception'],
      expression: bp['@_expression'],
      hitCount: bp['@_hit_count'] ? parseInt(bp['@_hit_count'], 10) : undefined,
      hitValue: bp['@_hit_value'] ? parseInt(bp['@_hit_value'], 10) : undefined,
      hitCondition: bp['@_hit_condition'] as HitCondition | undefined,
    }));
  }

  parseBreakpointSet(response: DbgpResponse): { id: string; resolved: boolean } {
    const data = response.data as Record<string, string>;
    return {
      id: data['@_id'] || '',
      resolved: data['@_resolved'] === '1',
    };
  }
}
