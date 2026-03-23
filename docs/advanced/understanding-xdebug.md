---
layout: default
title: Understanding Xdebug | How Xdebug Works
description: Deep dive into Xdebug architecture, installation, modes, and how PHP debugging works. Technical understanding for advanced users.
---

# Understanding Xdebug

Deep technical understanding of how Xdebug works and how it enables PHP debugging.

## What is Xdebug?

Xdebug is a powerful PHP extension that provides:
- **Interactive Debugging** - Breakpoints, stepping, variable inspection
- **Profiling** - Performance analysis and timing
- **Tracing** - Function call logging
- **Code Coverage** - Test coverage analysis
- **Variable Display** - Rich debugging output

It's essential for PHP development and powers many IDE debuggers.

## Xdebug Architecture

### Core Components

```
┌─────────────────────────────────────────────┐
│         PHP Application                     │
│                                             │
│    Your PHP code executes here             │
└──────────────┬──────────────────────────────┘
               │
               │ (Hooks into execution)
               ▼
┌─────────────────────────────────────────────┐
│    Xdebug Extension (PHP Module)            │
│                                             │
│  - Intercepts execution                    │
│  - Manages breakpoints                     │
│  - Captures variables                      │
│  - Handles step commands                   │
└──────────────┬──────────────────────────────┘
               │
               │ (DBGp Protocol)
               │
               ▼
┌─────────────────────────────────────────────┐
│    Debugger (IDE, Agent, MCP Server)       │
│                                             │
│  - Displays code                           │
│  - Manages breakpoints                     │
│  - Shows variables                         │
│  - Commands stepping                       │
└─────────────────────────────────────────────┘
```

### How It Works

1. **PHP starts**
   - Loads Xdebug extension
   - Initializes debugging mode

2. **Script execution begins**
   - Xdebug intercepts execution
   - Checks for breakpoints
   - Pauses if breakpoint hit

3. **Debugging session active**
   - Debugger sends commands
   - Xdebug executes them
   - Reports results back

4. **Script completes**
   - Session ends
   - Variables cleaned up

## Installation Process

### Linux - Ubuntu/Debian

```bash
# Install from package manager
sudo apt-get install php-xdebug

# Or compile from source
pecl install xdebug

# Enable extension
php5enmod xdebug  # PHP 5
phpenmod xdebug   # PHP 7+
```

### macOS - Homebrew

```bash
# Install
brew install php-xdebug

# Or
pecl install xdebug
```

### Windows

Download DLL from [xdebug.org/download](https://xdebug.org/download):
1. Select PHP version
2. Download correct DLL
3. Place in PHP `ext/` folder
4. Add to php.ini

### Verify Installation

```bash
# Check if loaded
php -m | grep xdebug

# Full info
php -i | grep -A 10 "xdebug"

# Should show version
php -v | grep Xdebug
```

## Xdebug Modes

Xdebug supports multiple operational modes:

### Debug Mode

**Purpose:** Interactive debugging

**Configuration:**
```ini
xdebug.mode=debug
```

**Features:**
- Breakpoints
- Stepping through code
- Variable inspection
- Stack traces
- Remote debugging

**Overhead:** 5-10x slower

**Used By:** IDEs, agents, debuggers

### Profile Mode

**Purpose:** Performance analysis

**Configuration:**
```ini
xdebug.mode=profile
```

**Features:**
- Function execution times
- Call counts
- Memory usage
- Performance bottlenecks

**Output:** Cachegrind format files

### Trace Mode

**Purpose:** Execution logging

**Configuration:**
```ini
xdebug.mode=trace
```

**Features:**
- All function calls logged
- Entry/exit information
- Detailed execution flow
- Very verbose output

**Overhead:** 10-20x slower

### Coverage Mode

**Purpose:** Code coverage analysis

**Configuration:**
```ini
xdebug.mode=coverage
```

**Features:**
- Lines executed
- Lines not executed
- Coverage percentages
- Test coverage metrics

### GCStats Mode

**Purpose:** Garbage collector statistics

**Configuration:**
```ini
xdebug.mode=gcstats
```

**Features:**
- Memory allocation patterns
- Garbage collection events
- Memory usage statistics

### Multiple Modes

```ini
# Enable multiple modes simultaneously
xdebug.mode=debug,profile,coverage
```

## The DBGp Protocol

Xdebug communicates using the **DBGp Protocol** - an XML-based debugging protocol.

### Protocol Flow

```
1. PHP starts with Xdebug
2. Xdebug initiates connection
3. Debugger accepts connection
4. Initialization handshake

5. Script pauses at breakpoint
6. Debugger sends: "step_over"
7. Xdebug executes one line
8. Debugger queries: "property_get"
9. Xdebug returns: Variable values

10. Script completes
11. Debugger sends: "detach"
12. Connection closes
```

See [DBGp Protocol](./dbgp-protocol) for detailed specification.

## IDE Key Configuration

The **IDE Key** is an identifier that tells Xdebug which debugger to connect to.

```ini
xdebug.idekey=xdebug-mcp
```

### How It Works

1. Script starts with IDE key
2. Xdebug reads IDE key from config
3. Debugger listens for that key
4. Xdebug connects to matching debugger
5. Session established

### Standard IDE Keys

- `phpstorm` - PhpStorm/IntelliJ IDEs
- `vscode` - Visual Studio Code
- `netbeans` - NetBeans IDE
- `xdebug-mcp` - Xdebug MCP Server
- Custom values allowed

## Execution Flow

### Without Debugging

```
Script Start
  ↓
Execute Line 1
  ↓
Execute Line 2
  ↓
... (no pauses)
  ↓
Script End
```

### With Debugging

```
Script Start
  ↓
Check Breakpoint at Line 1 (not set)
  ↓
Execute Line 1
  ↓
Check Breakpoint at Line 2 (SET!)
  ↓
PAUSE - Wait for Debugger Command
  ↓
[Debugger: Inspect $var, Get Stack, etc.]
  ↓
Continue to Line 3
  ↓
Execute Line 3
  ↓
Script End
```

## Variable Handling

### Scope Levels

Xdebug provides three scope levels:

```
Global Scope
  - Global variables ($GLOBALS)
  - Super globals ($_GET, $_POST, etc.)

Local Scope
  - Function local variables
  - Parameters
  - Static variables

Object/Array Scope
  - Object properties
  - Array elements
  - Nested structures
```

### Variable Representation

Variables are serialized as XML:

```xml
<property name="$amount" type="int">
  <value>100</value>
</property>

<property name="$user" type="object" class="User">
  <property name="id" type="int">
    <value>123</value>
  </property>
  <property name="name" type="string">
    <value>John Doe</value>
  </property>
</property>

<property name="$items" type="array" numchildren="3">
  <property index="0" type="float">
    <value>19.99</value>
  </property>
  <property index="1" type="float">
    <value>29.99</value>
  </property>
  <property index="2" type="float">
    <value>39.99</value>
  </property>
</property>
```

## Performance Considerations

### Overhead by Mode

| Mode | Overhead | Use Case |
|------|----------|----------|
| Off | 0% | Production |
| Debug | 5-10x | Development |
| Profile | 2-5x | Performance analysis |
| Trace | 10-20x | Detailed analysis |
| Coverage | 3-8x | Test coverage |

### Optimization Strategies

1. **Disable in production**
   ```ini
   xdebug.mode=off
   ```

2. **Use selective debugging**
   ```ini
   xdebug.trigger_value=debug
   xdebug.trigger=GET
   # Then use: ?debug=1
   ```

3. **Increase limits for complex code**
   ```ini
   xdebug.max_nesting_level=512
   ```

4. **Optimize variable display**
   ```ini
   xdebug.var_display_max_depth=10
   xdebug.var_display_max_data=10000
   xdebug.var_display_max_children=100
   ```

## Version History

### Xdebug 2.x

- Traditional version
- Widely used
- Good IDE support
- Some limitations

### Xdebug 3.x

- Major rewrite
- Better performance
- Simplified configuration
- Multiple modes support

**Current:** Xdebug 3.2+

## Security Considerations

### Production Safety

**Never** enable debugging in production:

```ini
# ✗ NEVER in production
xdebug.mode=debug

# ✓ Production setup
xdebug.mode=off
# Or just don't load extension
```

### Network Security

For remote debugging:
- Use VPN or SSH tunneling
- Don't expose debugger to internet
- Restrict firewall rules
- Use authentication

### Variable Exposure

When exposing debug output:
- Be careful with sensitive data
- Don't log passwords/tokens
- Consider what's visible in variables
- Sanitize debug output

## Browser Integration

### Xdebug Browser Extension

Install browser extension to trigger debugging:

```javascript
// Click extension button sends:
// Cookie: XDEBUG_SESSION=1
// or GET param: ?XDEBUG_SESSION=1
```

### Web Debugging Flow

```
1. Browser makes request
2. Browser has XDEBUG_SESSION cookie
3. Xdebug detects session trigger
4. Script pauses at breakpoints
5. Debugger receives commands
6. Browser waits for response
7. Debugging completes
8. Response sent to browser
```

## Testing with Xdebug

### Coverage Reports

```bash
# Generate coverage report
# Requires xdebug.mode=coverage
```

Output formats:
- HTML report
- Clover XML
- Cobertura XML
- Text summary

### Performance Profiling

```bash
# Profile script execution
# Requires xdebug.mode=profile
```

Analyze with:
- KCachegrind
- QCachegrind
- WebGrind
- Online tools

## Comparison with Other Debuggers

| Debugger | Pros | Cons |
|----------|------|------|
| Xdebug | Full-featured, standard | Configuration needed |
| Blackfire | Cloud-based, nice UI | Paid service |
| IdeaVim | IDE-integrated | Limited to IDE |
| var_dump | Built-in, simple | No breakpoints |

## Limitations

1. **Requires Extension**
   - Must be installed
   - May not be available on shared hosting

2. **Performance Impact**
   - 5-10x slower in debug mode
   - Not suitable for production

3. **Network Latency**
   - Remote debugging slower
   - TCP overhead

4. **Complexity**
   - Needs proper configuration
   - Connection issues possible

## Best Practices

1. **Always disable in production**
   - Set mode=off
   - Or don't load extension

2. **Use selective debugging**
   - Don't debug everything
   - Use trigger values

3. **Clean up sessions**
   - Remove old debug sessions
   - Close connections properly

4. **Monitor performance**
   - Debug mode is slow
   - Use profiling to find bottlenecks

5. **Secure remote debugging**
   - Use VPN/SSH tunnels
   - Restrict network access
   - Use strong authentication

---

**Next Steps:**
- [DBGp Protocol](./dbgp-protocol) - Protocol details
- [Debugging Guide](../guides/debugging-guide) - Practical debugging
- [Configuration](../reference/configuration) - Configuration details
