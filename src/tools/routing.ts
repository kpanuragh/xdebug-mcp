/**
 * Dynamic DBGp proxy route MCP tool.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface DebugRoute {
  ideKey: string;
  listenerHost: string;
  listenerPort: number;
  proxyHost: string;
  proxyPort: number;
}

export function registerRoutingTools(
  server: McpServer,
  prepare: (meta: Record<string, unknown> | undefined) => Promise<DebugRoute>
): void {
  server.tool(
    'prepare_debug_route',
    'Prepare this MCP client\'s DBGp proxy route using identity metadata supplied by the client. Call before starting PHP.',
    {},
    async (_args, extra) => {
      try {
        const route = await prepare(extra._meta);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  route,
                  trigger: route.ideKey,
                  message: `Start PHP with XDEBUG_TRIGGER=${route.ideKey}`,
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
