import { ServerAuth } from "../../server/auth"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"

export const TokenCommand = cmd({
  command: "token",
  describe: "manage server authentication tokens",
  builder: (yargs) =>
    yargs
      .command(TokenCreateCommand)
      .command(TokenListCommand)
      .command(TokenRevokeCommand)
      .demandCommand(),
  async handler() {},
})

export const TokenCreateCommand = cmd({
  command: "create [name]",
  describe: "create a new authentication token",
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      describe: "name for the token (e.g., 'My Laptop', 'CI Server')",
    }),
  async handler(args) {
    UI.empty()
    prompts.intro("Create Authentication Token")

    let name = args.name
    if (!name) {
      const input = await prompts.text({
        message: "Enter a name for this token",
        placeholder: "My Laptop",
        validate: (x) => (x && x.length > 0 ? undefined : "Token name is required"),
      })
      if (prompts.isCancel(input)) throw new UI.CancelledError()
      name = input
    }

    const spinner = prompts.spinner()
    spinner.start("Generating token...")

    try {
      const { token, info } = await ServerAuth.createToken(name)
      spinner.stop("Token created successfully")

      prompts.note(
        `Token ID: ${info.id}\nToken: ${token}\nCreated: ${new Date(info.createdAt).toLocaleString()}\nPermissions: ${info.permissions.join(", ")}`,
        "Token Details"
      )

      prompts.log.warn("⚠️  Save this token now - it won't be shown again!")
      prompts.log.info(`Use with: opencode --server <url> --token ${token}`)

      prompts.outro("Done")
    } catch (error) {
      spinner.stop("Failed to create token", 1)
      prompts.log.error(error instanceof Error ? error.message : String(error))
      prompts.outro("Failed")
    }
  },
})

export const TokenListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list all authentication tokens",
  async handler() {
    UI.empty()
    prompts.intro("Authentication Tokens")

    try {
      const tokens = await ServerAuth.listTokens()

      if (tokens.length === 0) {
        prompts.log.warn("No tokens found")
        prompts.outro("Create a token with: opencode token create")
        return
      }

      for (const token of tokens) {
        const created = new Date(token.createdAt).toLocaleString()
        prompts.log.info(
          `${token.name}\n  ${UI.Style.TEXT_DIM}ID: ${token.id}\n  Created: ${created}\n  Permissions: ${token.permissions.join(", ")}`
        )
      }

      prompts.outro(`${tokens.length} token${tokens.length === 1 ? "" : "s"}`)
    } catch (error) {
      prompts.log.error(error instanceof Error ? error.message : String(error))
      prompts.outro("Failed")
    }
  },
})

export const TokenRevokeCommand = cmd({
  command: "revoke <id>",
  describe: "revoke an authentication token",
  builder: (yargs) =>
    yargs.positional("id", {
      type: "string",
      describe: "token ID to revoke",
      demandOption: true,
    }),
  async handler(args) {
    UI.empty()
    prompts.intro("Revoke Authentication Token")

    const id = args.id as string

    // Verify token exists
    const token = await ServerAuth.getToken(id)
    if (!token) {
      prompts.log.error(`Token not found: ${id}`)
      prompts.outro("Failed")
      return
    }

    prompts.log.warn(`Token: ${token.name}`)
    prompts.log.warn(`Created: ${new Date(token.createdAt).toLocaleString()}`)

    const confirm = await prompts.confirm({
      message: "Are you sure you want to revoke this token?",
    })

    if (prompts.isCancel(confirm) || !confirm) {
      prompts.outro("Cancelled")
      return
    }

    const spinner = prompts.spinner()
    spinner.start("Revoking token...")

    try {
      const success = await ServerAuth.revokeToken(id)
      if (success) {
        spinner.stop("Token revoked successfully")
        prompts.outro("Done")
      } else {
        spinner.stop("Failed to revoke token", 1)
        prompts.outro("Failed")
      }
    } catch (error) {
      spinner.stop("Failed to revoke token", 1)
      prompts.log.error(error instanceof Error ? error.message : String(error))
      prompts.outro("Failed")
    }
  },
})
