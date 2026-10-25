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
import type { DebugSession } from './session/session.js';
import {
  registerAllTools,
  createToolsContext,
  registerRoutingTools,
  ToolsContext,
} from './tools/index.js';
import { logger } from './utils/logger.js';

/**
 * Start the MCP server and optionally register its DBGp listener with an external proxy.
 */
async function main() {
  const config = loadConfig();
  const proxyConfig = config.proxy;
  let dbgpProxyClient: DbgpProxyClient | null = null;
  let registeredIdeKey: string | null = null;
  let registrationPromise: Promise<void> | null = null;

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
            // Script finished, engine waiting for client acknowledgment before it
            // shuts down — same handling the execution tools use.
            await session.acknowledgeCompletion(result);
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
    const address = dbgpServer.address;
    const addressText = address && 'path' in address
      ? `Unix socket: ${address.path}`
      : address
        ? `${address.host}:${address.port}`
        : 'unknown';
    logger.info(`DBGp server listening on ${addressText}`);
  } catch (error) {
    logger.error('Failed to start DBGp server:', error);
    process.exit(1);
  }

  const listenerAddress = dbgpServer.address;
  const listenerPort = listenerAddress && 'port' in listenerAddress
    ? listenerAddress.port
    : null;

  const ensureProxyRegistration = async (ideKey: string): Promise<void> => {
    if (!proxyConfig || listenerPort === null) {
      throw new Error('Dynamic routing requires a TCP listener and DBGp proxy configuration.');
    }
    if (registeredIdeKey && registeredIdeKey !== ideKey) {
      throw new Error(
        `This MCP process is already registered as '${registeredIdeKey}' and cannot switch to '${ideKey}'.`
      );
    }
    if (dbgpProxyClient?.isRegistered) {
      return;
    }
    if (registrationPromise) {
      return registrationPromise;
    }

    registeredIdeKey = ideKey;
    registrationPromise = (async () => {
      const client = new DbgpProxyClient(
        {
          host: proxyConfig.host,
          port: proxyConfig.port,
          ideKey,
        },
        config.commandTimeout
      );
      const registration = await client.register(listenerPort, true);
      dbgpProxyClient = client;
      const proxyTarget = registration.address && registration.port
        ? `${registration.address}:${registration.port}`
        : 'unknown proxy endpoint';
      logger.info(
        `Registered IDE key '${registration.ideKey}' with DBGp proxy ${proxyConfig.host}:${proxyConfig.port} (proxy server: ${proxyTarget})`
      );
    })();

    try {
      await registrationPromise;
    } catch (error) {
      dbgpProxyClient = null;
      registeredIdeKey = null;
      throw error;
    } finally {
      registrationPromise = null;
    }
  };

  if (proxyConfig?.ideKey) {
    try {
      await ensureProxyRegistration(proxyConfig.ideKey);
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
  if (proxyConfig?.ideKeyMetaKey) {
    registerRoutingTools(mcpServer, async (explicitIdentifier, meta) => {
      const identity = explicitIdentifier ?? meta?.[proxyConfig.ideKeyMetaKey!];
      if (typeof identity !== 'string' || identity.length === 0) {
        throw new Error(
          `Pass a non-empty identifier or provide MCP metadata '${proxyConfig.ideKeyMetaKey}'.`
        );
      }

      const ideKey = `${proxyConfig.ideKeyPrefix}${identity}`;
      await ensureProxyRegistration(ideKey);
      if (listenerPort === null) {
        throw new Error('DBGp listener did not expose a TCP port.');
      }

      return {
        ideKey,
        listenerHost: config.dbgpHost,
        listenerPort,
        proxyHost: proxyConfig.host,
        proxyPort: proxyConfig.port,
      };
    });
  }

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
        // Unregister first so the proxy stops routing new sessions while this process is exiting.
        await dbgpProxyClient.unregister();
        logger.info(`Removed DBGp proxy registration for IDE key '${registeredIdeKey}'`);
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
    : listenerPort === null
      ? 'Waiting for Xdebug connections...'
      : `Waiting for Xdebug connections on port ${listenerPort}...`;
  logger.info(waitMsg);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
