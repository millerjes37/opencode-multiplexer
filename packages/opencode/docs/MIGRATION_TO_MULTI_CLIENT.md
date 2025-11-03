# Migration Guide: Multi-Client Server Mode

This guide helps existing OpenCode users understand and adopt the new multi-client server architecture.

## What's Changed

OpenCode now supports two modes of operation:

### Legacy Mode (Auto-Spawn Server)

**How to use:**
```bash
opencode
```

**What happens:**
- Automatically spawns an embedded server for that client only
- Server runs as part of the TUI process
- Server stops when you exit the TUI
- Each TUI instance has its own isolated server

### Multi-Client Mode (Shared Server)

**How to use:**
```bash
# Start server
opencode serve

# Connect clients
opencode --server http://localhost:4096
```

**What happens:**
- Run a dedicated server process
- Multiple clients can connect to the same server
- Server continues running when clients disconnect
- Clients are lightweight TUI processes

## Backward Compatibility

**Good news: Nothing breaks!**

- Default behavior is unchanged - running `opencode` still works exactly as before
- Legacy mode (auto-spawn) is still the default
- No changes to command flags (except new optional `--server` flag)
- All existing workflows continue to work
- Session data format is unchanged
- Configuration format is unchanged

**The `--server` flag is completely optional** - you only use it if you want multi-client mode.

## When to Migrate

### Stick with Legacy Mode If:

- You're a single user on a local machine
- You prefer simple "just works" behavior
- You want maximum isolation between sessions
- You're developing or testing OpenCode itself

### Use Multi-Client Mode If:

- You want to run the server on a powerful remote machine
- Multiple developers need to share API keys/configuration
- You want sessions to persist when disconnecting
- You're running OpenCode in containers/VMs
- You want to connect from multiple devices

**Most users don't need to migrate** - legacy mode works great for local development!

## How to Upgrade

### Step 1: Update OpenCode

Multi-client mode is available in version 0.1.0+.

```bash
# Check version
opencode --version

# Update if needed
npm update -g opencode-ai
# or
curl -fsSL https://opencode.ai/install | bash
```

### Step 2: Choose Your Mode

**Option A: Continue using legacy mode (no changes needed)**

```bash
opencode  # Same as always
```

**Option B: Try multi-client mode**

```bash
# Terminal 1: Start server
opencode serve

# Terminal 2: Connect client
opencode --server http://localhost:4096

# Terminal 3: Connect another client
opencode --server http://localhost:4096 ~/different-project
```

### Step 3: Test Your Setup

**Verify server is running:**

```bash
curl http://localhost:4096/health
```

**Check client connection:**

```bash
curl http://localhost:4096/status
```

**Connect and test:**

```bash
opencode --server http://localhost:4096
# Try some commands to verify everything works
```

## New Features Available

### 1. Remote Development

Run the server on a powerful machine:

```bash
# On powerful machine
opencode serve --hostname 0.0.0.0 --port 8080
```

Connect from anywhere:

```bash
# On laptop
opencode --server http://powerful-machine:8080
```

### 2. Persistent Sessions

Sessions survive client disconnections:

```bash
# Connect and start work
opencode --server http://localhost:4096
# ... do some work ...
# Exit client (Ctrl+C)

# Later: reconnect to same server
opencode --server http://localhost:4096 --continue
# Your session is still there!
```

### 3. Server Monitoring

New `/status` endpoint:

```bash
curl http://localhost:4096/status | jq
```

### 4. Multi-Project Isolation

Each project directory gets isolated context:

```bash
# Client 1 working on project A
opencode --server http://localhost:4096 ~/project-a

# Client 2 working on project B
opencode --server http://localhost:4096 ~/project-b

# No interference between projects!
```

## Configuration Changes

### Server Configuration

**Location:** Server inherits configuration from `~/.opencode/config.json`

**API Keys:** Configure once on the server machine:

```bash
# On server machine
opencode auth login
```

All clients connecting to this server will use these credentials.

### Client Configuration

**Clients inherit** most configuration from the server:
- API keys and credentials
- Model preferences
- Provider settings

**Clients can override:**
- Model selection (via `--model` flag)
- Agent selection (via `--agent` flag)
- Session to continue (via `--session` flag)

## Migration Scenarios

### Scenario 1: Local Development (No Migration Needed)

**Before:**
```bash
opencode
```

**After:**
```bash
opencode  # Same command, same behavior
```

**Verdict:** No changes needed!

---

### Scenario 2: Remote Development

**Before:**

You would SSH into a remote machine and run OpenCode there, which required keeping the SSH session open.

```bash
ssh remote-machine
opencode  # Had to keep SSH connection alive
```

**After:**

Run server on remote machine (can be in a screen/tmux session):

```bash
# On remote machine (via SSH or startup script)
opencode serve --hostname 0.0.0.0 --port 8080
```

Connect from local machine:

```bash
# On local machine
opencode --server http://remote-machine:8080
```

**Benefits:**
- Don't need to keep SSH session open
- Can reconnect anytime
- Can connect from multiple devices

---

### Scenario 3: Team Development

**Before:**

Each developer runs their own OpenCode instance with their own API keys.

```bash
# Each developer
opencode
```

**After:**

Run a shared server with centralized API keys:

```bash
# On shared dev machine
opencode serve --hostname 0.0.0.0 --port 8080
```

Team members connect:

```bash
# Developer 1
opencode --server http://dev-server:8080 ~/my-project

# Developer 2
opencode --server http://dev-server:8080 ~/my-project
```

**Benefits:**
- Centralized API key management
- Better resource utilization
- Consistent model behavior

---

### Scenario 4: Container/VM Deployment

**Before:**

Running OpenCode in a container was tricky because the TUI needs a terminal.

**After:**

Run headless server in container:

```dockerfile
FROM node:20
RUN npm install -g opencode-ai
CMD ["opencode", "serve", "--hostname", "0.0.0.0", "--port", "8080"]
```

Connect TUI from host:

```bash
docker run -d -p 8080:8080 opencode-server
opencode --server http://localhost:8080
```

**Benefits:**
- Clean separation of concerns
- Server can run headless
- Easy to scale and deploy

## Breaking Changes

**None!** The multi-client feature is purely additive.

However, be aware of these behavioral differences in multi-client mode:

1. **Server keeps running** when clients disconnect
   - Legacy: Server stops when you exit TUI
   - Multi-client: Server keeps running until explicitly stopped

2. **Configuration location**
   - Legacy: Reads from client machine's `~/.opencode/config.json`
   - Multi-client: Reads from server machine's `~/.opencode/config.json`

3. **File system access**
   - Legacy: Accesses files on client machine
   - Multi-client: Accesses files on server machine (use SSH tunnel or mount if needed)

4. **Port conflicts**
   - Legacy: Uses random port (no conflicts)
   - Multi-client: Uses specified port (default 4096, can conflict)

## Troubleshooting Migration

### Issue: "Connection refused" when connecting client

**Cause:** Server is not running or using different port.

**Solution:**

```bash
# Check if server is running
ps aux | grep "opencode serve"

# Start server if not running
opencode serve

# Or use different port
opencode serve --port 8080
opencode --server http://localhost:8080
```

---

### Issue: "Project directory not found"

**Cause:** Client specified a directory that doesn't exist on the server.

**Solution:**

- Ensure the path exists on the server machine
- Use absolute paths to avoid confusion
- If developing remotely, mount the remote filesystem locally

---

### Issue: "Model not found" after connecting

**Cause:** Server has different provider configuration than expected.

**Solution:**

Configure providers on the server:

```bash
# On server machine
opencode auth login
```

---

### Issue: Client feels slower than before

**Cause:** Network latency between client and server.

**Solution:**

- Use wired connection instead of WiFi
- Run server closer to client (same network)
- Check network latency: `ping server-host`
- Consider running server locally for best performance

---

### Issue: Port already in use

**Cause:** Another process is using port 4096.

**Solution:**

```bash
# Use different port
opencode serve --port 8080
opencode --server http://localhost:8080

# Or find what's using the port
lsof -i :4096
```

## Rollback Plan

If you encounter issues with multi-client mode:

1. **Stop the server:**
   ```bash
   # Find and kill server process
   ps aux | grep "opencode serve"
   kill <pid>
   ```

2. **Return to legacy mode:**
   ```bash
   # Just run without --server flag
   opencode
   ```

3. **Report issues:**
   - [GitHub Issues](https://github.com/sst/opencode/issues)
   - [Discord](https://opencode.ai/discord)

## Best Practices After Migration

1. **Monitor your server:**
   ```bash
   curl http://localhost:4096/status
   ```

2. **Use systemd/launchd for production servers:**
   - See [examples/multi-client-setup/](../examples/multi-client-setup/)

3. **Set up proper security:**
   - Use reverse proxy with authentication
   - Restrict network access
   - Use TLS for remote connections

4. **Regular restarts:**
   - Restart server periodically to free memory
   - Server can accumulate memory over long sessions

5. **Backup configuration:**
   ```bash
   cp ~/.opencode/config.json ~/.opencode/config.json.backup
   ```

## FAQ

### Q: Do I need to migrate?

**A:** No! Legacy mode still works great for most users. Only migrate if you need the features of multi-client mode.

### Q: Can I use both modes?

**A:** Yes! You can use legacy mode for some projects and multi-client mode for others.

```bash
# Legacy mode for project A
cd project-a && opencode

# Multi-client mode for project B  
opencode --server http://localhost:4096 ~/project-b
```

### Q: Will legacy mode be removed?

**A:** No plans to remove it. Legacy mode is simple and works well for single-user scenarios.

### Q: What happens to my existing sessions?

**A:** Nothing changes. Sessions are stored in `~/.opencode/state` and work the same in both modes.

### Q: Can clients on different machines connect to same server?

**A:** Yes! Just make sure the server is listening on `0.0.0.0` and firewall allows connections.

```bash
# Server
opencode serve --hostname 0.0.0.0

# Client on different machine
opencode --server http://server-ip:4096
```

### Q: Does this work on Windows?

**A:** Yes! Multi-client mode works on Windows, macOS, and Linux.

### Q: How do I secure remote connections?

**A:** Use SSH tunneling or reverse proxy with TLS:

```bash
# SSH tunnel
ssh -L 4096:localhost:4096 remote-host
opencode --server http://localhost:4096
```

## Getting Help

If you need assistance with migration:

- **Documentation:** [Multi-Client Guide](./MULTI_CLIENT_GUIDE.md)
- **Examples:** [examples/multi-client-setup/](../examples/multi-client-setup/)
- **Discord:** [OpenCode Discord](https://opencode.ai/discord)
- **GitHub:** [Report Issues](https://github.com/sst/opencode/issues)

## Summary

**For most users:** No migration needed - keep using `opencode` as before!

**For power users:** Try `opencode serve` + `opencode --server` for new capabilities.

**No risk:** Multi-client mode is optional and doesn't affect existing workflows.

Welcome to multi-client mode! 🚀
