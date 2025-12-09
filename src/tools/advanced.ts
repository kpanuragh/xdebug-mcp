/**
 * Advanced Debugging MCP Tools
 * Watch expressions, logpoints, profiling, coverage, and more.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionManager } from '../session/manager.js';
import { WatchManager } from '../session/watch-manager.js';
import { LogpointManager } from '../session/logpoint-manager.js';
import { Profiler } from '../session/profiler.js';
import { RequestContextCapture } from '../session/request-context.js';
import { StepFilter } from '../session/step-filter.js';
import { DebugConfigManager } from '../session/debug-config.js';
import { CodeCoverageTracker } from '../session/code-coverage.js';
import { SessionExporter } from '../session/session-export.js';

export interface AdvancedToolsContext {
  sessionManager: SessionManager;
  watchManager: WatchManager;
  logpointManager: LogpointManager;
  profiler: Profiler;
  requestCapture: RequestContextCapture;
  stepFilter: StepFilter;
  configManager: DebugConfigManager;
  coverageTracker: CodeCoverageTracker;
  sessionExporter: SessionExporter;
}

export function registerAdvancedTools(
  server: McpServer,
  ctx: AdvancedToolsContext
): void {
  // ============ Watch Expressions ============

  server.tool(
    'add_watch',
    'Add a watch expression that will be evaluated on each break. Watch expressions persist across steps.',
    {
      expression: z.string().describe("PHP expression to watch (e.g., '$user->id', 'count($items)')"),
    },
    async ({ expression }) => {
      const watch = ctx.watchManager.addWatch(expression);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              watch: {
                id: watch.id,
                expression: watch.expression,
              },
            }),
          },
        ],
      };
    }
  );

  server.tool(
    'remove_watch',
    'Remove a watch expression',
    {
      watch_id: z.string().describe('Watch ID to remove'),
    },
    async ({ watch_id }) => {
      const success = ctx.watchManager.removeWatch(watch_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success, watch_id }),
          },
        ],
      };
    }
  );

  server.tool(
    'evaluate_watches',
    'Evaluate all watch expressions and return their current values',
    {
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ session_id }) => {
      const session = ctx.sessionManager.resolveSession(session_id);
      if (!session) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'No active session' }) }],
        };
      }

      const results = await ctx.watchManager.evaluateAll(session);
      const changedWatches = results.filter((r) => r.hasChanged);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                watches: results.map((r) => ({
                  id: r.id,
                  expression: r.expression,
                  value: r.value,
                  hasChanged: r.hasChanged,
                  error: r.error,
                })),
                changedCount: changedWatches.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'list_watches',
    'List all active watch expressions',
    {},
    async () => {
      const watches = ctx.watchManager.getAllWatches();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                watches: watches.map((w) => ({
                  id: w.id,
                  expression: w.expression,
                  lastValue: w.lastValue,
                  hasChanged: w.hasChanged,
                  evaluationCount: w.evaluationCount,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ============ Logpoints ============

  server.tool(
    'add_logpoint',
    'Add a logpoint that logs messages without stopping execution. Use {varName} placeholders for variables.',
    {
      file: z.string().describe('File path'),
      line: z.number().int().describe('Line number'),
      message: z.string().describe("Message template with {var} placeholders (e.g., 'User {$userId} logged in')"),
      condition: z.string().optional().describe('Optional condition'),
    },
    async ({ file, line, message, condition }) => {
      const logpoint = ctx.logpointManager.createLogpoint(file, line, message, condition);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              logpoint: {
                id: logpoint.id,
                file,
                line,
                message,
                condition,
              },
            }),
          },
        ],
      };
    }
  );

  server.tool(
    'remove_logpoint',
    'Remove a logpoint',
    {
      logpoint_id: z.string().describe('Logpoint ID'),
    },
    async ({ logpoint_id }) => {
      const success = ctx.logpointManager.removeLogpoint(logpoint_id);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success, logpoint_id }) }],
      };
    }
  );

  server.tool(
    'get_logpoint_history',
    'Get the log output history from logpoints',
    {
      logpoint_id: z.string().optional().describe('Specific logpoint ID (all if not specified)'),
      limit: z.number().int().default(50).describe('Maximum entries to return'),
    },
    async ({ logpoint_id, limit }) => {
      if (logpoint_id) {
        const history = ctx.logpointManager.getLogHistory(logpoint_id, limit);
        return {
          content: [{ type: 'text', text: JSON.stringify({ logpoint_id, history }, null, 2) }],
        };
      }

      const stats = ctx.logpointManager.getStatistics();
      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  // ============ Profiling ============

  server.tool(
    'start_profiling',
    'Start profiling to track memory usage and execution time',
    {},
    async () => {
      const session = ctx.profiler.startSession();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessionId: session.id,
              message: 'Profiling started. Use step commands to collect data.',
            }),
          },
        ],
      };
    }
  );

  server.tool(
    'stop_profiling',
    'Stop profiling and get the results',
    {},
    async () => {
      const session = ctx.profiler.endSession();
      if (!session) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'No active profiling session' }) }],
        };
      }

      const stats = ctx.profiler.getStatistics();
      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  server.tool(
    'get_profile_stats',
    'Get current profiling statistics',
    {},
    async () => {
      const stats = ctx.profiler.getStatistics();
      if (!stats) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'No profiling data. Start profiling first.' }) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  server.tool(
    'get_memory_timeline',
    'Get memory usage timeline from profiling',
    {},
    async () => {
      const timeline = ctx.profiler.getMemoryTimeline();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                timeline: timeline.map((t) => ({
                  timestamp: t.timestamp,
                  usage: Profiler.formatBytes(t.usage),
                  peak: Profiler.formatBytes(t.peak),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ============ Request Context ============

  server.tool(
    'capture_request_context',
    'Capture the current HTTP request context ($_GET, $_POST, $_SESSION, $_COOKIE, headers)',
    {
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ session_id }) => {
      const session = ctx.sessionManager.resolveSession(session_id);
      if (!session) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'No active session' }) }],
        };
      }

      try {
        const context = await ctx.requestCapture.capture(session);
        const summary = ctx.requestCapture.getSummary(context);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  summary,
                  headers: context.headers,
                  get: context.get,
                  post: context.post,
                  cookies: context.cookie,
                  session: context.session,
                  requestBody: context.requestBody,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to capture request context',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // ============ Step Filters ============

  server.tool(
    'add_step_filter',
    'Add a step filter to skip certain files/directories during stepping (e.g., vendor code)',
    {
      pattern: z.string().describe("Pattern to match (e.g., '/vendor/', '*.min.js', '/regex/')"),
      type: z.enum(['include', 'exclude']).describe('include = step into, exclude = skip'),
      description: z.string().optional().describe('Description of the filter'),
    },
    async ({ pattern, type, description }) => {
      const rule = ctx.stepFilter.addRule(pattern, type, description);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, rule }) }],
      };
    }
  );

  server.tool(
    'list_step_filters',
    'List all step filter rules',
    {},
    async () => {
      const rules = ctx.stepFilter.getAllRules();
      return {
        content: [{ type: 'text', text: JSON.stringify({ rules }, null, 2) }],
      };
    }
  );

  server.tool(
    'get_function_history',
    'Get the history of function calls made during debugging',
    {
      limit: z.number().int().default(50).describe('Maximum entries'),
      search: z.string().optional().describe('Search query to filter'),
    },
    async ({ limit, search }) => {
      let history = search
        ? ctx.stepFilter.searchHistory(search)
        : ctx.stepFilter.getFunctionHistory(limit);

      if (limit && history.length > limit) {
        history = history.slice(-limit);
      }

      const stats = ctx.stepFilter.getCallStatistics();
      const topCalls = Array.from(stats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                history,
                topFunctions: topCalls.map(([name, stat]) => ({
                  name,
                  count: stat.count,
                  lastCall: stat.lastCall,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ============ Code Coverage ============

  server.tool(
    'start_coverage',
    'Start tracking code coverage during debugging',
    {},
    async () => {
      const report = ctx.coverageTracker.startTracking();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Code coverage tracking started',
            }),
          },
        ],
      };
    }
  );

  server.tool(
    'stop_coverage',
    'Stop tracking code coverage and get the report',
    {},
    async () => {
      ctx.coverageTracker.stopTracking();
      const summary = ctx.coverageTracker.getSummary();
      const report = ctx.coverageTracker.generateReport();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ summary, report }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'get_coverage_report',
    'Get the current code coverage report',
    {},
    async () => {
      const summary = ctx.coverageTracker.getSummary();
      const hotSpots = ctx.coverageTracker.getHotSpots(10);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ summary, hotSpots }, null, 2),
          },
        ],
      };
    }
  );

  // ============ Debug Profiles ============

  server.tool(
    'save_debug_profile',
    'Save the current debug configuration (breakpoints, watches, filters) as a named profile',
    {
      name: z.string().describe('Profile name'),
      description: z.string().optional().describe('Profile description'),
    },
    async ({ name, description }) => {
      const session = ctx.sessionManager.getActiveSession();

      // Create profile with current settings
      const profile = ctx.configManager.createProfile(name, description);

      // Add current breakpoints
      if (session) {
        const breakpoints = await session.listBreakpoints();
        profile.breakpoints = breakpoints.map((bp) => ({
          file: bp.filename || '',
          line: bp.lineno || 0,
          condition: bp.expression,
          enabled: bp.state === 'enabled',
        }));
      }

      // Add watches
      profile.watchExpressions = ctx.watchManager.getAllWatches().map((w) => w.expression);

      // Add step filters
      profile.stepFilters = ctx.stepFilter.getAllRules().map((r) => ({
        pattern: r.pattern,
        type: r.type,
        enabled: r.enabled,
      }));

      // Add logpoints
      profile.logpoints = ctx.logpointManager.getAllLogpoints().map((lp) => ({
        file: lp.file,
        line: lp.line,
        message: lp.message,
        condition: lp.condition,
      }));

      await ctx.configManager.saveAllProfiles();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              profile: {
                name: profile.name,
                breakpoints: profile.breakpoints.length,
                watches: profile.watchExpressions.length,
                filters: profile.stepFilters.length,
                logpoints: profile.logpoints.length,
              },
            }),
          },
        ],
      };
    }
  );

  server.tool(
    'load_debug_profile',
    'Load a saved debug profile',
    {
      name: z.string().describe('Profile name to load'),
    },
    async ({ name }) => {
      const profile = ctx.configManager.getProfile(name);
      if (!profile) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Profile not found: ${name}` }) }],
        };
      }

      // Clear current settings
      ctx.watchManager.clearAllWatches();

      // Load watches
      for (const expr of profile.watchExpressions) {
        ctx.watchManager.addWatch(expr);
      }

      // Load step filters
      ctx.stepFilter.importConfig(profile.stepFilters);

      // Load logpoints
      for (const lp of profile.logpoints) {
        ctx.logpointManager.createLogpoint(lp.file, lp.line, lp.message, lp.condition);
      }

      ctx.configManager.setActiveProfile(name);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              loaded: {
                name: profile.name,
                breakpoints: profile.breakpoints.length,
                watches: profile.watchExpressions.length,
                filters: profile.stepFilters.length,
                logpoints: profile.logpoints.length,
              },
              note: 'Breakpoints need to be set manually using set_breakpoint for each entry',
            }),
          },
        ],
      };
    }
  );

  server.tool(
    'list_debug_profiles',
    'List all saved debug profiles',
    {},
    async () => {
      await ctx.configManager.loadProfiles();
      const profiles = ctx.configManager.getAllProfiles();
      const activeProfile = ctx.configManager.getActiveProfile();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                activeProfile: activeProfile?.name || null,
                profiles: profiles.map((p) => ({
                  name: p.name,
                  description: p.description,
                  breakpoints: p.breakpoints.length,
                  watches: p.watchExpressions.length,
                  createdAt: p.createdAt,
                  updatedAt: p.updatedAt,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ============ Export ============

  server.tool(
    'export_session',
    'Export the current debug session as a report',
    {
      format: z.enum(['json', 'html']).default('json').describe('Export format'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ format, session_id }) => {
      const session = ctx.sessionManager.resolveSession(session_id);
      if (!session) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'No active session' }) }],
        };
      }

      // Capture final snapshot
      const watchResults = await ctx.watchManager.evaluateAll(session);
      await ctx.sessionExporter.captureSnapshot(session, {
        watchValues: watchResults,
      });

      const exported =
        format === 'html'
          ? ctx.sessionExporter.exportAsHtml(session)
          : ctx.sessionExporter.exportAsJson(session);

      return {
        content: [
          {
            type: 'text',
            text:
              format === 'html'
                ? JSON.stringify({
                    format: 'html',
                    content: exported,
                    note: 'Save this content to a .html file to view the report',
                  })
                : exported,
          },
        ],
      };
    }
  );

  server.tool(
    'capture_snapshot',
    'Capture a snapshot of the current debug state for the export report',
    {
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ session_id }) => {
      const session = ctx.sessionManager.resolveSession(session_id);
      if (!session) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'No active session' }) }],
        };
      }

      const watchResults = await ctx.watchManager.evaluateAll(session);
      const snapshot = await ctx.sessionExporter.captureSnapshot(session, {
        watchValues: watchResults,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              snapshotCount: ctx.sessionExporter.snapshotCount,
              currentState: snapshot.state,
            }),
          },
        ],
      };
    }
  );
}
