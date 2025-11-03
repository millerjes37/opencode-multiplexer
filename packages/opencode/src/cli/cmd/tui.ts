import { Global } from "../../global"
import { Provider } from "../../provider/provider"
import { Server } from "../../server/server"
import { UI } from "../ui"
import { cmd } from "./cmd"
import path from "path"
import fs from "fs/promises"
import { Installation } from "../../installation"
import { Config } from "../../config/config"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { Ide } from "../../ide"

import { Flag } from "../../flag/flag"
import { Session } from "../../session"
import { $ } from "bun"
import { bootstrap } from "../bootstrap"

declare global {
  const OPENCODE_TUI_PATH: string
}

if (typeof OPENCODE_TUI_PATH !== "undefined") {
  await import(OPENCODE_TUI_PATH as string, {
    with: { type: "file" },
  })
}

export const TuiCommand = cmd({
  command: "$0 [project]",
  describe: "start opencode tui",
  builder: (yargs) =>
    yargs
      .positional("project", {
        type: "string",
        describe: "path to start opencode in",
      })
      .option("server", {
        type: "string",
        describe: "connect to existing OpenCode server (e.g., http://localhost:8080)",
        conflicts: ["port", "hostname"],
      })
      .option("token", {
        type: "string",
        describe: "authentication token for server connection",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        describe: "session id to continue",
        type: "string",
      })
      .option("prompt", {
        alias: ["p"],
        type: "string",
        describe: "prompt to use",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("port", {
        type: "number",
        describe: "port for auto-spawned server (ignored if --server provided)",
        default: 0,
      })
      .option("hostname", {
        type: "string",
        describe: "hostname for auto-spawned server (ignored if --server provided)",
        default: "127.0.0.1",
      }),
  handler: async (args) => {
    while (true) {
      const cwd = args.project ? path.resolve(args.project) : process.cwd()
      try {
        process.chdir(cwd)
      } catch (e) {
        UI.error("Failed to change directory to " + cwd)
        return
      }
      const result = await bootstrap(cwd, async () => {
        const sessionID = await (async () => {
          if (args.continue) {
            const it = Session.list()
            try {
              for await (const s of it) {
                if (s.parentID === undefined) {
                  return s.id
                }
              }
              return
            } finally {
              await it.return()
            }
          }
          if (args.session) {
            return args.session
          }
          return undefined
        })()
        const providers = await Provider.list()
        if (Object.keys(providers).length === 0) {
          return "needs_provider"
        }

        // Check if --server flag is provided for external server mode
        let serverUrl: string
        let server: ReturnType<typeof Server.listen> | undefined

        if (args.server) {
          // External server mode - connect with retry logic
          serverUrl = args.server
          
          // Test connection with exponential backoff retry
          const MAX_RETRIES = 5
          const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]
          let connected = false
          
          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
              const response = await fetch(`${serverUrl}/path?directory=${encodeURIComponent(cwd)}`)
              if (response.ok) {
                connected = true
                break
              }
              throw new Error(`Server returned ${response.status}`)
            } catch (e: any) {
              if (attempt === MAX_RETRIES - 1) {
                UI.error(`Failed to connect to server at ${serverUrl}: ${e.message}`)
                UI.error("Make sure the server is running with: opencode serve")
                return "done"
              }
              const delay = RETRY_DELAYS[attempt]
              UI.println(`Connection attempt ${attempt + 1}/${MAX_RETRIES} failed. Retrying in ${delay}ms...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
          
          if (!connected) {
            return "done"
          }
        } else {
          // Legacy mode - auto-spawn embedded server
          server = Server.listen({
            port: args.port,
            hostname: args.hostname,
          })
          serverUrl = server.url.toString()
        }

        let cmd = [] as string[]
        const tui = Bun.embeddedFiles.find((item) => (item as File).name.includes("tui")) as File
        if (tui) {
          let binaryName = tui.name
          if (process.platform === "win32" && !binaryName.endsWith(".exe")) {
            binaryName += ".exe"
          }
          const binary = path.join(Global.Path.cache, "tui", binaryName)
          const file = Bun.file(binary)
          if (!(await file.exists())) {
            await Bun.write(file, tui, { mode: 0o755 })
            if (process.platform !== "win32") await fs.chmod(binary, 0o755)
          }
          cmd = [binary]
        }
        if (!tui) {
          const dir = Bun.fileURLToPath(new URL("../../../../tui/cmd/opencode", import.meta.url))
          let binaryName = `./dist/tui${process.platform === "win32" ? ".exe" : ""}`
          await $`go build -o ${binaryName} ./main.go`.cwd(dir)
          cmd = [path.join(dir, binaryName)]
        }
        Log.Default.info("tui", {
          cmd,
        })
        const proc = Bun.spawn({
          cmd: [
            ...cmd,
            ...(args.model ? ["--model", args.model] : []),
            ...(args.prompt ? ["--prompt", args.prompt] : []),
            ...(args.agent ? ["--agent", args.agent] : []),
            ...(sessionID ? ["--session", sessionID] : []),
          ],
          cwd,
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
          env: {
            ...process.env,
            CGO_ENABLED: "0",
            OPENCODE_SERVER: serverUrl,
            ...(args.token ? { OPENCODE_TOKEN: args.token } : {}),
          },
          onExit: () => {
            server?.stop()
          },
        })

        ;(async () => {
          // if (Installation.isLocal()) return
          const config = await Config.get()
          if (config.autoupdate === false || Flag.OPENCODE_DISABLE_AUTOUPDATE) return
          const latest = await Installation.latest().catch(() => {})
          if (!latest) return
          if (Installation.VERSION === latest) return
          const method = await Installation.method()
          if (method === "unknown") return
          await Installation.upgrade(method, latest)
            .then(() => Bus.publish(Installation.Event.Updated, { version: latest }))
            .catch(() => {})
        })()
        ;(async () => {
          if (Ide.alreadyInstalled()) return
          const ide = Ide.ide()
          if (ide === "unknown") return
          await Ide.install(ide)
            .then(() => Bus.publish(Ide.Event.Installed, { ide }))
            .catch(() => {})
        })()

        await proc.exited
        server?.stop()

        return "done"
      })
      if (result === "done") break
      if (result === "needs_provider") {
        UI.empty()
        UI.println(UI.logo("   "))
        const result = await Bun.spawn({
          cmd: [...getOpencodeCommand(), "auth", "login"],
          cwd: process.cwd(),
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
        }).exited
        if (result !== 0) return
        UI.empty()
      }
    }
  },
})

/**
 * Get the correct command to run opencode CLI
 * In development: ["bun", "run", "packages/opencode/src/index.ts"]
 * In production: ["/path/to/opencode"]
 */
function getOpencodeCommand(): string[] {
  // Check if OPENCODE_BIN_PATH is set (used by shell wrapper scripts)
  if (process.env["OPENCODE_BIN_PATH"]) {
    return [process.env["OPENCODE_BIN_PATH"]]
  }

  const execPath = process.execPath.toLowerCase()

  if (Installation.isLocal()) {
    // In development, use bun to run the TypeScript entry point
    return [execPath, "run", process.argv[1]]
  }

  // In production, use the current executable path
  return [process.execPath]
}
