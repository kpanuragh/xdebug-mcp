/**
 * Breakpoint MCP Tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionManager } from '../session/manager.js';
import { PendingBreakpointsManager } from '../session/pending-breakpoints.js';
import { HitCondition } from '../dbgp/types.js';

export function registerBreakpointTools(
  server: McpServer,
  sessionManager: SessionManager,
  pendingBreakpoints: PendingBreakpointsManager
): void {
  // Set a line breakpoint
  server.tool(
    'set_breakpoint',
    'Set a breakpoint in PHP code. Supports line breakpoints and conditional breakpoints with hit counts. Can be set before a debug session starts - breakpoints will be applied when a session connects.',
    {
      file: z
        .string()
        .describe(
          'Full file path (use container path for Docker, e.g., /var/www/html/index.php)'
        ),
      line: z.number().int().positive().describe('Line number for the breakpoint'),
      condition: z
        .string()
        .optional()
        .describe("Optional PHP condition expression (e.g., '$x > 10' or '$user !== null')"),
      hit_value: z
        .number()
        .int()
        .optional()
        .describe('Hit count value - break after this many hits'),
      hit_condition: z
        .enum(['>=', '==', '%'])
        .optional()
        .describe(
          'Hit condition: >= (break when hits >= value), == (break on exact hit), % (break every N hits)'
        ),
      session_id: z
        .string()
        .optional()
        .describe('Session ID (uses active session if not specified)'),
    },
    async ({ file, line, condition, hit_value, hit_condition, session_id }) => {
      const session = sessionManager.resolveSession(session_id);

      // If no active session, store as pending breakpoint
      if (!session) {
        const pendingBp = pendingBreakpoints.addLineBreakpoint(file, line, {
          condition,
          hitValue: hit_value,
          hitCondition: hit_condition as HitCondition,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  pending: true,
                  message: 'Breakpoint stored as pending - will be applied when a debug session connects',
                  breakpoint: {
                    id: pendingBp.id,
                    type: 'line',
                    file,
                    line,
                    condition: condition || null,
                    hitValue: hit_value || null,
                    hitCondition: hit_condition || null,
                    enabled: pendingBp.enabled,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const breakpoint = await session.setLineBreakpoint(file, line, {
          condition,
          hitValue: hit_value,
          hitCondition: hit_condition as HitCondition,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  breakpoint: {
                    id: breakpoint.id,
                    type: breakpoint.type,
                    file,
                    line,
                    condition: condition || null,
                    hitValue: hit_value || null,
                    hitCondition: hit_condition || null,
                    resolved: breakpoint.resolved,
                    state: breakpoint.state,
                  },
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
                error: 'Failed to set breakpoint',
                message: error instanceof Error ? error.message : String(error),
                file,
                line,
              }),
            },
          ],
        };
      }
    }
  );

  // Set exception breakpoint
  server.tool(
    'set_exception_breakpoint',
    'Set a breakpoint that triggers when a specific exception is thrown. Can be set before a debug session starts.',
    {
      exception: z
        .string()
        .default('*')
        .describe(
          "Exception class name to break on (use '*' for all exceptions, or specific like 'RuntimeException')"
        ),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ exception, session_id }) => {
      const session = sessionManager.resolveSession(session_id);

      // If no active session, store as pending breakpoint
      if (!session) {
        const pendingBp = pendingBreakpoints.addExceptionBreakpoint(exception);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  pending: true,
                  message: 'Exception breakpoint stored as pending - will be applied when a debug session connects',
                  breakpoint: {
                    id: pendingBp.id,
                    type: 'exception',
                    exception,
                    enabled: pendingBp.enabled,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const breakpoint = await session.setExceptionBreakpoint(exception);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  breakpoint: {
                    id: breakpoint.id,
                    type: 'exception',
                    exception,
                    state: breakpoint.state,
                  },
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
                error: 'Failed to set exception breakpoint',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Set call breakpoint (function entry)
  server.tool(
    'set_call_breakpoint',
    'Set a breakpoint that triggers when a specific function is called. Can be set before a debug session starts.',
    {
      function_name: z
        .string()
        .describe(
          "Function name to break on (e.g., 'myFunction' or 'MyClass::myMethod')"
        ),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ function_name, session_id }) => {
      const session = sessionManager.resolveSession(session_id);

      // If no active session, store as pending breakpoint
      if (!session) {
        const pendingBp = pendingBreakpoints.addCallBreakpoint(function_name);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  pending: true,
                  message: 'Call breakpoint stored as pending - will be applied when a debug session connects',
                  breakpoint: {
                    id: pendingBp.id,
                    type: 'call',
                    function: function_name,
                    enabled: pendingBp.enabled,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const breakpoint = await session.setCallBreakpoint(function_name);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  breakpoint: {
                    id: breakpoint.id,
                    type: 'call',
                    function: function_name,
                    state: breakpoint.state,
                  },
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
                error: 'Failed to set call breakpoint',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Remove a breakpoint
  server.tool(
    'remove_breakpoint',
    'Remove a breakpoint by its ID. Works for both active session breakpoints and pending breakpoints.',
    {
      breakpoint_id: z.string().describe('The breakpoint ID to remove (session breakpoint ID or pending_* ID)'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ breakpoint_id, session_id }) => {
      // Check if it's a pending breakpoint
      if (breakpoint_id.startsWith('pending_')) {
        const success = pendingBreakpoints.removeBreakpoint(breakpoint_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success,
                breakpoint_id,
                message: success
                  ? 'Pending breakpoint removed'
                  : 'Failed to remove pending breakpoint (may not exist)',
              }),
            },
          ],
        };
      }

      const session = sessionManager.resolveSession(session_id);

      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'No active debug session' }),
            },
          ],
        };
      }

      const success = await session.removeBreakpoint(breakpoint_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success,
              breakpoint_id,
              message: success
                ? 'Breakpoint removed'
                : 'Failed to remove breakpoint (may not exist)',
            }),
          },
        ],
      };
    }
  );

  // Update breakpoint (enable/disable, change hit conditions)
  server.tool(
    'update_breakpoint',
    'Update a breakpoint (enable/disable or change hit conditions). Works for both active session and pending breakpoints.',
    {
      breakpoint_id: z.string().describe('The breakpoint ID to update'),
      state: z
        .enum(['enabled', 'disabled'])
        .optional()
        .describe('Enable or disable the breakpoint'),
      hit_value: z.number().int().optional().describe('New hit count value'),
      hit_condition: z
        .enum(['>=', '==', '%'])
        .optional()
        .describe('New hit condition'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ breakpoint_id, state, hit_value, hit_condition, session_id }) => {
      // Check if it's a pending breakpoint
      if (breakpoint_id.startsWith('pending_')) {
        const enabled = state === undefined ? undefined : state === 'enabled';
        if (enabled !== undefined) {
          const success = pendingBreakpoints.setBreakpointEnabled(breakpoint_id, enabled);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success,
                  breakpoint_id,
                  updates: { state },
                  message: success
                    ? 'Pending breakpoint updated'
                    : 'Failed to update pending breakpoint (may not exist)',
                }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                breakpoint_id,
                message: 'Only enable/disable is supported for pending breakpoints',
              }),
            },
          ],
        };
      }

      const session = sessionManager.resolveSession(session_id);

      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'No active debug session' }),
            },
          ],
        };
      }

      const success = await session.updateBreakpoint(breakpoint_id, {
        state: state as 'enabled' | 'disabled' | undefined,
        hitValue: hit_value,
        hitCondition: hit_condition as HitCondition | undefined,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success,
              breakpoint_id,
              updates: { state, hit_value, hit_condition },
            }),
          },
        ],
      };
    }
  );

  // List all breakpoints
  server.tool(
    'list_breakpoints',
    'List all breakpoints including both active session breakpoints and pending breakpoints',
    {
      session_id: z.string().optional().describe('Session ID'),
      include_pending: z.boolean().default(true).describe('Include pending breakpoints in the list'),
    },
    async ({ session_id, include_pending }) => {
      const session = sessionManager.resolveSession(session_id);
      const pending = pendingBreakpoints.getAllPendingBreakpoints();

      // If no session, just return pending breakpoints
      if (!session) {
        if (pending.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  message: 'No active debug session and no pending breakpoints',
                  breakpoints: [],
                  pendingBreakpoints: [],
                  totalCount: 0,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'No active debug session - showing pending breakpoints only',
                  breakpoints: [],
                  pendingBreakpoints: pending.map((bp) => ({
                    id: bp.id,
                    type: bp.type,
                    file: bp.file,
                    line: bp.line,
                    condition: bp.condition,
                    hitValue: bp.hitValue,
                    hitCondition: bp.hitCondition,
                    exception: bp.exception,
                    functionName: bp.functionName,
                    enabled: bp.enabled,
                    createdAt: bp.createdAt,
                  })),
                  totalCount: pending.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const breakpoints = await session.listBreakpoints();

      const result: {
        breakpoints: object[];
        pendingBreakpoints?: object[];
        totalCount: number;
      } = {
        breakpoints: breakpoints.map((bp) => ({
          id: bp.id,
          type: bp.type,
          state: bp.state,
          resolved: bp.resolved,
          file: bp.filename,
          line: bp.lineno,
          function: bp.function,
          exception: bp.exception,
          expression: bp.expression,
          hitCount: bp.hitCount,
          hitValue: bp.hitValue,
          hitCondition: bp.hitCondition,
        })),
        totalCount: breakpoints.length,
      };

      if (include_pending && pending.length > 0) {
        result.pendingBreakpoints = pending.map((bp) => ({
          id: bp.id,
          type: bp.type,
          file: bp.file,
          line: bp.line,
          condition: bp.condition,
          hitValue: bp.hitValue,
          hitCondition: bp.hitCondition,
          exception: bp.exception,
          functionName: bp.functionName,
          enabled: bp.enabled,
          createdAt: bp.createdAt,
        }));
        result.totalCount += pending.length;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
