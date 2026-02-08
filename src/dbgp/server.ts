/**
 * DBGp Server
 * TCP server that listens for incoming Xdebug connections.
 */

import * as net from 'net';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { DbgpConnection } from './connection.js';
import { logger } from '../utils/logger.js';

export interface DbgpServerConfig {
  host?: string;
  port?: number;
  socketPath?: string;
  commandTimeout?: number;
}

export interface DbgpServerEvents {
  connection: (connection: DbgpConnection) => void;
  error: (error: Error) => void;
  listening: (address: string) => void;
  close: () => void;
}

export class DbgpServer extends EventEmitter {
  private server: net.Server | null = null;
  private connections: Map<string, DbgpConnection> = new Map();
  private config: DbgpServerConfig & { commandTimeout: number };
  private isUnixSocket: boolean;

  constructor(config: DbgpServerConfig) {
    super();
    this.isUnixSocket = !!config.socketPath;
    this.config = {
      host: config.host,
      port: config.port,
      socketPath: config.socketPath,
      commandTimeout: config.commandTimeout ?? 30000,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up stale socket file if using Unix socket
      if (this.isUnixSocket && this.config.socketPath) {
        try {
          if (fs.existsSync(this.config.socketPath)) {
            fs.unlinkSync(this.config.socketPath);
            logger.debug(`Cleaned up stale socket file: ${this.config.socketPath}`);
          }
        } catch (err) {
          logger.warn(`Failed to clean up socket file: ${err}`);
        }
      }

      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        logger.error('DBGp server error:', err);
        this.emit('error', err);
        reject(err);
      });

      this.server.on('close', () => {
        this.emit('close');
      });

      if (this.isUnixSocket) {
        this.server.listen(this.config.socketPath, () => {
          logger.info(`DBGp server listening on Unix socket: ${this.config.socketPath}`);
          this.emit('listening', `unix://${this.config.socketPath}`);
          resolve();
        });
      } else {
        const host = this.config.host || '0.0.0.0';
        const port = this.config.port || 9003;
        this.server.listen(port, host, () => {
          logger.info(`DBGp server listening on ${host}:${port}`);
          this.emit('listening', `${host}:${port}`);
          resolve();
        });
      }
    });
  }

  private handleConnection(socket: net.Socket): void {
    const connection = new DbgpConnection(socket, this.config.commandTimeout);

    logger.info(`New DBGp connection from ${connection.remoteAddress}`);
    this.connections.set(connection.id, connection);

    connection.on('init', () => {
      this.emit('connection', connection);
    });

    connection.on('close', () => {
      logger.info(`DBGp connection closed: ${connection.id}`);
      this.connections.delete(connection.id);
    });

    connection.on('error', (err) => {
      logger.error(`Connection ${connection.id} error:`, err);
    });
  }

  getConnection(id: string): DbgpConnection | undefined {
    return this.connections.get(id);
  }

  getAllConnections(): DbgpConnection[] {
    return Array.from(this.connections.values());
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  async stop(): Promise<void> {
    // Close all connections
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          // Clean up socket file if using Unix socket
          if (this.isUnixSocket && this.config.socketPath) {
            try {
              if (fs.existsSync(this.config.socketPath)) {
                fs.unlinkSync(this.config.socketPath);
                logger.debug(`Cleaned up socket file: ${this.config.socketPath}`);
              }
            } catch (err) {
              logger.warn(`Failed to clean up socket file: ${err}`);
            }
          }
          logger.info('DBGp server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  get isListening(): boolean {
    return this.server?.listening ?? false;
  }

  get address(): { host: string; port: number } | { path: string } | null {
    const addr = this.server?.address();
    if (addr && typeof addr === 'object') {
      if ('path' in addr) {
        return { path: (addr as { path: string }).path };
      }
      return { host: (addr as { address: string; port: number }).address, port: (addr as { address: string; port: number }).port };
    }
    return null;
  }
}
