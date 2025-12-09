/**
 * Debug Session
 * Represents a single PHP debug session with all debugging operations.
 */

import { EventEmitter } from 'events';
import { DbgpConnection } from '../dbgp/connection.js';
import {
  Breakpoint,
  DebugStatus,
  Property,
  StackFrame,
  Context,
  InitPacket,
  HitCondition,
  DbgpResponse,
} from '../dbgp/types.js';
import { logger } from '../utils/logger.js';

export interface SessionState {
  id: string;
  status: DebugStatus;
  filename?: string;
  lineno?: number;
  ideKey?: string;
  startTime: Date;
}

export class DebugSession extends EventEmitter {
  public readonly id: string;
  public status: DebugStatus = 'starting';
  public currentFile?: string;
  public currentLine?: number;
  public readonly startTime: Date;

  private breakpoints: Map<string, Breakpoint> = new Map();
  private initialized: boolean = false;

  constructor(private connection: DbgpConnection) {
    super();
    this.id = connection.id;
    this.startTime = new Date();

    // Update state on responses
    connection.on('response', (response: DbgpResponse) => {
      if (response.status) {
        this.status = response.status;
      }
      if (response.message) {
        this.currentFile = response.message.filename;
        this.currentLine = response.message.lineno;
      }
      this.emit('stateChange', this.getState());
    });

    connection.on('close', () => {
      this.status = 'stopped';
      this.emit('close');
    });

    connection.on('stream', (data) => {
      this.emit('output', data);
    });
  }

  get initPacket(): InitPacket | null {
    return this.connection.initPacket;
  }

  getState(): SessionState {
    return {
      id: this.id,
      status: this.status,
      filename: this.currentFile,
      lineno: this.currentLine,
      ideKey: this.initPacket?.ideKey,
      startTime: this.startTime,
    };
  }

  // === Initialization ===

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Set preferred features
      await this.setFeature('max_depth', '3');
      await this.setFeature('max_children', '128');
      await this.setFeature('max_data', '2048');
      await this.setFeature('show_hidden', '1');

      this.initialized = true;
      logger.debug(`Session ${this.id} initialized`);
    } catch (error) {
      logger.error(`Failed to initialize session ${this.id}:`, error);
      throw error;
    }
  }

  // === Feature Negotiation ===

  async setFeature(name: string, value: string): Promise<boolean> {
    try {
      const response = await this.connection.sendCommand('feature_set', {
        n: name,
        v: value,
      });
      return response.success === true;
    } catch {
      return false;
    }
  }

  async getFeature(name: string): Promise<string | null> {
    try {
      const response = await this.connection.sendCommand('feature_get', {
        n: name,
      });
      const data = response.data as Record<string, string>;
      return data['@_supported'] === '1' ? data['#text'] || null : null;
    } catch {
      return null;
    }
  }

  // === Breakpoint Operations ===

  async setLineBreakpoint(
    filename: string,
    line: number,
    options?: {
      condition?: string;
      hitValue?: number;
      hitCondition?: HitCondition;
      temporary?: boolean;
    }
  ): Promise<Breakpoint> {
    const args: Record<string, string> = {
      t: options?.condition ? 'conditional' : 'line',
      f: this.normalizeFileUri(filename),
      n: line.toString(),
    };

    if (options?.hitValue !== undefined) {
      args['h'] = options.hitValue.toString();
    }
    if (options?.hitCondition) {
      args['o'] = options.hitCondition;
    }
    if (options?.temporary) {
      args['r'] = '1';
    }

    const response = await this.connection.sendCommand(
      'breakpoint_set',
      args,
      options?.condition
    );

    if (response.error) {
      throw new Error(`Failed to set breakpoint: ${response.error.message}`);
    }

    const result = this.connection.parseBreakpointSet(response);

    const breakpoint: Breakpoint = {
      id: result.id,
      type: options?.condition ? 'conditional' : 'line',
      state: 'enabled',
      resolved: result.resolved,
      filename,
      lineno: line,
      expression: options?.condition,
      hitValue: options?.hitValue,
      hitCondition: options?.hitCondition,
    };

    this.breakpoints.set(breakpoint.id, breakpoint);
    logger.debug(`Breakpoint set: ${breakpoint.id} at ${filename}:${line}`);
    return breakpoint;
  }

  async setExceptionBreakpoint(exception: string = '*'): Promise<Breakpoint> {
    const response = await this.connection.sendCommand('breakpoint_set', {
      t: 'exception',
      x: exception,
    });

    if (response.error) {
      throw new Error(`Failed to set exception breakpoint: ${response.error.message}`);
    }

    const result = this.connection.parseBreakpointSet(response);

    const breakpoint: Breakpoint = {
      id: result.id,
      type: 'exception',
      state: 'enabled',
      exception,
    };

    this.breakpoints.set(breakpoint.id, breakpoint);
    return breakpoint;
  }

  async setCallBreakpoint(functionName: string): Promise<Breakpoint> {
    const response = await this.connection.sendCommand('breakpoint_set', {
      t: 'call',
      m: functionName,
    });

    if (response.error) {
      throw new Error(`Failed to set call breakpoint: ${response.error.message}`);
    }

    const result = this.connection.parseBreakpointSet(response);

    const breakpoint: Breakpoint = {
      id: result.id,
      type: 'call',
      state: 'enabled',
      function: functionName,
    };

    this.breakpoints.set(breakpoint.id, breakpoint);
    return breakpoint;
  }

  async removeBreakpoint(breakpointId: string): Promise<boolean> {
    const response = await this.connection.sendCommand('breakpoint_remove', {
      d: breakpointId,
    });

    if (!response.error) {
      this.breakpoints.delete(breakpointId);
      logger.debug(`Breakpoint removed: ${breakpointId}`);
      return true;
    }
    return false;
  }

  async updateBreakpoint(
    breakpointId: string,
    options: {
      state?: 'enabled' | 'disabled';
      hitValue?: number;
      hitCondition?: HitCondition;
    }
  ): Promise<boolean> {
    const args: Record<string, string> = { d: breakpointId };

    if (options.state) args['s'] = options.state;
    if (options.hitValue !== undefined) args['h'] = options.hitValue.toString();
    if (options.hitCondition) args['o'] = options.hitCondition;

    const response = await this.connection.sendCommand('breakpoint_update', args);
    return !response.error;
  }

  async getBreakpoint(breakpointId: string): Promise<Breakpoint | null> {
    const response = await this.connection.sendCommand('breakpoint_get', {
      d: breakpointId,
    });

    if (response.error) return null;

    const breakpoints = this.connection.parseBreakpoints(response);
    return breakpoints[0] || null;
  }

  async listBreakpoints(): Promise<Breakpoint[]> {
    const response = await this.connection.sendCommand('breakpoint_list');
    const breakpoints = this.connection.parseBreakpoints(response);

    // Update local cache
    this.breakpoints.clear();
    for (const bp of breakpoints) {
      this.breakpoints.set(bp.id, bp);
    }

    return breakpoints;
  }

  // === Execution Control ===

  async run(): Promise<{ status: DebugStatus; file?: string; line?: number }> {
    const response = await this.connection.sendCommand('run');
    return this.handleStepResponse(response);
  }

  async stepInto(): Promise<{ status: DebugStatus; file?: string; line?: number }> {
    const response = await this.connection.sendCommand('step_into');
    return this.handleStepResponse(response);
  }

  async stepOver(): Promise<{ status: DebugStatus; file?: string; line?: number }> {
    const response = await this.connection.sendCommand('step_over');
    return this.handleStepResponse(response);
  }

  async stepOut(): Promise<{ status: DebugStatus; file?: string; line?: number }> {
    const response = await this.connection.sendCommand('step_out');
    return this.handleStepResponse(response);
  }

  async stop(): Promise<void> {
    await this.connection.sendCommand('stop');
    this.status = 'stopped';
  }

  async detach(): Promise<void> {
    await this.connection.sendCommand('detach');
  }

  private handleStepResponse(response: DbgpResponse): {
    status: DebugStatus;
    file?: string;
    line?: number;
  } {
    const status = response.status || 'break';
    this.status = status;

    if (response.message) {
      this.currentFile = response.message.filename;
      this.currentLine = response.message.lineno;
    }

    return {
      status,
      file: this.currentFile,
      line: this.currentLine,
    };
  }

  // === Stack Inspection ===

  async getStackDepth(): Promise<number> {
    const response = await this.connection.sendCommand('stack_depth');
    const data = response.data as Record<string, string>;
    return parseInt(data['@_depth'] || '0', 10);
  }

  async getStackTrace(depth?: number): Promise<StackFrame[]> {
    const args: Record<string, string> = {};
    if (depth !== undefined) {
      args['d'] = depth.toString();
    }

    const response = await this.connection.sendCommand('stack_get', args);
    return this.connection.parseStackFrames(response);
  }

  // === Context and Variables ===

  async getContexts(stackDepth: number = 0): Promise<Context[]> {
    const response = await this.connection.sendCommand('context_names', {
      d: stackDepth.toString(),
    });
    return this.connection.parseContexts(response);
  }

  async getVariables(
    contextId: number = 0,
    stackDepth: number = 0
  ): Promise<Property[]> {
    const response = await this.connection.sendCommand('context_get', {
      c: contextId.toString(),
      d: stackDepth.toString(),
    });
    return this.connection.parseProperties(response);
  }

  async getVariable(
    name: string,
    options?: {
      contextId?: number;
      stackDepth?: number;
      maxDepth?: number;
      page?: number;
    }
  ): Promise<Property | null> {
    const args: Record<string, string> = {
      n: name,
    };

    if (options?.contextId !== undefined) {
      args['c'] = options.contextId.toString();
    }
    if (options?.stackDepth !== undefined) {
      args['d'] = options.stackDepth.toString();
    }
    if (options?.maxDepth !== undefined) {
      args['m'] = options.maxDepth.toString();
    }
    if (options?.page !== undefined) {
      args['p'] = options.page.toString();
    }

    const response = await this.connection.sendCommand('property_get', args);

    if (response.error) {
      return null;
    }

    return this.connection.parseProperty(response);
  }

  async setVariable(
    name: string,
    value: string,
    options?: {
      contextId?: number;
      stackDepth?: number;
      type?: string;
    }
  ): Promise<boolean> {
    const args: Record<string, string> = {
      n: name,
    };

    if (options?.contextId !== undefined) {
      args['c'] = options.contextId.toString();
    }
    if (options?.stackDepth !== undefined) {
      args['d'] = options.stackDepth.toString();
    }
    if (options?.type) {
      args['t'] = options.type;
    }

    const response = await this.connection.sendCommand('property_set', args, value);
    return response.success === true || !response.error;
  }

  // === Expression Evaluation ===

  async evaluate(
    expression: string,
    stackDepth: number = 0
  ): Promise<Property | null> {
    const response = await this.connection.sendCommand(
      'eval',
      { d: stackDepth.toString() },
      expression
    );

    if (response.error) {
      throw new Error(`Evaluation error: ${response.error.message}`);
    }

    return this.connection.parseProperty(response);
  }

  // === Source Code ===

  async getSource(
    fileUri: string,
    beginLine?: number,
    endLine?: number
  ): Promise<string | null> {
    const args: Record<string, string> = {
      f: this.normalizeFileUri(fileUri),
    };

    if (beginLine !== undefined) args['b'] = beginLine.toString();
    if (endLine !== undefined) args['e'] = endLine.toString();

    const response = await this.connection.sendCommand('source', args);

    if (response.error) return null;

    const data = response.data as Record<string, string>;
    const encoding = data['@_encoding'];
    const content = data['#text'] || '';

    if (encoding === 'base64' && content) {
      return Buffer.from(content, 'base64').toString('utf8');
    }

    return content;
  }

  // === Stream Redirection ===

  async redirectStdout(mode: 'disable' | 'copy' | 'redirect'): Promise<boolean> {
    const modeMap = { disable: '0', copy: '1', redirect: '2' };
    const response = await this.connection.sendCommand('stdout', {
      c: modeMap[mode],
    });
    return response.success === true;
  }

  async redirectStderr(mode: 'disable' | 'copy' | 'redirect'): Promise<boolean> {
    const modeMap = { disable: '0', copy: '1', redirect: '2' };
    const response = await this.connection.sendCommand('stderr', {
      c: modeMap[mode],
    });
    return response.success === true;
  }

  // === Utilities ===

  private normalizeFileUri(path: string): string {
    if (path.startsWith('file://')) {
      return path;
    }
    return `file://${path}`;
  }

  close(): void {
    this.connection.close();
  }

  get isConnected(): boolean {
    return this.connection.isConnected;
  }
}
