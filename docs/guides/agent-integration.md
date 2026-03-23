---
layout: default
title: Agent Integration Guide | Xdebug MCP Server
description: Complete setup guide for using Xdebug MCP with Claude Code, Cursor, Cline, VS Code, Copilot, Windsurf, and PhpStorm. Standalone PHP debugging with AI agents.
permalink: /:collection/:name/
---

# Agent Integration Guide

Complete setup instructions for using **Xdebug MCP Server** with your favorite AI agents and IDEs. No PHP dependencies. No composer needed. Works standalone.

## Quick Setup by Agent

### Claude Code (Recommended)

**Installation:**
```bash
claude mcp add xdebug-mcp npx xdebug-mcp
```

**Manual Configuration** - Edit `~/.claude/mcp.json`:
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

**How to Debug:**
1. Ask Claude: "Debug this PHP code"
2. Claude automatically:
   - Sets breakpoints where needed
   - Continues execution
   - Inspects variables and stack traces
   - Analyzes issues and suggests fixes

**Example:**
```
User: Debug the checkout process in app/checkout.php

Claude: I'll debug the checkout process. Let me set breakpoints at the
payment processing line and run through it step by step...

[Claude sets breakpoints, runs code, inspects variables]

Found the issue: The payment processing has a calculation error at line 45
where the total doesn't account for tax. The fix is to multiply by the
tax rate before adding to total.
```

---

### Cursor

**Installation via UI:**
1. Open Cursor Settings
2. Go to `Features → Extensions`
3. Search for "xdebug-mcp"
4. Click Install

**Manual Config** - Edit `.cursor/settings.json`:
```json
{
  "mcpServers": {
    "xdebug": {
      "command": "npx",
      "args": ["xdebug-mcp"],
      "type": "stdio"
    }
  }
}
```

**How to Debug:**
1. Open PHP file in Cursor
2. Use Command Palette: `Cmd+Shift+P` → "Debug with Xdebug"
3. Cursor shows:
   - Breakpoint indicators in code
   - Variable inspector sidebar
   - Call stack panel
   - Debug console

**Example Output:**
```php
function processPayment($amount) {
  →  $tax = calculateTax($amount);      // Breakpoint hit here
     $total = $amount + $tax;
     return $total;
}

// Sidebar shows:
Variables:
  $amount = 100
  $tax = 8.5
  $total = 108.5
```

---

### Cline

**Installation:**
```bash
cline install xdebug-mcp npx xdebug-mcp
```

**Manual Config** - Edit `~/.cline/config.json`:
```json
{
  "mcpServers": {
    "xdebug": {
      "command": "npx",
      "args": ["xdebug-mcp"],
      "type": "stdio",
      "timeout": 30000
    }
  }
}
```

**How to Debug:**
1. Ask Cline: "Debug this PHP error"
2. Cline will:
   - Analyze error logs
   - Set breakpoints automatically
   - Step through execution
   - Identify root cause
   - Suggest fixes with code

**Example:**
```
User: I'm getting "undefined array key" error in checkout code

Cline: Let me debug this. I'll trace through the checkout process...

Found it! The 'shipping_address' key isn't being set when payment
method is 'paypal'. The issue is on line 156 in checkout_handler.php.

Here's the fix: Check if payment_method is 'paypal' before accessing
shipping_address, or initialize it with empty values.
```

---

### VS Code with MCP Extension

**Install MCP Extension:**
```bash
npm install -g @claud-ai/claude-mcp-extension
```

**Configuration** - `.vscode/settings.json`:
```json
{
  "mcp.servers": {
    "xdebug": {
      "command": "npx",
      "args": ["xdebug-mcp"],
      "env": {
        "XDEBUG_PORT": "9003"
      }
    }
  }
}
```

**How to Debug:**
1. Click MCP Server icon in sidebar
2. Select "Xdebug" from list
3. Open PHP file
4. Right-click → "Debug with Xdebug"
5. Use VS Code's Debug View:
   - Variables panel shows local variables
   - Call stack shows function calls
   - Watch expressions for custom monitoring
   - Debug console for commands

**Example Debug Panel:**
```
Call Stack:
  processPayment() - checkout.php:45
  handleCheckout() - handlers.php:123
  main() - index.php:1

Variables:
  $amount = 100
  $customer = Object
  $paymentId = "pay_123456"

Watch Expressions:
  $total = 108.5
  sizeof($items) = 3
```

---

### GitHub Copilot (VS Code)

**Prerequisites:**
- GitHub Copilot extension installed
- VS Code MCP extension configured (see VS Code section above)

**Configuration** - `.vscode/settings.json`:
```json
{
  "github.copilot": {
    "enable": {
      "plaintext": false,
      "markdown": false,
      "scm": false
    }
  },
  "mcp.servers": {
    "xdebug": {
      "command": "npx",
      "args": ["xdebug-mcp"]
    }
  }
}
```

**How to Debug with Copilot:**
1. Use Copilot Chat: `Ctrl+Shift+I`
2. Ask: "@xdebug debug my checkout process"
3. Copilot will:
   - Suggest breakpoints
   - Show expected vs actual values
   - Identify logic errors
   - Generate test cases

**Example Chat:**
```
You: @xdebug Why is the total calculation wrong?

Copilot: I'll debug the calculation. Let me trace through...

The issue is that getTaxRate() returns a decimal (0.085) but
the code treats it as a percentage (8.5). Line 45 should multiply
by 0.01 or use the decimal directly.
```

---

### Windsurf

**Installation:**
```bash
windsurf install-mcp xdebug-mcp npx xdebug-mcp
```

**Configuration** - `windsurf.config.json`:
```json
{
  "mcp": {
    "xdebug": {
      "command": "npx",
      "args": ["xdebug-mcp"],
      "stdio": true
    }
  }
}
```

**How to Debug:**
1. Open Windsurf Editor
2. Select "Debug" from Agent Menu
3. Choose "Xdebug MCP"
4. Tell Windsurf what to debug
5. Windsurf will:
   - Set up debugging session
   - Run your code
   - Analyze results
   - Suggest improvements

---

### JetBrains IDEs (PhpStorm, IntelliJ)

**Plugin Setup:**
1. Settings → Plugins → Marketplace
2. Search "MCP Server"
3. Install "MCP Server Support"

**Configuration** - `mcp-servers.json`:
```json
{
  "xdebug": {
    "command": "npx",
    "args": ["xdebug-mcp"],
    "type": "stdio"
  }
}
```

**How to Debug:**
1. Run → Edit Configurations
2. Create "MCP Server" configuration
3. Set server to "xdebug"
4. Click Debug button
5. Use PhpStorm's Debug Tools:
   - Step through code
   - Set conditional breakpoints
   - Evaluate expressions
   - View variable contents

---

## Common Debugging Tasks

### Task: Find Why User Login Fails

#### With Claude Code:
```
User: Debug why users can't log in to the app

Claude: I'll trace through the authentication process...
[Debugs login.php, checks database calls, inspects variables]

Issue found: The password hash comparison uses == instead of ===
on line 78, allowing type coercion to bypass security.

Fix: Change line 78 to:
if (hash_equals($hash, $_POST['password']))
```

#### With Cursor:
```
// Cursor highlights the issue in the editor
← Breakpoint at line 78: if ($hash == $_POST['password'])
     Warning: Loose comparison detected

// Shows in sidebar:
$_POST['password'] = "0"
$hash = "0e123456789..."
Comparison result: true (WRONG!)
```

#### With Cline:
```
User: Users report they can't login

Cline: Found the security vulnerability in authentication.
The hash comparison uses loose equality (==) which fails for
hashes starting with "0e". This is a known PHP type juggling issue.

Recommended fix: Change line 78 to:
if (hash_equals($hash, $_POST['password']))
```

---

### Task: Optimize Slow Database Query

#### With Claude Code:
```
User: My report page is loading slowly

Claude: Let me profile the database queries...
[Sets breakpoint at query, steps through, measures time]

The query on line 156 scans 1M rows without an index.
Adding an index on the 'status' column will improve performance by ~50x.
```

#### With Cursor:
```
// Debug panel shows execution time:
get_reports() - 2.5 seconds
  ├─ SELECT * FROM transactions - 2.3 seconds ⚠️
  └─ process_results() - 0.2 seconds

// Suggests: Add index on 'status' column
```

---

### Task: Fix Undefined Variable Error

#### With Cline:
```
User: Getting "undefined variable" error

Cline: Tracing execution...
[Steps through code]

The variable $customer is only set inside the if statement
on line 45, but used outside on line 67. Initialize it before
the conditional.

Fix:
$customer = null;  // Add this line before the if
if ($account_id > 0) {
    $customer = getCustomer($account_id);
}
```

---

## Docker Integration

### Dockerfile with Xdebug MCP

```dockerfile
FROM node:18
RUN npm install -g xdebug-mcp

# PHP container should be separate
# Set up Xdebug to connect to host
ENV XDEBUG_MODE=debug
ENV XDEBUG_CLIENT_HOST=host.docker.internal
ENV XDEBUG_CLIENT_PORT=9003

EXPOSE 9003
CMD ["xdebug-mcp"]
```

### Docker Compose Setup

```yaml
version: '3'
services:
  php:
    image: php:8.1-cli
    volumes:
      - ./app:/app
    working_dir: /app
    environment:
      XDEBUG_MODE: debug
      XDEBUG_CLIENT_HOST: debugger
      XDEBUG_CLIENT_PORT: 9003
      XDEBUG_IDEKEY: xdebug-mcp

  debugger:
    image: node:18
    command: npm install -g xdebug-mcp && xdebug-mcp
    ports:
      - "9003:9003"
    environment:
      XDEBUG_HOST: 0.0.0.0
      XDEBUG_PORT: 9003
```

**Run with:**
```bash
docker-compose up
```

---

## Configuration Comparison

| Agent | Install Command | Config File | Entry Point |
|-------|-----------------|-------------|-------------|
| **Claude Code** | `claude mcp add` | `~/.claude/mcp.json` | `npx xdebug-mcp` |
| **Cursor** | UI or manual | `.cursor/settings.json` | `npx xdebug-mcp` |
| **Cline** | `cline install` | `~/.cline/config.json` | `npx xdebug-mcp` |
| **VS Code** | Extension | `.vscode/settings.json` | `npx xdebug-mcp` |
| **Copilot** | Extension | `.vscode/settings.json` | `npx xdebug-mcp` |
| **Windsurf** | `windsurf install-mcp` | `windsurf.config.json` | `npx xdebug-mcp` |
| **PhpStorm** | Plugin | `mcp-servers.json` | `npx xdebug-mcp` |

---

## Troubleshooting by Agent

### Claude Code Issues

**Problem:** "Command not found: xdebug-mcp"

```bash
npm install -g xdebug-mcp
claude mcp add xdebug-mcp npx xdebug-mcp
```

### Cursor Issues

**Problem:** Debug panel not showing

```json
{
  "mcp.debug": true,
  "mcp.logLevel": "verbose"
}
```

### VS Code Issues

**Problem:** MCP extension not detecting server

1. Check: `View → Output → MCP`
2. Verify: `npx xdebug-mcp` runs standalone
3. Restart VS Code

### Docker Issues

**Problem:** Can't connect from container to host

```yaml
services:
  app:
    extra_hosts:
      - "debugger:host-gateway"
```

---

## Best Practices

1. **Tell agents what to debug specifically**
   - ❌ "Debug my code"
   - ✅ "Debug the payment processing in checkout.php"

2. **Let agents control the debugging flow**
   - Don't manually set every breakpoint
   - Let agent decide where to pause execution

3. **Use agent-specific features**
   - Claude: Ask questions during debugging
   - Cursor: Use editor highlighting
   - Cline: Request automatic fixes

4. **Check logs when debugging fails**
   - Claude: Look at logs in chat
   - Cursor: Check Debug Console
   - VS Code: Check Output panel

---

## Next Steps

- [Getting Started Guide](./getting-started) - Install and setup Xdebug MCP
- [Debugging Guide](./debugging-guide) - Learn debugging workflows
- [Configuration Reference](../reference/configuration) - All configuration options
- [Troubleshooting](../reference/troubleshooting) - Common issues & solutions
