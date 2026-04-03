/**
 * Configuration Management
 */

import { z } from 'zod';
import { logger } from './utils/logger.js';

const PathMappingsSchema = z.record(z.string(), z.string());
const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
const ProxyIdeKeySchema = z.string().min(1).refine(
  (value) => !/[\0\s"\\]/.test(value),
  'DBGP_IDEKEY must not contain spaces, quotes, backslashes, or null bytes because the reference DBGp proxy does not parse escaped arguments.'
);

const ProxyConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  ideKey: ProxyIdeKeySchema,
  allowFallback: z.boolean().default(true),
});

const TransportSchema = z.enum(['stdio', 'http']);

const ConfigSchema = z.object({
  // DBGp server settings
  dbgpPort: z.number().int().positive().default(9003),
  dbgpHost: z.string().default('0.0.0.0'),
  dbgpSocketPath: z.string().optional(),
  commandTimeout: z.number().int().positive().default(30000),
  proxy: ProxyConfigSchema.optional(),

  // MCP transport settings
  mcpTransport: TransportSchema.default('stdio'),
  mcpHttpPort: z.number().int().positive().default(3100),
  mcpHttpHost: z.string().default('127.0.0.1'),

  // Path mappings for Docker
  pathMappings: z.record(z.string(), z.string()).optional(),

  // Variable inspection limits
  maxDepth: z.number().int().positive().default(3),
  maxChildren: z.number().int().positive().default(128),
  maxData: z.number().int().positive().default(2048),

  // Logging
  logLevel: LogLevelSchema.default('info'),
});

/**
 * Runtime configuration resolved from environment variables and validated with Zod.
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load the process configuration and fail fast when the environment is inconsistent.
 */
export function loadConfig(): Config {
  const rawConfig: z.input<typeof ConfigSchema> = {
    dbgpPort: parseInt(process.env.XDEBUG_PORT || '9003', 10),
    dbgpHost: process.env.XDEBUG_HOST || '0.0.0.0',
    commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '30000', 10),
    mcpTransport: TransportSchema.parse(process.env.MCP_TRANSPORT || 'stdio'),
    mcpHttpPort: parseInt(process.env.MCP_HTTP_PORT || '3100', 10),
    mcpHttpHost: process.env.MCP_HTTP_HOST || '127.0.0.1',
    maxDepth: parseInt(process.env.MAX_DEPTH || '3', 10),
    maxChildren: parseInt(process.env.MAX_CHILDREN || '128', 10),
    maxData: parseInt(process.env.MAX_DATA || '2048', 10),
    logLevel: LogLevelSchema.parse(process.env.LOG_LEVEL || 'info'),
  };

  // Add socket path if provided
  if (process.env.XDEBUG_SOCKET_PATH) {
    rawConfig.dbgpSocketPath = process.env.XDEBUG_SOCKET_PATH;
  }

  const proxyHost = process.env.DBGP_PROXY_HOST;
  const proxyPort = process.env.DBGP_PROXY_PORT;
  const proxyIdeKey = process.env.DBGP_IDEKEY;

  if (proxyHost || proxyPort || proxyIdeKey) {
    // Require the full proxy tuple together so startup never lands in a half-configured mode.
    if (!proxyHost || !proxyPort || !proxyIdeKey) {
      throw new Error(
        'DBGp proxy configuration is incomplete. Set DBGP_PROXY_HOST, DBGP_PROXY_PORT, and DBGP_IDEKEY together.'
      );
    }

    // Proxy registration needs a reachable TCP listener, so Unix socket mode must stay disabled here.
    if (process.env.XDEBUG_SOCKET_PATH) {
      throw new Error(
        'DBGp proxy registration requires TCP listener mode. Remove XDEBUG_SOCKET_PATH when using DBGP proxy registration.'
      );
    }

    rawConfig.proxy = ProxyConfigSchema.parse({
      host: proxyHost,
      port: parseInt(proxyPort, 10),
      ideKey: proxyIdeKey,
      allowFallback: process.env.DBGP_PROXY_ALLOW_FALLBACK !== 'false',
    });
  }

  // Parse path mappings from JSON if provided
  if (process.env.PATH_MAPPINGS) {
    try {
      rawConfig.pathMappings = PathMappingsSchema.parse(JSON.parse(process.env.PATH_MAPPINGS));
    } catch {
      logger.warn('Failed to parse PATH_MAPPINGS environment variable');
    }
  }

  const config = ConfigSchema.parse(rawConfig);

  // Apply log level
  logger.setLevel(config.logLevel);

  return config;
}

/**
 * Return the schema defaults without reading from the process environment.
 */
export function getDefaultConfig(): Config {
  return ConfigSchema.parse({});
}
