---
layout: default
title: Configuration Reference | Xdebug MCP
description: Complete Xdebug MCP and PHP Xdebug configuration options. Environment variables, php.ini settings, Docker setup.
permalink: /:collection/:name/
---

# Configuration Reference

Complete reference for configuring Xdebug MCP Server and PHP Xdebug extension.

## Server Configuration

### Environment Variables

Configure the MCP Server via environment variables:

```bash
# TCP Configuration
XDEBUG_HOST=0.0.0.0          # Bind address
XDEBUG_PORT=9003             # Listen port

# Unix Socket Configuration
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock  # Socket path

# Logging
DEBUG=xdebug-mcp              # Enable debug output
```

Optional DBGp proxy registration:

```bash
DBGP_PROXY_HOST=127.0.0.1
DBGP_PROXY_PORT=9001
DBGP_IDEKEY=claude-mcp
DBGP_PROXY_ALLOW_FALLBACK=true
```

`DBGP_IDEKEY` should stay simple ASCII without spaces, quotes, or backslashes so it remains compatible with the reference `dbgpProxy` parser.

For the full proxy-mode workflow, see the [DBGp Proxy Registration Guide](/guides/dbgp-proxy-registration/).

### Usage Examples

**TCP Mode (Default):**
```bash
xdebug-mcp
# or explicit
XDEBUG_HOST=0.0.0.0 XDEBUG_PORT=9003 xdebug-mcp
```

**Unix Socket Mode:**
```bash
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp
```

**Custom Port:**
```bash
XDEBUG_PORT=9004 xdebug-mcp
```

**Debug Logging:**
```bash
DEBUG=xdebug-mcp xdebug-mcp
```

## PHP Xdebug Configuration

### php.ini Settings

Add these settings to your `php.ini` file:

#### Basic Configuration

```ini
[xdebug]
; Load extension
zend_extension=xdebug

; Enable debug mode
xdebug.mode=debug

; Connection settings
xdebug.client_host=localhost
xdebug.client_port=9003

; IDE Key (optional)
xdebug.idekey=xdebug-mcp
```

#### Complete Configuration

```ini
[xdebug]
; Core Settings
zend_extension=xdebug
xdebug.mode=debug              ; debug, profile, trace, coverage, gcstats
xdebug.max_nesting_level=256   ; Stack depth limit

; Client Connection (TCP)
xdebug.client_host=localhost
xdebug.client_port=9003
xdebug.discover_client_host=true
xdebug.client_discovery_header=HTTP_X_FORWARDED_FOR

; Client Connection (Unix Socket)
; xdebug.client_host=/tmp/xdebug.sock
; xdebug.client_port=0

; Debug Control
xdebug.break_on_first_line=true    ; Break at script start
xdebug.trigger_value=debug         ; Trigger value for selective debug
xdebug.trigger=GET                 ; Which superglobal to trigger on

; Logging
xdebug.log=/tmp/xdebug.log
xdebug.log_level=10

; IDE Key
xdebug.idekey=xdebug-mcp

; Additional
xdebug.var_display_max_depth=5
xdebug.var_display_max_data=10000
xdebug.var_display_max_children=100
```

## Configuration Options

### xdebug.mode

**Values:** `off`, `debug`, `profile`, `trace`, `coverage`, `gcstats`, or combinations

**Examples:**
```ini
; Single mode
xdebug.mode=debug

; Multiple modes
xdebug.mode=debug,profile

; Disable Xdebug
xdebug.mode=off
```

**Mode Descriptions:**

| Mode | Purpose | Overhead |
|------|---------|----------|
| **debug** | Interactive debugging (breakpoints, stepping) | 5-10x |
| **profile** | Performance analysis | 2-5x |
| **trace** | Function call logging | 10-20x |
| **coverage** | Code coverage analysis | 3-8x |
| **gcstats** | Garbage collector stats | Low |

### xdebug.client_host

**Values:** IP address, hostname, or socket path

**Examples:**
```ini
; localhost
xdebug.client_host=localhost
xdebug.client_host=127.0.0.1

; Network
xdebug.client_host=192.168.1.100
xdebug.client_host=debugger.example.com

; Unix socket
xdebug.client_host=/tmp/xdebug.sock
```

### xdebug.client_port

**Values:** Port number (0-65535), or 0 for Unix socket

**Default:** 9003

**Examples:**
```ini
; Standard port
xdebug.client_port=9003

; Custom port
xdebug.client_port=9004

; Unix socket (port must be 0)
xdebug.client_host=/tmp/xdebug.sock
xdebug.client_port=0
```

### xdebug.idekey

**Values:** String identifier

**Default:** Based on environment

**Examples:**
```ini
; Standard
xdebug.idekey=xdebug-mcp

; IDE-specific
xdebug.idekey=vscode
xdebug.idekey=phpstorm

; Custom
xdebug.idekey=my-debugger
```

### xdebug.break_on_first_line

**Values:** true/false

**Default:** false

**Purpose:** Break at script's first line before execution

**Example:**
```ini
xdebug.break_on_first_line=true
```

### xdebug.trigger_value

**Values:** String or empty

**Purpose:** Value to trigger debugging when present

**Examples:**
```ini
; Trigger on specific value
xdebug.trigger_value=debug
; Then use: php script.php?debug=1

; Trigger on any value
xdebug.trigger_value=

; Different identifier
xdebug.trigger_value=xdebug
; Then use: php script.php?xdebug=anything
```

### xdebug.trigger

**Values:** `GET`, `POST`, `COOKIE`, or empty

**Purpose:** Which superglobal contains trigger value

**Examples:**
```ini
; Trigger via GET parameter
xdebug.trigger=GET

; Trigger via POST
xdebug.trigger=POST

; Trigger via COOKIE
xdebug.trigger=COOKIE

; Trigger via any method
xdebug.trigger=
```

### xdebug.log

**Values:** File path

**Purpose:** Where to write Xdebug debug log

**Examples:**
```ini
; Linux/macOS
xdebug.log=/tmp/xdebug.log

; Windows
xdebug.log=C:\temp\xdebug.log
```

### xdebug.log_level

**Values:** 0-10 (verbosity level)

**Default:** 5

**Levels:**
- 0 = No logging
- 5 = Normal logging
- 10 = Very verbose

**Example:**
```ini
xdebug.log_level=10  ; Maximum verbosity
```

### xdebug.max_nesting_level

**Values:** Integer (stack depth)

**Default:** 256

**Purpose:** Maximum recursion depth before stopping

**Example:**
```ini
xdebug.max_nesting_level=512
```

## Platform-Specific Configurations

### Linux - Debian/Ubuntu

**Install Xdebug:**
```bash
sudo apt-get install php-xdebug
```

**php.ini locations:**
```
/etc/php/8.1/cli/php.ini
/etc/php/8.1/fpm/php.ini
/etc/php/8.1/apache2/php.ini
```

### Linux - CentOS/RHEL

**Install Xdebug:**
```bash
sudo yum install php-pecl-xdebug
```

**php.ini location:**
```
/etc/php.ini
```

### macOS - Homebrew

**Install Xdebug:**
```bash
brew install php-xdebug
```

**php.ini location:**
```
/usr/local/etc/php/8.1/php.ini
```

### Windows - XAMPP

**php.ini location:**
```
C:\xampp\php\php.ini
```

### Windows - WAMP

**php.ini location:**
```
C:\wamp\bin\php\php8.1.0\php.ini
```

## Docker Configuration

### Dockerfile

```dockerfile
FROM php:8.1-cli

RUN pecl install xdebug && docker-php-ext-enable xdebug

RUN echo "xdebug.mode=debug" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini
RUN echo "xdebug.client_host=host.docker.internal" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini
RUN echo "xdebug.client_port=9003" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini
RUN echo "xdebug.idekey=xdebug-mcp" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini
```

### docker-compose.yml

```yaml
version: '3'
services:
  app:
    build: .
    environment:
      XDEBUG_MODE: debug
      XDEBUG_CLIENT_HOST: debugger
      XDEBUG_CLIENT_PORT: 9003
      XDEBUG_IDE_KEY: xdebug-mcp

  debugger:
    image: node:18
    command: npm install -g xdebug-mcp && xdebug-mcp
    ports:
      - "9003:9003"
```

## Configuration by Use Case

### Local Development (TCP)

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug
xdebug.client_host=localhost
xdebug.client_port=9003
xdebug.idekey=xdebug-mcp
xdebug.log=/tmp/xdebug.log
```

### Local Development (Unix Socket)

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug
xdebug.client_host=/tmp/xdebug.sock
xdebug.client_port=0
xdebug.idekey=xdebug-mcp
xdebug.log=/tmp/xdebug.log
```

### Remote Debugging

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug
xdebug.client_host=192.168.1.100      ; Your machine IP
xdebug.client_port=9003
xdebug.discover_client_host=true
xdebug.idekey=xdebug-mcp
```

### Performance Profiling

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=profile
xdebug.profiler_output_dir=/tmp
xdebug.profiler_enable=1
```

### Code Coverage

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=coverage
```

### Production (Disabled)

```ini
[xdebug]
xdebug.mode=off
```

## Verification

### Check Installation

```bash
# Show all Xdebug settings
php -i | grep -A 30 "xdebug"

# Check specific setting
php -r "echo ini_get('xdebug.mode');"

# Verify extension loaded
php -m | grep xdebug
```

### Test Configuration

```bash
# Simple test
php -r "echo 'Xdebug loaded: ' . (extension_loaded('xdebug') ? 'yes' : 'no');"
```

## Performance Tuning

### Optimize for Debugging

```ini
[xdebug]
xdebug.max_nesting_level=512         ; Allow deep recursion
xdebug.var_display_max_depth=10      ; Show more nested data
xdebug.var_display_max_children=500  ; More array elements
```

### Optimize for Production

```ini
[xdebug]
xdebug.mode=off                      ; Disable completely
```

### Selective Debugging

```ini
[xdebug]
xdebug.mode=debug
xdebug.trigger_value=debug           ; Trigger on GET param
xdebug.trigger=GET                   ; Triggered via ?debug=1
```

## Troubleshooting Configuration

### Verify Configuration Loaded

```bash
# Show where php.ini is located
php -i | grep "php.ini"

# Show all INI settings
php -i | grep "ini"

# Check specific setting
php -i | grep "xdebug.client_port"
```

### Reload Configuration

```bash
# PHP CLI (automatic)
php script.php

# PHP-FPM
sudo systemctl restart php-fpm

# Apache
sudo systemctl restart apache2

# Nginx (with PHP-FPM)
sudo systemctl restart php-fpm
```

## Common Configuration Mistakes

| Mistake | Fix |
|---------|-----|
| `xdebug.mode=on` | Should be `debug`, `profile`, etc. |
| Missing `zend_extension=xdebug` | Add to php.ini |
| Wrong port in php.ini and server | Must match |
| Firewall blocking port | Allow port 9003 |
| Socket path not writable | Check permissions |
| `xdebug.client_port=9003` with socket | Should be `0` |
| `xdebug.client_host=/path` with TCP | Should be IP/hostname |

## Quick Configuration Templates

### Development Setup
```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug
xdebug.client_host=localhost
xdebug.client_port=9003
xdebug.break_on_first_line=0
xdebug.idekey=xdebug-mcp
xdebug.log=/tmp/xdebug.log
xdebug.log_level=5
```

### Profiling Setup
```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=profile,debug
xdebug.client_host=localhost
xdebug.client_port=9003
xdebug.profiler_output_dir=/tmp/xdebug-profile
```

### Testing Setup
```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=coverage,debug
xdebug.client_host=localhost
xdebug.client_port=9003
```

---

**Need help?** Check [Troubleshooting Guide](./troubleshooting) or [Getting Started](../guides/getting-started)
