/**
 * Logpoint Manager
 * Manages logpoints - breakpoints that log without stopping execution.
 */

import { EventEmitter } from 'events';
import { DebugSession } from './session.js';
import { logger } from '../utils/logger.js';

export interface Logpoint {
  id: string;
  breakpointId?: string;
  file: string;
  line: number;
  message: string;
  condition?: string;
  hitCount: number;
  lastHitAt?: Date;
  createdAt: Date;
  enabled: boolean;
  logHistory: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  variables: Record<string, unknown>;
  stackDepth: number;
}

export interface LogpointHit {
  logpoint: Logpoint;
  entry: LogEntry;
}

export class LogpointManager extends EventEmitter {
  private logpoints: Map<string, Logpoint> = new Map();
  private logpointIdCounter: number = 0;
  private maxHistoryPerLogpoint: number = 100;

  constructor() {
    super();
  }

  /**
   * Create a logpoint
   * @param file File path
   * @param line Line number
   * @param message Message template with {varName} placeholders
   * @param condition Optional condition
   */
  createLogpoint(
    file: string,
    line: number,
    message: string,
    condition?: string
  ): Logpoint {
    const id = `logpoint_${++this.logpointIdCounter}`;
    const logpoint: Logpoint = {
      id,
      file,
      line,
      message,
      condition,
      hitCount: 0,
      createdAt: new Date(),
      enabled: true,
      logHistory: [],
    };
    this.logpoints.set(id, logpoint);
    logger.debug(`Logpoint created: ${id} at ${file}:${line}`);
    return logpoint;
  }

  removeLogpoint(id: string): boolean {
    const removed = this.logpoints.delete(id);
    if (removed) {
      logger.debug(`Logpoint removed: ${id}`);
    }
    return removed;
  }

  getLogpoint(id: string): Logpoint | undefined {
    return this.logpoints.get(id);
  }

  getAllLogpoints(): Logpoint[] {
    return Array.from(this.logpoints.values());
  }

  /**
   * Find logpoint by file and line
   */
  findLogpoint(file: string, line: number): Logpoint | undefined {
    for (const lp of this.logpoints.values()) {
      if (lp.file === file && lp.line === line) {
        return lp;
      }
    }
    return undefined;
  }

  /**
   * Process a logpoint hit - evaluate and log the message
   */
  async processHit(
    session: DebugSession,
    logpoint: Logpoint,
    stackDepth: number = 0
  ): Promise<LogEntry> {
    // Extract variable names from message template
    const varPattern = /\{([^}]+)\}/g;
    const variables: Record<string, unknown> = {};
    let evaluatedMessage = logpoint.message;

    // Find all {varName} placeholders
    let match;
    const varNames: string[] = [];
    while ((match = varPattern.exec(logpoint.message)) !== null) {
      varNames.push(match[1]);
    }

    // Evaluate each variable
    for (const varName of varNames) {
      try {
        const result = await session.evaluate(varName, stackDepth);
        const value = result?.value ?? result?.type ?? 'undefined';
        variables[varName] = value;
        evaluatedMessage = evaluatedMessage.replace(`{${varName}}`, String(value));
      } catch {
        variables[varName] = '<error>';
        evaluatedMessage = evaluatedMessage.replace(`{${varName}}`, '<error>');
      }
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      message: evaluatedMessage,
      variables,
      stackDepth,
    };

    // Update logpoint state
    logpoint.hitCount++;
    logpoint.lastHitAt = new Date();
    logpoint.logHistory.push(entry);

    // Trim history if too large
    if (logpoint.logHistory.length > this.maxHistoryPerLogpoint) {
      logpoint.logHistory = logpoint.logHistory.slice(-this.maxHistoryPerLogpoint);
    }

    this.emit('logpointHit', { logpoint, entry } as LogpointHit);
    logger.info(`[Logpoint ${logpoint.id}] ${evaluatedMessage}`);

    return entry;
  }

  /**
   * Get hit statistics for all logpoints
   */
  getStatistics(): {
    totalLogpoints: number;
    totalHits: number;
    logpoints: Array<{
      id: string;
      file: string;
      line: number;
      hitCount: number;
      lastHitAt?: Date;
    }>;
  } {
    const logpoints = this.getAllLogpoints();
    const totalHits = logpoints.reduce((sum, lp) => sum + lp.hitCount, 0);

    return {
      totalLogpoints: logpoints.length,
      totalHits,
      logpoints: logpoints.map((lp) => ({
        id: lp.id,
        file: lp.file,
        line: lp.line,
        hitCount: lp.hitCount,
        lastHitAt: lp.lastHitAt,
      })),
    };
  }

  /**
   * Get log history for a specific logpoint
   */
  getLogHistory(id: string, limit?: number): LogEntry[] {
    const logpoint = this.logpoints.get(id);
    if (!logpoint) return [];

    const history = logpoint.logHistory;
    if (limit && limit < history.length) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Clear log history for all logpoints
   */
  clearHistory(): void {
    for (const lp of this.logpoints.values()) {
      lp.logHistory = [];
      lp.hitCount = 0;
    }
  }

  /**
   * Export configuration
   */
  exportConfig(): Array<{ file: string; line: number; message: string; condition?: string }> {
    return this.getAllLogpoints().map((lp) => ({
      file: lp.file,
      line: lp.line,
      message: lp.message,
      condition: lp.condition,
    }));
  }

  /**
   * Import configuration
   */
  importConfig(
    config: Array<{ file: string; line: number; message: string; condition?: string }>
  ): void {
    for (const item of config) {
      this.createLogpoint(item.file, item.line, item.message, item.condition);
    }
  }
}
