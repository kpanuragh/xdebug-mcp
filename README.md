# Xdebug MCP Server

[![npm version](https://badge.fury.io/js/xdebug-mcp.svg)](https://www.npmjs.com/package/xdebug-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that provides PHP debugging capabilities through Xdebug's DBGp protocol. This allows AI assistants like Claude to directly debug PHP applications.

## Features

### Core Debugging
- **Full Debug Control**: Step into, step over, step out, continue, stop
- **Breakpoints**: Line breakpoints, conditional breakpoints, exception breakpoints, function call breakpoints
- **Variable Inspection**: View all variables, get specific variables, set variable values
- **Expression Evaluation**: Evaluate PHP expressions in the current context
- **Stack Traces**: View the full call stack
- **Multiple Sessions**: Debug multiple PHP scripts simultaneously
- **Docker Support**: Works with PHP running in Docker containers

### Advanced Features
- **Watch Expressions**: Persistent watches that auto-evaluate on each break with change detection
- **Logpoints**: Log messages without stopping execution using `{$var}` placeholders
- **Memory Profiling**: Track memory usage and execution time between breakpoints
- **Code Coverage**: Track which lines were executed during debugging
- **Request Context**: Capture `$_GET`, `$_POST`, `$_SESSION`, `$_COOKIE`, headers automatically
- **Step Filters**: Skip vendor/library code during stepping
- **Debug Profiles**: Save and restore breakpoint configurations
- **Session Export**: Export debug sessions as JSON or HTML reports

## Installation

### From npm (Recommended)

```bash
npm install -g xdebug-mcp
```

### From Source

```bash
git clone https://github.com/kpanuragh/xdebug-mcp.git
cd xdebug-mcp
npm install
npm run build
```

## MCP Server Configuration

### For Claude Code

Add the xdebug-mcp server to your MCP configuration (`.mcp.json` or Claude settings):

**Using npm global install:**

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "xdebug-mcp",
      "env": {
        "XDEBUG_PORT": "9003",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Using npx:**

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "npx",
      "args": ["-y", "xdebug-mcp"],
      "env": {
        "XDEBUG_PORT": "9003",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### With Path Mappings (for Docker)

When debugging PHP in Docker containers, you need path mappings to translate container paths to host paths:

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "xdebug-mcp",
      "env": {
        "XDEBUG_PORT": "9003",
        "PATH_MAPPINGS": "{\"/var/www/html\": \"/home/user/projects/myapp\"}",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### With DBGp Proxy Registration

If you already use a DBGp proxy, keep [`mcp-config.example.json`](./mcp-config.example.json) as the default direct-listener example and start from [`mcp-config.proxy.example.json`](./mcp-config.proxy.example.json) for proxy registration.

Proxy mode requires:
- TCP listener mode for `xdebug-mcp` (not `XDEBUG_SOCKET_PATH`)
- a unique callback port such as `9006`, `9007`, or `9008` for `XDEBUG_PORT`
- `DBGP_PROXY_HOST`, `DBGP_PROXY_PORT`, and `DBGP_IDEKEY`

See the [DBGp Proxy Registration Guide](./docs/_guides/dbgp-proxy-registration.md) for the full setup, multi-agent examples, and PHP/Xdebug proxy configuration.

## PHP/Xdebug Configuration

### php.ini (or xdebug.ini)

```ini
[xdebug]
zend_extension=xdebug

; Enable step debugging
xdebug.mode=debug

; Start debugging on every request
xdebug.start_with_request=yes

; Host where MCP server is running
; For Docker: use host.docker.internal
; For local PHP: use 127.0.0.1
xdebug.client_host=host.docker.internal

; Port where MCP server listens
xdebug.client_port=9003

; IDE key (optional, for filtering)
xdebug.idekey=mcp
```

### Docker Compose

```yaml
version: '3.8'

services:
  php:
    image: php:8.2-apache
    volumes:
      - ./src:/var/www/html
      - ./xdebug.ini:/usr/local/etc/php/conf.d/99-xdebug.ini
    extra_hosts:
      - "host.docker.internal:host-gateway"  # Required for Linux
    environment:
      - XDEBUG_MODE=debug
      - XDEBUG_CONFIG=client_host=host.docker.internal client_port=9003
```

### Using Unix Domain Sockets

For improved performance and simplified setup on local systems, you can use Unix domain sockets instead of TCP. Unix sockets eliminate network stack overhead and are ideal for debugging on the same machine.

**Benefits:**
- ⚡ Lower latency (no TCP/IP stack overhead)
- 🔒 Better security (file permissions instead of port binding)
- 📦 Simpler setup (no port management)
- 🚀 Faster communication for local debugging

**MCP Configuration (Unix Socket):**

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "xdebug-mcp",
      "env": {
        "XDEBUG_SOCKET_PATH": "/tmp/xdebug.sock",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**PHP/Xdebug Configuration:**

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug
xdebug.start_with_request=yes
xdebug.client_host=unix:///tmp/xdebug.sock
```

**Socket File Permissions:**

The socket file is created with default permissions. To restrict access, you can:

```bash
# After MCP server starts
chmod 600 /tmp/xdebug.sock

# Or use a secure directory
mkdir -p ~/.xdebug && chmod 700 ~/.xdebug
# Then set XDEBUG_SOCKET_PATH=$HOME/.xdebug/xdebug.sock
```

**Automatic Cleanup:**

When `XDEBUG_SOCKET_PATH` is set, the server will:
- Listen on the specified Unix socket instead of TCP port
- Automatically clean up stale socket files on startup (prevents "address in use" errors)
- Automatically clean up socket files on shutdown
- Use the same debugging tools and features as TCP mode

**When to Use Unix Sockets:**
- ✅ Local PHP development (best performance)
- ✅ Same-machine debugging
- ✅ High-frequency breakpoint hits
- ❌ Remote debugging (use TCP instead)

*Unix socket support requested in [Issue #1](https://github.com/kpanuragh/xdebug-mcp/issues/1) by [@dkd-kaehm](https://github.com/dkd-kaehm)*

## Available MCP Tools (41 Total)

### Session Management

| Tool | Description |
|------|-------------|
| `list_sessions` | List all active debug sessions |
| `get_session_state` | Get detailed state of a session |
| `set_active_session` | Set which session is active |
| `close_session` | Close a debug session |

### Breakpoints

| Tool | Description |
|------|-------------|
| `set_breakpoint` | Set a line or conditional breakpoint (supports pending breakpoints) |
| `set_exception_breakpoint` | Break on exceptions (supports pending breakpoints) |
| `set_call_breakpoint` | Break on function calls (supports pending breakpoints) |
| `remove_breakpoint` | Remove a breakpoint (works with pending breakpoints) |
| `update_breakpoint` | Enable/disable or modify a breakpoint |
| `list_breakpoints` | List all breakpoints including pending |

**Pending Breakpoints**: You can set breakpoints before a debug session starts. These are stored as "pending breakpoints" and automatically applied when a PHP script connects with Xdebug. This is useful for setting up breakpoints before triggering a page load or script execution.

### Execution Control

| Tool | Description |
|------|-------------|
| `continue` | Continue to next breakpoint |
| `step_into` | Step into function calls |
| `step_over` | Step over (skip function internals) |
| `step_out` | Step out of current function |
| `stop` | Stop debugging |
| `detach` | Detach and let script continue |

### Inspection

| Tool | Description |
|------|-------------|
| `get_stack_trace` | Get the call stack |
| `get_contexts` | Get available variable contexts |
| `get_variables` | Get all variables in scope |
| `get_variable` | Get a specific variable |
| `set_variable` | Set a variable's value |
| `evaluate` | Evaluate a PHP expression |
| `get_source` | Get source code |

### Watch Expressions

| Tool | Description |
|------|-------------|
| `add_watch` | Add a persistent watch expression |
| `remove_watch` | Remove a watch expression |
| `evaluate_watches` | Evaluate all watches and detect changes |
| `list_watches` | List all active watches |

### Logpoints

| Tool | Description |
|------|-------------|
| `add_logpoint` | Add a logpoint with message template |
| `remove_logpoint` | Remove a logpoint |
| `get_logpoint_history` | View log output and hit statistics |

### Profiling

| Tool | Description |
|------|-------------|
| `start_profiling` | Start memory/time profiling |
| `stop_profiling` | Stop profiling and get results |
| `get_profile_stats` | Get current profiling statistics |
| `get_memory_timeline` | View memory usage over time |

### Code Coverage

| Tool | Description |
|------|-------------|
| `start_coverage` | Start tracking code coverage |
| `stop_coverage` | Stop and get coverage report |
| `get_coverage_report` | View coverage statistics |

### Debug Profiles

| Tool | Description |
|------|-------------|
| `save_debug_profile` | Save current configuration as a profile |
| `load_debug_profile` | Load a saved debug profile |
| `list_debug_profiles` | List all saved profiles |

### Additional Tools

| Tool | Description |
|------|-------------|
| `capture_request_context` | Capture HTTP request context |
| `add_step_filter` | Add filter to skip files during stepping |
| `list_step_filters` | List step filter rules |
| `get_function_history` | View function call history |
| `export_session` | Export session as JSON/HTML report |
| `capture_snapshot` | Capture debug state snapshot |

## Usage Examples

### Setting a Breakpoint

```
Use set_breakpoint with file="/var/www/html/index.php" and line=25
```

### Conditional Breakpoint

```
Use set_breakpoint with file="/var/www/html/api.php", line=42, condition="$userId > 100"
```

### Watch Expression

```
Use add_watch with expression="$user->email"
Use add_watch with expression="count($items)"
```

### Logpoint

```
Use add_logpoint with file="/var/www/html/api.php", line=50, message="User {$userId} accessed {$endpoint}"
```

### Inspecting Variables

```
Use get_variables to see all local variables
Use get_variable with name="$user" to inspect a specific variable
Use evaluate with expression="count($items)" to evaluate an expression
```

### Capture Request Context

```
Use capture_request_context to see $_GET, $_POST, $_SESSION, cookies, and headers
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `XDEBUG_PORT` | `9003` | Port to listen for Xdebug connections (TCP mode) |
| `XDEBUG_HOST` | `0.0.0.0` | Host to bind (TCP mode) |
| `XDEBUG_SOCKET_PATH` | - | Unix domain socket path (e.g., `/tmp/xdebug.sock`). When set, uses Unix socket instead of TCP |
| `COMMAND_TIMEOUT` | `30000` | Command timeout in milliseconds |
| `PATH_MAPPINGS` | - | JSON object mapping container to host paths |
| `MAX_DEPTH` | `3` | Max depth for variable inspection |
| `MAX_CHILDREN` | `128` | Max children to return for arrays/objects |
| `MAX_DATA` | `2048` | Max data size per variable |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

## Connection Modes: TCP vs Unix Socket

| Feature | TCP | Unix Socket |
|---------|-----|-------------|
| **Setup** | Easy (default) | Simple (one env var) |
| **Performance** | Good | Excellent (lower latency) |
| **Security** | Port accessible to network | File-based permissions |
| **Remote Debugging** | ✅ Supported | ❌ Local only |
| **Docker** | ✅ Works with host.docker.internal | ❌ Requires volume mount |
| **Stale Socket** | Manual port cleanup | Auto-cleanup |
| **Default** | `XDEBUG_PORT=9003` | Disabled (use TCP) |

**Quick Decision Guide:**
- 🏠 **Local development?** → Use Unix socket for best performance
- 🐳 **Docker on same machine?** → Use Unix socket with volume mount
- 🌐 **Remote server?** → Use TCP
- 🚀 **Maximum speed?** → Use Unix socket
- 📝 **Don't know?** → Start with TCP (default), switch to Unix socket if needed

## How It Works

1. **MCP Server starts** and listens for Xdebug connections (TCP port 9003 or Unix socket)
2. **PHP script runs** with Xdebug enabled
3. **Xdebug connects** to the MCP server via DBGp protocol
4. **AI uses MCP tools** to control debugging (set breakpoints, step, inspect)
5. **DBGp commands** are sent to Xdebug, responses parsed and returned

```
┌─────────────┐     MCP/stdio      ┌─────────────┐   DBGp/TCP or    ┌─────────────┐
│   Claude    │ ◄────────────────► │  xdebug-mcp │ ◄─ Unix Socket ──► │   Xdebug    │
│  (AI Agent) │                    │   Server    │                   │  (in PHP)   │
└─────────────┘                    └─────────────┘                   └─────────────┘
```

**Connection Options:**
- **TCP (Default):** `xdebug.client_host=127.0.0.1` + `XDEBUG_PORT=9003`
- **Unix Socket:** `xdebug.client_host=unix:///tmp/xdebug.sock` + `XDEBUG_SOCKET_PATH=/tmp/xdebug.sock`

## Troubleshooting

### No debug sessions appearing

1. Check that Xdebug is installed: `php -v` should show Xdebug
2. Verify Xdebug config: `php -i | grep xdebug`
3. Ensure `xdebug.client_host` points to the MCP server
4. **For TCP:** Check firewall allows connections on port 9003
5. **For Unix socket:** Verify socket path exists and has correct permissions: `ls -la /tmp/xdebug.sock`
6. Check MCP server logs: `LOG_LEVEL=debug` for verbose output

### Connection issues with Docker

1. For Linux, add `extra_hosts: ["host.docker.internal:host-gateway"]`
2. Verify container can reach host: `curl host.docker.internal:9003`
3. Check xdebug logs in container: `docker logs <container-id> | grep xdebug`

### Unix socket issues

1. **"Address already in use"**: Socket file wasn't cleaned up
   - Remove manually: `rm -f /tmp/xdebug.sock`
   - MCP server will clean up automatically on next start
2. **"Permission denied"**: Check socket file permissions
   - List socket: `ls -la /tmp/xdebug.sock`
   - Run as same user as PHP: `ps aux | grep php`
3. **Socket path in php.ini:**
   - Correct: `xdebug.client_host=unix:///tmp/xdebug.sock`
   - Wrong: `xdebug.client_host=unix:/tmp/xdebug.sock` (missing one `/`)

### Breakpoints not hitting

1. Ensure file paths match exactly (use container paths for Docker)
2. Check breakpoint is resolved: `list_breakpoints`
3. Verify script execution reaches that line
4. Check that `xdebug.start_with_request=yes` is set
5. Try a simple file to verify basic setup works

### Performance issues

1. If experiencing slow stepping, increase `COMMAND_TIMEOUT`:
   - Default: 30000ms (30 seconds)
   - Try: `COMMAND_TIMEOUT=60000` for slower systems
2. For Unix sockets, verify socket is on fast filesystem (not network mount)
3. Check system load: `top` - excessive context switching slows debugging

### Server won't start

1. **Port in use (TCP):**
   - Find process: `lsof -i :9003`
   - Kill it: `kill -9 <pid>`
2. **Bad config:**
   - Validate environment variables: `echo $XDEBUG_SOCKET_PATH`
   - Check for typos in path names
3. **Permission denied:**
   - For Unix socket, ensure write permission to parent directory
   - Example: `mkdir -p ~/.xdebug && chmod 700 ~/.xdebug`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
