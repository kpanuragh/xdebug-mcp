/**
 * Session Export
 * Export debug sessions as JSON/HTML reports for sharing.
 */

import { DebugSession, SessionState } from './session.js';
import { StackFrame, Property, Breakpoint } from '../dbgp/types.js';
import { RequestContext } from './request-context.js';
import { WatchExpression } from './watch-manager.js';
import { LogEntry } from './logpoint-manager.js';

export interface DebugSnapshot {
  timestamp: Date;
  sessionId: string;
  state: SessionState;
  stackTrace: StackFrame[];
  variables: Record<string, Property>;
  watchValues: Array<{ expression: string; value: Property | null; error?: string }>;
  breakpoints: Breakpoint[];
  requestContext?: RequestContext;
  logEntries?: LogEntry[];
}

export interface ExportedSession {
  exportedAt: Date;
  sessionInfo: {
    id: string;
    startTime: Date;
    endTime?: Date;
    initialFile: string;
    ideKey: string;
  };
  snapshots: DebugSnapshot[];
  summary: {
    totalSnapshots: number;
    filesVisited: string[];
    breakpointsHit: number;
    totalSteps: number;
  };
}

export class SessionExporter {
  private snapshots: DebugSnapshot[] = [];
  private filesVisited: Set<string> = new Set();
  private breakpointsHit: number = 0;
  private totalSteps: number = 0;

  /**
   * Capture a snapshot of the current debug state
   */
  async captureSnapshot(
    session: DebugSession,
    additionalData?: {
      watchValues?: Array<{ expression: string; value: Property | null; error?: string }>;
      requestContext?: RequestContext;
      logEntries?: LogEntry[];
    }
  ): Promise<DebugSnapshot> {
    const state = session.getState();
    let stackTrace: StackFrame[] = [];
    let variables: Record<string, Property> = {};
    let breakpoints: Breakpoint[] = [];

    try {
      stackTrace = await session.getStackTrace();
    } catch {
      // May fail if session is not in break state
    }

    try {
      const vars = await session.getVariables(0, 0);
      for (const v of vars) {
        variables[v.name] = v;
      }
    } catch {
      // May fail
    }

    try {
      breakpoints = await session.listBreakpoints();
    } catch {
      // May fail
    }

    if (state.filename) {
      this.filesVisited.add(state.filename);
    }
    this.totalSteps++;

    const snapshot: DebugSnapshot = {
      timestamp: new Date(),
      sessionId: session.id,
      state,
      stackTrace,
      variables,
      watchValues: additionalData?.watchValues || [],
      breakpoints,
      requestContext: additionalData?.requestContext,
      logEntries: additionalData?.logEntries,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Record a breakpoint hit
   */
  recordBreakpointHit(): void {
    this.breakpointsHit++;
  }

  /**
   * Export session as JSON
   */
  exportAsJson(session: DebugSession): string {
    const exported = this.buildExportedSession(session);
    return JSON.stringify(exported, null, 2);
  }

  /**
   * Export session as HTML report
   */
  exportAsHtml(session: DebugSession): string {
    const exported = this.buildExportedSession(session);
    return this.generateHtmlReport(exported);
  }

  /**
   * Build the exported session object
   */
  private buildExportedSession(session: DebugSession): ExportedSession {
    const initPacket = session.initPacket;

    return {
      exportedAt: new Date(),
      sessionInfo: {
        id: session.id,
        startTime: session.startTime,
        initialFile: initPacket?.fileUri || '',
        ideKey: initPacket?.ideKey || '',
      },
      snapshots: this.snapshots,
      summary: {
        totalSnapshots: this.snapshots.length,
        filesVisited: Array.from(this.filesVisited),
        breakpointsHit: this.breakpointsHit,
        totalSteps: this.totalSteps,
      },
    };
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(exported: ExportedSession): string {
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Debug Session Report - ${exported.sessionInfo.id}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1, h2, h3 { color: #333; }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }
    .summary-item {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      text-align: center;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: #007bff;
    }
    .summary-label {
      color: #666;
      font-size: 14px;
    }
    .snapshot {
      border-left: 4px solid #007bff;
      padding-left: 15px;
      margin: 15px 0;
    }
    .snapshot-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .status {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-break { background: #ffc107; color: #333; }
    .status-running { background: #28a745; color: white; }
    .status-stopped { background: #dc3545; color: white; }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 13px;
    }
    .stack-frame {
      padding: 8px;
      margin: 4px 0;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .stack-frame-current {
      background: #e7f1ff;
      border-left: 3px solid #007bff;
    }
    .variable {
      display: flex;
      justify-content: space-between;
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    .variable-name { font-weight: bold; color: #007bff; }
    .variable-type { color: #666; font-size: 12px; }
    .timestamp { color: #888; font-size: 12px; }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th { background: #f8f9fa; }
  </style>
</head>
<body>
  <h1>Debug Session Report</h1>

  <div class="card">
    <h2>Session Information</h2>
    <table>
      <tr><th>Session ID</th><td>${escapeHtml(exported.sessionInfo.id)}</td></tr>
      <tr><th>Initial File</th><td>${escapeHtml(exported.sessionInfo.initialFile)}</td></tr>
      <tr><th>IDE Key</th><td>${escapeHtml(exported.sessionInfo.ideKey)}</td></tr>
      <tr><th>Start Time</th><td>${exported.sessionInfo.startTime.toISOString()}</td></tr>
      <tr><th>Export Time</th><td>${exported.exportedAt.toISOString()}</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${exported.summary.totalSnapshots}</div>
        <div class="summary-label">Snapshots</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${exported.summary.totalSteps}</div>
        <div class="summary-label">Steps Taken</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${exported.summary.breakpointsHit}</div>
        <div class="summary-label">Breakpoints Hit</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${exported.summary.filesVisited.length}</div>
        <div class="summary-label">Files Visited</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Files Visited</h2>
    <ul>
      ${exported.summary.filesVisited.map((f) => `<li>${escapeHtml(f)}</li>`).join('\n')}
    </ul>
  </div>

  <div class="card">
    <h2>Debug Timeline</h2>
    ${exported.snapshots
      .map(
        (snap, i) => `
      <div class="snapshot">
        <div class="snapshot-header">
          <strong>Snapshot #${i + 1}</strong>
          <span class="status status-${snap.state.status}">${snap.state.status}</span>
          <span class="timestamp">${snap.timestamp.toISOString()}</span>
        </div>
        <p><strong>Location:</strong> ${escapeHtml(snap.state.filename || 'N/A')}:${snap.state.lineno || 'N/A'}</p>

        ${
          snap.stackTrace.length > 0
            ? `
        <h4>Stack Trace</h4>
        ${snap.stackTrace
          .map(
            (frame, fi) => `
          <div class="stack-frame ${fi === 0 ? 'stack-frame-current' : ''}">
            #${frame.level} ${escapeHtml(frame.where || '(main)')} at ${escapeHtml(frame.filename)}:${frame.lineno}
          </div>
        `
          )
          .join('')}
        `
            : ''
        }

        ${
          Object.keys(snap.variables).length > 0
            ? `
        <h4>Variables</h4>
        ${Object.entries(snap.variables)
          .slice(0, 20)
          .map(
            ([name, prop]) => `
          <div class="variable">
            <span class="variable-name">${escapeHtml(name)}</span>
            <span>
              <span class="variable-type">(${escapeHtml(prop.type)})</span>
              ${prop.value ? escapeHtml(String(prop.value).slice(0, 100)) : ''}
            </span>
          </div>
        `
          )
          .join('')}
        `
            : ''
        }
      </div>
    `
      )
      .join('')}
  </div>

  <div class="card">
    <h2>Raw Export Data</h2>
    <pre>${escapeHtml(JSON.stringify(exported, null, 2))}</pre>
  </div>
</body>
</html>`;
  }

  /**
   * Clear all captured data
   */
  reset(): void {
    this.snapshots = [];
    this.filesVisited.clear();
    this.breakpointsHit = 0;
    this.totalSteps = 0;
  }

  get snapshotCount(): number {
    return this.snapshots.length;
  }
}
