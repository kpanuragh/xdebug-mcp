# Xdebug MCP Server

An MCP (Model Context Protocol) server that provides PHP debugging capabilities through Xdebug's DBGp protocol. This allows AI assistants like Claude to directly debug PHP applications.

## Features

- **Full Debug Control**: Step into, step over, step out, continue, stop
- **Breakpoints**: Line breakpoints, conditional breakpoints, exception breakpoints, function call breakpoints
- **Variable Inspection**: View all variables, get specific variables, set variable values
- **Expression Evaluation**: Evaluate PHP expressions in the current context
- **Stack Traces**: View the full call stack
- **Multiple Sessions**: Debug multiple PHP scripts simultaneously
- **Docker Support**: Works with PHP running in Docker containers

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd xdebug-mcp

# Install dependencies
npm install

# Build
npm run build
```

## MCP Server Configuration

### For Claude Code (claude_desktop_config.json or settings)

Add the xdebug-mcp server to your MCP configuration:

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "node",
      "args": ["/home/power/Projects/xdebug-mcp/dist/index.js"],
      "env": {
        "XDEBUG_PORT": "9003",
        "XDEBUG_HOST": "0.0.0.0",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Or if installed globally via npm:

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

### With Path Mappings (for Docker)

When debugging PHP in Docker containers, you need path mappings to translate container paths to host paths:

```json
{
  "mcpServers": {
    "xdebug": {
      "command": "node",
      "args": ["/home/power/Projects/xdebug-mcp/dist/index.js"],
      "env": {
        "XDEBUG_PORT": "9003",
        "XDEBUG_HOST": "0.0.0.0",
        "PATH_MAPPINGS": "{\"/var/www/html\": \"/home/user/projects/myapp\"}",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

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

## Available MCP Tools

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
| `set_breakpoint` | Set a line or conditional breakpoint |
| `set_exception_breakpoint` | Break on exceptions |
| `set_call_breakpoint` | Break on function calls |
| `remove_breakpoint` | Remove a breakpoint |
| `update_breakpoint` | Enable/disable or modify a breakpoint |
| `list_breakpoints` | List all breakpoints |

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

## Usage Examples

### Setting a Breakpoint

```
Use set_breakpoint with file="/var/www/html/index.php" and line=25
```

### Conditional Breakpoint

```
Use set_breakpoint with file="/var/www/html/api.php", line=42, condition="$userId > 100"
```

### Inspecting Variables

```
Use get_variables to see all local variables
Use get_variable with name="$user" to inspect a specific variable
Use evaluate with expression="count($items)" to evaluate an expression
```

### Stepping Through Code

```
Use step_into to step into a function
Use step_over to execute the line and move to the next
Use step_out to finish the current function
Use continue to run until the next breakpoint
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `XDEBUG_PORT` | `9003` | Port to listen for Xdebug connections |
| `XDEBUG_HOST` | `0.0.0.0` | Host to bind |
| `COMMAND_TIMEOUT` | `30000` | Command timeout in milliseconds |
| `PATH_MAPPINGS` | - | JSON object mapping container to host paths |
| `MAX_DEPTH` | `3` | Max depth for variable inspection |
| `MAX_CHILDREN` | `128` | Max children to return for arrays/objects |
| `MAX_DATA` | `2048` | Max data size per variable |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

## How It Works

1. **MCP Server starts** and listens for Xdebug connections on port 9003
2. **PHP script runs** with Xdebug enabled
3. **Xdebug connects** to the MCP server via DBGp protocol
4. **AI uses MCP tools** to control debugging (set breakpoints, step, inspect)
5. **DBGp commands** are sent to Xdebug, responses parsed and returned

```
┌─────────────┐     MCP/stdio      ┌─────────────┐     DBGp/TCP      ┌─────────────┐
│   Claude    │ ◄────────────────► │  xdebug-mcp │ ◄───────────────► │   Xdebug    │
│  (AI Agent) │                    │   Server    │                   │  (in PHP)   │
└─────────────┘                    └─────────────┘                   └─────────────┘
```

## Troubleshooting

### No debug sessions appearing

1. Check that Xdebug is installed: `php -v` should show Xdebug
2. Verify Xdebug config: `php -i | grep xdebug`
3. Ensure `xdebug.client_host` points to the MCP server
4. Check firewall allows connections on port 9003

### Connection issues with Docker

1. For Linux, add `extra_hosts: ["host.docker.internal:host-gateway"]`
2. Verify container can reach host: `curl host.docker.internal:9003`

### Breakpoints not hitting

1. Ensure file paths match exactly (use container paths for Docker)
2. Check breakpoint is resolved: `list_breakpoints`
3. Verify script execution reaches that line

## License

MIT
