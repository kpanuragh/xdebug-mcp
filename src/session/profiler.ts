/**
 * Performance Profiler
 * Tracks memory usage, execution time, and function call statistics.
 */

import { EventEmitter } from 'events';
import { DebugSession } from './session.js';
import { logger } from '../utils/logger.js';

export interface ProfileSnapshot {
  timestamp: Date;
  file: string;
  line: number;
  memoryUsage?: number;
  peakMemoryUsage?: number;
  executionTime?: number;
  functionName?: string;
}

export interface FunctionProfile {
  name: string;
  callCount: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  lastCalledAt?: Date;
}

export interface ProfilingSession {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  snapshots: ProfileSnapshot[];
  functionProfiles: Map<string, FunctionProfile>;
  totalMemorySnapshots: number;
  peakMemoryUsage: number;
}

export class Profiler extends EventEmitter {
  private currentSession: ProfilingSession | null = null;
  private sessionIdCounter: number = 0;
  private lastSnapshotTime: number = 0;

  constructor() {
    super();
  }

  /**
   * Start a new profiling session
   */
  startSession(): ProfilingSession {
    if (this.currentSession && !this.currentSession.endedAt) {
      this.endSession();
    }

    this.currentSession = {
      id: `profile_${++this.sessionIdCounter}`,
      startedAt: new Date(),
      snapshots: [],
      functionProfiles: new Map(),
      totalMemorySnapshots: 0,
      peakMemoryUsage: 0,
    };

    this.lastSnapshotTime = Date.now();
    logger.info(`Profiling session started: ${this.currentSession.id}`);
    return this.currentSession;
  }

  /**
   * End the current profiling session
   */
  endSession(): ProfilingSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endedAt = new Date();
    const session = this.currentSession;
    logger.info(`Profiling session ended: ${session.id}`);
    return session;
  }

  /**
   * Take a snapshot at the current execution point
   */
  async takeSnapshot(
    session: DebugSession,
    functionName?: string
  ): Promise<ProfileSnapshot | null> {
    if (!this.currentSession) return null;

    const now = Date.now();
    const executionTime = now - this.lastSnapshotTime;
    this.lastSnapshotTime = now;

    // Get memory usage via eval
    let memoryUsage: number | undefined;
    let peakMemoryUsage: number | undefined;

    try {
      const memResult = await session.evaluate('memory_get_usage(true)');
      if (memResult?.value) {
        memoryUsage = parseInt(memResult.value, 10);
      }

      const peakResult = await session.evaluate('memory_get_peak_usage(true)');
      if (peakResult?.value) {
        peakMemoryUsage = parseInt(peakResult.value, 10);
      }
    } catch {
      // Memory functions may not be available
    }

    const snapshot: ProfileSnapshot = {
      timestamp: new Date(),
      file: session.currentFile || '',
      line: session.currentLine || 0,
      memoryUsage,
      peakMemoryUsage,
      executionTime,
      functionName,
    };

    this.currentSession.snapshots.push(snapshot);
    this.currentSession.totalMemorySnapshots++;

    if (peakMemoryUsage && peakMemoryUsage > this.currentSession.peakMemoryUsage) {
      this.currentSession.peakMemoryUsage = peakMemoryUsage;
    }

    // Track function profile
    if (functionName) {
      this.recordFunctionCall(functionName, executionTime);
    }

    this.emit('snapshot', snapshot);
    return snapshot;
  }

  /**
   * Record a function call for profiling
   */
  private recordFunctionCall(name: string, executionTime: number): void {
    if (!this.currentSession) return;

    let profile = this.currentSession.functionProfiles.get(name);

    if (!profile) {
      profile = {
        name,
        callCount: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
      };
      this.currentSession.functionProfiles.set(name, profile);
    }

    profile.callCount++;
    profile.totalTime += executionTime;
    profile.avgTime = profile.totalTime / profile.callCount;
    profile.minTime = Math.min(profile.minTime, executionTime);
    profile.maxTime = Math.max(profile.maxTime, executionTime);
    profile.lastCalledAt = new Date();
  }

  /**
   * Get current session statistics
   */
  getStatistics(): {
    sessionId: string | null;
    isActive: boolean;
    duration: number;
    snapshotCount: number;
    peakMemoryUsage: number;
    functionCount: number;
    topFunctions: FunctionProfile[];
  } | null {
    if (!this.currentSession) return null;

    const duration = this.currentSession.endedAt
      ? this.currentSession.endedAt.getTime() - this.currentSession.startedAt.getTime()
      : Date.now() - this.currentSession.startedAt.getTime();

    const functions = Array.from(this.currentSession.functionProfiles.values());
    const topFunctions = functions
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 10);

    return {
      sessionId: this.currentSession.id,
      isActive: !this.currentSession.endedAt,
      duration,
      snapshotCount: this.currentSession.snapshots.length,
      peakMemoryUsage: this.currentSession.peakMemoryUsage,
      functionCount: functions.length,
      topFunctions,
    };
  }

  /**
   * Get memory timeline
   */
  getMemoryTimeline(): Array<{ timestamp: Date; usage: number; peak: number }> {
    if (!this.currentSession) return [];

    return this.currentSession.snapshots
      .filter((s) => s.memoryUsage !== undefined)
      .map((s) => ({
        timestamp: s.timestamp,
        usage: s.memoryUsage!,
        peak: s.peakMemoryUsage || s.memoryUsage!,
      }));
  }

  /**
   * Get function profiles sorted by total time
   */
  getFunctionProfiles(): FunctionProfile[] {
    if (!this.currentSession) return [];

    return Array.from(this.currentSession.functionProfiles.values()).sort(
      (a, b) => b.totalTime - a.totalTime
    );
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Format duration to human readable string
   */
  static formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
    return `${(ms / 60000).toFixed(2)} min`;
  }

  get isActive(): boolean {
    return this.currentSession !== null && !this.currentSession.endedAt;
  }

  get currentSessionId(): string | null {
    return this.currentSession?.id || null;
  }
}
