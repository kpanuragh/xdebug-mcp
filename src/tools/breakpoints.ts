/**
 * Breakpoint MCP Tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionManager } from '../session/manager.js';
import { HitCondition } from '../dbgp/types.js';

export function registerBreakpointTools(
  server: McpServer,
  sessionManager: SessionManager
): void {
  // Set a line breakpoint
  server.tool(
    'set_breakpoint',
    'Set a breakpoint in PHP code. Supports line breakpoints and conditional breakpoints with hit counts.',
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

      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'No active debug session',
                message:
                  'Start a PHP script with Xdebug enabled to create a debug session first.',
              }),
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
    'Set a breakpoint that triggers when a specific exception is thrown',
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
    'Set a breakpoint that triggers when a specific function is called',
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
    'Remove a breakpoint by its ID',
    {
      breakpoint_id: z.string().describe('The breakpoint ID to remove'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ breakpoint_id, session_id }) => {
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
    'Update a breakpoint (enable/disable or change hit conditions)',
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
    'List all breakpoints in the current debug session',
    {
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ session_id }) => {
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

      const breakpoints = await session.listBreakpoints();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
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
                count: breakpoints.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
