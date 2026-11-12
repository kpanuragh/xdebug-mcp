---
layout: default
title: DBGp Proxy Registration Guide | Xdebug MCP
description: Configure xdebug-mcp with a DBGp proxy, unique IDE keys, separate callback ports, and multi-agent routing.
permalink: /:collection/:name/
---

# DBGp Proxy Registration Guide

Use this mode when PHP should connect to a DBGp proxy, and the proxy should route matching IDE keys back to `xdebug-mcp`.

Proxy setup is optional. If you use one agent session and the default direct listener works, keep it: no proxy, identity configuration, or `prepare_debug_route` call is required. Existing static proxy registration also works without dynamic routing.

## The Parallel-Session Problem

With Xdebug MCP configured to start automatically in each Codex or Claude Code session:

1. Open session A: Xdebug MCP starts and reserves the configured port.
2. Leave A open and start session B: its Xdebug MCP server fails to start because A already holds that port.
3. Open more sessions: each hits the same conflict, even if A has never started debugging.

For automatic per-conversation routing, opt into dynamic routing, install a DBGp proxy, and configure PHP to connect to that proxy. Each conversation gets its own MCP process, callback port, and IDE key. The shared proxy delivers a PHP request only to the route matching its key. This is about concurrent agent sessions, not concurrent tool calls within one conversation. Manually assigning distinct listener ports remains an alternative.

## When to Use This

Choose DBGp proxy registration when:

- you already run a shared DBGp proxy for PhpStorm or another IDE
- you want multiple AI agents to coexist without fighting over one Xdebug port
- PHP should keep connecting to the proxy, while each `xdebug-mcp` instance listens on its own callback port

If you just want a single local debugging listener, stay with the default direct TCP setup in [`mcp-config.example.json`](../../mcp-config.example.json).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `XDEBUG_PORT` | Yes | TCP callback port where `xdebug-mcp` listens for proxied DBGp sessions. Use `0` for an OS-assigned port with metadata-derived registration. This is **not** the proxy's client-facing port. |
| `XDEBUG_HOST` | No | Interface for the local callback listener. Defaults to `0.0.0.0`. |
| `DBGP_PROXY_HOST` | Yes | Hostname or IP address of the DBGp proxy. Example: `127.0.0.1`. |
| `DBGP_PROXY_PORT` | Yes | Port where the DBGp proxy accepts `proxyinit` and `proxystop`. Example: `9001`. |
| `DBGP_PROXY_SERVER_PORT` | No | Port where the proxy accepts PHP/Xdebug connections. Defaults to `9003`. |
| `DBGP_DYNAMIC_ROUTING` | No | Set to `true` to opt into session-based registration and expose `prepare_debug_route`. Defaults to `false`. Requires a proxy and no static `DBGP_IDEKEY`. |
| `DBGP_IDEKEY` | In static mode | Static IDE key that the proxy should route to this MCP server. Cannot be combined with `DBGP_DYNAMIC_ROUTING=true`. |
| `DBGP_IDEKEY_META_KEY` | No | MCP request metadata field used by `prepare_debug_route` when no explicit `identifier` is supplied. Defaults to `threadId` when `DBGP_DYNAMIC_ROUTING=true`; setting it without that opt-in is an error. |
| `DBGP_IDEKEY_PREFIX` | No | Prefix added to a dynamic IDE key. |
| `DBGP_PROXY_ALLOW_FALLBACK` | No | When `true` (default), continue in direct-listener mode if static startup registration fails. When `false`, fail startup instead. Dynamic registration failures are returned by `prepare_debug_route`. |

Important constraints:

- `XDEBUG_SOCKET_PATH` cannot be used together with DBGp proxy registration.
- `XDEBUG_PORT` is the callback listener for `xdebug-mcp`. PHP/Xdebug should still connect to the proxy's client-facing port.
- Use a dedicated IDE key for each `xdebug-mcp` instance. Do not reuse the same IDE key as PhpStorm or another agent.
- Keep `DBGP_IDEKEY` simple: no spaces, quotes, or backslashes. The reference `dbgpProxy` implementation does not parse escaped argument values.
- If you need separate registrations for multiple AI agents, do not place `xdebug-mcp` behind an MCP proxy or bundler. Register it directly in each agent's MCP configuration.

## MCP Configuration Examples

Start from [`mcp-config.proxy.example.json`](../../mcp-config.proxy.example.json) if you want a copyable proxy-mode example.

**Installed package:**

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "xdebug-mcp",
      "env": {
        "XDEBUG_PORT": "9006",
        "XDEBUG_HOST": "0.0.0.0",
        "DBGP_PROXY_HOST": "127.0.0.1",
        "DBGP_PROXY_PORT": "9001",
        "DBGP_PROXY_SERVER_PORT": "9003",
        "DBGP_IDEKEY": "xdebug-warp",
        "DBGP_PROXY_ALLOW_FALLBACK": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Using `npx`:**

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "npx",
      "args": ["-y", "xdebug-mcp"],
      "env": {
        "XDEBUG_PORT": "9006",
        "XDEBUG_HOST": "0.0.0.0",
        "DBGP_PROXY_HOST": "127.0.0.1",
        "DBGP_PROXY_PORT": "9001",
        "DBGP_IDEKEY": "xdebug-warp",
        "DBGP_PROXY_ALLOW_FALLBACK": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Multiple AI Agents

If you run more than one AI agent against the same DBGp proxy, each agent must start its own `xdebug-mcp` process directly and use unique registration values.

Suggested values:

- Warp: `DBGP_IDEKEY=xdebug-warp`, `XDEBUG_PORT=9006`
- Claude Code: `DBGP_IDEKEY=xdebug-claude`, `XDEBUG_PORT=9007`
- Codex: `DBGP_IDEKEY=xdebug-codex`, `XDEBUG_PORT=9008`

Keep PHP/Xdebug pointed at the proxy's client-facing port, then trigger the target agent using the matching IDE key.

## Optional Dynamic Registration for Parallel Client Sessions

Dynamic routing is disabled by default. Enable it explicitly with `DBGP_DYNAMIC_ROUTING=true` only when you want per-conversation proxy routes. Install and start the proxy separately, configure the ports below, and point PHP at the proxy's debugger-facing port. Without this opt-in, the route-preparation tool is not exposed and native client IDs impose no new requirement on ordinary debugging.

Once enabled, dynamic clients can avoid pre-allocating callback ports. Codex and Claude Code supply native session identities automatically; other clients may supply an identifier explicitly:

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "xdebug-mcp",
      "env": {
        "XDEBUG_PORT": "0",
        "XDEBUG_HOST": "127.0.0.1",
        "DBGP_DYNAMIC_ROUTING": "true",
        "DBGP_PROXY_HOST": "127.0.0.1",
        "DBGP_PROXY_PORT": "9001",
        "DBGP_IDEKEY_PREFIX": "xdebug-",
        "DBGP_PROXY_ALLOW_FALLBACK": "false"
      }
    }
  }
}
```

1. The MCP server binds an OS-assigned callback port and exposes tools without registering a route.
2. The client calls `prepare_debug_route`, optionally with an explicit `identifier` string.
3. The tool uses the explicit identifier, configured request metadata, or Claude Code session environment variable (in that order) and registers the actual callback port.
4. The tool returns the configured proxy debugger endpoint (`DBGP_PROXY_HOST:DBGP_PROXY_SERVER_PORT`) and IDE key.
5. PHP connects to that endpoint using the returned IDE key as `XDEBUG_TRIGGER`.
6. Process shutdown removes the proxy registration.

### Client Compatibility and Connection Lifetime

Each conversation must own a separate `xdebug-mcp` process. The external DBGp proxy can be shared, but breakpoint state and debug sessions inside an MCP process are not separated by conversation metadata. The first successful route preparation pins that process to one identity. Another call with the same identity reuses the route; a different identity is rejected. This still allows multiple PHP debug sessions within one conversation.

Do not assume that registering a stdio server gives every conversation a separate process. Check the client's MCP connection lifetime, especially in hosts that reuse connections across conversations or directories. Disabling an optional connection pool does not necessarily create a process per conversation.

#### Codex and Claude Code

Codex supplies `threadId` on native MCP tool calls. Claude Code supplies `CLAUDE_CODE_SESSION_ID` to stdio MCP servers. Both can call `prepare_debug_route({})` without an identifier argument. Native tool calls and real PHP breakpoint/inspection/continue workflows have been tested with both clients.

Claude Code's [environment variable reference](https://code.claude.com/docs/en/env-vars) documents that its MCP subprocess retains the ID from startup: `/clear` does not update it, and `--continue` or `--resume` without an explicit ID may expose an initial startup ID. Restart Claude Code when switching conversations if a fresh route identity is required. Explicit `--resume <session-id>` receives the resumed ID; this was fixed in Claude Code 2.1.163.

#### OpenCode

OpenCode's [MCP context documentation](https://opencode.ai/docs/mcp-servers#context) describes `_meta["ai.opencode/sessionID"]`. In the local MCP server's `environment` configuration, add:

```json
{
  "DBGP_IDEKEY_META_KEY": "ai.opencode/sessionID",
  "DBGP_IDEKEY_PREFIX": "xdebug-opencode-"
}
```

Keep the other dynamic proxy settings shown above. The agent can then call `prepare_debug_route({})`; the existing metadata-field setting reads the session ID without an explicit argument. This is a configuration example based on OpenCode's documentation, not a verified native OpenCode integration.

OpenCode documents [MCP connections per directory and optional sharing across directories](https://opencode.ai/docs/mcp-servers#shared-connections). That does not establish a separate MCP process per conversation. If different conversations use the same `xdebug-mcp` process, the second identity will be rejected. Use a deployment that actually gives each conversation its own MCP process. Supporting different identities within one shared process would require separate route listeners, breakpoint state, and debug-session managers, which this mode does not implement.

#### Other MCP Clients and Explicit Identifiers

If a client supplies a stable string in request `_meta`, set `DBGP_IDEKEY_META_KEY` to that exact field name. Otherwise pass `identifier` explicitly. Identity sources are considered in this order:

1. The tool's explicit `identifier` argument.
2. The configured request metadata field (default `threadId`).
3. The native `CLAUDE_CODE_SESSION_ID` environment variable.

Missing or invalid identities return a tool error. The server does not invent a random conversation ID. An explicit identifier is a fallback for clients without native identity support, not a way to switch an already prepared process to another conversation.

For example, `prepare_debug_route({"identifier":"my-session-123"})` uses that identifier in preference to metadata. Identifiers must be unique across live MCP processes and cannot contain whitespace, quotes, backslashes, or null bytes. Each MCP process binds to its first successfully registered identifier; subsequent calls with that identifier reuse the route, while a different identifier is rejected.

### Agent Workflow

1. Call `prepare_debug_route({})` when native identity is available. Otherwise supply a stable, unique `identifier` once and reuse it for that MCP process. Do not pass literal `"{}"` as an identifier.
2. Check for a successful result before launching PHP. Use `set_breakpoint` to store pending breakpoints.
3. Set PHP's `xdebug.client_host` to `route.proxyHost`, `xdebug.client_port` to `route.proxyPort`, and `XDEBUG_TRIGGER` to `trigger`. The OS-assigned `route.listenerPort` is the proxy's callback endpoint; `DBGP_PROXY_PORT` is the registration control port. Neither is the PHP-facing proxy port.
4. Trigger PHP, inspect the paused session with the debugging tools, and continue or stop execution when finished.
5. If preparation reports that the process is already registered under another identity, reconnect using a separate MCP process for the new conversation. Do not work around the error by borrowing another conversation's identifier or skipping preparation.

## How Registration Works

1. `xdebug-mcp` starts its local TCP listener on `XDEBUG_HOST:XDEBUG_PORT`.
2. If `DBGP_PROXY_HOST`, `DBGP_PROXY_PORT`, and `DBGP_IDEKEY` are present, it opens a control connection to the DBGp proxy.
3. It sends `proxyinit -p <XDEBUG_PORT> -k <DBGP_IDEKEY> -m 1`.
4. The proxy stores that registration and routes matching IDE-key sessions back to `xdebug-mcp`.
5. On shutdown, `xdebug-mcp` sends `proxystop -k <DBGP_IDEKEY>`.

Depending on your environment, registration can add a small startup delay, so give the MCP server a moment to finish booting before expecting the proxy to route sessions to it.

## PHP/Xdebug Side in Proxy Mode

When using a DBGp proxy, PHP should point to the proxy, not directly to `xdebug-mcp`:

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug
xdebug.start_with_request=trigger
xdebug.client_host=127.0.0.1
xdebug.client_port=9003
```

Then trigger the request with the IDE key registered for `xdebug-mcp`, for example:

- `XDEBUG_TRIGGER=xdebug-warp`
- `XDEBUG_TRIGGER=xdebug-claude`
- `XDEBUG_TRIGGER=xdebug-codex`

You can use the same values with `XDEBUG_SESSION` if that matches your workflow.

## DBGp Proxy Binary / Download

The official Xdebug DBGp proxy documentation, source, and download guidance are here:

- https://xdebug.org/docs/dbgpProxy

Use that page for installation details and the current recommended binary or source distribution method for the proxy.
