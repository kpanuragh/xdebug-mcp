---
layout: default
title: Tools & Commands Reference | Xdebug MCP
description: Complete reference of Xdebug MCP debugging tools and commands for breakpoints, execution control, variable inspection, and stack traces.
---

# Tools & Commands Reference

Complete reference of available debugging tools and commands in Xdebug MCP.

## Breakpoint Management

### Set Breakpoint

**Purpose:** Pause execution at specific line

**Syntax:**
```
set_breakpoint(file={path}, line={number})
```

**Parameters:**
- `file`: Absolute path to PHP file (required)
- `line`: Line number with executable code (required)

**Examples:**
```bash
# Set breakpoint in checkout.php at line 45
set_breakpoint(file=/var/www/app/checkout.php, line=45)

# Set breakpoint in login.php at line 78
set_breakpoint(file=/home/user/project/auth/login.php, line=78)
```

**Best Practice:**
- Use absolute paths
- Target executable lines (not comments or blank lines)
- Set at function start or calculation points

### Get Breakpoints

**Purpose:** List all active breakpoints

**Syntax:**
```
get_breakpoints()
```

**Output:**
```
File: /var/www/app/checkout.php
  Line 45: calculateTotal()
  Line 89: applyDiscount()

File: /home/user/auth/login.php
  Line 78: verifyPassword()

Total: 3 breakpoints
```

### Clear Breakpoint

**Purpose:** Remove specific breakpoint

**Syntax:**
```
clear_breakpoint(file={path}, line={number})
```

**Example:**
```bash
clear_breakpoint(file=/var/www/app/checkout.php, line=45)
```

### Clear All Breakpoints

**Purpose:** Remove all active breakpoints

**Syntax:**
```
clear_all_breakpoints()
```

---

## Execution Control

### Continue Execution

**Purpose:** Resume execution until next breakpoint

**Syntax:**
```
continue_execution()
```

**Usage:**
- Script paused at breakpoint
- Call continue_execution()
- Script runs to next breakpoint or completion

### Step Into

**Purpose:** Execute next line, entering function calls

**Syntax:**
```
step_into()
```

**Usage:**
- Useful for debugging function internals
- Step through function logic
- Trace execution path

**Example:**
```php
$result = calculateTotal($items);  // Step into this function
```

### Step Over

**Purpose:** Execute next line, skip function calls

**Syntax:**
```
step_over()
```

**Usage:**
- Skip library function calls
- Jump over known-good functions
- Focus on your code

**Example:**
```php
$result = json_encode($data);  // Step over this function
```

### Step Out

**Purpose:** Execute until current function returns

**Syntax:**
```
step_out()
```

**Usage:**
- Exit current function
- Return to calling code
- Done debugging this function

### Stop Execution

**Purpose:** Terminate debugging session

**Syntax:**
```
stop_execution()
```

**Usage:**
- End debug session immediately
- Clean up resources
- Stop script

---

## Variable Inspection

### Get Variables

**Purpose:** List all variables in current scope

**Syntax:**
```
get_variables(context={type})
```

**Parameters:**
- `context`: `local` (current scope), `global` (global variables), `superglobal` ($_GET, $_POST, etc.)

**Examples:**
```bash
# Get local variables in current function
get_variables(context=local)

# Get global variables
get_variables(context=global)

# Get superglobals
get_variables(context=superglobal)
```

**Output:**
```
Local Variables:
  $amount = 100
  $taxRate = 0.08
  $total = 108

Global Variables:
  $config = Array
  $db = PDO Object

Superglobals:
  $_GET = [debug=1, id=123]
  $_POST = [name=John, email=john@example.com]
  $_SERVER = Array (many items)
```

### Get Variable

**Purpose:** Inspect specific variable in detail

**Syntax:**
```
get_variable(name={varname}, depth={levels})
```

**Parameters:**
- `name`: Variable name with $ (e.g., `$user`) (required)
- `depth`: Nesting depth for complex objects (optional, default 5)

**Examples:**
```bash
# Get variable $user
get_variable(name=$user)

# Get variable with deeper nesting (10 levels)
get_variable(name=$data, depth=10)

# Get superglobal
get_variable(name=$_POST)

# Get array element
get_variable(name=$items[0])
```

**Output:**
```
Variable: $user
Type: Object (User)
Value:
  id => 123
  name => "John Doe"
  email => "john@example.com"
  roles => Array (2 items)
    [0] => "user"
    [1] => "admin"
  created_at => "2024-03-23 10:30:00"
```

### Watch Variable

**Purpose:** Monitor variable changes across breakpoints

**Syntax:**
```
watch_variable(name={varname}, expression={expr})
```

**Parameters:**
- `name`: Variable name (required)
- `expression`: Custom expression to evaluate (optional)

**Examples:**
```bash
# Watch $total variable
watch_variable(name=$total)

# Watch custom expression
watch_variable(expression=$amount * 1.1)

# Watch array size
watch_variable(expression=count($items))
```

**Output (at each breakpoint):**
```
Watch: $total = 108.5
Watch: $amount * 1.1 = 110
Watch: count($items) = 3
```

---

## Code Inspection

### Get Stack Trace

**Purpose:** View function call stack leading to current point

**Syntax:**
```
get_stack_trace()
```

**Output:**
```
Call Stack (depth: 5):
  [5] processPayment() - checkout.php:45 (line 8)
  [4] handleCheckout() - checkout.php:128 (line 15)
  [3] processRequest() - handlers.php:23 (line 42)
  [2] routeRequest() - router.php:67 (line 18)
  [1] main() - index.php:1 (line 5)
```

Shows execution path to current code.

### Get Source Code

**Purpose:** View source code around current execution point

**Syntax:**
```
get_source_code(file={path}, lines={range})
```

**Parameters:**
- `file`: PHP file path (required)
- `lines`: Line range, e.g., "40-60" (optional)

**Examples:**
```bash
# Get source around breakpoint
get_source_code(file=/var/www/app/checkout.php, lines=40-60)

# Get entire file
get_source_code(file=/var/www/app/checkout.php)
```

**Output:**
```
File: /var/www/app/checkout.php
40:   $subtotal = array_sum($items);
41:   $tax = $subtotal * $taxRate;
42: → $total = $subtotal + $tax;      // Current line
43:   return $total;
44: }
45:
46: $items = [19.99, 29.99, 39.99];
```

---

## Advanced Features

### Get Code Coverage

**Purpose:** View code coverage metrics

**Syntax:**
```
get_code_coverage()
```

**Output:**
```
Code Coverage Report:
  File: checkout.php
    Total lines: 150
    Covered lines: 120
    Coverage: 80%

  File: handlers.php
    Total lines: 200
    Covered lines: 145
    Coverage: 72.5%

  Overall Coverage: 76%
```

### Get Profiling Data

**Purpose:** View performance profiling information

**Syntax:**
```
get_profiling_data()
```

**Output:**
```
Performance Profile:
  calculateTotal() - 0.025ms
  applyDiscount() - 0.018ms
  getUserData() - 2.345ms (DB query)
  formatOutput() - 0.012ms

Slowest function: getUserData (2.345ms)
```

### Get Session Info

**Purpose:** View current debugging session information

**Syntax:**
```
get_session_info()
```

**Output:**
```
Session ID: session_12345
Status: paused
File: /var/www/app/checkout.php
Line: 45
Function: calculateTotal

Variables in scope: 12
Breakpoints set: 5
Execution time: 1.234 seconds
```

---

## Command Chaining

Execute multiple commands in sequence:

```bash
# Set breakpoint, run script, inspect variable, step through
set_breakpoint(file=/app/checkout.php, line=45)
continue_execution()
get_variable(name=$total)
step_into()
get_stack_trace()
```

---

## Error Responses

When a command fails, you receive detailed error information:

### Common Errors

**File not found:**
```
Error: File /var/www/app/checkout.php not found
Verify: Absolute path is correct
```

**Invalid line number:**
```
Error: Line 999 is beyond file length (150 lines)
Verify: Line number is valid and contains executable code
```

**Variable not found:**
```
Error: Variable $undefined not found in current scope
Available: $amount, $tax, $total, $items
Verify: Variable name is correct and in scope
```

**Breakpoint already exists:**
```
Warning: Breakpoint already exists at checkout.php:45
Action: Continue or clear and reset
```

---

## Performance Tips

### Optimize Debugging

1. **Use step_over for library code**
   - Skip json_encode(), array_sum(), etc.
   - Focus on your custom code

2. **Limit variable inspection**
   - Don't inspect huge arrays completely
   - Use depth parameter to limit nesting

3. **Remove unused breakpoints**
   - Keep only necessary breakpoints
   - Fewer breakpoints = faster execution

4. **Batch watch expressions**
   - Watch important variables only
   - Too many watches slow execution

### Performance Comparison

| Approach | Speed | Best For |
|----------|-------|----------|
| Step into everything | Slow | Detailed tracing |
| Step over functions | Medium | Custom code focus |
| Few breakpoints | Fast | High-level flow |
| Many breakpoints | Slow | Detailed debugging |

---

## Best Practices

1. **Set breakpoints strategically**
   - Function entry points
   - Complex calculations
   - Conditional branches
   - Loop iterations

2. **Use appropriate stepping**
   - Step into: Custom functions
   - Step over: Library functions
   - Step out: When done with function

3. **Inspect methodically**
   - Check assumptions
   - Verify calculations
   - Trace data flow

4. **Clean up when done**
   - Remove all breakpoints
   - Stop debugging session
   - Close connections

---

## Quick Reference

```bash
# Breakpoints
set_breakpoint(file=/path/file.php, line=45)
get_breakpoints()
clear_breakpoint(file=/path/file.php, line=45)
clear_all_breakpoints()

# Execution
continue_execution()
step_into()
step_over()
step_out()
stop_execution()

# Variables
get_variables(context=local)
get_variable(name=$var)
watch_variable(name=$var)

# Code
get_stack_trace()
get_source_code(file=/path/file.php)

# Advanced
get_code_coverage()
get_profiling_data()
get_session_info()
```

---

**Need help?** Check [Debugging Guide](../guides/debugging-guide) or [Troubleshooting](./troubleshooting)
