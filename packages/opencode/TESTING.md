# Multi-Client Testing Guide

This document provides comprehensive testing procedures for OpenCode's multi-client functionality.

## Table of Contents

1. [Overview](#overview)
2. [Test Suite Structure](#test-suite-structure)
3. [Running Tests](#running-tests)
4. [Manual Testing](#manual-testing)
5. [Load Testing](#load-testing)
6. [Race Condition Testing](#race-condition-testing)
7. [Expected Results](#expected-results)
8. [Interpreting Test Failures](#interpreting-test-failures)
9. [Common Issues and Solutions](#common-issues-and-solutions)

## Overview

The multi-client testing infrastructure validates that:

- Multiple clients can connect to a single OpenCode server simultaneously
- Events are properly filtered by project ID
- Sessions are isolated between different projects
- Locks don't conflict across projects
- Storage operations handle concurrency correctly
- Connection tracking accurately reflects active clients
- Cleanup happens properly on disconnect
- Race conditions are handled gracefully

## Test Suite Structure

### 1. Automated Unit Tests

**File**: `test/multi-client.test.ts`

Comprehensive unit tests using Bun's test framework covering:
- Connection tracking
- Event isolation
- Concurrent session operations
- Session locks across projects
- Storage concurrency
- Connection cleanup
- Race conditions
- Cross-project isolation

### 2. Manual Testing Script

**File**: `test-multi-client.sh`

Bash script that:
- Starts an OpenCode server on a specified port
- Creates test project directories
- Opens multiple TUI clients in separate terminals
- Provides step-by-step testing instructions
- Monitors server status

### 3. Load Testing Script

**File**: `load-test-multi-client.ts`

Performance testing script that:
- Spawns N concurrent clients
- Performs random operations (create, list, update, delete)
- Monitors server memory and CPU usage
- Reports metrics: requests/second, latency, error rate
- Detects potential memory leaks

### 4. Race Condition Testing

**File**: `test-race-conditions.ts`

Specialized tests for edge cases:
- Simultaneous session creation with duplicate names
- Concurrent updates to the same session
- Session deletion during active operations
- Rapid connect/disconnect cycles
- Mixed operations under stress

## Running Tests

### Automated Unit Tests

```bash
# Run all multi-client tests
cd packages/opencode
bun test test/multi-client.test.ts

# Run with verbose output
bun test test/multi-client.test.ts --verbose

# Run specific test suite
bun test test/multi-client.test.ts -t "Connection Tests"
```

**Expected output:**
```
✓ Multi-Client Connection Tests > should track multiple client connections
✓ Event Isolation Tests > should filter events by projectID
✓ Concurrent Session Tests > should handle multiple clients creating sessions
... (all tests passing)
```

### Manual Testing

```bash
# Start manual test with default settings (3 clients)
./test-multi-client.sh

# Start with custom number of clients
./test-multi-client.sh 5

# Use custom port
PORT=4097 ./test-multi-client.sh
```

**What it does:**
1. Creates temporary test project directories in `/tmp`
2. Starts server on port 4096 (or specified port)
3. Waits for server to be ready
4. Opens N terminal tabs/windows with TUI clients
5. Displays testing instructions
6. Cleans up on Ctrl+C

### Load Testing

```bash
# Run with default settings (10 clients, 100 operations each)
bun load-test-multi-client.ts

# Custom configuration
bun load-test-multi-client.ts \
  --clients 20 \
  --operations 200 \
  --duration 120 \
  --server http://localhost:4096

# With verbose logging
bun load-test-multi-client.ts --verbose
```

**Metrics reported:**
- Total requests and success rate
- Requests per second
- Latency (min/avg/max)
- Memory usage and growth
- Error breakdown by type

### Race Condition Testing

```bash
# Run all race condition tests
bun test-race-conditions.ts

# With custom server URL
bun test-race-conditions.ts --server http://localhost:4097
```

**Tests executed:**
- Simultaneous session creation
- Concurrent updates
- Rapid create/delete cycles
- Cross-project concurrency
- Stress operations

## Manual Testing

### Prerequisites

1. **Start the server:**
   ```bash
   cd packages/opencode
   PORT=4096 bun run dev --server-only
   ```

2. **Verify server is running:**
   ```bash
   curl http://localhost:4096/health
   # Should return: {"status":"ok"}
   ```

### Test Scenarios

#### Scenario 1: Connection Verification

**Objective**: Verify multiple clients can connect

**Steps:**
1. Run `./test-multi-client.sh 3`
2. Wait for all 3 clients to open
3. Check server status:
   ```bash
   curl http://localhost:4096/status | jq
   ```

**Expected:**
```json
{
  "connectedClients": 3,
  "connectionsByProject": {
    "project-id-1": 1,
    "project-id-2": 1,
    "project-id-3": 1
  },
  "uptime": 45.2
}
```

#### Scenario 2: Project Isolation

**Objective**: Verify sessions are isolated by project

**Steps:**
1. In Client 1, create a new session (press `n`)
2. Give it a unique title: "Client 1 Test Session"
3. In Client 2, list sessions (should NOT see Client 1's session)
4. In Client 3, list sessions (should NOT see Client 1's session)
5. In Client 1, verify the session appears

**Expected:**
- Each client only sees sessions from its own project
- Sessions from other projects are not visible

#### Scenario 3: Concurrent Sessions

**Objective**: Verify concurrent session creation

**Steps:**
1. In all 3 clients simultaneously, create a new session
2. Give each a unique title
3. Verify each session is created successfully
4. Check server status to confirm all sessions exist

**Expected:**
- All sessions created successfully
- No conflicts or race conditions
- Each session has a unique ID

#### Scenario 4: Event Filtering

**Objective**: Verify events are filtered by project

**Steps:**
1. In Client 1, create a session and add messages
2. Monitor Client 2 and Client 3 terminals
3. They should NOT see real-time updates from Client 1
4. Only Client 1 should see its own events

**Expected:**
- Events are isolated to the originating project
- No event leakage between projects

#### Scenario 5: Storage Concurrency

**Objective**: Verify concurrent storage operations

**Steps:**
1. In all 3 clients, create multiple sessions (3-5 each)
2. In each session, save some content
3. Close all clients (Ctrl+C)
4. Restart clients in the same project directories
5. Verify all sessions and content are persisted

**Expected:**
- All data persisted correctly
- No corruption or data loss
- Each client sees its own project's sessions

#### Scenario 6: Connection Cleanup

**Objective**: Verify cleanup on disconnect

**Steps:**
1. Check server status: `curl http://localhost:4096/status | jq`
2. Note the number of connected clients
3. Close Client 1 (Ctrl+C)
4. Wait 2 seconds
5. Check server status again

**Expected:**
```json
{
  "connectedClients": 2,  // Decreased by 1
  "connectionsByProject": {
    "project-id-2": 1,
    "project-id-3": 1
  }
}
```

#### Scenario 7: Reconnection

**Objective**: Verify clients can reconnect

**Steps:**
1. Note Client 1's project directory
2. Restart Client 1 in the same directory:
   ```bash
   bun run dev --server http://localhost:4096 --directory /tmp/opencode-test-project-1
   ```
3. Verify it sees previous sessions
4. Check server status (should show 3 clients again)

**Expected:**
- Client reconnects successfully
- Previous sessions are visible
- New client ID assigned
- Connection count updated

#### Scenario 8: High Frequency Operations

**Objective**: Test server stability under load

**Steps:**
1. In Client 1, rapidly create and delete sessions (10-20 times)
2. Monitor other clients for responsiveness
3. Monitor server memory:
   ```bash
   watch -n 2 "curl -s http://localhost:4096/status | jq"
   ```

**Expected:**
- Server remains responsive
- Other clients unaffected
- No memory leaks (stable memory usage)
- No crashes or errors

#### Scenario 9: Server Lock Test

**Objective**: Verify port locking

**Steps:**
1. With server running on port 4096, try to start another:
   ```bash
   PORT=4096 bun run dev --server-only
   ```

**Expected:**
```
Error: Address already in use (port 4096)
```

## Load Testing

### Running Load Tests

```bash
# Ensure server is running
PORT=4096 bun run dev --server-only &

# In another terminal, run load test
bun load-test-multi-client.ts --clients 20 --operations 100
```

### Interpreting Load Test Results

#### Performance Metrics

**Requests/Second:**
- **Excellent**: > 50 req/s
- **Good**: 20-50 req/s
- **Acceptable**: 10-20 req/s
- **Poor**: < 10 req/s

**Error Rate:**
- **Excellent**: < 0.1%
- **Good**: < 1%
- **Acceptable**: < 5%
- **Poor**: > 5%

**Average Latency:**
- **Excellent**: < 50ms
- **Good**: 50-100ms
- **Acceptable**: 100-200ms
- **Poor**: > 200ms

#### Memory Analysis

**Normal behavior:**
- Initial spike during warm-up
- Stabilizes after a few seconds
- Slight growth (< 10MB) over time
- Garbage collection visible as dips

**Memory leak indicators:**
- Continuous upward trend
- Growth > 50MB during test
- No garbage collection dips
- Memory doesn't stabilize

**Action if leak detected:**
1. Review server logs for errors
2. Check for unclosed connections
3. Verify session cleanup
4. Profile with: `bun --inspect load-test-multi-client.ts`

## Race Condition Testing

### Running Race Tests

```bash
bun test-race-conditions.ts
```

### Expected Behavior

All tests should pass, indicating:
- Concurrent operations are serialized correctly
- No data corruption under concurrent access
- Unique ID generation works under load
- Cleanup happens reliably
- No deadlocks or race conditions

### Common Race Condition Failures

**Duplicate IDs:**
```
❌ Simultaneous session creation
   Error: Expected 5 unique IDs, got 4
```
- **Cause**: ID generation not atomic
- **Solution**: Review session ID generation in `src/session/index.ts`

**Data Corruption:**
```
❌ Concurrent session updates
   Error: Session not found after concurrent updates
```
- **Cause**: Concurrent writes without locking
- **Solution**: Review storage implementation for proper locking

**Cleanup Failures:**
```
❌ Rapid create/delete
   Error: Expected 0 rapid sessions, found 3
```
- **Cause**: Async cleanup not completing
- **Solution**: Ensure all cleanup operations are awaited

## Expected Results

### Automated Tests

```
Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Time:        12.5s
```

### Manual Tests

- All scenarios complete without errors
- Server remains stable throughout testing
- No connection leaks or orphaned sessions
- Clean disconnect and reconnect
- Event isolation maintained

### Load Tests

```
LOAD TEST REPORT
================
Configuration:
  Clients:              20
  Duration:             45.23s
  Operations/Client:    100

Performance:
  Total Requests:       8000
  Successful:           7998
  Failed:               2
  Requests/Second:      176.87
  Error Rate:           0.03%

Latency:
  Average:              45.32ms
  Minimum:              12ms
  Maximum:              234ms

Memory:
  Average Heap:         125.45 MB
  Min Heap:             118.32 MB
  Max Heap:             132.78 MB
  Memory Leak:          None

✅ Load test passed successfully
```

### Race Condition Tests

```
RACE CONDITION TEST SUMMARY
============================
Total Tests:     10
Passed:          10
Failed:          0
Success Rate:    100.0%
Total Duration:  8523ms
Avg Duration:    852.3ms

✅ All race condition tests passed!
```

## Interpreting Test Failures

### Connection Failures

**Symptom**: Tests fail with "Cannot connect to server"

**Possible causes:**
- Server not running
- Wrong port number
- Firewall blocking connections

**Solution:**
```bash
# Check if server is running
curl http://localhost:4096/health

# Check what's running on port
lsof -i :4096

# Restart server
PORT=4096 bun run dev --server-only
```

### Event Leakage

**Symptom**: Events appear in wrong project's clients

**Possible causes:**
- Event filtering logic broken
- ProjectID not being set correctly
- Event bus not filtering by projectID

**Solution:**
- Review `src/server/server.ts` event filtering (around line 1815)
- Check that all events include `projectID` in properties
- Verify `Instance.project.id` is correct

### Session Isolation Failure

**Symptom**: Sessions appear in other projects

**Possible causes:**
- Session storage not project-scoped
- ProjectID not being stored correctly
- Session listing not filtering by project

**Solution:**
- Review `src/session/index.ts` session storage
- Verify `Session.list()` filters by `Instance.project.id`
- Check session creation includes projectID

### Memory Leaks

**Symptom**: Memory grows continuously during load test

**Possible causes:**
- Event listeners not being cleaned up
- Sessions not being removed from memory
- Connection tracking not cleaning up

**Solution:**
```bash
# Profile memory usage
bun --inspect load-test-multi-client.ts

# In Chrome DevTools:
# - Open chrome://inspect
# - Click "inspect" on the Bun process
# - Take heap snapshots at intervals
# - Compare snapshots to find retained objects
```

### Race Condition Failures

**Symptom**: Intermittent test failures, especially under load

**Possible causes:**
- Missing `await` statements
- Concurrent access to shared state
- ID generation not atomic

**Solution:**
- Add logging to identify race conditions:
  ```typescript
  Log.init({ print: true })
  ```
- Use `Promise.all()` with caution
- Ensure all async operations are properly sequenced

## Common Issues and Solutions

### Issue: "Address already in use"

**Cause**: Another process is using the port

**Solution:**
```bash
# Find process using port
lsof -i :4096

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=4097 bun run dev --server-only
```

### Issue: Tests timeout

**Cause**: Server not responding, network issues

**Solution:**
- Increase test timeout in test files
- Check server logs for errors
- Verify network connectivity
- Reduce number of concurrent clients

### Issue: "Project not found"

**Cause**: Test project directory doesn't exist or isn't a git repo

**Solution:**
```bash
# Ensure test directories exist and are git repos
mkdir -p /tmp/opencode-test-project-1
cd /tmp/opencode-test-project-1
git init
git commit --allow-empty -m "Initial commit"
```

### Issue: Flaky tests

**Cause**: Timing-dependent behavior, insufficient wait times

**Solution:**
- Add delays between operations
- Use proper `await` on all promises
- Increase timeout for slow operations
- Use event-driven synchronization instead of sleep

### Issue: Permission errors

**Cause**: Insufficient permissions on test directories

**Solution:**
```bash
# Fix permissions
chmod -R 755 /tmp/opencode-test-*

# Or run with sudo (not recommended)
sudo bun test
```

### Issue: Tests pass locally but fail in CI

**Cause**: Different environment, timing issues, resource constraints

**Solution:**
- Increase timeouts in CI environment
- Reduce concurrency in CI
- Use environment variables to detect CI:
  ```typescript
  const isCI = process.env.CI === "true"
  const timeout = isCI ? 10000 : 5000
  ```

## Best Practices

1. **Always cleanup**: Ensure all test resources are cleaned up
2. **Use `using` for automatic cleanup**: Leverage disposable resources
3. **Test isolation**: Each test should be independent
4. **Deterministic tests**: Avoid timing-dependent tests
5. **Clear error messages**: Make test failures easy to diagnose
6. **Monitor resources**: Watch memory and connections during tests
7. **Document failures**: Record failure patterns for debugging

## Debugging Tips

### Enable verbose logging

```typescript
Log.init({ print: true })
```

### Monitor server in real-time

```bash
# Server status
watch -n 1 "curl -s http://localhost:4096/status | jq"

# Server logs
tail -f /tmp/opencode-server.log

# Memory usage
watch -n 2 "ps aux | grep bun | grep -v grep"
```

### Use debugger

```bash
# Run tests with debugger
bun --inspect-brk test test/multi-client.test.ts

# Then open chrome://inspect in Chrome
```

### Profile performance

```bash
# Generate performance profile
bun --cpu-prof load-test-multi-client.ts

# Analyze with Chrome DevTools
# chrome://inspect > Performance > Load profile
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Multi-Client Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Run unit tests
        run: bun test test/multi-client.test.ts
      - name: Start server
        run: PORT=4096 bun run dev --server-only &
        working-directory: packages/opencode
      - name: Wait for server
        run: sleep 5
      - name: Run load tests
        run: bun load-test-multi-client.ts --clients 5 --operations 50
        working-directory: packages/opencode
      - name: Run race condition tests
        run: bun test-race-conditions.ts
        working-directory: packages/opencode
```

## Additional Resources

- [Multi-Client Architecture Guide](docs/MULTI_CLIENT_GUIDE.md)
- [Migration Guide](docs/MIGRATION_TO_MULTI_CLIENT.md)
- [API Documentation](docs/API.md)
- [Server Implementation](src/server/server.ts)
- [Session Management](src/session/index.ts)

## Support

For issues or questions:
1. Check existing test output for clues
2. Review server logs
3. Search GitHub issues
4. Create a new issue with:
   - Test output
   - Server logs
   - Environment details (OS, Bun version)
   - Steps to reproduce
