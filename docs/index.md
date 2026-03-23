---
layout: default
title: Xdebug MCP Server - PHP Debugging with AI Agents
description: Standalone PHP debugger with Xdebug MCP Server. Debug PHP code with Claude, Cursor, VS Code, Cline, and more. No composer, no dependencies - just powerful debugging.
---

# Xdebug MCP Server

**The standalone PHP debugger for AI agents and IDEs.**

Debug PHP code interactively with **Claude, Cursor, Cline, VS Code, Copilot, Windsurf, and PhpStorm** using the Xdebug Model Context Protocol Server. No PHP dependencies. No composer requirements. Just connect and debug.

## 🚀 Quick Start

### Install the Server

```bash
npm install -g xdebug-mcp
xdebug-mcp
```

### Configure PHP

Add to `php.ini`:

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug
xdebug.client_host=localhost
xdebug.client_port=9003
xdebug.idekey=xdebug-mcp
```

### Use with Your Agent

**Claude Code:**
```bash
claude mcp add xdebug-mcp npx xdebug-mcp
```

**VS Code, Cursor, Cline, Copilot, Windsurf, PhpStorm** — See [Agent Integration Guide](#documentation)

---

## ✨ Features

- **Interactive Debugging** — Set breakpoints, step through code, inspect variables
- **Multi-Agent Support** — Works with Claude, Cursor, Cline, VS Code, Copilot, Windsurf, PhpStorm
- **Connection Modes** — TCP (default) or Unix Domain Sockets (10x faster)
- **Comprehensive Tools** — Breakpoints, execution control, variable inspection, stack traces
- **Docker Ready** — Easy setup in containerized environments
- **Full DBGp Protocol** — Complete Xdebug debugging protocol implementation

---

## 📚 Documentation

### Getting Started
- **[Agent Integration Guide](./guides/agent-integration)** ⭐ — Setup for Claude, Cursor, Cline, VS Code, Copilot, Windsurf, PhpStorm
- **[Installation & Setup](./guides/getting-started)** — Prerequisites and installation
- **[Debugging Guide](./guides/debugging-guide)** — Learn debugging workflows

### Configuration & Reference
- **[Configuration Reference](./reference/configuration)** — All configuration options
- **[Connection Modes](./reference/connection-modes)** — TCP vs Unix sockets
- **[Tools & Commands](./reference/tools-commands)** — Available debugging tools
- **[Troubleshooting](./reference/troubleshooting)** — Common issues & solutions

### Advanced
- **[Understanding Xdebug](./advanced/understanding-xdebug)** — How Xdebug works
- **[DBGp Protocol](./advanced/dbgp-protocol)** — Protocol specification
- **[MCP Server Architecture](./advanced/mcp-architecture)** — Server internals

---

## 🎯 Use Cases

### Debug with Claude Code
Tell Claude to debug your PHP code, and it will automatically:
- Set breakpoints where needed
- Step through execution
- Inspect variables and stack traces
- Analyze issues and suggest fixes

### IDE Integration
Use xdebug-mcp as a backend for:
- **VS Code** with MCP extension
- **Cursor** IDE
- **PhpStorm / IntelliJ** IDEs
- **Windsurf** editor
- **Cline** agent
- **GitHub Copilot** chat

### Remote Debugging
Debug PHP running on remote servers or Docker containers from your local machine.

---

## 📦 Installation

### Prerequisites
- **Node.js** 18.0.0+
- **PHP** 7.0+ with Xdebug extension
- **npm** or yarn

### Install via npm

```bash
npm install -g xdebug-mcp
```

### Verify Installation

```bash
xdebug-mcp --version
```

---

## 🔌 Connection Modes

### TCP Mode (Default)
Works on all platforms, listens on `localhost:9003`

```bash
xdebug-mcp
```

### Unix Socket Mode (Faster)
10x faster for local debugging on Linux/macOS

```bash
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp
```

---

## 🐳 Docker Support

### Quick Docker Setup

```dockerfile
FROM php:8.1-cli
RUN pecl install xdebug && docker-php-ext-enable xdebug
RUN npm install -g xdebug-mcp
COPY app /app
WORKDIR /app
CMD ["xdebug-mcp"]
```

### Docker Compose

```yaml
version: '3'
services:
  app:
    image: php:8.1-cli
    volumes:
      - ./app:/app
    working_dir: /app
    environment:
      XDEBUG_MODE: debug
      XDEBUG_CLIENT_HOST: debugger
      XDEBUG_CLIENT_PORT: 9003

  debugger:
    image: node:18
    command: npm install -g xdebug-mcp && xdebug-mcp
    ports:
      - "9003:9003"
```

---

## 🛠️ Environment Variables

Configure the server with environment variables:

```bash
# TCP Configuration
XDEBUG_HOST=0.0.0.0              # Bind address (default: 0.0.0.0)
XDEBUG_PORT=9003                 # Listen port (default: 9003)

# Unix Socket Configuration
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock   # Socket path (for Unix sockets)

# Logging
DEBUG=xdebug-mcp                  # Enable verbose logging
```

### Examples

```bash
# Custom TCP port
XDEBUG_PORT=9004 xdebug-mcp

# Unix socket mode
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp

# Verbose logging
DEBUG=xdebug-mcp xdebug-mcp
```

---

## 🤖 Agent Integration Examples

### Claude Code
```json
{
  "mcpServers": {
    "xdebug": {
      "command": "npx",
      "args": ["xdebug-mcp"]
    }
  }
}
```

Then ask Claude: "Debug this PHP code"

### Cursor
1. Open Cursor Settings
2. Go to Features → Extensions
3. Search for "xdebug-mcp" and install
4. Use Command Palette: `Cmd+Shift+P` → "Debug with Xdebug"

### VS Code
Install [MCP Extension](https://marketplace.visualstudio.com/items?itemName=claud-ai.claude-mcp-extension)

Configure `.vscode/settings.json`:
```json
{
  "mcp.servers": {
    "xdebug": {
      "command": "npx",
      "args": ["xdebug-mcp"]
    }
  }
}
```

**→ [See all agents](https://github.com/kpanuragh/xdebug-mcp/wiki/Agent-Integration)**

---

## 🎓 Tutorial Example

### Create a test script

```php
<?php
function calculateTotal($items) {
    $total = 0;
    foreach ($items as $price) {
        $total += $price;
    }
    return $total;
}

$items = [10, 20, 30];
$result = calculateTotal($items);
echo "Total: $result";
?>
```

### Debug with Claude Code

```
User: Debug this PHP checkout calculation

Claude: I'll set a breakpoint in the calculateTotal function and trace the execution...

[Sets breakpoint, runs code, inspects variables]

The calculation is working correctly. Total is 60 as expected.
```

---

## 📖 Learn More

- **[Full Documentation](https://github.com/kpanuragh/xdebug-mcp/wiki)** — Complete wiki with all guides
- **[GitHub Repository](https://github.com/kpanuragh/xdebug-mcp)** — Source code and issues
- **[Xdebug Docs](https://xdebug.org)** — Official Xdebug documentation
- **[Model Context Protocol](https://modelcontextprotocol.io)** — MCP specification

---

## 🐛 Troubleshooting

### "xdebug-mcp: command not found"
```bash
npm install -g xdebug-mcp
```

### "Port 9003 already in use"
```bash
XDEBUG_PORT=9004 xdebug-mcp
```

### "Xdebug not connecting"
1. Verify Xdebug is installed: `php -v | grep Xdebug`
2. Check php.ini configuration: `php -i | grep -i xdebug`
3. Ensure server is listening: `lsof -i :9003`

**→ [Full troubleshooting guide](https://github.com/kpanuragh/xdebug-mcp/wiki/Troubleshooting)**

---

## 📄 License

MIT License - See [LICENSE](https://github.com/kpanuragh/xdebug-mcp/blob/main/LICENSE)

---

## 🤝 Contributing

Contributions are welcome! Please see the [GitHub repository](https://github.com/kpanuragh/xdebug-mcp) for guidelines.

---

**Made with ❤️ by [Anuragh K P](https://github.com/kpanuragh)**

[GitHub](https://github.com/kpanuragh/xdebug-mcp) • [npm](https://www.npmjs.com/package/xdebug-mcp) • [Wiki](https://github.com/kpanuragh/xdebug-mcp/wiki)
