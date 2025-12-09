/**
 * DBGp Protocol Types
 * Based on: https://xdebug.org/docs/dbgp
 */

export interface InitPacket {
  appId: string;
  ideKey: string;
  session: string;
  thread: string;
  language: string;
  protocolVersion: string;
  fileUri: string;
  engine?: {
    name: string;
    version: string;
  };
}

export type DebugStatus = 'starting' | 'break' | 'running' | 'stopping' | 'stopped';
export type StopReason = 'ok' | 'error' | 'aborted' | 'exception';

export interface DbgpResponse {
  command: string;
  transactionId: number;
  status?: DebugStatus;
  reason?: StopReason;
  success?: boolean;
  error?: DbgpError;
  message?: {
    filename: string;
    lineno: number;
    exception?: string;
  };
  data?: Record<string, unknown>;
}

export interface DbgpError {
  code: number;
  message: string;
}

export interface StackFrame {
  level: number;
  type: 'file' | 'eval';
  filename: string;
  lineno: number;
  where?: string;
  cmdbegin?: string;
  cmdend?: string;
}

export interface Context {
  id: number;
  name: string;
}

export interface Property {
  name: string;
  fullname: string;
  type: string;
  classname?: string;
  facet?: string;
  constant?: boolean;
  children?: boolean;
  numchildren?: number;
  size?: number;
  page?: number;
  pagesize?: number;
  address?: string;
  key?: string;
  encoding?: string;
  value?: string;
  properties?: Property[];
}

export type BreakpointType = 'line' | 'call' | 'return' | 'exception' | 'conditional' | 'watch';
export type BreakpointState = 'enabled' | 'disabled';
export type HitCondition = '>=' | '==' | '%';

export interface Breakpoint {
  id: string;
  type: BreakpointType;
  state: BreakpointState;
  resolved?: boolean;
  filename?: string;
  lineno?: number;
  function?: string;
  exception?: string;
  expression?: string;
  hitCount?: number;
  hitValue?: number;
  hitCondition?: HitCondition;
}

export interface StreamData {
  type: 'stdout' | 'stderr';
  encoding: string;
  content: string;
}

// DBGp error codes
export const DBGP_ERROR_CODES = {
  PARSE_ERROR: 1,
  DUPLICATE_ARGS: 2,
  INVALID_OPTIONS: 3,
  UNIMPLEMENTED_COMMAND: 4,
  COMMAND_NOT_AVAILABLE: 5,

  FILE_NOT_FOUND: 100,
  STREAM_REDIRECT_FAILED: 101,

  BREAKPOINT_NOT_SET: 200,
  BREAKPOINT_TYPE_NOT_SUPPORTED: 201,
  INVALID_BREAKPOINT_LINE: 202,
  NO_CODE_ON_LINE: 203,
  INVALID_BREAKPOINT_STATE: 204,
  NO_SUCH_BREAKPOINT: 205,
  EXPRESSION_ERROR: 206,

  PROPERTY_NOT_FOUND: 300,
  INVALID_STACK_DEPTH: 301,
  INVALID_CONTEXT: 302,

  ENCODING_NOT_SUPPORTED: 900,
  INTERNAL_ERROR: 998,
  UNKNOWN_ERROR: 999,
} as const;
