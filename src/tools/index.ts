/**
 * MCP Tool Registration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SessionManager } from '../session/manager.js';
import { WatchManager } from '../session/watch-manager.js';
import { LogpointManager } from '../session/logpoint-manager.js';
import { Profiler } from '../session/profiler.js';
import { RequestContextCapture } from '../session/request-context.js';
import { StepFilter } from '../session/step-filter.js';
import { DebugConfigManager } from '../session/debug-config.js';
import { CodeCoverageTracker } from '../session/code-coverage.js';
import { SessionExporter } from '../session/session-export.js';
import { PendingBreakpointsManager } from '../session/pending-breakpoints.js';
import { registerSessionTools } from './session.js';
import { registerBreakpointTools } from './breakpoints.js';
import { registerExecutionTools } from './execution.js';
import { registerInspectionTools } from './inspection.js';
import { registerAdvancedTools, AdvancedToolsContext } from './advanced.js';

export interface ToolsContext {
  sessionManager: SessionManager;
  watchManager: WatchManager;
  logpointManager: LogpointManager;
  profiler: Profiler;
  requestCapture: RequestContextCapture;
  stepFilter: StepFilter;
  configManager: DebugConfigManager;
  coverageTracker: CodeCoverageTracker;
  sessionExporter: SessionExporter;
  pendingBreakpoints: PendingBreakpointsManager;
}

export function createToolsContext(sessionManager: SessionManager): ToolsContext {
  return {
    sessionManager,
    watchManager: new WatchManager(),
    logpointManager: new LogpointManager(),
    profiler: new Profiler(),
    requestCapture: new RequestContextCapture(),
    stepFilter: new StepFilter(),
    configManager: new DebugConfigManager(),
    coverageTracker: new CodeCoverageTracker(),
    sessionExporter: new SessionExporter(),
    pendingBreakpoints: new PendingBreakpointsManager(),
  };
}

export function registerAllTools(
  server: McpServer,
  ctx: ToolsContext
): void {
  // Core debugging tools
  registerSessionTools(server, ctx.sessionManager);
  registerBreakpointTools(server, ctx.sessionManager, ctx.pendingBreakpoints);
  registerExecutionTools(server, ctx.sessionManager);
  registerInspectionTools(server, ctx.sessionManager);

  // Advanced tools
  registerAdvancedTools(server, ctx as AdvancedToolsContext);
}

export { registerSessionTools } from './session.js';
export { registerBreakpointTools } from './breakpoints.js';
export { registerExecutionTools } from './execution.js';
export { registerInspectionTools } from './inspection.js';
export { registerAdvancedTools } from './advanced.js';
