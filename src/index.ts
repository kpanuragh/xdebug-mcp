#!/usr/bin/env node
/**
 * Xdebug MCP Server
 *
 * An MCP server that provides PHP debugging capabilities through Xdebug's DBGp protocol.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import { loadConfig } from './config.js';
import { DbgpProxyClient } from './dbgp/proxy.js';
import { DbgpServer } from './dbgp/server.js';
import { SessionManager } from './session/manager.js';
import type { DebugSession } from './session/session.js';
import { registerAllTools, createToolsContext, ToolsContext } from './tools/index.js';
import { logger } from './utils/logger.js';

/**
 * Create a configured MCP server with all debugging tools registered.
 * In HTTP mode this is called once per client session; in stdio mode, once.
 */
function createMcpServer(ctx: ToolsContext): McpServer {
  const server = new McpServer({
    name: 'xdebug-mcp',
    version: '1.0.0',
  });
  registerAllTools(server, ctx);
  return server;
}

/**
 * Collect and JSON-parse the request body from an incoming HTTP request.
 */
function collectBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Start the MCP server and optionally register its DBGp listener with an external proxy.
 */
async function main() {
  const config = loadConfig();
  const proxyIntegration = config.proxy
    ? {
        config: config.proxy,
        // Reuse the server command timeout so proxy control traffic follows the same operator expectation.
        client: new DbgpProxyClient(
          {
            host: config.proxy.host,
            port: config.proxy.port,
            ideKey: config.proxy.ideKey,
          },
          config.commandTimeout
        ),
      }
    : null;

  logger.info('Starting Xdebug MCP Server...');
  logger.debug('Configuration:', config);

  // Initialize components
  const sessionManager = new SessionManager();
  const dbgpServer = new DbgpServer({
    host: config.dbgpHost,
    port: config.dbgpPort,
    socketPath: config.dbgpSocketPath,
    commandTimeout: config.commandTimeout,
  });

  // Create tools context early so we can access pendingBreakpoints
  const toolsContext: ToolsContext = createToolsContext(sessionManager);

  // Handle new Xdebug connections
  dbgpServer.on('connection', async (connection) => {
    logger.info(`New Xdebug connection: ${connection.id}`);
    logger.info(`  File: ${connection.initPacket?.fileUri}`);
    logger.info(`  IDE Key: ${connection.initPacket?.ideKey}`);

    let session: DebugSession | null = null;

    try {
      // === PHASE 1: Session Creation ===
      try {
        session = await sessionManager.createSession(connection);
        logger.info(`Debug session created: ${session.id}`);
      } catch (createError) {
        logger.error(`Failed to create debug session: ${createError instanceof Error ? createError.message : String(createError)}`);
        connection.close();
        return;
      }

      // === PHASE 2: Initialization (Breakpoints) ===
      const pendingCount = toolsContext.pendingBreakpoints.count;
      if (pendingCount > 0) {
        try {
          logger.info(`Applying ${pendingCount} pending breakpoints to session ${session.id}...`);
          const applied = await toolsContext.pendingBreakpoints.applyToSession(session);
          logger.info(`Applied ${applied.length} breakpoints to session ${session.id}`);
        } catch (bpError) {
          logger.error(
            `Failed to apply breakpoints to session ${session.id}: ${bpError instanceof Error ? bpError.message : String(bpError)}`
          );
          logger.warn(`Continuing without breakpoints — execution will run to completion`);
          // Don't close — continue with execution attempt
        }
      }

      // === PHASE 3: Execution Continuation ===
      try {
        // Send 'run' command to continue execution — PHP will break at breakpoints or run to completion
        const result = await session.run();
        logger.debug(`Execution result for session ${session.id}: status=${result.status}`);

        // Handle all possible execution states
        switch (result.status) {
          case 'stopping': {
            // Script finished, engine waiting for client acknowledgment
            logger.info(`Script completed for session ${session.id}, releasing PHP process`);

            try {
              // When script finishes (status=stopping), send stop to release PHP process.
              // DBGp "stopping" state means the script completed but the engine is waiting
              // for client acknowledgment before shutting down.
              await session.stop();
              logger.debug(`Successfully stopped session ${session.id}`);
            } catch (stopError) {
              logger.error(
                `Failed to acknowledge script completion for session ${session.id}: ${stopError instanceof Error ? stopError.message : String(stopError)}`
              );
              logger.warn(`PHP process may not release cleanly for session ${session.id}`);
              session.close();
            }
            break;
          }

          case 'break': {
            logger.info(
              `Execution paused at breakpoint for session ${session.id}: ${result.file}:${result.line}`
            );
            // Session remains active — user can interact via MCP tools (step, inspect, run, etc.)
            break;
          }

          case 'running': {
            logger.warn(`Execution still in progress after run command for session ${session.id}`);
            // Unexpected but not critical — session should eventually complete
            break;
          }

          case 'stopped': {
            logger.info(`Session ${session.id} already in stopped state`);
            session.close();
            break;
          }

          case 'starting': {
            logger.warn(`Session ${session.id} still in starting state after run command`);
            break;
          }

          default: {
            logger.error(`Unknown execution status for session ${session.id}: ${result.status}`);
          }
        }
      } catch (runError) {
        logger.error(
          `Failed to continue execution for session ${session.id}: ${runError instanceof Error ? runError.message : String(runError)}`
        );
        logger.warn(`Debug session ${session.id} may be in an unstable state`);
        session.close();
      }
    } catch (error) {
      // Catch-all for any unexpected errors
      logger.error(
        `Unexpected error in connection handler for session ${session?.id || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`
      );
      if (session) {
        session.close();
      } else {
        connection.close();
      }
    }
  });

  dbgpServer.on('error', (err) => {
    logger.error('DBGp server error:', err);
  });

  // Track session events
  sessionManager.on('sessionEnded', (sessionId) => {
    logger.info(`Session ended: ${sessionId}`);
    // Clear applied breakpoints mapping for this session
    toolsContext.pendingBreakpoints.clearSessionBreakpoints(sessionId);
  });

  // Start DBGp server
  try {
    await dbgpServer.start();
    const address = config.dbgpSocketPath
      ? `Unix socket: ${config.dbgpSocketPath}`
      : `${config.dbgpHost}:${config.dbgpPort}`;
    logger.info(`DBGp server listening on ${address}`);
  } catch (error) {
    logger.error('Failed to start DBGp server:', error);
    process.exit(1);
  }

  if (proxyIntegration) {
    const { client: dbgpProxyClient, config: proxyConfig } = proxyIntegration;
    try {
      // Register only after the TCP listener is live so the proxy never routes sessions to a dead endpoint.
      const registration = await dbgpProxyClient.register(config.dbgpPort, true);
      const proxyTarget = registration.address && registration.port
        ? `${registration.address}:${registration.port}`
        : 'unknown proxy endpoint';
      logger.info(
        `Registered IDE key '${registration.ideKey}' with DBGp proxy ${proxyConfig.host}:${proxyConfig.port} (proxy server: ${proxyTarget})`
      );
    } catch (error) {
      logger.error(
        `Failed to register with DBGp proxy ${proxyConfig.host}:${proxyConfig.port}: ${error instanceof Error ? error.message : String(error)}`
      );

      if (!proxyConfig.allowFallback) {
        await dbgpServer.stop();
        process.exit(1);
      }

      logger.warn('Continuing in direct-listener mode because DBGP_PROXY_ALLOW_FALLBACK is enabled');
    }
  }

  // Load saved debug profiles (shared across all MCP sessions)
  try {
    await toolsContext.configManager.loadProfiles();
    logger.info('Loaded debug profiles');
  } catch {
    logger.debug('No saved debug profiles found');
  }

  // --- MCP Transport ---

  // Track the HTTP server (if any) so shutdown can close it.
  let httpServer: http.Server | undefined;
  const httpSessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

  if (config.mcpTransport === 'http') {
    // HTTP daemon mode: one long-running process, multiple MCP clients connect over HTTP.
    httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      if (url.pathname !== '/mcp') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      try {
        const body = req.method === 'DELETE' ? undefined : await collectBody(req);
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        if (req.method === 'POST' && !sessionId) {
          // New MCP client session
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
          });
          const server = createMcpServer(toolsContext);
          await server.connect(transport);

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) {
              httpSessions.delete(sid);
              logger.info(`MCP HTTP session closed: ${sid}`);
            }
          };

          // handleRequest processes the initialize message and sets transport.sessionId
          await transport.handleRequest(req, res, body);

          if (transport.sessionId) {
            httpSessions.set(transport.sessionId, { transport, server });
            logger.info(`MCP HTTP session created: ${transport.sessionId}`);
          }
        } else if (sessionId && httpSessions.has(sessionId)) {
          // Existing session
          const session = httpSessions.get(sessionId)!;
          await session.transport.handleRequest(req, res, body);
        } else if (req.method === 'DELETE' && sessionId) {
          // Session already cleaned up
          res.writeHead(204).end();
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad request or unknown session' }));
        }
      } catch (error) {
        logger.error('HTTP request error:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    });

    httpServer.listen(config.mcpHttpPort, config.mcpHttpHost, () => {
      logger.info(`MCP HTTP server listening on http://${config.mcpHttpHost}:${config.mcpHttpPort}/mcp`);
    });
  } else {
    // stdio mode (default): one MCP server, one client via stdin/stdout.
    const mcpServer = createMcpServer(toolsContext);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    logger.info('MCP server connected via stdio');
  }

  // Graceful shutdown
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Shutting down...');
    sessionManager.closeAllSessions();

    // Close all MCP HTTP sessions
    if (httpServer) {
      for (const [, { server }] of httpSessions) {
        try { await server.close(); } catch { /* already closing */ }
      }
      httpSessions.clear();
      httpServer.close();
    }

    if (proxyIntegration?.client.isRegistered) {
      const { client: dbgpProxyClient, config: proxyConfig } = proxyIntegration;
      try {
        // Unregister first so the proxy stops routing new sessions while this process is exiting.
        await dbgpProxyClient.unregister();
        logger.info(`Removed DBGp proxy registration for IDE key '${proxyConfig.ideKey}'`);
      } catch (error) {
        logger.warn(
          `Failed to remove DBGp proxy registration: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    await dbgpServer.stop();
    process.exit(0);
  };

  // Handle various shutdown signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);

  // Handle stdin close (when parent process like Claude Code exits) — stdio mode only
  if (config.mcpTransport === 'stdio') {
    process.stdin.on('close', () => {
      logger.info('stdin closed, shutting down...');
      shutdown();
    });

    process.stdin.on('end', () => {
      logger.info('stdin ended, shutting down...');
      shutdown();
    });
  }

  // Handle uncaught errors gracefully
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception:', error);
    await shutdown();
  });

  process.on('unhandledRejection', async (reason) => {
    logger.error('Unhandled rejection:', reason);
    await shutdown();
  });

  // Keep the process alive
  logger.info('Xdebug MCP Server is ready');
  const waitMsg = config.dbgpSocketPath
    ? `Waiting for Xdebug connections on ${config.dbgpSocketPath}...`
    : `Waiting for Xdebug connections on port ${config.dbgpPort}...`;
  logger.info(waitMsg);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
