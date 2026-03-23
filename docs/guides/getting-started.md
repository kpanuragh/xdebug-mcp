---
layout: default
title: Getting Started with Xdebug MCP | Installation Guide
description: Install and setup Xdebug MCP Server in minutes. No PHP dependencies. Standalone PHP debugging for AI agents.
permalink: /:collection/:name/
---

# Getting Started with Xdebug MCP

Get up and running with Xdebug MCP in just a few minutes. No PHP composer dependencies required.

## Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or yarn
- **PHP** 7.0+ with Xdebug extension
- Basic command line knowledge

## Installation Steps

### Step 1: Install Xdebug MCP Server

```bash
npm install -g xdebug-mcp
```

Or using yarn:

```bash
yarn global add xdebug-mcp
```

### Step 2: Verify Installation

```bash
xdebug-mcp --version
```

Expected output:
```
xdebug-mcp v1.2.1
```

## Setting Up PHP

### Install Xdebug Extension

**Using PECL (Recommended):**
```bash
pecl install xdebug
```

**Ubuntu/Debian:**
```bash
sudo apt-get install php-xdebug
```

**macOS (Homebrew):**
```bash
brew install php-xdebug
```

**Windows:**
Download from [xdebug.org/download](https://xdebug.org/download)

### Configure php.ini

Find your php.ini file:
```bash
php --ini
```

Add Xdebug configuration:

```ini
[xdebug]
zend_extension=xdebug

; Enable debug mode
xdebug.mode=debug

; Connection settings
xdebug.client_host=localhost
xdebug.client_port=9003

; IDE Key (identifier)
xdebug.idekey=xdebug-mcp

; Logging (optional)
xdebug.log=/tmp/xdebug.log
xdebug.log_level=10
```

### Verify Xdebug Installation

```bash
php -v | grep Xdebug
```

Should output:
```
with Xdebug X.X.X
```

## Quick Start

### 1. Start the MCP Server

```bash
xdebug-mcp
```

Expected output:
```
[INFO] Xdebug MCP Server listening on localhost:9003
[INFO] Server ready for debugging
```

### 2. Create a Test Script

Save as `test.php`:

```php
<?php
function greet($name) {
    $message = "Hello, " . $name;
    return $message;
}

$result = greet("World");
echo $result;
?>
```

### 3. Debug the Script

```bash
php test.php
```

The script will pause at breakpoints when you set them via your agent.

## Setup with Your Agent

Choose your preferred AI agent or IDE:

### Claude Code
```bash
claude mcp add xdebug-mcp npx xdebug-mcp
```

Then ask Claude: "Debug this PHP code"

### VS Code, Cursor, Cline, PhpStorm
See [Agent Integration Guide](./agent-integration) for detailed setup instructions.

## Connection Modes

### TCP Mode (Default)

Works out of the box on all platforms:

```bash
xdebug-mcp
# Listens on localhost:9003
```

### Unix Socket Mode (Faster)

For Linux/macOS - 10x faster for local debugging:

```bash
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp
```

Update php.ini:
```ini
xdebug.client_host=/tmp/xdebug.sock
xdebug.client_port=0
```

## Docker Setup

### Docker Compose Example

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
    command: php app.php

  debugger:
    image: node:18
    command: npm install -g xdebug-mcp && xdebug-mcp
    ports:
      - "9003:9003"
```

Run with:
```bash
docker-compose up
```

## Troubleshooting First Steps

### "Command not found: xdebug-mcp"

Make sure npm is in your PATH:

```bash
npm list -g xdebug-mcp
```

If not installed, reinstall:
```bash
npm install -g xdebug-mcp
```

### "Port 9003 already in use"

Use a different port:

```bash
XDEBUG_PORT=9004 xdebug-mcp
```

Update php.ini:
```ini
xdebug.client_port=9004
```

### "Xdebug not connecting"

1. **Check php.ini:**
```bash
php -i | grep -i xdebug
```

2. **Check Xdebug log:**
```bash
tail -f /tmp/xdebug.log
```

3. **Verify server listening:**
```bash
lsof -i :9003
```

## Environment Variables

Configure server behavior with environment variables:

```bash
# TCP mode (default)
XDEBUG_HOST=0.0.0.0
XDEBUG_PORT=9003

# Unix socket mode
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock

# Logging
DEBUG=xdebug-mcp
```

## System Requirements

| Component | Requirement |
|-----------|-------------|
| Node.js | 18.0.0+ |
| PHP | 7.0+ |
| Xdebug | 2.9+ or 3.0+ |
| OS | Linux, macOS, Windows |
| RAM | 100MB minimum |
| Disk | 50MB |

## Quick Reference

```bash
# Install
npm install -g xdebug-mcp

# Start server
xdebug-mcp

# TCP mode on custom port
XDEBUG_PORT=9004 xdebug-mcp

# Unix socket mode
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp

# Debug mode (verbose logging)
DEBUG=xdebug-mcp xdebug-mcp

# Stop server
Ctrl+C
```

## What's Next?

You're all set! 🎉

1. **Choose your agent:** [Agent Integration Guide](./agent-integration)
2. **Learn debugging:** [Debugging Guide](./debugging-guide)
3. **Configure settings:** [Configuration Reference](../reference/configuration)
4. **Get help:** [Troubleshooting Guide](../reference/troubleshooting)

---

## Need Help?

- **Installation issues?** Check [Troubleshooting Guide](../reference/troubleshooting)
- **Configuration questions?** See [Configuration Reference](../reference/configuration)
- **Xdebug docs:** [xdebug.org](https://xdebug.org)
- **Report issues:** [GitHub Issues](https://github.com/kpanuragh/xdebug-mcp/issues)
