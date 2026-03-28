#!/usr/bin/env node
/**
 * Xdebug MCP Server
 *
 * An MCP server that provides PHP debugging capabilities through Xdebug's DBGp protocol.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { DbgpProxyClient } from './dbgp/proxy.js';
import { DbgpServer } from './dbgp/server.js';
import { SessionManager } from './session/manager.js';
import { registerAllTools, createToolsContext, ToolsContext } from './tools/index.js';
import { logger } from './utils/logger.js';

async function main() {
  const config = loadConfig();
  const proxyConfig = config.proxy;

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
  const dbgpProxyClient = proxyConfig
    ? new DbgpProxyClient({
        host: proxyConfig.host,
        port: proxyConfig.port,
        ideKey: proxyConfig.ideKey,
      })
    : null;

  // Create tools context early so we can access pendingBreakpoints
  const toolsContext: ToolsContext = createToolsContext(sessionManager);

  // Handle new Xdebug connections
  dbgpServer.on('connection', async (connection) => {
    logger.info(`New Xdebug connection: ${connection.id}`);
    logger.info(`  File: ${connection.initPacket?.fileUri}`);
    logger.info(`  IDE Key: ${connection.initPacket?.ideKey}`);

    let session: any = null;

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

  if (dbgpProxyClient && proxyConfig) {
    try {
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

  // Initialize MCP server
  const mcpServer = new McpServer({
    name: 'xdebug-mcp',
    version: '1.0.0',
  });

  // Load saved debug profiles
  try {
    await toolsContext.configManager.loadProfiles();
    logger.info('Loaded debug profiles');
  } catch {
    logger.debug('No saved debug profiles found');
  }

  // Register all debugging tools
  registerAllTools(mcpServer, toolsContext);

  // Connect MCP transport (stdio)
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  logger.info('MCP server connected via stdio');

  // Graceful shutdown
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Shutting down...');
    sessionManager.closeAllSessions();
    if (dbgpProxyClient?.isRegistered && proxyConfig) {
      try {
        await dbgpProxyClient.unregister();
        logger.info(`Removed DBGp proxy registration for IDE key '${proxyConfig?.ideKey}'`);
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

  // Handle stdin close (when parent process like Claude Code exits)
  process.stdin.on('close', () => {
    logger.info('stdin closed, shutting down...');
    shutdown();
  });

  process.stdin.on('end', () => {
    logger.info('stdin ended, shutting down...');
    shutdown();
  });

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
