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
| `XDEBUG_PORT` | Yes | TCP callback port where `xdebug-mcp` listens for proxied DBGp sessions. Example: `9006`. This is **not** the proxy's client-facing port and must be unique per running `xdebug-mcp` instance. |
| `XDEBUG_HOST` | No | Interface for the local callback listener. Defaults to `0.0.0.0`. |
| `DBGP_PROXY_HOST` | Yes | Hostname or IP address of the DBGp proxy. Example: `127.0.0.1`. |
| `DBGP_PROXY_PORT` | Yes | Port where the DBGp proxy accepts `proxyinit` and `proxystop`. Example: `9001`. |
| `DBGP_IDEKEY` | Yes | IDE key that the proxy should route to this MCP server. Use a value distinct from PhpStorm and every other running agent, for example `warp-mcp`, `claude-mcp`, or `codex-mcp`. |
| `DBGP_PROXY_ALLOW_FALLBACK` | No | When `true` (default), continue in direct-listener mode if proxy registration fails. When `false`, fail startup instead. |

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
        "DBGP_IDEKEY": "warp-mcp",
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
        "DBGP_IDEKEY": "warp-mcp",
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

- Warp: `DBGP_IDEKEY=warp-mcp`, `XDEBUG_PORT=9006`
- Claude Code: `DBGP_IDEKEY=claude-mcp`, `XDEBUG_PORT=9007`
- Codex: `DBGP_IDEKEY=codex-mcp`, `XDEBUG_PORT=9008`

Keep PHP/Xdebug pointed at the proxy's client-facing port, then trigger the target agent using the matching IDE key.

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

- `XDEBUG_TRIGGER=warp-mcp`
- `XDEBUG_TRIGGER=claude-mcp`
- `XDEBUG_TRIGGER=codex-mcp`

You can use the same values with `XDEBUG_SESSION` if that matches your workflow.

## DBGp Proxy Binary / Download

The official Xdebug DBGp proxy documentation, source, and download guidance are here:

- https://xdebug.org/docs/dbgpProxy

Use that page for installation details and the current recommended binary or source distribution method for the proxy.
