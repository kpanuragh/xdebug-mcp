import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../config.js';

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset transport-related env vars
    delete process.env.MCP_TRANSPORT;
    delete process.env.MCP_HTTP_PORT;
    delete process.env.MCP_HTTP_HOST;
    delete process.env.XDEBUG_PORT;
    delete process.env.XDEBUG_HOST;
    delete process.env.LOG_LEVEL;
    delete process.env.DBGP_PROXY_HOST;
    delete process.env.DBGP_PROXY_PORT;
    delete process.env.DBGP_IDEKEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults mcpTransport to stdio', () => {
    const config = loadConfig();
    expect(config.mcpTransport).toBe('stdio');
  });

  it('defaults mcpHttpPort to 3100', () => {
    const config = loadConfig();
    expect(config.mcpHttpPort).toBe(3100);
  });

  it('defaults mcpHttpHost to 127.0.0.1', () => {
    const config = loadConfig();
    expect(config.mcpHttpHost).toBe('127.0.0.1');
  });

  it('parses MCP_TRANSPORT=http', () => {
    process.env.MCP_TRANSPORT = 'http';
    const config = loadConfig();
    expect(config.mcpTransport).toBe('http');
  });

  it('parses MCP_HTTP_PORT override', () => {
    process.env.MCP_HTTP_PORT = '4000';
    const config = loadConfig();
    expect(config.mcpHttpPort).toBe(4000);
  });

  it('parses MCP_HTTP_HOST override', () => {
    process.env.MCP_HTTP_HOST = '0.0.0.0';
    const config = loadConfig();
    expect(config.mcpHttpHost).toBe('0.0.0.0');
  });

  it('throws on invalid MCP_TRANSPORT value', () => {
    process.env.MCP_TRANSPORT = 'websocket';
    expect(() => loadConfig()).toThrow();
  });
});
