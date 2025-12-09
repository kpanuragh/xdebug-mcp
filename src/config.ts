/**
 * Configuration Management
 */

import { z } from 'zod';
import { LogLevel, logger } from './utils/logger.js';

const ConfigSchema = z.object({
  // DBGp server settings
  dbgpPort: z.number().int().positive().default(9003),
  dbgpHost: z.string().default('0.0.0.0'),
  commandTimeout: z.number().int().positive().default(30000),

  // Path mappings for Docker
  pathMappings: z.record(z.string(), z.string()).optional(),

  // Variable inspection limits
  maxDepth: z.number().int().positive().default(3),
  maxChildren: z.number().int().positive().default(128),
  maxData: z.number().int().positive().default(2048),

  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const rawConfig: Record<string, unknown> = {
    dbgpPort: parseInt(process.env.XDEBUG_PORT || '9003', 10),
    dbgpHost: process.env.XDEBUG_HOST || '0.0.0.0',
    commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '30000', 10),
    maxDepth: parseInt(process.env.MAX_DEPTH || '3', 10),
    maxChildren: parseInt(process.env.MAX_CHILDREN || '128', 10),
    maxData: parseInt(process.env.MAX_DATA || '2048', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };

  // Parse path mappings from JSON if provided
  if (process.env.PATH_MAPPINGS) {
    try {
      rawConfig.pathMappings = JSON.parse(process.env.PATH_MAPPINGS);
    } catch {
      logger.warn('Failed to parse PATH_MAPPINGS environment variable');
    }
  }

  const config = ConfigSchema.parse(rawConfig);

  // Apply log level
  logger.setLevel(config.logLevel as LogLevel);

  return config;
}

export function getDefaultConfig(): Config {
  return ConfigSchema.parse({});
}
