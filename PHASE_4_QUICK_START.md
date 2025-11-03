# Phase 4: Authentication Quick Start Guide

## Overview

Phase 4 (Authentication/Authorization) has been **fully implemented**. This guide shows you how to use the authentication features.

---

## Quick Usage Examples

### 1. Managing Authentication Tokens

#### Create a Token
```bash
# Interactive mode
opencode token create

# With name argument
opencode token create "My Laptop"
```

**Output:**
```
✔ Token created successfully
┌─────────────────────────────────────────────────┐
│ Token Details                                   │
├─────────────────────────────────────────────────┤
│ Token ID: abc-123-def                           │
│ Token: 1234567890abcdef...                      │
│ Created: 11/2/2025, 10:30:00 AM                │
│ Permissions: read, write                        │
└─────────────────────────────────────────────────┘

⚠️  Save this token now - it won't be shown again!
💡 Use with: opencode --server <url> --token 1234567890abcdef...
```

#### List Tokens
```bash
opencode token list
# or
opencode token ls
```

**Output:**
```
◇  Authentication Tokens
│
◆  My Laptop
   ID: abc-123-def
   Created: 11/2/2025, 10:30:00 AM
   Permissions: read, write
│
└  1 token
```

#### Revoke a Token
```bash
opencode token revoke <token-id>
```

**Output:**
```
◇  Revoke Authentication Token
│
◆  Token: My Laptop
◆  Created: 11/2/2025, 10:30:00 AM
│
?  Are you sure you want to revoke this token? (y/n)
│
◆  Token revoked successfully
└  Done
```

---

### 2. Running Server with Authentication

#### Start Server with Auth Required
```bash
opencode serve --require-auth
```

**First Time (No tokens exist):**
```
⚠️  No authentication tokens found. Creating one now...

🔐 Authentication Token Created:
   Token: a1b2c3d4e5f6...
   ID: 550e8400-e29b-41d4-a716-446655440000

⚠️  Save this token - it won't be shown again!

💡 Clients must connect with: opencode --server http://127.0.0.1:4096 --token a1b2c3d4e5f6...

🚀 OpenCode server listening on http://127.0.0.1:4096
📁 Data directory: ~/.local/share/opencode
```

**Subsequent Times (Tokens exist):**
```
🔐 Authentication required - 2 token(s) configured
💡 Clients must connect with: opencode --server http://127.0.0.1:4096 --token <your-token>
   Manage tokens with: opencode token list

🚀 OpenCode server listening on http://127.0.0.1:4096
📁 Data directory: ~/.local/share/opencode
```

#### Start Server WITHOUT Auth (Default)
```bash
opencode serve
```

**Output:**
```
🚀 OpenCode server listening on http://127.0.0.1:4096
📁 Data directory: ~/.local/share/opencode
💡 Connect clients with: opencode --server http://127.0.0.1:4096
```

---

### 3. Connecting Clients

#### Connect to Server WITH Authentication
```bash
# Using --token flag
opencode --server http://localhost:4096 --token a1b2c3d4e5f6...

# Using environment variable
export OPENCODE_TOKEN=a1b2c3d4e5f6...
opencode --server http://localhost:4096
```

#### Connect to Server WITHOUT Authentication
```bash
opencode --server http://localhost:4096
```

---

## Authentication Flow

### Token Creation & Storage

1. **Token Generation**: 
   - 256-bit random token (64 hex characters)
   - Generated using `crypto.randomBytes(32)`

2. **Token Hashing**:
   - SHA-256 hash created for storage
   - Original token shown once to user
   - Only hash stored on disk

3. **Token Storage**:
   - Location: `~/.local/share/opencode/storage/tokens/{uuid}.json`
   - Format:
     ```json
     {
       "id": "550e8400-e29b-41d4-a716-446655440000",
       "hash": "5e884898da...",
       "createdAt": "2025-11-02T10:30:00.000Z",
       "name": "My Laptop",
       "permissions": ["read", "write"]
     }
     ```

### Token Validation

1. **Client Request**:
   ```http
   GET /session HTTP/1.1
   Authorization: Bearer a1b2c3d4e5f6...
   ```

2. **Server Validation**:
   - Extracts token from `Authorization: Bearer <token>` header
   - Hashes provided token
   - Compares hash against stored hashes using constant-time comparison
   - Returns 401 if invalid or missing

3. **Special Endpoints** (Always Accessible):
   - `/health` - Health check endpoint
   - `/status` - Server status endpoint

---

## Security Best Practices

### Token Management

1. **Treat Tokens Like Passwords**
   - Never commit tokens to version control
   - Never share tokens publicly
   - Use environment variables for CI/CD

2. **Use Descriptive Names**
   ```bash
   opencode token create "GitHub Actions CI"
   opencode token create "Production Deploy Server"
   opencode token create "My Laptop"
   ```

3. **Regular Token Rotation**
   ```bash
   # Create new token
   opencode token create "Laptop - Nov 2025"
   
   # Update services to use new token
   # ...
   
   # Revoke old token
   opencode token revoke <old-token-id>
   ```

4. **Revoke Compromised Tokens Immediately**
   ```bash
   opencode token list
   opencode token revoke <compromised-token-id>
   ```

### Server Security

1. **Enable Auth for Multi-User Environments**
   ```bash
   opencode serve --require-auth
   ```

2. **Use HTTPS in Production**
   ```bash
   # Behind reverse proxy (nginx, caddy, etc.)
   # Proxy HTTPS → HTTP to OpenCode server
   ```

3. **Monitor Access Logs**
   ```bash
   opencode serve --print-logs
   ```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENCODE_TOKEN` | Authentication token for client | `a1b2c3d4e5f6...` |
| `OPENCODE_SERVER` | Server URL (set by TUI automatically) | `http://localhost:4096` |

---

## API Usage

### Using curl with Authentication

```bash
# Without authentication
curl http://localhost:4096/session

# With authentication
curl -H "Authorization: Bearer a1b2c3d4e5f6..." \
     http://localhost:4096/session

# Health check (no auth required)
curl http://localhost:4096/health
```

### Using SDK with Authentication

```typescript
import { createOpencodeClient } from '@opencode-ai/sdk'

const client = createOpencodeClient({
  baseUrl: 'http://localhost:4096',
  headers: {
    Authorization: 'Bearer a1b2c3d4e5f6...'
  }
})

const sessions = await client.session.list()
```

---

## Troubleshooting

### Error: "Missing authentication token"

**Cause:** Server has `--require-auth` enabled but client didn't provide token

**Solution:**
```bash
# Get token
opencode token list

# Connect with token
opencode --server http://localhost:4096 --token <your-token>
```

### Error: "Invalid authentication token"

**Cause:** Token is incorrect, expired, or revoked

**Solution:**
```bash
# Verify token exists
opencode token list

# Create new token if needed
opencode token create "My Device"

# Use correct token
opencode --server http://localhost:4096 --token <valid-token>
```

### Can't Connect to Server

**Check if server is running:**
```bash
curl http://localhost:4096/health
```

**Check if auth is required:**
```bash
curl http://localhost:4096/status
```

**Check server logs:**
```bash
opencode serve --print-logs
```

---

## Testing

### Manual Test Script

Run the automated test script:
```bash
./test-phase4-auth.sh
```

This tests:
- Token creation
- Token listing
- Server with authentication
- Client connection (with/without tokens)
- Health/status endpoint bypass

### Manual Testing Steps

1. **Test Token Management**
   ```bash
   opencode token create "Test Token"
   opencode token list
   TOKEN_ID=$(opencode token list | grep "ID:" | awk '{print $2}')
   opencode token revoke $TOKEN_ID
   ```

2. **Test Server Authentication**
   ```bash
   # Terminal 1: Start server
   opencode serve --require-auth
   
   # Terminal 2: Try without token (should fail)
   curl http://localhost:4096/session
   
   # Terminal 3: Try with token (should work)
   curl -H "Authorization: Bearer <token>" http://localhost:4096/session
   ```

3. **Test Client Connection**
   ```bash
   # Terminal 1: Start server
   opencode serve --require-auth
   
   # Terminal 2: Connect client
   opencode --server http://localhost:4096 --token <token>
   ```

---

## Migration & Backward Compatibility

### Existing Deployments

**No breaking changes!** Authentication is **disabled by default**.

```bash
# Existing behavior (no auth)
opencode serve

# New behavior (with auth)
opencode serve --require-auth
```

### Upgrading to Use Authentication

1. **Stop existing server** (if running)

2. **Create tokens for clients**
   ```bash
   opencode token create "Client 1"
   opencode token create "Client 2"
   # Save the generated tokens!
   ```

3. **Start server with auth**
   ```bash
   opencode serve --require-auth
   ```

4. **Update clients to use tokens**
   ```bash
   opencode --server http://localhost:4096 --token <token>
   ```

---

## Additional Resources

- **Implementation Summary**: See `PHASE_4_IMPLEMENTATION_SUMMARY.md`
- **Implementation Plan**: See `MULTI_CLIENT_IMPLEMENTATION_PLAN.md`
- **Test Script**: Run `./test-phase4-auth.sh`

---

## Support

For issues or questions:
1. Check server logs: `opencode serve --print-logs`
2. Verify token: `opencode token list`
3. Test health: `curl http://localhost:4096/health`
4. Review documentation: `PHASE_4_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated:** 2025-11-02  
**Status:** Production Ready ✅
