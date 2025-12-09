/**
 * Inspection MCP Tools
 * Tools for inspecting variables, stack traces, and evaluating expressions.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionManager } from '../session/manager.js';
import { Property } from '../dbgp/types.js';

// Helper to format property for output
function formatProperty(prop: Property, depth: number = 0): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: prop.name,
    type: prop.type,
  };

  if (prop.classname) result.classname = prop.classname;
  if (prop.value !== undefined) result.value = prop.value;
  if (prop.numchildren !== undefined && prop.numchildren > 0) {
    result.numchildren = prop.numchildren;
  }
  if (prop.constant) result.constant = true;

  // Include nested properties if present and not too deep
  if (prop.properties && prop.properties.length > 0 && depth < 3) {
    result.children = prop.properties.map((p) => formatProperty(p, depth + 1));
  }

  return result;
}

export function registerInspectionTools(
  server: McpServer,
  sessionManager: SessionManager
): void {
  // Get stack trace
  server.tool(
    'get_stack_trace',
    'Get the current call stack showing all function calls leading to the current position',
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

      try {
        const frames = await session.getStackTrace();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  stack: frames.map((frame) => ({
                    level: frame.level,
                    file: frame.filename,
                    line: frame.lineno,
                    where: frame.where || '(main)',
                    type: frame.type,
                  })),
                  depth: frames.length,
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
                error: 'Failed to get stack trace',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Get available contexts
  server.tool(
    'get_contexts',
    'Get available variable contexts (Local, Superglobals, User-defined constants) at the current position',
    {
      stack_depth: z
        .number()
        .int()
        .default(0)
        .describe('Stack frame depth (0 = current frame)'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ stack_depth, session_id }) => {
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
        const contexts = await session.getContexts(stack_depth);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  contexts: contexts.map((ctx) => ({
                    id: ctx.id,
                    name: ctx.name,
                  })),
                  hint: 'Use context_id in get_variables to get variables from a specific context',
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
                error: 'Failed to get contexts',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Get all variables in scope
  server.tool(
    'get_variables',
    'Get all variables at the current execution point. Use context_id to switch between local variables, superglobals, etc.',
    {
      context_id: z
        .number()
        .int()
        .default(0)
        .describe('Context ID: 0=Local variables, 1=Superglobals, 2=User constants'),
      stack_depth: z
        .number()
        .int()
        .default(0)
        .describe('Stack frame depth (0 = current frame)'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ context_id, stack_depth, session_id }) => {
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
        const variables = await session.getVariables(context_id, stack_depth);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  variables: variables.map((v) => formatProperty(v)),
                  count: variables.length,
                  context_id,
                  stack_depth,
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
                error: 'Failed to get variables',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Get a specific variable
  server.tool(
    'get_variable',
    "Get a specific variable by name, including nested properties. Use PHP syntax for nested access (e.g., '$user->name', '$array[0]', '$obj->items[2]->value')",
    {
      name: z
        .string()
        .describe(
          "Variable name with $ prefix (e.g., '$user', '$data[\"key\"]', '$obj->property')"
        ),
      context_id: z.number().int().default(0).describe('Context ID'),
      stack_depth: z.number().int().default(0).describe('Stack frame depth'),
      max_depth: z
        .number()
        .int()
        .default(2)
        .describe('Maximum depth for nested properties'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ name, context_id, stack_depth, max_depth, session_id }) => {
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
        const variable = await session.getVariable(name, {
          contextId: context_id,
          stackDepth: stack_depth,
          maxDepth: max_depth,
        });

        if (!variable) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Variable not found',
                  name,
                  message: `Variable "${name}" does not exist in the current scope`,
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
                  variable: formatProperty(variable),
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
                error: 'Failed to get variable',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Set a variable value
  server.tool(
    'set_variable',
    'Set the value of a variable in the current scope',
    {
      name: z.string().describe('Variable name (e.g., $x, $user->name)'),
      value: z.string().describe('New value as a PHP literal (e.g., 42, "hello", true, null)'),
      context_id: z.number().int().default(0).describe('Context ID'),
      stack_depth: z.number().int().default(0).describe('Stack frame depth'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ name, value, context_id, stack_depth, session_id }) => {
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
        const success = await session.setVariable(name, value, {
          contextId: context_id,
          stackDepth: stack_depth,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success,
                name,
                value,
                message: success
                  ? `Variable ${name} set to ${value}`
                  : 'Failed to set variable',
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to set variable',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Evaluate an expression
  server.tool(
    'evaluate',
    "Evaluate a PHP expression in the current context. Returns the result of the expression. Use for calculations, method calls, or inspecting computed values.",
    {
      expression: z
        .string()
        .describe(
          "PHP expression to evaluate (e.g., '$x + $y', 'count($array)', '$user->getName()', 'array_keys($data)')"
        ),
      stack_depth: z.number().int().default(0).describe('Stack frame depth'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ expression, stack_depth, session_id }) => {
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
        const result = await session.evaluate(expression, stack_depth);

        if (!result) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Evaluation returned no result',
                  expression,
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
                  expression,
                  result: formatProperty(result),
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
                error: 'Evaluation failed',
                expression,
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Get source code
  server.tool(
    'get_source',
    'Get the source code of a file or a specific line range',
    {
      file: z.string().describe('File path to get source from'),
      begin_line: z.number().int().optional().describe('Starting line number'),
      end_line: z.number().int().optional().describe('Ending line number'),
      session_id: z.string().optional().describe('Session ID'),
    },
    async ({ file, begin_line, end_line, session_id }) => {
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
        const source = await session.getSource(file, begin_line, end_line);

        if (source === null) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Failed to get source',
                  file,
                  message: 'File not found or not accessible',
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
                  file,
                  beginLine: begin_line,
                  endLine: end_line,
                  source,
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
                error: 'Failed to get source',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );
}
