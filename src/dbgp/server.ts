/**
 * DBGp Server
 * TCP server that listens for incoming Xdebug connections.
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { DbgpConnection } from './connection.js';
import { logger } from '../utils/logger.js';

export interface DbgpServerConfig {
  host: string;
  port: number;
  commandTimeout?: number;
}

export interface DbgpServerEvents {
  connection: (connection: DbgpConnection) => void;
  error: (error: Error) => void;
  listening: (port: number, host: string) => void;
  close: () => void;
}

export class DbgpServer extends EventEmitter {
  private server: net.Server | null = null;
  private connections: Map<string, DbgpConnection> = new Map();
  private config: Required<DbgpServerConfig>;

  constructor(config: DbgpServerConfig) {
    super();
    this.config = {
      host: config.host,
      port: config.port,
      commandTimeout: config.commandTimeout ?? 30000,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
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

      this.server.listen(this.config.port, this.config.host, () => {
        logger.info(`DBGp server listening on ${this.config.host}:${this.config.port}`);
        this.emit('listening', this.config.port, this.config.host);
        resolve();
      });
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

  get address(): { host: string; port: number } | null {
    const addr = this.server?.address();
    if (addr && typeof addr === 'object') {
      return { host: addr.address, port: addr.port };
    }
    return null;
  }
}
