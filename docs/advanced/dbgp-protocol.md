---
layout: default
title: DBGp Protocol Specification | Xdebug
description: Complete DBGp protocol documentation. XML-based debugging protocol used by Xdebug with commands, responses, and examples.
permalink: /:collection/:name/
---

# DBGp Protocol Specification

Complete specification of the DBGp (Debugger Protocol) - the XML-based protocol used by Xdebug for debugging communication.

## Protocol Overview

**DBGp** (Debugger Protocol) is a simple, lightweight XML-based protocol for debugging.

### Key Features

- **XML-Based** - All communication in XML format
- **Session-Oriented** - Connection-based debugging session
- **Command-Response** - Client sends commands, server responds
- **Context-Aware** - Tracks execution context and scope

### Standard Ports

- Default: **9003** (TCP)
- Custom: Any available port
- Unix Socket: `/tmp/xdebug.sock`

## Session Initialization

### Initial Handshake

When Xdebug connects, it sends initialization response:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<init appid="xdebug"
      appversion="3.2.0"
      idekey="xdebug-mcp"
      session="session_12345"
      thread="1"
      parent="127.0.0.1"
      language="PHP"
      languageVersion="8.1.0"
      fileuri="file:///var/www/app/index.php"
      xdebug:version="3.2.0">
</init>
```

### Required Elements

| Element | Meaning |
|---------|---------|
| `appid` | Application ID (always "xdebug") |
| `appversion` | Xdebug version |
| `idekey` | IDE key identifier |
| `session` | Session ID |
| `language` | Programming language ("PHP") |
| `languageVersion` | PHP version |
| `fileuri` | Initial script URI |

## Core Commands

### Status Command

**Purpose:** Query debugger status

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<status -i transaction_id></status>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response
    command="status"
    transaction_id="1"
    status="break"
    reason="ok"></response>
```

**Status Values:**
- `starting` - Debugger starting
- `stopping` - Debugger stopping
- `stopped` - Debugger stopped
- `running` - Script executing
- `break` - Paused at breakpoint

### Continue Execution

**Purpose:** Resume execution

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<run -i transaction_id></run>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response
    command="run"
    transaction_id="2"
    status="break"
    reason="breakpoint">
</response>
```

### Step Commands

#### Step Into
Execute next line, entering function calls:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<step_into -i transaction_id></step_into>
```

#### Step Over
Execute next line, skip function calls:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<step_over -i transaction_id></step_over>
```

#### Step Out
Execute until function returns:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<step_out -i transaction_id></step_out>
```

## Breakpoint Commands

### Set Breakpoint

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<breakpoint_set
    -i transaction_id
    type="line"
    filename="file:///var/www/app/checkout.php"
    lineno="45">
</breakpoint_set>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response
    command="breakpoint_set"
    transaction_id="3"
    state="enabled"
    id="breakpoint_1"></response>
```

**Breakpoint Types:**
- `line` - Line number breakpoint
- `call` - Function call breakpoint
- `return` - Function return breakpoint
- `exception` - Exception breakpoint
- `watch` - Variable watch breakpoint

### Get Breakpoints

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<breakpoint_list -i transaction_id></breakpoint_list>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response command="breakpoint_list" transaction_id="4">
  <breakpoint id="breakpoint_1"
              type="line"
              filename="file:///var/www/app/checkout.php"
              lineno="45"
              state="enabled"
              hit_count="0"
              hit_value="0">
  </breakpoint>
  <breakpoint id="breakpoint_2"
              type="line"
              filename="file:///var/www/app/handlers.php"
              lineno="89"
              state="enabled"
              hit_count="2"
              hit_value="0">
  </breakpoint>
</response>
```

### Remove Breakpoint

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<breakpoint_remove
    -i transaction_id
    d="breakpoint_1"></breakpoint_remove>
```

## Variable Inspection

### Context Get

**Purpose:** Get variables in current context

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<context_get
    -i transaction_id
    d="0"
    c="0"></context_get>
```

**Parameters:**
- `d` - Depth (stack frame)
- `c` - Context (0=local, 1=global, 2=superglobals)

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response command="context_get" transaction_id="5">
  <property name="$amount" fullname="$amount" type="int" size="4">
    <value>100</value>
  </property>
  <property name="$tax" fullname="$tax" type="float" size="8">
    <value>8.5</value>
  </property>
  <property name="$total" fullname="$total" type="float" size="8">
    <value>108.5</value>
  </property>
</response>
```

### Property Get

**Purpose:** Inspect specific variable

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<property_get
    -i transaction_id
    n="$user"
    d="0"></property_get>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response command="property_get" transaction_id="6">
  <property name="$user" fullname="$user" type="object" class="User">
    <property name="id" fullname="$user->id" type="int">
      <value>123</value>
    </property>
    <property name="name" fullname="$user->name" type="string">
      <value xdebug:type="string">John Doe</value>
    </property>
    <property name="email" fullname="$user->email" type="string">
      <value xdebug:type="string">john@example.com</value>
    </property>
  </property>
</response>
```

## Stack Trace

### Stack Get

**Purpose:** Get current call stack

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<stack_get -i transaction_id></stack_get>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response command="stack_get" transaction_id="7">
  <stack level="0"
         type="file"
         filename="file:///var/www/app/checkout.php"
         lineno="45"
         where="calculateTotal"></stack>
  <stack level="1"
         type="file"
         filename="file:///var/www/app/checkout.php"
         lineno="128"
         where="handleCheckout"></stack>
  <stack level="2"
         type="file"
         filename="file:///var/www/app/index.php"
         lineno="1"
         where="main"></stack>
</response>
```

## Source Code

### Source Get

**Purpose:** Get source code

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<source -i transaction_id
        f="file:///var/www/app/checkout.php"
        b="40"
        e="60"></source>
```

**Parameters:**
- `f` - File URI
- `b` - Begin line
- `e` - End line

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response command="source" transaction_id="8">
  <source encoding="UTF-8"><![CDATA[
40:   $subtotal = array_sum($items);
41:   $tax = $subtotal * $taxRate;
42:   $total = $subtotal + $tax;
43:   return $total;
44: }
45:
46: $items = [19.99, 29.99, 39.99];
  ]]></source>
</response>
```

## Session Management

### Detach

**Purpose:** End debugging session

**Request:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<detach -i transaction_id></detach>
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response
    command="detach"
    transaction_id="9"
    status="stopped"></response>
```

## Variable Types

DBGp supports these variable types:

| Type | Example | Notes |
|------|---------|-------|
| `null` | `null` | NULL value |
| `bool` | `true`, `false` | Boolean |
| `int` | `123` | Integer |
| `float` | `3.14` | Float/double |
| `string` | `"hello"` | String (length included) |
| `array` | Multiple elements | Array (numchildren count) |
| `object` | Properties | Object instance |
| `resource` | File handle | PHP resource |

## Error Responses

### Error Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response command="property_get"
          transaction_id="10"
          status="stopped"
          reason="error">
  <error code="300">
    <message>Can not find property</message>
  </error>
</response>
```

### Error Codes

| Code | Meaning |
|------|---------|
| 1 | Parse error |
| 3 | Invalid option |
| 4 | Unimplemented command |
| 5 | Command unavailable |
| 100 | Cannot get property |
| 200 | Breakpoint state error |
| 300 | Parse error in expression |
| 999 | Unknown error |

## Transaction IDs

Every command has a transaction ID to match requests with responses:

```xml
<!-- Request -->
<run -i 1></run>

<!-- Response - same ID -->
<response command="run" transaction_id="1" ...></response>
```

Transaction IDs:
- Unique per session
- Sequential (1, 2, 3, ...)
- Used to correlate requests/responses

## Encoding

All messages are UTF-8 encoded:

```xml
<?xml version="1.0" encoding="UTF-8"?>
```

Binary data is base64-encoded:

```xml
<property name="$data" type="string">
  <value encoding="base64">aGVsbG8gd29ybGQ=</value>
</property>
```

## Connection Management

### TCP Connection

```
Client                           Server
  │                                │
  ├──────────── Connect ──────────>│
  │                                │
  │<──────── Init Response ────────┤
  │                                │
  ├──────── Breakpoint_set ──────>│
  │<──────── Response ─────────────┤
  │                                │
  ├──────── Continue ─────────────>│
  │<──────── Response ─────────────┤
  │                                │
  ├──────── Property_get ────────>│
  │<──────── Response ─────────────┤
  │                                │
  ├──────── Detach ───────────────>│
  │<──────── Response ─────────────┤
  │                                │
  ├──────── Close Connection ────>│
  │                                │
```

### Session Timeout

- Default: No timeout
- Can configure via config
- Automatic cleanup on disconnect

## Advanced Features

### Conditional Breakpoints

```xml
<breakpoint_set
    -i transaction_id
    type="line"
    filename="file:///var/www/app/checkout.php"
    lineno="45"
    hit_condition="=="
    hit_value="5"></breakpoint_set>
```

Breaks when hit count equals specific value.

### Expression Evaluation

```xml
<eval -i transaction_id>
  <![CDATA[
    $amount * 1.1
  ]]>
</eval>
```

Evaluates arbitrary expressions in current context.

## Best Practices

1. **Always include transaction ID**
   - Correlation is essential
   - Sequential numbering

2. **Use proper encoding**
   - UTF-8 for all text
   - Base64 for binary

3. **Handle timeouts**
   - Implement connection timeouts
   - Graceful error handling

4. **Respect protocol**
   - Follow command syntax strictly
   - Handle all response types

5. **Clean shutdown**
   - Always send detach
   - Close connection properly

## References

- [Official DBGp Documentation](https://xdebug.org/docs-dbgp)
- [Xdebug Protocol](https://xdebug.org/docs/dbgp)

---

**Next Steps:**
- [MCP Architecture](../advanced/mcp-architecture/) - How Xdebug MCP Server uses DBGp
- [Debugging Guide](../guides/debugging-guide/) - Practical debugging
