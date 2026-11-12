/**
 * Dynamic DBGp proxy route MCP tool.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export interface DebugRoute {
  ideKey: string;
  listenerHost: string;
  listenerPort: number;
  proxyHost: string;
  proxyPort: number;
}

export function registerRoutingTools(
  server: McpServer,
  prepare: (
    identifier: string | undefined,
    meta: Record<string, unknown> | undefined
  ) => Promise<DebugRoute>
): void {
  server.tool(
    'prepare_debug_route',
    'Prepare this MCP client\'s DBGp proxy route. Codex and Claude Code supply their session identity automatically; other clients can pass an identifier. Call before starting PHP.',
    {
      identifier: z.string().min(1).optional().describe(
        'Optional identity override for clients without a native session ID. Omit this property in Codex and Claude Code to use their automatic identity.'
      ),
    },
    async ({ identifier }, extra) => {
      try {
        const route = await prepare(identifier, extra._meta);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  route,
                  trigger: route.ideKey,
                  message: `Start PHP with XDEBUG_TRIGGER=${route.ideKey}, xdebug.client_host=${route.proxyHost}, and xdebug.client_port=${route.proxyPort}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Failed to prepare debug route',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );
}
