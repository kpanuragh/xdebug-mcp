---
layout: default
title: MCP Server Architecture | Xdebug MCP
description: Technical architecture of Xdebug MCP Server. System design, components, data flow, and implementation details.
permalink: /:collection/:name/
---

# MCP Server Architecture

Technical deep-dive into Xdebug MCP Server architecture, components, and how it bridges MCP clients with Xdebug's DBGp protocol.

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│         MCP Clients (AI Agents, IDEs)                  │
│  Claude Code, Cursor, Cline, VS Code, PhpStorm, etc.   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ MCP Protocol (JSON-RPC)
                  │
┌─────────────────▼───────────────────────────────────────┐
│        Xdebug MCP Server (Node.js)                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  MCP Server Framework                            │  │
│  │  - Handles client connections                    │  │
│  │  - Processes MCP messages                        │  │
│  │  - Routes to tools                               │  │
│  └──────────────────────────────────────────────────┘  │
│                  │                                      │
│  ┌──────────────▼──────────────────────────────────┐  │
│  │  Tool Handlers                                   │  │
│  │  - Breakpoint management                        │  │
│  │  - Execution control                            │  │
│  │  - Variable inspection                          │  │
│  │  - Stack trace handling                         │  │
│  └──────────────┬──────────────────────────────────┘  │
│                  │                                      │
│  ┌──────────────▼──────────────────────────────────┐  │
│  │  DBGp Protocol Handler                          │  │
│  │  - Sends DBGp commands to Xdebug               │  │
│  │  - Parses XML responses                        │  │
│  │  - Manages connection                          │  │
│  └──────────────┬──────────────────────────────────┘  │
│                  │                                      │
└─────────────────┼──────────────────────────────────────┘
                  │
                  │ DBGp Protocol (XML)
                  │
┌─────────────────▼───────────────────────────────────────┐
│         PHP with Xdebug Extension                      │
│                                                         │
│  Executing your PHP application                        │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server Framework

**Purpose:** Interface with MCP clients

**Responsibilities:**
- Accept client connections
- Parse MCP messages (JSON-RPC 2.0)
- Route to appropriate handlers
- Send responses back to clients

**Technologies:**
- Node.js server
- JSON-RPC 2.0 protocol
- Stdio/TCP transport

### 2. Tool Handlers

**Purpose:** Implement debugging tools

**Key Tools:**
```
- set_breakpoint()
- get_breakpoints()
- clear_breakpoint()
- continue_execution()
- step_into()
- step_over()
- step_out()
- get_variables()
- get_variable()
- get_stack_trace()
- get_source_code()
```

**Handler Flow:**
```
MCP Client Request
  ↓
Tool Handler receives parameters
  ↓
Validate parameters
  ↓
Create DBGp command
  ↓
Send to Xdebug
  ↓
Parse response
  ↓
Format for MCP client
  ↓
Send response
```

### 3. DBGp Protocol Handler

**Purpose:** Communicate with Xdebug

**Responsibilities:**
- Maintain socket connection to Xdebug
- Build DBGp XML commands
- Parse XML responses
- Handle protocol errors

**Connection Management:**
- TCP: `localhost:9003`
- Unix Socket: `/tmp/xdebug.sock`
- Auto-reconnect on failure

### 4. Session Manager

**Purpose:** Track debugging sessions

**Tracks:**
- Active debugging sessions
- Breakpoints per session
- Execution state
- Variable context

**Session Lifecycle:**
```
[Not Started]
     ↓
[Initialized] ← Xdebug connects
     ↓
[Running] ← Script executing
     ↓
[Paused] ← Breakpoint hit
     ↓
[Running] ← Resume execution
     ↓
[Stopped] ← Script completed
```

### 5. Pending Breakpoints Manager

**Purpose:** Handle breakpoints before code is loaded

**Problem:** Breakpoints might be set before file is loaded

**Solution:**
- Store requested breakpoints
- Track which are actually set
- Retry setting on new files
- Fallback to line-by-line execution

**Fallback Strategy:**
```
Phase 1: Try set_breakpoint (first try)
         ↓ (if fails)
Phase 2: Store pending breakpoint
         ↓ (on next break)
Phase 3: Check pending breakpoints
         ↓
         Set via line-by-line execution
```

## Data Flow Examples

### Example 1: Setting a Breakpoint

```
MCP Client (Claude Code)
  │
  │ "set_breakpoint" tool
  │ { file: "/var/www/checkout.php", line: 45 }
  │
  ▼
Tool Handler (set_breakpoint)
  │
  │ Parse parameters
  │ Validate file path (absolute required)
  │ Validate line number
  │
  ▼
DBGp Protocol Handler
  │
  │ Create XML:
  │ <breakpoint_set type="line"
  │     filename="file:///var/www/checkout.php"
  │     lineno="45" />
  │
  ▼
Xdebug (PHP Extension)
  │
  │ Store breakpoint
  │ Enable at line 45
  │
  ▼
DBGp Protocol Handler
  │
  │ Parse response:
  │ <response state="enabled" id="bp_1" />
  │
  ▼
Tool Handler
  │
  │ Format response
  │ Return to client
  │
  ▼
MCP Client
  │
  │ Receive: Breakpoint set at line 45
  │
```

### Example 2: Continuing Execution

```
MCP Client
  │
  │ "continue_execution" tool
  │
  ▼
Tool Handler (continue_execution)
  │
  │ Validate session active
  │ Update session state
  │
  ▼
DBGp Protocol Handler
  │
  │ Send: <run />
  │
  ▼
Xdebug
  │
  │ Resume script execution
  │ Check breakpoints
  │ Execute until next breakpoint
  │
  ▼
DBGp Protocol Handler
  │
  │ Receive response:
  │ <response status="break" reason="breakpoint" />
  │
  ▼
Session Manager
  │
  │ Update execution state
  │ Store current location
  │ Mark ready for variable inspection
  │
  ▼
Tool Handler
  │
  │ Extract execution context
  │ Format response
  │
  ▼
MCP Client
  │
  │ Receive: Script paused at line 78, function: calculateTotal
  │
```

### Example 3: Inspecting Variables

```
MCP Client
  │
  │ "get_variable" tool
  │ { name: "$user" }
  │
  ▼
Tool Handler (get_variable)
  │
  │ Validate variable name format
  │ Check session paused
  │
  ▼
DBGp Protocol Handler
  │
  │ Send: <property_get name="$user" />
  │
  ▼
Xdebug
  │
  │ Retrieve variable from current context
  │ Serialize to XML
  │
  ▼
DBGp Protocol Handler
  │
  │ Receive XML property
  │ Parse structure
  │ Convert to JSON
  │
  ▼
Tool Handler
  │
  │ Process object properties
  │ Handle nested structures
  │ Limit depth if needed
  │
  ▼
MCP Client
  │
  │ Receive:
  │ {
  │   $user: {
  │     type: "object",
  │     class: "User",
  │     properties: {
  │       id: 123,
  │       name: "John Doe",
  │       email: "john@example.com"
  │     }
  │   }
  │ }
  │
```

## Configuration Management

### Environment Variables

```bash
XDEBUG_HOST=0.0.0.0          # TCP bind address
XDEBUG_PORT=9003             # TCP port
XDEBUG_SOCKET_PATH=/tmp/...  # Unix socket path
DEBUG=xdebug-mcp             # Verbose logging
```

### Auto-Detection

Server automatically:
1. Checks environment variables
2. Determines connection mode (TCP vs Unix socket)
3. Sets up appropriate listener
4. Logs configuration

```
Config Detection:
  ├─ XDEBUG_SOCKET_PATH set?
  │  ├─ YES → Unix socket mode
  │  └─ NO  → Check TCP settings
  │
  └─ XDEBUG_PORT/HOST set?
     ├─ YES → Use provided values
     └─ NO  → Use defaults (0.0.0.0:9003)
```

## Error Handling Strategy

### Three-Phase Error Handling

#### Phase 1: Session Creation
- Validate Xdebug connected
- Initialize session context
- Fallback: Error on connection failure

#### Phase 2: Breakpoint Initialization
- Set breakpoints
- Fallback: Store as pending, retry on next break

#### Phase 3: Execution
- Execute step commands
- Inspect variables
- Fallback: Graceful degradation

### Error Recovery

```
Try DBGp Command
  │
  ├─ Success → Return response
  │
  ├─ Timeout → Retry once, then error
  │
  ├─ Protocol Error → Log and continue
  │
  └─ Connection Lost → Attempt reconnect
      │
      ├─ Reconnect successful → Retry command
      │
      └─ Reconnect failed → End session
```

## Concurrency Model

### Single Session (One Active Debug)

Xdebug MCP Server handles:
- One debugging session at a time
- Sequential command processing
- Ordered responses

```
Session 1 (Active)
  ├─ Connected to Xdebug
  ├─ Breakpoints set
  ├─ Variables tracked
  │
Session 2 (Queued)
  └─ Waits for Session 1 to complete
```

### Multiple Connections

MCP clients can connect independently:
```
Client 1 (Claude)        Client 2 (Cursor)        Client 3 (VS Code)
  │                            │                         │
  └──────────┬──────────────────┴───────────────────────┘
             │
       One Xdebug Server
             │
        One Active Debug Session
```

## Socket Connection Handling

### TCP Socket

```
Connection Pool:
┌────────────────────┐
│ Xdebug Connection  │
│ - socket object    │
│ - buffer           │
│ - timeout: 30s     │
│ - encoding: UTF-8  │
└────────────────────┘
```

### Unix Domain Socket

```
Socket File:
/tmp/xdebug.sock
├─ Created on startup
├─ Permissions: 666 (world readable/writable)
├─ Auto-cleaned on restart
└─ Faster than TCP (no network overhead)
```

### Connection Pooling

- Single persistent connection
- Reused for all commands
- Auto-reconnect on failure
- Configurable timeout

## Performance Characteristics

### Latency

```
Operation                  TCP      Unix Socket
─────────────────────────────────────────────
Breakpoint set            50ms     5ms
Step command              80ms     8ms
Property inspection       50ms     5ms
Stack trace               150ms    15ms
─────────────────────────────────────────────
Average overhead          ~10x slower with TCP
```

### Memory Usage

```
Per Session:
├─ Session context:     ~1-2 MB
├─ Breakpoint store:    ~0.1 MB per 10 breakpoints
├─ Variable cache:      ~5-10 MB (grows with inspection)
└─ Buffer:              ~1 MB

Total per session: ~10-20 MB average
```

## Security Architecture

### Socket Permissions

Unix sockets:
- File permissions: 666 (local access)
- Any local user can debug
- Not suitable for multi-user servers

TCP sockets:
- Bind to localhost by default
- Not accessible from network
- Firewall can restrict further

### No Authentication

Current version:
- No built-in authentication
- Assumes trusted local network
- Suitable for development only

Future:
- Could add token-based auth
- HTTPS for TCP connections
- Role-based access control

## Extensibility

### Adding New Tools

```
1. Define tool in schema
2. Create handler function
3. Implement DBGp communication
4. Handle errors and edge cases
5. Format response for MCP
6. Add tests
```

Example structure:
```javascript
{
  name: "custom_tool",
  description: "Does something special",
  inputSchema: {
    properties: {
      param: { type: "string" }
    }
  },
  handler: async (params) => {
    // DBGp communication
    // Response formatting
  }
}
```

## Logging & Debugging

### Debug Levels

```bash
DEBUG=xdebug-mcp        # Standard debug
DEBUG=xdebug-mcp:*      # All debug messages
DEBUG=xdebug-mcp:dbgp   # DBGp protocol only
DEBUG=xdebug-mcp:tools  # Tool handlers only
```

### Log Output

```
[2024-03-23 10:30:00] INFO Server listening on localhost:9003
[2024-03-23 10:30:05] DEBUG Xdebug connected from 127.0.0.1:12345
[2024-03-23 10:30:10] DEBUG Setting breakpoint at checkout.php:45
[2024-03-23 10:30:15] INFO Script paused at breakpoint
[2024-03-23 10:30:20] DEBUG Variable inspection: $total = 108.5
[2024-03-23 10:30:25] INFO Script completed
```

## Typical Workflow

```
1. Server starts
   └─ Listens for Xdebug connections
   └─ Listens for MCP client connections

2. PHP with Xdebug runs
   └─ Xdebug connects to server
   └─ Sends init message
   └─ Server initializes session

3. MCP Client connects
   └─ Client sends breakpoint commands
   └─ Server converts to DBGp
   └─ Xdebug stores breakpoints

4. Script executes
   └─ Hits breakpoint
   └─ Pauses and waits
   └─ Server notifies client

5. Client inspects
   └─ Requests variables
   └─ Requests stack trace
   └─ Requests code

6. Client continues
   └─ Sends step/continue command
   └─ Server forwards to Xdebug
   └─ Script resumes

7. Script completes
   └─ Xdebug disconnects
   └─ Server cleans up session

8. Client disconnects
   └─ Server closes connection
```

## Future Improvements

### Planned Features

1. **Multiple Concurrent Sessions**
   - Support multiple debug sessions
   - Client-specific breakpoints

2. **Enhanced Performance**
   - Connection pooling improvements
   - Caching of context data
   - Optimized serialization

3. **Better Security**
   - Token-based authentication
   - SSL/TLS support
   - Rate limiting

4. **Advanced Tools**
   - Expression evaluation
   - Function breakpoints
   - Memory profiling

5. **Better Error Handling**
   - Graceful degradation
   - Automatic recovery
   - Better error messages

---

**Related:**
- [DBGp Protocol](../advanced/dbgp-protocol/) - Protocol details
- [Understanding Xdebug](../advanced/understanding-xdebug/) - How Xdebug works
- [Configuration](../reference/configuration/) - Server configuration
