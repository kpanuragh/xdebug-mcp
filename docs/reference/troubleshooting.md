---
layout: default
title: Troubleshooting Guide | Xdebug MCP
description: Fix common Xdebug MCP issues. Installation problems, connection errors, breakpoint issues, and more with solutions.
permalink: /:collection/:name/
---

# Troubleshooting Guide

Solutions for common Xdebug MCP issues. Use this guide to diagnose and fix problems.

## Installation Issues

### "npm: command not found"

**Problem:** Node.js not installed or not in PATH

**Solution:**

Install Node.js:
```bash
# macOS (Homebrew)
brew install node

# Ubuntu/Debian
sudo apt-get install nodejs npm

# Windows: Download from nodejs.org

# Verify installation
node --version
npm --version
```

### "xdebug-mcp: command not found"

**Problem:** Package installed but not in PATH

**Solution:**

Check if installed:
```bash
npm list -g xdebug-mcp
```

Reinstall globally:
```bash
npm install -g xdebug-mcp
```

Check PATH:
```bash
echo $PATH
```

Add npm to PATH (macOS/Linux):
```bash
export PATH="/usr/local/bin:$PATH"
```

### "EACCES: permission denied"

**Problem:** Insufficient permissions for global install

**Solution:**

Option 1 - Use sudo (not recommended):
```bash
sudo npm install -g xdebug-mcp
```

Option 2 - Fix npm permissions (recommended):
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Then install normally
npm install -g xdebug-mcp
```

---

## Server Startup Issues

### "Port 9003 already in use"

**Problem:** Another service using port 9003

**Solution:**

Find what's using the port:
```bash
lsof -i :9003
netstat -tlnp | grep 9003
```

Kill the process:
```bash
kill -9 <PID>
```

Or use different port:
```bash
XDEBUG_PORT=9004 xdebug-mcp

# Update php.ini
xdebug.client_port=9004
```

### "Cannot bind to address"

**Problem:** Network binding issue

**Solution:**

Try specific address:
```bash
XDEBUG_HOST=127.0.0.1 xdebug-mcp
```

Or all interfaces:
```bash
XDEBUG_HOST=0.0.0.0 xdebug-mcp
```

Check firewall:
```bash
sudo ufw allow 9003
```

### Server crashes on startup

**Problem:** Configuration or initialization error

**Solution:**

Check with debug output:
```bash
DEBUG=xdebug-mcp xdebug-mcp
```

Check logs:
```bash
tail -f /tmp/xdebug-mcp.log
```

Reset to defaults:
```bash
XDEBUG_PORT=9003 XDEBUG_HOST=0.0.0.0 xdebug-mcp
```

---

## Xdebug Extension Issues

### "Xdebug extension not loaded"

**Problem:** PHP doesn't have Xdebug installed

**Solution:**

Verify installation:
```bash
php -v | grep Xdebug
```

If missing, install:
```bash
pecl install xdebug
# or
sudo apt-get install php-xdebug
```

Find php.ini:
```bash
php -i | grep "Scan this dir for"
```

Add to that directory:
```ini
zend_extension=xdebug
```

Verify loaded:
```bash
php -m | grep xdebug
```

### "Xdebug not connecting"

**Problem:** PHP can't connect to MCP Server

**Comprehensive Checklist:**

1. **Server running?**
   ```bash
   lsof -i :9003
   # Should show xdebug-mcp listening
   ```

2. **PHP configured?**
   ```bash
   php -i | grep -A 5 xdebug

   # Should show:
   # xdebug.mode => debug
   # xdebug.client_host => localhost
   # xdebug.client_port => 9003
   ```

3. **Correct port in both places?**
   ```bash
   # php.ini
   xdebug.client_port=9003

   # Server start
   XDEBUG_PORT=9003 xdebug-mcp
   ```

4. **Firewall blocking?**
   ```bash
   # macOS
   sudo lsof -i -P -n | grep LISTEN

   # Ubuntu
   sudo ufw status
   sudo ufw allow 9003
   ```

5. **Check Xdebug log:**
   ```bash
   # Set in php.ini
   xdebug.log=/tmp/xdebug.log
   xdebug.log_level=10

   # View log
   tail -f /tmp/xdebug.log
   ```

6. **Test connectivity:**
   ```bash
   php -r "echo 'PHP working';"
   # If no error, PHP is fine
   ```

---

## Execution Issues

### "Connection refused"

**Problem:** MCP Server not listening

**Solution:**

Check server status:
```bash
ps aux | grep xdebug-mcp
```

Start server:
```bash
xdebug-mcp
```

Verify listening:
```bash
netstat -tlnp | grep 9003
lsof -i :9003
```

### "Script executes without pausing"

**Problem:** Breakpoints not working or not set

**Solution:**

1. Set breakpoint before running:
   ```bash
   set_breakpoint(file=/path/file.php, line=25)
   ```

2. Verify breakpoints applied:
   ```bash
   get_breakpoints()
   ```

3. Check file path format:
   - Must be absolute path
   - Example: `/var/www/app.php` (not `app.php`)

4. Check line number valid:
   - Line must exist
   - Line must have executable code (not blank/comment)

### "Timeout waiting for connection"

**Problem:** Xdebug takes too long to connect

**Solution:**

Check network:
```bash
ping localhost
```

Reduce PHP overhead:
- Disable other extensions
- Use fewer breakpoints
- Close unnecessary applications

Increase timeout (if supported):
```ini
xdebug.connect_timeout=5
```

### "Session not created"

**Problem:** Error creating debug session

**Solution:**

Check server logs:
```bash
DEBUG=xdebug-mcp xdebug-mcp
```

Verify server healthy:
```bash
xdebug-mcp --version
```

Check system resources:
```bash
free -h  # RAM
df -h    # Disk space
```

---

## Unix Socket Issues

### "Socket file not found"

**Problem:** Unix socket not created

**Solution:**

Verify socket created:
```bash
ls -la /tmp/xdebug.sock
```

Check socket with lsof:
```bash
lsof /tmp/xdebug.sock
```

Check server logs:
```bash
DEBUG=xdebug-mcp xdebug-mcp
```

Manual socket creation test:
```bash
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp
```

### "Permission denied" (socket)

**Problem:** Insufficient file permissions

**Solution:**

Check permissions:
```bash
stat /tmp/xdebug.sock
```

Fix permissions:
```bash
chmod 666 /tmp/xdebug.sock
```

Or run as same user as PHP:
```bash
sudo -u www-data xdebug-mcp
```

Ensure consistent user:
```bash
whoami  # Check current user
id www-data  # Check PHP user
```

### "Address already in use" (socket)

**Problem:** Stale socket file exists

**Solution:**

Check if running:
```bash
lsof /tmp/xdebug.sock
```

Remove stale socket:
```bash
rm -f /tmp/xdebug.sock
```

Server auto-cleans on startup:
```bash
XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp
```

---

## Variable Inspection Issues

### "Cannot get variable"

**Problem:** Variable not accessible in scope

**Solution:**

Check available variables:
```bash
get_variables(context=local)
```

Ensure paused at breakpoint:
```bash
# Breakpoint must be hit first
get_stack_trace()  # Verify paused
```

Check variable name syntax:
```bash
# Correct: $varname (with $)
get_variable(name=$total)

# Wrong: varname (without $)
get_variable(name=total)  # ERROR
```

### "Large variables timeout"

**Problem:** Getting large arrays/objects is slow

**Solution:**

Limit recursion depth:
```bash
get_variable(name=$data, depth=1)
```

Inspect subset:
```bash
get_variable(name=$items[0])  # Single element
```

Use pagination (if available):
```bash
# Request smaller chunks
```

### "Special characters in variable"

**Problem:** Can't inspect variables with special names

**Solution:**

Use proper escaping:
```bash
get_variable(name=$_GET)  # Superglobal
get_variable(name=$_POST)

# Array element
get_variable(name=$data['key-name'])
```

---

## Docker Issues

### "Cannot connect to container"

**Problem:** Docker network not accessible

**Solution:**

Check container IP:
```bash
docker inspect container-name | grep IPAddress
```

Use host network:
```bash
docker run --network host xdebug-mcp
```

Or port mapping:
```bash
docker run -p 9003:9003 xdebug-mcp
```

For macOS/Windows containers:
```ini
xdebug.client_host=host.docker.internal
```

### "Socket file not shared"

**Problem:** Socket file not accessible between containers

**Solution:**

Use shared volume:
```yaml
version: '3'
services:
  app:
    volumes:
      - xdebug-socket:/tmp  # Mount volume

  debugger:
    volumes:
      - xdebug-socket:/tmp  # Same volume

volumes:
  xdebug-socket:
```

Verify volume mounted:
```bash
docker inspect container-name | grep Mounts
```

Check file exists in both:
```bash
docker exec php-container ls -la /tmp/xdebug.sock
docker exec debugger-container ls -la /tmp/xdebug.sock
```

---

## Performance Issues

### "Debugging is very slow"

**Problem:** High overhead from debugging

**Solution:**

This is normal (5-10x slower). Optimization strategies:

1. Use step_over instead of step_into:
   ```bash
   step_over()  # Skip library functions
   ```

2. Limit breakpoints:
   - Only essential breakpoints
   - Clear unused ones: `clear_all_breakpoints()`

3. Reduce variable inspection:
   - Limit depth: `get_variable(name=$var, depth=1)`
   - Don't inspect huge arrays completely

4. Use Unix socket (faster than TCP):
   ```bash
   XDEBUG_SOCKET_PATH=/tmp/xdebug.sock xdebug-mcp
   ```

5. Profile to find bottlenecks:
   ```bash
   get_profiling_data()
   ```

### "High memory usage"

**Problem:** Server using too much memory

**Solution:**

Monitor memory:
```bash
top -p $(pgrep xdebug-mcp)
```

Check active sessions:
```bash
get_session_info()
```

Clear old sessions:
```bash
stop_execution()
```

Restart server:
```bash
pkill xdebug-mcp
xdebug-mcp
```

---

## Remote Debugging Issues

### "Cannot debug remote server"

**Problem:** Remote PHP can't connect back

**Solution:**

1. Set correct client_host (your machine IP):
   ```ini
   xdebug.client_host=192.168.1.100
   ```

2. Ensure firewall allows port:
   ```bash
   ufw allow from <remote-server> to any port 9003
   ```

3. Test connectivity:
   ```bash
   nc -zv 192.168.1.100 9003
   ```

4. Check remote PHP can reach host:
   ```bash
   ssh user@remote-server "php -i | grep xdebug"
   ```

---

## Configuration Issues

### "Configuration not loaded"

**Problem:** Changes to php.ini not applied

**Solution:**

Restart PHP-FPM:
```bash
sudo systemctl restart php-fpm
```

Or restart web server:
```bash
sudo systemctl restart apache2
sudo systemctl restart nginx
```

Verify new config:
```bash
php -i | grep -i xdebug
```

### "IDE Key mismatch"

**Problem:** Xdebug uses wrong IDE key

**Solution:**

Set in php.ini:
```ini
xdebug.idekey=xdebug-mcp
```

Or environment variable:
```bash
export XDEBUG_IDEKEY=xdebug-mcp
```

Verify:
```bash
php -r "echo ini_get('xdebug.idekey');"
```

---

## Logging & Debug Output

### Enable Verbose Logging

Server debug output:
```bash
DEBUG=xdebug-mcp xdebug-mcp
```

Xdebug logging in php.ini:
```ini
xdebug.log=/tmp/xdebug.log
xdebug.log_level=10
```

View logs:
```bash
tail -f /tmp/xdebug.log
tail -f /tmp/xdebug-mcp.log
```

---

## Quick Diagnostic Steps

1. **Check server running:**
   ```bash
   lsof -i :9003
   ```

2. **Check Xdebug installed:**
   ```bash
   php -v | grep Xdebug
   ```

3. **Check php.ini configured:**
   ```bash
   php -i | grep -A 5 xdebug
   ```

4. **Test simple script:**
   ```bash
   php -r "echo 'OK';"
   ```

5. **Enable verbose logging:**
   ```bash
   DEBUG=xdebug-mcp xdebug-mcp
   ```

6. **Check logs:**
   ```bash
   tail -f /tmp/xdebug.log
   ```

---

## Error Message Reference

| Error | Cause | Solution |
|-------|-------|----------|
| EADDRINUSE | Port in use | Use different port |
| EACCES | Permission denied | Use sudo or fix permissions |
| ENOTFOUND | Server not reachable | Start server, check IP |
| ENOMEM | Out of memory | Increase RAM, restart |
| ETIMEDOUT | Connection timeout | Check firewall, restart |
| ENOENT | File not found | Check file path |
| EPERM | Operation not permitted | Check user permissions |

---

## Getting Help

1. **Review [Getting Started](../guides/getting-started)** - Ensure proper setup
2. **Check [Configuration Reference](./configuration)** - Verify all settings
3. **Read [Debugging Guide](../guides/debugging-guide)** - Understand workflows
4. **Visit GitHub** - Report issue with logs: [github.com/kpanuragh/xdebug-mcp/issues](https://github.com/kpanuragh/xdebug-mcp/issues)

When reporting issues, include:
- Error messages (full output)
- PHP version: `php -v`
- Xdebug status: `php -i | grep -A 5 xdebug`
- Server command used
- Server debug output: `DEBUG=xdebug-mcp xdebug-mcp`
- Xdebug log: `cat /tmp/xdebug.log`

---

## Still Having Issues?

1. Take a systematic approach
2. Check each component separately
3. Enable verbose logging
4. Isolate the problem
5. Try minimal test case
6. Review configuration carefully
7. Search GitHub issues
8. Report with full details

**Remember:** Debugging the debugger requires patience. Start simple and add complexity gradually.
