---
layout: default
title: PHP Debugging Guide | Xdebug MCP
description: Complete PHP debugging guide with step-by-step workflows, breakpoints, variable inspection, and stack traces using Xdebug MCP.
---

# PHP Debugging Guide

Complete guide to debugging PHP applications with Xdebug MCP. Learn step-by-step debugging workflows, breakpoints, variable inspection, and advanced techniques.

## Overview

Debugging with Xdebug MCP involves:
1. **Setting breakpoints** - Pause execution at specific lines
2. **Stepping through code** - Execute code line by line
3. **Inspecting variables** - View variable values at any point
4. **Stack traces** - See the call path that led to current execution
5. **Analyzing** - Identify issues and fix them

## Step-by-Step Debugging Workflow

### Phase 1: Prepare Your Environment

**1. Start the Xdebug MCP Server:**
```bash
xdebug-mcp
# Output: Listening on localhost:9003
```

**2. Ensure Xdebug is configured in php.ini:**
```bash
php -i | grep -A 5 xdebug
```

Should show:
```
xdebug.mode => debug
xdebug.client_host => localhost
xdebug.client_port => 9003
```

**3. Verify connection works:**
```bash
# Try running a simple PHP script
php test.php
```

### Phase 2: Set Breakpoints

**Example PHP code (`checkout.php`):**
```php
<?php
function calculateTotal($items, $taxRate) {
    $subtotal = 0;
    foreach ($items as $price) {
        $subtotal += $price;
    }
    $tax = $subtotal * $taxRate;
    $total = $subtotal + $tax;
    return $total;
}

$items = [19.99, 29.99, 39.99];
$total = calculateTotal($items, 0.08);
echo "Total: $" . number_format($total, 2);
?>
```

**Set a breakpoint at the tax calculation:**

With Claude Code:
```
User: Set a breakpoint at line 8 in checkout.php (the tax calculation line)

Claude: [Sets breakpoint using tool]
```

With Cursor:
```
1. Click on line 8 in the editor
2. Press Ctrl+B to toggle breakpoint
3. Breakpoint marker appears
```

### Phase 3: Run and Pause

**Execute the script:**
```bash
php checkout.php
```

**The script pauses at the breakpoint.** You can now:
- Inspect variables at this point
- Step through execution
- Continue to next breakpoint
- Modify execution flow

### Phase 4: Inspect Variables

**View all local variables:**

With Claude Code:
```
User: What are the current variable values at this breakpoint?

Claude: [Shows all local variables]
$items = [19.99, 29.99, 39.99]
$taxRate = 0.08
$subtotal = 89.97
$tax = 7.1976
```

With Cursor:
```
Variables panel shows:
  $items = Array (3)
  $taxRate = 0.08
  $subtotal = 89.97
  $tax = 7.1976
  $total = 97.1676
```

**Inspect specific variables:**

Look at array elements:
```
$items[0] = 19.99
$items[1] = 29.99
$items[2] = 39.99
```

Get object properties:
```
$order->id = 12345
$order->status = "pending"
$order->customer->name = "John Doe"
```

### Phase 5: Step Through Code

**Step into (F11 or equivalent):**
- Enter function calls
- Debug inside functions
- Useful for tracing execution through functions

**Step over (F10 or equivalent):**
- Execute current line without entering functions
- Useful for skipping library code
- Faster for high-level flow

**Step out (Shift+F11):**
- Exit current function
- Return to calling code
- Useful when done debugging a function

### Phase 6: Continue and Analyze

**Continue execution:**
```
Click Continue or press F5
```

Script runs to next breakpoint or completion.

## Common Debugging Scenarios

### Scenario 1: Finding Logic Errors

**Problem:** Calculation is wrong

```php
function applyDiscount($price, $discount) {
    $discounted = $price - $discount;  // BUG: Should be * (1 - discount)
    return $discounted;
}

$price = 100;
$discount = 0.2;  // 20% discount
$final = applyDiscount($price, $discount);
// Expected: 80, Got: 99.8
```

**Debugging steps:**

1. Set breakpoint inside applyDiscount()
2. Call the function
3. Inspect: $price = 100, $discount = 0.2
4. Step through: $discounted = 100 - 0.2 = 99.8 ❌
5. Identify: Wrong operator. Should be `*`
6. Fix: `$discounted = $price * (1 - $discount)`

### Scenario 2: Finding Null Reference Errors

**Problem:** "Call to undefined method on null"

```php
$user = getUserById($id);
$username = $user->getName();  // Line 45: $user is null
```

**Debugging steps:**

1. Set breakpoint before line 45
2. Inspect: $user = null ❌
3. Question: Why is $user null?
4. Check: Is getUserById() returning null?
5. Set breakpoint in getUserById()
6. Debug: Query not finding user, returns null
7. Fix: Add user existence check or fix query

### Scenario 3: Finding Array/Loop Errors

**Problem:** Loop not processing all items

```php
$items = [1, 2, 3, 4, 5];
$total = 0;
foreach ($items as $item) {
    if ($item == 3) {
        break;  // BUG: Exits loop prematurely
    }
    $total += $item;
}
// Expected: 15, Got: 3
```

**Debugging steps:**

1. Set breakpoint at start of loop
2. Step through each iteration
3. Watch $item and $total values
4. See loop exits at $item = 3
5. Identify: Unexpected break statement
6. Fix: Remove or refine break condition

### Scenario 4: Finding Database Query Issues

**Problem:** Query returns unexpected results

```php
function getActiveUsers() {
    $query = "SELECT * FROM users WHERE status = 'active'";
    return $db->query($query);
}

$users = getActiveUsers();
// Returning inactive users too
```

**Debugging steps:**

1. Set breakpoint in getActiveUsers()
2. Inspect: $query value
3. Add temporary logging: echo $query
4. Check actual database data
5. Identify: Query condition is wrong or case-sensitive issue
6. Fix: Adjust WHERE clause

## Advanced Debugging Techniques

### Conditional Breakpoints

Only pause when specific condition is true:

```php
// Set breakpoint on line with condition:
if ($userId == 123) {  // Break only when userId is 123
    $user = getUserById($userId);
}
```

### Watch Expressions

Monitor specific variables or expressions:

With Cursor:
1. Open Watch panel
2. Add: $total * 1.1
3. See value update as code executes

### Call Stack Analysis

Understand how you reached current code:

```
Call Stack:
  applyDiscount() - pricing.php:12
  checkoutProcess() - checkout.php:45
  handleRequest() - app.php:3
  main() - index.php:1
```

Shows execution path leading to current point.

### Performance Profiling

Find slow code:

```
Function execution times:
  getAllUsers() - 2.5 seconds ⚠️
    ├─ Query database - 2.3 seconds
    └─ Process results - 0.2 seconds

  getOrderDetails() - 0.1 seconds ✓
```

Identify where time is spent.

### Code Coverage

See which lines executed:

```
Coverage report:
  checkout.php:
    ✓ Lines 1-40 executed
    ✗ Lines 41-50 NOT executed
    ✓ Lines 51-60 executed
```

Find untested code paths.

## Debugging Different PHP Scenarios

### Debugging Web Requests

1. Set Xdebug trigger in query string: `?XDEBUG_SESSION=1`
2. Visit URL in browser
3. Server pauses at breakpoints
4. Debug HTTP request handling

### Debugging CLI Scripts

1. Run script normally: `php script.php`
2. Script pauses at breakpoints automatically
3. Use agent interface to step and inspect

### Debugging API Calls

1. Make API request (POST, GET, etc.)
2. Server pauses at breakpoints
3. Inspect request data: $_POST, $_GET, etc.
4. Debug API response generation

### Debugging Database Operations

1. Set breakpoint before database call
2. Execute query
3. Inspect query result
4. Check returned data structure
5. Identify data issues

## Common Debug Points

**Always set breakpoints at:**

1. **Function entry points:**
   ```php
   function processPayment($amount) {  // SET BREAKPOINT HERE
       // Function logic
   }
   ```

2. **Complex calculations:**
   ```php
   $tax = $subtotal * $taxRate;  // SET BREAKPOINT HERE
   ```

3. **Conditional branches:**
   ```php
   if ($status == 'active') {  // SET BREAKPOINT HERE
       // Branch logic
   }
   ```

4. **Loop iterations:**
   ```php
   foreach ($items as $item) {  // SET BREAKPOINT HERE
       // Loop logic
   }
   ```

5. **Database queries:**
   ```php
   $result = $db->query($sql);  // SET BREAKPOINT HERE
   ```

## Tips for Efficient Debugging

1. **Start from top**
   - Set breakpoint at script start
   - Step through to find issue
   - Narrow down problem area

2. **Use stepping strategically**
   - Step into functions you wrote
   - Step over library functions
   - Step out when done with function

3. **Inspect frequently**
   - Check variable values at each step
   - Verify assumptions
   - Catch issues early

4. **Use logging**
   - Add temporary logging for complex flows
   - Log variable values at key points
   - Remove after debugging

5. **Test in isolation**
   - Create minimal test case
   - Debug just the problematic code
   - Easier to focus and fix

6. **Document findings**
   - Note what you discover
   - Track patterns
   - Prevent similar bugs

## Next Steps

- [Agent Integration Guide](./agent-integration) - Use debugging with your agent
- [Configuration Reference](../reference/configuration) - Fine-tune Xdebug settings
- [Tools & Commands](../reference/tools-commands) - Advanced debugging tools
- [Troubleshooting Guide](../reference/troubleshooting) - Fix debugging issues
