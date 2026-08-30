/**
 * Execution Control MCP Tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DebugStatus } from '../dbgp/types.js';
import { SessionManager } from '../session/manager.js';
import { DebugSession } from '../session/session.js';
import { logger } from '../utils/logger.js';

interface ExecutionResult {
  status: DebugStatus;
  file?: string;
  line?: number;
}

/**
 * Acknowledge script completion so the PHP process can exit.
 *
 * When a script reaches its end, the engine replies with status "stopping" and
 * waits for the client to acknowledge before shutting down. Without that
 * acknowledgment the PHP process stays alive. The connection handler in index.ts
 * already does this for the initial run command, but the execution tools did not,
 * so any script that finished during continue/step left a hanging PHP process.
 */
async function acknowledgeCompletion(
  session: DebugSession,
  result: ExecutionResult
): Promise<ExecutionResult> {
  if (result.status !== 'stopping') {
    return result;
  }

  logger.info(`Script completed for session ${session.id}, releasing PHP process`);

  try {
    await session.stop();
    logger.debug(`Successfully stopped session ${session.id}`);
  } catch (stopError) {
    logger.error(
      `Failed to acknowledge script completion for session ${session.id}: ${stopError instanceof Error ? stopError.message : String(stopError)}`
    );
    logger.warn(`PHP process may not release cleanly for session ${session.id}`);
    session.close();
  }

  return { ...result, status: 'stopped' };
}

export function registerExecutionTools(
  server: McpServer,
  sessionManager: SessionManager
): void {
  // Continue execution
  server.tool(
    'continue',
    'Continue script execution until the next breakpoint or end of script',
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
        const result = await acknowledgeCompletion(session, await session.run());

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: result.status,
                file: result.file,
                line: result.line,
                message:
                  result.status === 'break'
                    ? `Stopped at ${result.file}:${result.line}`
                    : result.status === 'stopped'
                    ? 'Script execution completed'
                    : `Status: ${result.status}`,
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
                error: 'Execution failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Step into
  server.tool(
    'step_into',
    'Step into the next function call, or to the next line if not a function call. This follows execution into called functions.',
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
        const result = await acknowledgeCompletion(session, await session.stepInto());

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: result.status,
                file: result.file,
                line: result.line,
                message:
                  result.status === 'break'
                    ? `Stepped to ${result.file}:${result.line}`
                    : result.status === 'stopped'
                    ? 'Script execution completed'
                    : `Status: ${result.status}`,
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
                error: 'Step into failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Step over
  server.tool(
    'step_over',
    'Step over to the next line in the current scope. Function calls are executed but not stepped into.',
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
        const result = await acknowledgeCompletion(session, await session.stepOver());

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: result.status,
                file: result.file,
                line: result.line,
                message:
                  result.status === 'break'
                    ? `Stepped to ${result.file}:${result.line}`
                    : result.status === 'stopped'
                    ? 'Script execution completed'
                    : `Status: ${result.status}`,
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
                error: 'Step over failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Step out
  server.tool(
    'step_out',
    'Step out of the current function. Execution continues until the current function returns.',
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
        const result = await acknowledgeCompletion(session, await session.stepOut());

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: result.status,
                file: result.file,
                line: result.line,
                message:
                  result.status === 'break'
                    ? `Stepped out to ${result.file}:${result.line}`
                    : result.status === 'stopped'
                    ? 'Script execution completed'
                    : `Status: ${result.status}`,
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
                error: 'Step out failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Stop execution
  server.tool(
    'stop',
    'Stop the debug session and terminate script execution immediately',
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
        await session.stop();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Debug session stopped',
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
                error: 'Stop failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );

  // Detach from session (let script continue without debugging)
  server.tool(
    'detach',
    'Detach from the debug session and let the script continue running without debugging',
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
        await session.detach();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Detached from debug session. Script will continue running.',
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
                error: 'Detach failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );
}
