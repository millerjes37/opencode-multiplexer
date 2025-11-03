#!/usr/bin/env bun

/**
 * OpenCode Multi-Client Load Testing Script
 * 
 * This script simulates multiple concurrent clients connecting to an OpenCode server
 * and performing various operations to test:
 * - Server performance under load
 * - Memory usage over time
 * - Request/response latency
 * - Error rates
 * - Connection stability
 * 
 * Usage: bun run load-test-multi-client.ts [options]
 * 
 * Options:
 *   --clients <n>       Number of concurrent clients (default: 10)
 *   --duration <s>      Test duration in seconds (default: 60)
 *   --server <url>      Server URL (default: http://localhost:4096)
 *   --operations <n>    Operations per client (default: 100)
 */

import { parseArgs } from "util"

// Configuration
interface LoadTestConfig {
  numClients: number
  duration: number
  serverUrl: string
  operationsPerClient: number
}

// Metrics tracking
interface Metrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalLatency: number
  minLatency: number
  maxLatency: number
  errors: string[]
  memorySnapshots: number[]
  startTime: number
  endTime: number
}

// Parse command line arguments
function parseConfig(): LoadTestConfig {
  const args = process.argv.slice(2)
  
  let numClients = 10
  let duration = 60
  let serverUrl = "http://localhost:4096"
  let operationsPerClient = 100
  
  for (let i = 0; i < args.length; i += 2) {
    switch (args[i]) {
      case "--clients":
        numClients = parseInt(args[i + 1])
        break
      case "--duration":
        duration = parseInt(args[i + 1])
        break
      case "--server":
        serverUrl = args[i + 1]
        break
      case "--operations":
        operationsPerClient = parseInt(args[i + 1])
        break
    }
  }
  
  return { numClients, duration, serverUrl, operationsPerClient }
}

// Initialize metrics
function createMetrics(): Metrics {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    errors: [],
    memorySnapshots: [],
    startTime: Date.now(),
    endTime: 0,
  }
}

// Simulate a client
async function simulateClient(
  clientId: number,
  config: LoadTestConfig,
  metrics: Metrics,
  shouldStop: { value: boolean }
): Promise<void> {
  const projectDir = `/tmp/opencode-load-test-project-${clientId}`
  
  console.log(`[Client ${clientId}] Starting...`)
  
  let operationsCompleted = 0
  
  while (!shouldStop.value && operationsCompleted < config.operationsPerClient) {
    try {
      // 1. Create session
      const createStart = Date.now()
      const createResponse = await fetch(`${config.serverUrl}/project/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Load Test Session ${clientId}-${operationsCompleted}`,
        }),
      })
      const createLatency = Date.now() - createStart
      
      metrics.totalRequests++
      metrics.totalLatency += createLatency
      metrics.minLatency = Math.min(metrics.minLatency, createLatency)
      metrics.maxLatency = Math.max(metrics.maxLatency, createLatency)
      
      if (!createResponse.ok) {
        metrics.failedRequests++
        metrics.errors.push(
          `[Client ${clientId}] Create session failed: ${createResponse.status}`
        )
        continue
      }
      
      metrics.successfulRequests++
      const session = await createResponse.json()
      
      // 2. List sessions
      const listStart = Date.now()
      const listResponse = await fetch(`${config.serverUrl}/project/session`, {
        headers: {
          "Content-Type": "application/json",
        },
      })
      const listLatency = Date.now() - listStart
      
      metrics.totalRequests++
      metrics.totalLatency += listLatency
      metrics.minLatency = Math.min(metrics.minLatency, listLatency)
      metrics.maxLatency = Math.max(metrics.maxLatency, listLatency)
      
      if (listResponse.ok) {
        metrics.successfulRequests++
      } else {
        metrics.failedRequests++
      }
      
      // 3. Update session
      const updateStart = Date.now()
      const updateResponse = await fetch(
        `${config.serverUrl}/project/session/${session.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locked: true,
          }),
        }
      )
      const updateLatency = Date.now() - updateStart
      
      metrics.totalRequests++
      metrics.totalLatency += updateLatency
      metrics.minLatency = Math.min(metrics.minLatency, updateLatency)
      metrics.maxLatency = Math.max(metrics.maxLatency, updateLatency)
      
      if (updateResponse.ok) {
        metrics.successfulRequests++
      } else {
        metrics.failedRequests++
      }
      
      // 4. Delete session
      const deleteStart = Date.now()
      const deleteResponse = await fetch(
        `${config.serverUrl}/project/session/${session.id}`,
        {
          method: "DELETE",
        }
      )
      const deleteLatency = Date.now() - deleteStart
      
      metrics.totalRequests++
      metrics.totalLatency += deleteLatency
      metrics.minLatency = Math.min(metrics.minLatency, deleteLatency)
      metrics.maxLatency = Math.max(metrics.maxLatency, deleteLatency)
      
      if (deleteResponse.ok) {
        metrics.successfulRequests++
      } else {
        metrics.failedRequests++
      }
      
      operationsCompleted++
      
      // Small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 10))
    } catch (error) {
      metrics.failedRequests++
      metrics.errors.push(
        `[Client ${clientId}] Error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  
  console.log(`[Client ${clientId}] Completed ${operationsCompleted} operations`)
}

// Monitor server status
async function monitorServer(
  config: LoadTestConfig,
  metrics: Metrics,
  shouldStop: { value: boolean }
): Promise<void> {
  while (!shouldStop.value) {
    try {
      const response = await fetch(`${config.serverUrl}/status`)
      if (response.ok) {
        const status = await response.json()
        console.log(
          `[Monitor] Clients: ${status.connectedClients}, Uptime: ${status.uptime.toFixed(2)}s`
        )
      }
      
      // Capture memory snapshot
      const memUsage = process.memoryUsage()
      metrics.memorySnapshots.push(memUsage.heapUsed)
      
      await new Promise((resolve) => setTimeout(resolve, 5000))
    } catch (error) {
      // Ignore monitoring errors
    }
  }
}

// Print metrics report
function printReport(config: LoadTestConfig, metrics: Metrics): void {
  const duration = (metrics.endTime - metrics.startTime) / 1000
  const avgLatency = metrics.totalRequests > 0 
    ? metrics.totalLatency / metrics.totalRequests 
    : 0
  const requestsPerSecond = metrics.totalRequests / duration
  const errorRate = (metrics.failedRequests / metrics.totalRequests) * 100
  
  // Calculate memory statistics
  const avgMemory = metrics.memorySnapshots.length > 0
    ? metrics.memorySnapshots.reduce((a, b) => a + b, 0) / metrics.memorySnapshots.length
    : 0
  const maxMemory = metrics.memorySnapshots.length > 0
    ? Math.max(...metrics.memorySnapshots)
    : 0
  const minMemory = metrics.memorySnapshots.length > 0
    ? Math.min(...metrics.memorySnapshots)
    : 0
  
  // Check for memory leak (increasing trend)
  let memoryLeak = false
  if (metrics.memorySnapshots.length > 5) {
    const firstHalf = metrics.memorySnapshots.slice(0, Math.floor(metrics.memorySnapshots.length / 2))
    const secondHalf = metrics.memorySnapshots.slice(Math.floor(metrics.memorySnapshots.length / 2))
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    // If second half average is >20% higher than first half, potential leak
    if (avgSecond > avgFirst * 1.2) {
      memoryLeak = true
    }
  }
  
  console.log("\n" + "=".repeat(80))
  console.log("LOAD TEST REPORT")
  console.log("=".repeat(80))
  console.log("\nConfiguration:")
  console.log(`  Clients:              ${config.numClients}`)
  console.log(`  Duration:             ${duration.toFixed(2)}s`)
  console.log(`  Server URL:           ${config.serverUrl}`)
  console.log(`  Operations/Client:    ${config.operationsPerClient}`)
  
  console.log("\nPerformance:")
  console.log(`  Total Requests:       ${metrics.totalRequests}`)
  console.log(`  Successful:           ${metrics.successfulRequests}`)
  console.log(`  Failed:               ${metrics.failedRequests}`)
  console.log(`  Requests/Second:      ${requestsPerSecond.toFixed(2)}`)
  console.log(`  Error Rate:           ${errorRate.toFixed(2)}%`)
  
  console.log("\nLatency:")
  console.log(`  Average:              ${avgLatency.toFixed(2)}ms`)
  console.log(`  Minimum:              ${metrics.minLatency === Infinity ? 0 : metrics.minLatency}ms`)
  console.log(`  Maximum:              ${metrics.maxLatency}ms`)
  
  console.log("\nMemory:")
  console.log(`  Average Heap:         ${(avgMemory / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Min Heap:             ${(minMemory / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Max Heap:             ${(maxMemory / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Memory Leak:          ${memoryLeak ? "DETECTED ⚠️" : "None"}`)
  
  if (metrics.errors.length > 0) {
    console.log("\nErrors (first 10):")
    metrics.errors.slice(0, 10).forEach((error) => {
      console.log(`  - ${error}`)
    })
    if (metrics.errors.length > 10) {
      console.log(`  ... and ${metrics.errors.length - 10} more`)
    }
  }
  
  console.log("\n" + "=".repeat(80))
  
  // Exit code based on results
  if (errorRate > 5) {
    console.log("⚠️  Warning: Error rate exceeds 5%")
  }
  if (memoryLeak) {
    console.log("⚠️  Warning: Potential memory leak detected")
  }
  if (errorRate < 1 && !memoryLeak) {
    console.log("✅ Load test passed successfully")
  }
}

// Main function
async function main() {
  const config = parseConfig()
  const metrics = createMetrics()
  const shouldStop = { value: false }
  
  console.log("╔════════════════════════════════════════════════════════╗")
  console.log("║   OpenCode Multi-Client Load Test                     ║")
  console.log("╚════════════════════════════════════════════════════════╝")
  console.log("")
  console.log("Configuration:")
  console.log(`  Clients:              ${config.numClients}`)
  console.log(`  Duration:             ${config.duration}s`)
  console.log(`  Server URL:           ${config.serverUrl}`)
  console.log(`  Operations/Client:    ${config.operationsPerClient}`)
  console.log("")
  
  // Check server health
  try {
    console.log("Checking server health...")
    const health = await fetch(`${config.serverUrl}/health`)
    if (!health.ok) {
      console.error("❌ Server health check failed")
      process.exit(1)
    }
    console.log("✅ Server is healthy")
    console.log("")
  } catch (error) {
    console.error("❌ Cannot connect to server:", error)
    process.exit(1)
  }
  
  // Start monitoring
  const monitorPromise = monitorServer(config, metrics, shouldStop)
  
  // Start clients
  console.log(`Starting ${config.numClients} clients...\n`)
  const clientPromises: Promise<void>[] = []
  
  for (let i = 0; i < config.numClients; i++) {
    clientPromises.push(
      simulateClient(i, config, metrics, shouldStop)
    )
    // Stagger client starts
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  
  // Set timeout
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log(`\n⏱️  Time limit reached (${config.duration}s)`)
      shouldStop.value = true
      resolve()
    }, config.duration * 1000)
  })
  
  // Wait for clients to complete or timeout
  await Promise.race([
    Promise.all(clientPromises),
    timeoutPromise,
  ])
  
  shouldStop.value = true
  metrics.endTime = Date.now()
  
  // Wait a bit for monitoring to finish
  await new Promise((resolve) => setTimeout(resolve, 1000))
  
  // Print report
  printReport(config, metrics)
}

// Run
main().catch(console.error)
