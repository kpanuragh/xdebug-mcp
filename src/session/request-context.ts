/**
 * Request Context Capture
 * Captures and stores PHP request context ($_GET, $_POST, $_SESSION, etc.)
 */

import { DebugSession } from './session.js';
import { Property } from '../dbgp/types.js';
import { logger } from '../utils/logger.js';

export interface RequestContext {
  capturedAt: Date;
  method?: string;
  uri?: string;
  get: Record<string, unknown>;
  post: Record<string, unknown>;
  session: Record<string, unknown>;
  cookie: Record<string, unknown>;
  server: Record<string, unknown>;
  files: Record<string, unknown>;
  headers: Record<string, string>;
  requestBody?: string;
}

export class RequestContextCapture {
  private lastContext: RequestContext | null = null;

  /**
   * Capture the current request context from a debug session
   */
  async capture(session: DebugSession): Promise<RequestContext> {
    const context: RequestContext = {
      capturedAt: new Date(),
      get: {},
      post: {},
      session: {},
      cookie: {},
      server: {},
      files: {},
      headers: {},
    };

    // Capture superglobals
    const superglobals = [
      { name: '$_GET', target: 'get' },
      { name: '$_POST', target: 'post' },
      { name: '$_SESSION', target: 'session' },
      { name: '$_COOKIE', target: 'cookie' },
      { name: '$_SERVER', target: 'server' },
      { name: '$_FILES', target: 'files' },
    ];

    for (const { name, target } of superglobals) {
      try {
        const result = await session.getVariable(name, { contextId: 1 }); // 1 = superglobals
        if (result) {
          const obj = this.propertyToObject(result);
          if (target === 'get') context.get = obj;
          else if (target === 'post') context.post = obj;
          else if (target === 'session') context.session = obj;
          else if (target === 'cookie') context.cookie = obj;
          else if (target === 'server') context.server = obj;
          else if (target === 'files') context.files = obj;
        }
      } catch {
        logger.debug(`Failed to capture ${name}`);
      }
    }

    // Extract useful server info
    if (context.server) {
      const server = context.server as Record<string, string>;
      context.method = server['REQUEST_METHOD'];
      context.uri = server['REQUEST_URI'];

      // Extract headers from $_SERVER
      for (const [key, value] of Object.entries(server)) {
        if (key.startsWith('HTTP_')) {
          const headerName = key
            .slice(5)
            .toLowerCase()
            .replace(/_/g, '-')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          context.headers[headerName] = String(value);
        }
      }
      if (server['CONTENT_TYPE']) {
        context.headers['Content-Type'] = server['CONTENT_TYPE'];
      }
      if (server['CONTENT_LENGTH']) {
        context.headers['Content-Length'] = server['CONTENT_LENGTH'];
      }
    }

    // Try to capture raw request body
    try {
      const bodyResult = await session.evaluate('file_get_contents("php://input")');
      if (bodyResult?.value) {
        context.requestBody = bodyResult.value;
      }
    } catch {
      // Request body may not be available
    }

    this.lastContext = context;
    return context;
  }

  /**
   * Get the last captured context
   */
  getLastContext(): RequestContext | null {
    return this.lastContext;
  }

  /**
   * Convert a Property to a plain object
   */
  private propertyToObject(prop: Property): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (prop.properties) {
      for (const child of prop.properties) {
        const key = child.name || child.key || '';
        if (child.properties && child.properties.length > 0) {
          result[key] = this.propertyToObject(child);
        } else {
          result[key] = child.value;
        }
      }
    } else if (prop.value !== undefined) {
      return { value: prop.value };
    }

    return result;
  }

  /**
   * Format context as a readable report
   */
  formatReport(context: RequestContext): string {
    const lines: string[] = [];

    lines.push('=== Request Context ===');
    lines.push(`Captured at: ${context.capturedAt.toISOString()}`);
    lines.push(`Method: ${context.method || 'N/A'}`);
    lines.push(`URI: ${context.uri || 'N/A'}`);
    lines.push('');

    if (Object.keys(context.headers).length > 0) {
      lines.push('--- Headers ---');
      for (const [key, value] of Object.entries(context.headers)) {
        lines.push(`  ${key}: ${value}`);
      }
      lines.push('');
    }

    if (Object.keys(context.get).length > 0) {
      lines.push('--- GET Parameters ---');
      lines.push(JSON.stringify(context.get, null, 2));
      lines.push('');
    }

    if (Object.keys(context.post).length > 0) {
      lines.push('--- POST Data ---');
      lines.push(JSON.stringify(context.post, null, 2));
      lines.push('');
    }

    if (context.requestBody) {
      lines.push('--- Request Body ---');
      lines.push(context.requestBody);
      lines.push('');
    }

    if (Object.keys(context.cookie).length > 0) {
      lines.push('--- Cookies ---');
      lines.push(JSON.stringify(context.cookie, null, 2));
      lines.push('');
    }

    if (Object.keys(context.session).length > 0) {
      lines.push('--- Session ---');
      lines.push(JSON.stringify(context.session, null, 2));
      lines.push('');
    }

    if (Object.keys(context.files).length > 0) {
      lines.push('--- Uploaded Files ---');
      lines.push(JSON.stringify(context.files, null, 2));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get simplified context for quick viewing
   */
  getSummary(context: RequestContext): {
    method: string;
    uri: string;
    hasGet: boolean;
    hasPost: boolean;
    hasSession: boolean;
    hasCookies: boolean;
    hasFiles: boolean;
    headerCount: number;
  } {
    return {
      method: context.method || 'N/A',
      uri: context.uri || 'N/A',
      hasGet: Object.keys(context.get).length > 0,
      hasPost: Object.keys(context.post).length > 0,
      hasSession: Object.keys(context.session).length > 0,
      hasCookies: Object.keys(context.cookie).length > 0,
      hasFiles: Object.keys(context.files).length > 0,
      headerCount: Object.keys(context.headers).length,
    };
  }
}
