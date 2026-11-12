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
    'Prepare the DBGp route before setting pending breakpoints and launching PHP. Call with empty arguments in Codex or Claude Code; other clients can use configured identity metadata or an explicit identifier. One conversation per MCP process: another identity is rejected, and debug state is not isolated within a shared process. On success, use trigger as XDEBUG_TRIGGER and route.proxyHost/route.proxyPort as PHP xdebug.client_host/xdebug.client_port; do not use listenerPort or the proxy control port. If preparation fails, do not launch PHP with this route.',
    {
      identifier: z.string().min(1).optional().describe(
        'Optional stable, unique conversation ID. Omit when the client supplies native identity metadata or Claude Code session environment. Overrides automatic identity; reuse it for this MCP process and never substitute another conversation\'s ID.'
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
