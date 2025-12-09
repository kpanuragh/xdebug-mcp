<?php
/**
 * Test script for debugging with Xdebug MCP Server
 *
 * Run this script with Xdebug enabled to test debugging functionality.
 */

function calculateSum(array $numbers): int
{
    $sum = 0;
    foreach ($numbers as $number) {
        $sum += $number;
    }
    return $sum;
}

function processUser(array $user): array
{
    $user['processed'] = true;
    $user['timestamp'] = time();
    return $user;
}

class Calculator
{
    private array $history = [];

    public function add(int $a, int $b): int
    {
        $result = $a + $b;
        $this->history[] = "add($a, $b) = $result";
        return $result;
    }

    public function multiply(int $a, int $b): int
    {
        $result = $a * $b;
        $this->history[] = "multiply($a, $b) = $result";
        return $result;
    }

    public function getHistory(): array
    {
        return $this->history;
    }
}

// Main execution
echo "Starting test script...\n";

// Test simple variables
$message = "Hello, Xdebug!";
$count = 42;
$items = ['apple', 'banana', 'cherry'];

// Test function calls
$numbers = [1, 2, 3, 4, 5];
$sum = calculateSum($numbers);
echo "Sum: $sum\n";

// Test object
$calc = new Calculator();
$addResult = $calc->add(10, 20);
$multiplyResult = $calc->multiply(5, 6);
echo "Add result: $addResult\n";
echo "Multiply result: $multiplyResult\n";

// Test array processing
$user = [
    'name' => 'John Doe',
    'email' => 'john@example.com',
    'age' => 30
];
$processedUser = processUser($user);

// Test nested data
$data = [
    'users' => [
        ['name' => 'Alice', 'score' => 95],
        ['name' => 'Bob', 'score' => 87],
        ['name' => 'Charlie', 'score' => 92]
    ],
    'metadata' => [
        'total' => 3,
        'average' => 91.33
    ]
];

// Test exception (uncomment to test exception breakpoints)
// throw new RuntimeException("Test exception");

echo "Test script completed!\n";
echo "Calculator history:\n";
print_r($calc->getHistory());
