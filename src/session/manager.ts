/**
 * Session Manager
 * Manages multiple concurrent PHP debug sessions.
 */

import { EventEmitter } from 'events';
import { DbgpConnection } from '../dbgp/connection.js';
import { DebugSession, SessionState } from './session.js';
import { logger } from '../utils/logger.js';

export interface SessionManagerEvents {
  sessionCreated: (session: DebugSession) => void;
  sessionEnded: (sessionId: string) => void;
  sessionStateChange: (sessionId: string, state: SessionState) => void;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, DebugSession> = new Map();
  private activeSessionId: string | null = null;

  constructor() {
    super();
  }

  async createSession(connection: DbgpConnection): Promise<DebugSession> {
    const session = new DebugSession(connection);

    // Initialize the session (negotiate features)
    await session.initialize();

    this.sessions.set(session.id, session);

    // Track state changes
    session.on('stateChange', (state: SessionState) => {
      this.emit('sessionStateChange', session.id, state);

      // Auto-select as active if it's in break state and no active session
      if (state.status === 'break' && !this.activeSessionId) {
        this.activeSessionId = session.id;
      }
    });

    // Handle session close
    session.on('close', () => {
      this.sessions.delete(session.id);
      if (this.activeSessionId === session.id) {
        this.activeSessionId = null;
        // Select another session if available
        const next = this.sessions.values().next().value;
        if (next) {
          this.activeSessionId = next.id;
        }
      }
      this.emit('sessionEnded', session.id);
      logger.info(`Session ended: ${session.id}`);
    });

    // Set as active if it's the first session
    if (!this.activeSessionId) {
      this.activeSessionId = session.id;
    }

    this.emit('sessionCreated', session);
    logger.info(`Session created: ${session.id}`);

    return session;
  }

  getSession(id: string): DebugSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionStates(): SessionState[] {
    return this.getAllSessions().map((s) => s.getState());
  }

  getActiveSession(): DebugSession | undefined {
    if (this.activeSessionId) {
      return this.sessions.get(this.activeSessionId);
    }

    // Return first session in 'break' state, or first available
    for (const session of this.sessions.values()) {
      if (session.status === 'break') {
        this.activeSessionId = session.id;
        return session;
      }
    }

    // Return first available session
    const first = this.sessions.values().next().value;
    if (first) {
      this.activeSessionId = first.id;
    }
    return first;
  }

  setActiveSession(id: string): boolean {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      return true;
    }
    return false;
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get a session by ID or return the active session if no ID provided.
   * This is the primary method for tools to get a session.
   */
  resolveSession(sessionId?: string): DebugSession | undefined {
    if (sessionId) {
      return this.getSession(sessionId);
    }
    return this.getActiveSession();
  }

  closeSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (session) {
      session.close();
      // The 'close' event handler will remove it from the map
      return true;
    }
    return false;
  }

  closeAllSessions(): void {
    for (const session of this.sessions.values()) {
      session.close();
    }
    // The 'close' event handlers will clear the map
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  hasActiveSessions(): boolean {
    return this.sessions.size > 0;
  }

  /**
   * Find sessions by file being debugged
   */
  findSessionsByFile(filename: string): DebugSession[] {
    const normalized = filename.toLowerCase();
    return this.getAllSessions().filter((session) => {
      const initFile = session.initPacket?.fileUri?.toLowerCase() || '';
      const currentFile = session.currentFile?.toLowerCase() || '';
      return initFile.includes(normalized) || currentFile.includes(normalized);
    });
  }

  /**
   * Find sessions by IDE key
   */
  findSessionsByIdeKey(ideKey: string): DebugSession[] {
    return this.getAllSessions().filter(
      (session) => session.initPacket?.ideKey === ideKey
    );
  }
}
