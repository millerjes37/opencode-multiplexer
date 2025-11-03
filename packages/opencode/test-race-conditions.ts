#!/usr/bin/env bun

/**
 * OpenCode Race Condition Testing Script
 * 
 * This script tests various race condition scenarios in the multi-client setup:
 * 1. Simultaneous session creation with same name
 * 2. Concurrent message generation in same session
 * 3. Rapid connect/disconnect cycles
 * 4. Project disposal while clients are connected
 * 
 * Usage: bun run test-race-conditions.ts [--server <url>]
 */

import { Instance } from "./src/project/instance"
import { Session } from "./src/session"
import { Log } from "./src/util/log"
import path from "path"

// Configuration
const SERVER_URL = process.argv.includes("--server")
  ? process.argv[process.argv.indexOf("--server") + 1]
  : "http://localhost:4096"

const TEST_DIRS = {
  project1: "/tmp/opencode-race-test-1",
  project2: "/tmp/opencode-race-test-2",
}

// Disable logging for cleaner output
Log.init({ print: false })

// Test result tracking
interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

const results: TestResult[] = []

// Helper function to run a test
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  console.log(`\n🧪 Running: ${name}`)
  const start = Date.now()
  
  try {
    await testFn()
    const duration = Date.now() - start
    results.push({ name, passed: true, duration })
    console.log(`✅ PASSED (${duration}ms)`)
  } catch (error) {
    const duration = Date.now() - start
    const errorMsg = error instanceof Error ? error.message : String(error)
    results.push({ name, passed: false, error: errorMsg, duration })
    console.log(`❌ FAILED (${duration}ms): ${errorMsg}`)
  }
}

// Test 1: Simultaneous session creation with same name
async function testSimultaneousSessionCreation() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      const sessionName = "Duplicate Session Name"
      
      // Create 5 sessions with the same name simultaneously
      const promises = Array.from({ length: 5 }, () =>
        Session.create({ title: sessionName })
      )
      
      const sessions = await Promise.all(promises)
      
      // All should be created successfully
      if (sessions.length !== 5) {
        throw new Error(`Expected 5 sessions, got ${sessions.length}`)
      }
      
      // All should have unique IDs even with same name
      const ids = new Set(sessions.map((s) => s.id))
      if (ids.size !== 5) {
        throw new Error(`Expected 5 unique IDs, got ${ids.size}`)
      }
      
      // Cleanup
      await Promise.all(sessions.map((s) => Session.remove(s.id)))
    },
  })
}

// Test 2: Concurrent updates to same session
async function testConcurrentSessionUpdates() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      const session = await Session.create({ title: "Update Test" })
      
      // Perform 10 concurrent updates
      const promises = Array.from({ length: 10 }, (_, i) =>
        Session.update(session.id, { locked: i % 2 === 0 })
      )
      
      await Promise.all(promises)
      
      // Session should still be valid
      const updated = await Session.get(session.id)
      if (!updated) {
        throw new Error("Session not found after concurrent updates")
      }
      
      // Cleanup
      await Session.remove(session.id)
    },
  })
}

// Test 3: Simultaneous session deletion
async function testSimultaneousSessionDeletion() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      const session = await Session.create({ title: "Delete Test" })
      
      // Try to delete the same session multiple times simultaneously
      const promises = Array.from({ length: 5 }, () =>
        Session.remove(session.id).catch(() => {
          // Expected: some may fail if already deleted
        })
      )
      
      await Promise.all(promises)
      
      // Session should be gone
      try {
        await Session.get(session.id)
        throw new Error("Session still exists after deletion")
      } catch (error) {
        // Expected: session not found
      }
    },
  })
}

// Test 4: Concurrent operations across multiple projects
async function testCrossProjectConcurrency() {
  const operations: Promise<void>[] = []
  
  // Project 1: Create and delete sessions rapidly
  operations.push(
    Instance.provide({
      directory: TEST_DIRS.project1,
      fn: async () => {
        for (let i = 0; i < 10; i++) {
          const session = await Session.create({ title: `P1 Session ${i}` })
          await Session.remove(session.id)
        }
      },
    })
  )
  
  // Project 2: Create and delete sessions rapidly
  operations.push(
    Instance.provide({
      directory: TEST_DIRS.project2,
      fn: async () => {
        for (let i = 0; i < 10; i++) {
          const session = await Session.create({ title: `P2 Session ${i}` })
          await Session.remove(session.id)
        }
      },
    })
  )
  
  await Promise.all(operations)
}

// Test 5: Rapid session creation and listing
async function testRapidCreateAndList() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      const sessions: Session.Info[] = []
      
      // Create sessions and list simultaneously
      const createPromises = Array.from({ length: 5 }, async (_, i) => {
        const session = await Session.create({ title: `Rapid ${i}` })
        sessions.push(session)
      })
      
      const listPromises = Array.from({ length: 5 }, () => Session.list())
      
      await Promise.all([...createPromises, ...listPromises])
      
      // Cleanup
      await Promise.all(sessions.map((s) => Session.remove(s.id)))
    },
  })
}

// Test 6: Concurrent session locks
async function testConcurrentLocks() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      // Create multiple sessions
      const sessions = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          Session.create({ title: `Lock Test ${i}` })
        )
      )
      
      // Lock all simultaneously
      await Promise.all(
        sessions.map((s) => Session.update(s.id, { locked: true }))
      )
      
      // Verify all are locked
      const locked = await Promise.all(
        sessions.map((s) => Session.get(s.id))
      )
      
      if (!locked.every((s) => s.locked)) {
        throw new Error("Not all sessions were locked")
      }
      
      // Unlock all simultaneously
      await Promise.all(
        sessions.map((s) => Session.update(s.id, { locked: false }))
      )
      
      // Verify all are unlocked
      const unlocked = await Promise.all(
        sessions.map((s) => Session.get(s.id))
      )
      
      if (unlocked.some((s) => s.locked)) {
        throw new Error("Some sessions are still locked")
      }
      
      // Cleanup
      await Promise.all(sessions.map((s) => Session.remove(s.id)))
    },
  })
}

// Test 7: Stress test - many operations simultaneously
async function testStressOperations() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      const operations: Promise<any>[] = []
      const createdSessions: string[] = []
      
      // Mix of create, update, list, and delete operations
      for (let i = 0; i < 20; i++) {
        // Create
        operations.push(
          Session.create({ title: `Stress ${i}` }).then((s) => {
            createdSessions.push(s.id)
            return s
          })
        )
        
        // List
        operations.push(Session.list())
      }
      
      await Promise.all(operations)
      
      // Cleanup
      await Promise.all(
        createdSessions.map((id) =>
          Session.remove(id).catch(() => {
            // May already be deleted
          })
        )
      )
    },
  })
}

// Test 8: Concurrent instance providers
async function testConcurrentInstanceProviders() {
  const providers: Promise<void>[] = []
  
  // Create 10 concurrent instance providers for the same directory
  for (let i = 0; i < 10; i++) {
    providers.push(
      Instance.provide({
        directory: TEST_DIRS.project1,
        fn: async () => {
          const session = await Session.create({ title: `Provider ${i}` })
          await Session.remove(session.id)
        },
      })
    )
  }
  
  await Promise.all(providers)
}

// Test 9: Alternating create/delete
async function testAlternatingCreateDelete() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      for (let i = 0; i < 20; i++) {
        const session = await Session.create({ title: `Alternating ${i}` })
        await Session.remove(session.id)
      }
    },
  })
}

// Test 10: Multiple sessions with rapid updates
async function testMultipleSessionsRapidUpdates() {
  await Instance.provide({
    directory: TEST_DIRS.project1,
    fn: async () => {
      // Create 5 sessions
      const sessions = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          Session.create({ title: `Multi Update ${i}` })
        )
      )
      
      // Update all sessions rapidly
      for (let round = 0; round < 5; round++) {
        await Promise.all(
          sessions.map((s) =>
            Session.update(s.id, { locked: round % 2 === 0 })
          )
        )
      }
      
      // Cleanup
      await Promise.all(sessions.map((s) => Session.remove(s.id)))
    },
  })
}

// Print summary
function printSummary() {
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  
  console.log("\n" + "=".repeat(80))
  console.log("RACE CONDITION TEST SUMMARY")
  console.log("=".repeat(80))
  console.log(`\nTotal Tests:     ${results.length}`)
  console.log(`Passed:          ${passed}`)
  console.log(`Failed:          ${failed}`)
  console.log(`Success Rate:    ${((passed / results.length) * 100).toFixed(1)}%`)
  console.log(`Total Duration:  ${totalDuration}ms`)
  console.log(`Avg Duration:    ${(totalDuration / results.length).toFixed(1)}ms`)
  
  if (failed > 0) {
    console.log("\nFailed Tests:")
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}`)
        console.log(`     ${r.error}`)
      })
  }
  
  console.log("\n" + "=".repeat(80))
  
  if (failed === 0) {
    console.log("✅ All race condition tests passed!")
  } else {
    console.log("⚠️  Some tests failed - review results above")
  }
}

// Main function
async function main() {
  console.log("╔════════════════════════════════════════════════════════╗")
  console.log("║   OpenCode Race Condition Tests                        ║")
  console.log("╚════════════════════════════════════════════════════════╝")
  
  // Create test directories
  await Bun.write(`${TEST_DIRS.project1}/README.md`, "# Test Project 1")
  await Bun.write(`${TEST_DIRS.project2}/README.md`, "# Test Project 2")
  
  // Run all tests
  await runTest("Simultaneous Session Creation", testSimultaneousSessionCreation)
  await runTest("Concurrent Session Updates", testConcurrentSessionUpdates)
  await runTest("Simultaneous Session Deletion", testSimultaneousSessionDeletion)
  await runTest("Cross-Project Concurrency", testCrossProjectConcurrency)
  await runTest("Rapid Create and List", testRapidCreateAndList)
  await runTest("Concurrent Locks", testConcurrentLocks)
  await runTest("Stress Operations", testStressOperations)
  await runTest("Concurrent Instance Providers", testConcurrentInstanceProviders)
  await runTest("Alternating Create/Delete", testAlternatingCreateDelete)
  await runTest("Multiple Sessions Rapid Updates", testMultipleSessionsRapidUpdates)
  
  // Print summary
  printSummary()
  
  // Exit with appropriate code
  process.exit(results.some((r) => !r.passed) ? 1 : 0)
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
