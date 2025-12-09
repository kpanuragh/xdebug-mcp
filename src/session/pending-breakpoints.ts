/**
 * Pending Breakpoints Manager
 * Stores breakpoints before a debug session starts and applies them when a session connects.
 */

import { EventEmitter } from 'events';
import { HitCondition } from '../dbgp/types.js';
import { DebugSession } from './session.js';
import { logger } from '../utils/logger.js';

export interface PendingBreakpoint {
  id: string;
  type: 'line' | 'exception' | 'call';
  file?: string;
  line?: number;
  condition?: string;
  hitValue?: number;
  hitCondition?: HitCondition;
  exception?: string;
  functionName?: string;
  enabled: boolean;
  createdAt: Date;
}

export interface AppliedBreakpoint {
  pendingId: string;
  sessionId: string;
  breakpointId: string;
}

export class PendingBreakpointsManager extends EventEmitter {
  private pendingBreakpoints: Map<string, PendingBreakpoint> = new Map();
  private appliedBreakpoints: Map<string, AppliedBreakpoint[]> = new Map();
  private breakpointIdCounter: number = 0;

  /**
   * Add a pending line breakpoint
   */
  addLineBreakpoint(
    file: string,
    line: number,
    options?: {
      condition?: string;
      hitValue?: number;
      hitCondition?: HitCondition;
    }
  ): PendingBreakpoint {
    const id = `pending_${++this.breakpointIdCounter}`;
    const bp: PendingBreakpoint = {
      id,
      type: 'line',
      file,
      line,
      condition: options?.condition,
      hitValue: options?.hitValue,
      hitCondition: options?.hitCondition,
      enabled: true,
      createdAt: new Date(),
    };
    this.pendingBreakpoints.set(id, bp);
    logger.info(`Pending breakpoint added: ${id} at ${file}:${line}`);
    this.emit('breakpointAdded', bp);
    return bp;
  }

  /**
   * Add a pending exception breakpoint
   */
  addExceptionBreakpoint(exception: string = '*'): PendingBreakpoint {
    const id = `pending_${++this.breakpointIdCounter}`;
    const bp: PendingBreakpoint = {
      id,
      type: 'exception',
      exception,
      enabled: true,
      createdAt: new Date(),
    };
    this.pendingBreakpoints.set(id, bp);
    logger.info(`Pending exception breakpoint added: ${id} for ${exception}`);
    this.emit('breakpointAdded', bp);
    return bp;
  }

  /**
   * Add a pending call breakpoint
   */
  addCallBreakpoint(functionName: string): PendingBreakpoint {
    const id = `pending_${++this.breakpointIdCounter}`;
    const bp: PendingBreakpoint = {
      id,
      type: 'call',
      functionName,
      enabled: true,
      createdAt: new Date(),
    };
    this.pendingBreakpoints.set(id, bp);
    logger.info(`Pending call breakpoint added: ${id} for ${functionName}`);
    this.emit('breakpointAdded', bp);
    return bp;
  }

  /**
   * Remove a pending breakpoint
   */
  removeBreakpoint(id: string): boolean {
    const removed = this.pendingBreakpoints.delete(id);
    if (removed) {
      logger.info(`Pending breakpoint removed: ${id}`);
      this.emit('breakpointRemoved', id);
    }
    return removed;
  }

  /**
   * Get all pending breakpoints
   */
  getAllPendingBreakpoints(): PendingBreakpoint[] {
    return Array.from(this.pendingBreakpoints.values());
  }

  /**
   * Get a specific pending breakpoint
   */
  getPendingBreakpoint(id: string): PendingBreakpoint | undefined {
    return this.pendingBreakpoints.get(id);
  }

  /**
   * Enable/disable a pending breakpoint
   */
  setBreakpointEnabled(id: string, enabled: boolean): boolean {
    const bp = this.pendingBreakpoints.get(id);
    if (bp) {
      bp.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Apply all pending breakpoints to a new session
   */
  async applyToSession(session: DebugSession): Promise<AppliedBreakpoint[]> {
    const applied: AppliedBreakpoint[] = [];

    for (const bp of this.pendingBreakpoints.values()) {
      if (!bp.enabled) continue;

      try {
        let result;

        switch (bp.type) {
          case 'line':
            if (bp.file && bp.line) {
              result = await session.setLineBreakpoint(bp.file, bp.line, {
                condition: bp.condition,
                hitValue: bp.hitValue,
                hitCondition: bp.hitCondition,
              });
              applied.push({
                pendingId: bp.id,
                sessionId: session.id,
                breakpointId: result.id,
              });
              logger.debug(`Applied breakpoint ${bp.id} -> ${result.id}`);
            }
            break;

          case 'exception':
            if (bp.exception) {
              result = await session.setExceptionBreakpoint(bp.exception);
              applied.push({
                pendingId: bp.id,
                sessionId: session.id,
                breakpointId: result.id,
              });
              logger.debug(`Applied exception breakpoint ${bp.id} -> ${result.id}`);
            }
            break;

          case 'call':
            if (bp.functionName) {
              result = await session.setCallBreakpoint(bp.functionName);
              applied.push({
                pendingId: bp.id,
                sessionId: session.id,
                breakpointId: result.id,
              });
              logger.debug(`Applied call breakpoint ${bp.id} -> ${result.id}`);
            }
            break;
        }
      } catch (error) {
        logger.error(`Failed to apply breakpoint ${bp.id}:`, error);
      }
    }

    // Store applied breakpoints for this session
    this.appliedBreakpoints.set(session.id, applied);

    logger.info(`Applied ${applied.length} breakpoints to session ${session.id}`);
    this.emit('breakpointsApplied', session.id, applied);

    return applied;
  }

  /**
   * Get applied breakpoints for a session
   */
  getAppliedBreakpoints(sessionId: string): AppliedBreakpoint[] {
    return this.appliedBreakpoints.get(sessionId) || [];
  }

  /**
   * Clear applied breakpoints for a session (when session ends)
   */
  clearSessionBreakpoints(sessionId: string): void {
    this.appliedBreakpoints.delete(sessionId);
  }

  /**
   * Clear all pending breakpoints
   */
  clearAll(): void {
    this.pendingBreakpoints.clear();
    logger.info('All pending breakpoints cleared');
  }

  /**
   * Export configuration
   */
  exportConfig(): PendingBreakpoint[] {
    return this.getAllPendingBreakpoints();
  }

  /**
   * Import configuration
   */
  importConfig(breakpoints: PendingBreakpoint[]): void {
    for (const bp of breakpoints) {
      this.pendingBreakpoints.set(bp.id, {
        ...bp,
        createdAt: new Date(bp.createdAt),
      });
      // Update counter to avoid ID conflicts
      const num = parseInt(bp.id.replace('pending_', ''), 10);
      if (!isNaN(num) && num >= this.breakpointIdCounter) {
        this.breakpointIdCounter = num + 1;
      }
    }
  }

  get count(): number {
    return this.pendingBreakpoints.size;
  }
}
