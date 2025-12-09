#!/usr/bin/env node
/**
 * Xdebug MCP Server
 *
 * An MCP server that provides PHP debugging capabilities through Xdebug's DBGp protocol.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { DbgpServer } from './dbgp/server.js';
import { SessionManager } from './session/manager.js';
import { registerAllTools, createToolsContext, ToolsContext } from './tools/index.js';
import { logger } from './utils/logger.js';

async function main() {
  const config = loadConfig();

  logger.info('Starting Xdebug MCP Server...');
  logger.debug('Configuration:', config);

  // Initialize components
  const sessionManager = new SessionManager();
  const dbgpServer = new DbgpServer({
    host: config.dbgpHost,
    port: config.dbgpPort,
    commandTimeout: config.commandTimeout,
  });

  // Create tools context early so we can access pendingBreakpoints
  const toolsContext: ToolsContext = createToolsContext(sessionManager);

  // Handle new Xdebug connections
  dbgpServer.on('connection', async (connection) => {
    logger.info(`New Xdebug connection: ${connection.id}`);
    logger.info(`  File: ${connection.initPacket?.fileUri}`);
    logger.info(`  IDE Key: ${connection.initPacket?.ideKey}`);

    try {
      const session = await sessionManager.createSession(connection);
      logger.info(`Debug session created: ${session.id}`);

      // Apply pending breakpoints to the new session
      const pendingCount = toolsContext.pendingBreakpoints.count;
      if (pendingCount > 0) {
        logger.info(`Applying ${pendingCount} pending breakpoints to session ${session.id}...`);
        const applied = await toolsContext.pendingBreakpoints.applyToSession(session);
        logger.info(`Applied ${applied.length} breakpoints to session ${session.id}`);
      }
    } catch (error) {
      logger.error('Failed to create session:', error);
      connection.close();
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
    logger.info(`DBGp server listening on ${config.dbgpHost}:${config.dbgpPort}`);
  } catch (error) {
    logger.error('Failed to start DBGp server:', error);
    process.exit(1);
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
  const shutdown = async () => {
    logger.info('Shutting down...');
    sessionManager.closeAllSessions();
    await dbgpServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive
  logger.info('Xdebug MCP Server is ready');
  logger.info(`Waiting for Xdebug connections on port ${config.dbgpPort}...`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
