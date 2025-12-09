/**
 * Session Management MCP Tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionManager } from '../session/manager.js';

export function registerSessionTools(
  server: McpServer,
  sessionManager: SessionManager
): void {
  // List all active debug sessions
  server.tool(
    'list_sessions',
    'List all active PHP debug sessions with their current state',
    {},
    async () => {
      const sessions = sessionManager.getAllSessions();
      const activeId = sessionManager.getActiveSessionId();

      const sessionData = sessions.map((s) => {
        const state = s.getState();
        return {
          id: s.id,
          active: s.id === activeId,
          status: state.status,
          file: s.initPacket?.fileUri || 'unknown',
          currentFile: state.filename,
          currentLine: state.lineno,
          ideKey: s.initPacket?.ideKey || 'unknown',
          language: s.initPacket?.language || 'PHP',
          startTime: state.startTime.toISOString(),
        };
      });

      if (sessionData.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  sessions: [],
                  message:
                    'No active debug sessions. Start a PHP script with Xdebug enabled to begin debugging.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sessions: sessionData, count: sessionData.length }, null, 2),
          },
        ],
      };
    }
  );

  // Get detailed session state
  server.tool(
    'get_session_state',
    'Get detailed state of a specific debug session including current position and status',
    {
      session_id: z
        .string()
        .optional()
        .describe('Session ID (uses active session if not specified)'),
    },
    async ({ session_id }) => {
      const session = sessionManager.resolveSession(session_id);

      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'No session found',
                message: session_id
                  ? `Session "${session_id}" not found`
                  : 'No active debug session. Start a PHP script with Xdebug enabled.',
              }),
            },
          ],
        };
      }

      const state = session.getState();
      const initPacket = session.initPacket;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: session.id,
                status: state.status,
                currentFile: state.filename,
                currentLine: state.lineno,
                startTime: state.startTime.toISOString(),
                init: initPacket
                  ? {
                      fileUri: initPacket.fileUri,
                      ideKey: initPacket.ideKey,
                      language: initPacket.language,
                      protocolVersion: initPacket.protocolVersion,
                      engine: initPacket.engine,
                    }
                  : null,
                isConnected: session.isConnected,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Set active session
  server.tool(
    'set_active_session',
    'Set which debug session should be the active/default session for subsequent commands',
    {
      session_id: z.string().describe('Session ID to set as active'),
    },
    async ({ session_id }) => {
      const success = sessionManager.setActiveSession(session_id);

      if (!success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Session not found',
                session_id,
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
              success: true,
              message: `Session "${session_id}" is now active`,
            }),
          },
        ],
      };
    }
  );

  // Close a session
  server.tool(
    'close_session',
    'Close and terminate a debug session',
    {
      session_id: z
        .string()
        .optional()
        .describe('Session ID to close (uses active session if not specified)'),
    },
    async ({ session_id }) => {
      const session = sessionManager.resolveSession(session_id);

      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'No session found',
                message: session_id
                  ? `Session "${session_id}" not found`
                  : 'No active debug session',
              }),
            },
          ],
        };
      }

      const closedId = session.id;
      sessionManager.closeSession(closedId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Session "${closedId}" closed`,
            }),
          },
        ],
      };
    }
  );
}
