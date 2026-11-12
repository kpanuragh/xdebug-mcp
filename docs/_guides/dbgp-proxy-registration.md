---
layout: default
title: DBGp Proxy Registration Guide | Xdebug MCP
description: Configure xdebug-mcp with a DBGp proxy, unique IDE keys, separate callback ports, and multi-agent routing.
permalink: /:collection/:name/
---

# DBGp Proxy Registration Guide

Use this mode when PHP should connect to a DBGp proxy, and the proxy should route matching IDE keys back to `xdebug-mcp`.

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
| `DBGP_IDEKEY` | Conditional | Static IDE key that the proxy should route to this MCP server. Mutually exclusive with `DBGP_IDEKEY_META_KEY`. |
| `DBGP_IDEKEY_META_KEY` | No | MCP request metadata field used by `prepare_debug_route` when no explicit `identifier` is supplied. Defaults to `threadId` in dynamic mode and is mutually exclusive with `DBGP_IDEKEY`. |
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

## Dynamic Registration for Parallel Client Sessions

Dynamic clients can avoid pre-allocating callback ports. Codex and Claude Code supply native session identities automatically; other clients may supply an identifier explicitly:

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "xdebug-mcp",
      "env": {
        "XDEBUG_PORT": "0",
        "XDEBUG_HOST": "127.0.0.1",
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

Codex supplies `threadId` on native MCP tool calls. Claude Code supplies `CLAUDE_CODE_SESSION_ID` to stdio MCP servers. Both can call `prepare_debug_route({})` without an identifier argument. Other clients can pass `identifier` directly or attach a stable string under `DBGP_IDEKEY_META_KEY`.

Claude Code's [environment variable reference](https://code.claude.com/docs/en/env-vars) documents that its MCP subprocess retains the ID from startup: `/clear` does not update it, and `--continue` or `--resume` without an explicit ID may expose an initial startup ID. Restart the MCP server when switching conversations to get a new route identity. Explicit `--resume <session-id>` receives the resumed ID; this was fixed in Claude Code 2.1.163.

For example, `prepare_debug_route({"identifier":"my-session-123"})` uses that identifier in preference to metadata. Identifiers must be unique across live MCP processes and cannot contain whitespace, quotes, backslashes, or null bytes. Each MCP process binds to its first successfully registered identifier; subsequent calls with that identifier reuse the route, while a different identifier is rejected.

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
