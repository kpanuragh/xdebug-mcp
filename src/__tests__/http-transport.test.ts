import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SessionManager } from '../session/manager.js';
import { createToolsContext, registerAllTools, ToolsContext } from '../tools/index.js';

/**
 * Collect the full response body from an http.IncomingMessage.
 */
function readResponse(res: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks).toString()));
    res.on('error', reject);
  });
}

/**
 * Send a JSON-RPC request to the MCP HTTP endpoint.
 */
function mcpRequest(
  port: number,
  body: object,
  sessionId?: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data).toString(),
      'Accept': 'application/json, text/event-stream',
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;

    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/mcp', method: 'POST', headers },
      async (res) => {
        const responseBody = await readResponse(res);
        resolve({ status: res.statusCode!, headers: res.headers, body: responseBody });
      },
    );
    req.on('error', reject);
    req.end(data);
  });
}

describe('HTTP transport', () => {
  let server: http.Server;
  let port: number;
  let toolsContext: ToolsContext;
  const httpSessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

  beforeAll(async () => {
    const sessionManager = new SessionManager();
    toolsContext = createToolsContext(sessionManager);

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      if (url.pathname !== '/mcp') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      const body = req.method === 'DELETE' ? undefined : await new Promise<unknown>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch (err) { reject(err); }
        });
        req.on('error', reject);
      });

      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (req.method === 'POST' && !sessionId) {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
        const mcpServer = new McpServer({ name: 'xdebug-mcp', version: '1.0.0' });
        registerAllTools(mcpServer, toolsContext);
        await mcpServer.connect(transport);

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) httpSessions.delete(sid);
        };

        await transport.handleRequest(req, res, body);

        if (transport.sessionId) {
          httpSessions.set(transport.sessionId, { transport, server: mcpServer });
        }
      } else if (sessionId && httpSessions.has(sessionId)) {
        const session = httpSessions.get(sessionId)!;
        await session.transport.handleRequest(req, res, body);
      } else if (req.method === 'DELETE' && sessionId) {
        res.writeHead(204).end();
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request or unknown session' }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const [, { server: s }] of httpSessions) {
      try { await s.close(); } catch { /* ok */ }
    }
    httpSessions.clear();
    server.close();
  });

  it('returns 404 for non-/mcp paths', async () => {
    const res = await new Promise<{ status: number }>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/wrong`, (res) => resolve({ status: res.statusCode! })).on('error', reject);
    });
    expect(res.status).toBe(404);
  });

  it('creates a new session on POST without session ID', async () => {
    const res = await mcpRequest(port, {
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers['mcp-session-id']).toBeDefined();
    expect(res.headers['mcp-session-id']!.length).toBeGreaterThan(0);
  });

  it('routes requests to existing session', async () => {
    // Create session
    const initRes = await mcpRequest(port, {
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    });
    const sessionId = initRes.headers['mcp-session-id'] as string;

    // Send initialized notification
    await mcpRequest(port, { jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);

    // Call list_sessions tool on the existing session
    const toolRes = await mcpRequest(
      port,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 2,
        params: { name: 'list_sessions', arguments: {} },
      },
      sessionId,
    );
    expect(toolRes.status).toBe(200);
  });

  it('returns 400 for unknown session ID', async () => {
    const res = await mcpRequest(
      port,
      { jsonrpc: '2.0', method: 'initialize', id: 1, params: {} },
      'nonexistent-session-id',
    );
    expect(res.status).toBe(400);
  });

  it('two sessions get different IDs but share SessionManager', async () => {
    const res1 = await mcpRequest(port, {
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'client-1', version: '1.0' },
      },
    });

    const res2 = await mcpRequest(port, {
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'client-2', version: '1.0' },
      },
    });

    const sid1 = res1.headers['mcp-session-id'];
    const sid2 = res2.headers['mcp-session-id'];
    expect(sid1).toBeDefined();
    expect(sid2).toBeDefined();
    expect(sid1).not.toBe(sid2);
  });
});
