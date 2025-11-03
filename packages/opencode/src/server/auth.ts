import crypto from "crypto"
import z from "zod"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"

export namespace ServerAuth {
  const log = Log.create({ service: "server-auth" })

  // Token info schema
  export const TokenInfo = z.object({
    id: z.string(),
    hash: z.string(),
    createdAt: z.string(),
    name: z.string(),
    permissions: z.array(z.string()),
  })
  export type TokenInfo = z.infer<typeof TokenInfo>

  /**
   * Generate a secure random token
   * Returns both the raw token (to show user) and the hash (to store)
   */
  export function generateToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString("hex")
    const hash = hashToken(token)
    return { token, hash }
  }

  /**
   * Hash a token using SHA-256
   */
  export function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex")
  }

  /**
   * Create a new token with metadata
   */
  export async function createToken(name: string, permissions: string[] = ["read", "write"]): Promise<{ token: string; info: TokenInfo }> {
    const { token, hash } = generateToken()
    const id = crypto.randomUUID()
    
    const info: TokenInfo = {
      id,
      hash,
      createdAt: new Date().toISOString(),
      name,
      permissions,
    }
    
    await Storage.write(["tokens", id], info)
    log.info("token created", { id, name })
    
    return { token, info }
  }

  /**
   * Validate a token against stored hashes
   */
  export async function validateToken(token: string): Promise<boolean> {
    try {
      const hash = hashToken(token)
      const tokens = await listTokens()
      
      for (const tokenInfo of tokens) {
        if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(tokenInfo.hash))) {
          log.debug("token validated", { id: tokenInfo.id })
          return true
        }
      }
      
      log.warn("invalid token provided")
      return false
    } catch (error) {
      log.error("token validation error", { error })
      return false
    }
  }

  /**
   * List all tokens (without revealing hashes)
   */
  export async function listTokens(): Promise<TokenInfo[]> {
    try {
      const keys = await Storage.list(["tokens"])
      const tokens: TokenInfo[] = []
      
      for (const key of keys) {
        try {
          const token = await Storage.read<TokenInfo>(key)
          tokens.push(token)
        } catch (error) {
          log.warn("failed to read token", { key, error })
        }
      }
      
      return tokens.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch (error) {
      log.error("failed to list tokens", { error })
      return []
    }
  }

  /**
   * Revoke a token by ID
   */
  export async function revokeToken(id: string): Promise<boolean> {
    try {
      await Storage.remove(["tokens", id])
      log.info("token revoked", { id })
      return true
    } catch (error) {
      log.error("failed to revoke token", { id, error })
      return false
    }
  }

  /**
   * Get token info by ID
   */
  export async function getToken(id: string): Promise<TokenInfo | null> {
    try {
      return await Storage.read<TokenInfo>(["tokens", id])
    } catch (error) {
      return null
    }
  }
}
