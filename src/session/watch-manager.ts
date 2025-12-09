/**
 * Watch Manager
 * Manages persistent watch expressions that auto-evaluate on each break.
 */

import { EventEmitter } from 'events';
import { Property } from '../dbgp/types.js';
import { DebugSession } from './session.js';
import { logger } from '../utils/logger.js';

export interface WatchExpression {
  id: string;
  expression: string;
  lastValue?: Property | null;
  previousValue?: Property | null;
  hasChanged: boolean;
  errorMessage?: string;
  evaluationCount: number;
  createdAt: Date;
  lastEvaluatedAt?: Date;
}

export interface WatchEvaluationResult {
  id: string;
  expression: string;
  value: Property | null;
  previousValue: Property | null;
  hasChanged: boolean;
  error?: string;
}

export class WatchManager extends EventEmitter {
  private watches: Map<string, WatchExpression> = new Map();
  private watchIdCounter: number = 0;

  constructor() {
    super();
  }

  addWatch(expression: string): WatchExpression {
    const id = `watch_${++this.watchIdCounter}`;
    const watch: WatchExpression = {
      id,
      expression,
      hasChanged: false,
      evaluationCount: 0,
      createdAt: new Date(),
    };
    this.watches.set(id, watch);
    logger.debug(`Watch added: ${id} = ${expression}`);
    return watch;
  }

  removeWatch(id: string): boolean {
    const removed = this.watches.delete(id);
    if (removed) {
      logger.debug(`Watch removed: ${id}`);
    }
    return removed;
  }

  getWatch(id: string): WatchExpression | undefined {
    return this.watches.get(id);
  }

  getAllWatches(): WatchExpression[] {
    return Array.from(this.watches.values());
  }

  clearAllWatches(): void {
    this.watches.clear();
    logger.debug('All watches cleared');
  }

  /**
   * Evaluate all watch expressions in the current session context
   */
  async evaluateAll(
    session: DebugSession,
    stackDepth: number = 0
  ): Promise<WatchEvaluationResult[]> {
    const results: WatchEvaluationResult[] = [];

    for (const watch of this.watches.values()) {
      const result = await this.evaluateWatch(session, watch, stackDepth);
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate a single watch expression
   */
  async evaluateWatch(
    session: DebugSession,
    watch: WatchExpression,
    stackDepth: number = 0
  ): Promise<WatchEvaluationResult> {
    try {
      const value = await session.evaluate(watch.expression, stackDepth);

      // Track previous value for change detection
      watch.previousValue = watch.lastValue;
      watch.lastValue = value;
      watch.lastEvaluatedAt = new Date();
      watch.evaluationCount++;
      watch.errorMessage = undefined;

      // Detect changes
      watch.hasChanged = this.hasValueChanged(watch.previousValue, watch.lastValue);

      if (watch.hasChanged) {
        this.emit('watchChanged', watch);
      }

      return {
        id: watch.id,
        expression: watch.expression,
        value,
        previousValue: watch.previousValue || null,
        hasChanged: watch.hasChanged,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      watch.errorMessage = errorMessage;
      watch.lastEvaluatedAt = new Date();
      watch.evaluationCount++;

      return {
        id: watch.id,
        expression: watch.expression,
        value: null,
        previousValue: watch.previousValue || null,
        hasChanged: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Compare two property values to detect changes
   */
  private hasValueChanged(prev: Property | null | undefined, curr: Property | null | undefined): boolean {
    if (!prev && !curr) return false;
    if (!prev || !curr) return true;

    // Compare type
    if (prev.type !== curr.type) return true;

    // Compare value
    if (prev.value !== curr.value) return true;

    // For complex types, compare number of children
    if (prev.numchildren !== curr.numchildren) return true;

    return false;
  }

  /**
   * Get watches that have changed since last evaluation
   */
  getChangedWatches(): WatchExpression[] {
    return Array.from(this.watches.values()).filter((w) => w.hasChanged);
  }

  /**
   * Export watch configuration for saving
   */
  exportConfig(): { expressions: string[] } {
    return {
      expressions: Array.from(this.watches.values()).map((w) => w.expression),
    };
  }

  /**
   * Import watch configuration
   */
  importConfig(config: { expressions: string[] }): void {
    this.clearAllWatches();
    for (const expr of config.expressions) {
      this.addWatch(expr);
    }
  }
}
