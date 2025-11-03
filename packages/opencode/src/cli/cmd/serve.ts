import { Server } from "../../server/server"
import { ServerAuth } from "../../server/auth"
import { cmd } from "./cmd"
import { Global } from "../../global"
import { Instance } from "../../project/instance"
import fs from "fs/promises"
import path from "path"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) =>
    yargs
      .option("port", {
        alias: ["p"],
        type: "number",
        describe: "port to listen on",
        default: 4096,
      })
      .option("hostname", {
        type: "string",
        describe: "hostname to listen on",
        default: "127.0.0.1",
      })
      .option("pidfile", {
        type: "string",
        describe: "write PID to file for process management",
      })
      .option("detach", {
        type: "boolean",
        describe: "run server in background (detached mode)",
        default: false,
      })
      .option("require-auth", {
        type: "boolean",
        describe: "require token-based authentication for all requests",
        default: false,
      }),
  describe: "starts a headless OpenCode server for multiple clients",
  handler: async (args) => {
    const hostname = args.hostname
    const port = args.port
    const requireAuth = args.requireAuth
    
    // Enable authentication if required
    if (requireAuth) {
      Server.setAuthRequired(true)
      
      // Check if any tokens exist
      const tokens = await ServerAuth.listTokens()
      if (tokens.length === 0) {
        console.log(`⚠️  No authentication tokens found. Creating one now...`)
        const { token, info } = await ServerAuth.createToken("Default Server Token")
        console.log(`\n🔐 Authentication Token Created:`)
        console.log(`   Token: ${token}`)
        console.log(`   ID: ${info.id}`)
        console.log(`\n⚠️  Save this token - it won't be shown again!`)
        console.log(`\n💡 Clients must connect with: opencode --server http://${hostname}:${port} --token ${token}\n`)
      } else {
        console.log(`🔐 Authentication required - ${tokens.length} token(s) configured`)
        console.log(`💡 Clients must connect with: opencode --server http://${hostname}:${port} --token <your-token>`)
        console.log(`   Manage tokens with: opencode token list\n`)
      }
    }
    
    const server = Server.listen({
      port,
      hostname,
    })
    
    console.log(`🚀 OpenCode server listening on http://${server.hostname}:${server.port}`)
    console.log(`📁 Data directory: ${Global.Path.data}`)
    
    if (!requireAuth) {
      console.log(`💡 Connect clients with: opencode --server http://${server.hostname}:${server.port}`)
    }
    
    // Write server URL to known location for client discovery
    const serverUrlFile = path.join(Global.Path.state, "server-url")
    await fs.writeFile(serverUrlFile, `http://${server.hostname}:${server.port}`)
    
    if (args.pidfile) {
      await fs.writeFile(args.pidfile, process.pid.toString())
      console.log(`📝 PID written to: ${args.pidfile}`)
    }
    
    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\n⏹️  Received ${signal}, shutting down gracefully...`)
      await Instance.disposeAll()
      await server.stop(true)
      if (args.pidfile) {
        await fs.unlink(args.pidfile).catch(() => {})
      }
      await fs.unlink(serverUrlFile).catch(() => {})
      process.exit(0)
    }
    
    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))
    
    // Keep server running
    await new Promise(() => {})
  },
})
