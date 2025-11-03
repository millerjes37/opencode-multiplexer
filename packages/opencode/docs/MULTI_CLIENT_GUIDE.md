# Multi-Client Server Mode Guide

## Overview

OpenCode's multi-client server mode allows you to run a single OpenCode server that multiple clients can connect to simultaneously. This architecture provides several advantages:

- **Resource Efficiency**: Run one server instance instead of multiple separate processes
- **Shared Context**: All clients connected to the same project directory share session state
- **Remote Development**: Run the server on a powerful machine while connecting from multiple devices
- **Team Collaboration**: Multiple developers can connect to the same server for pair programming
- **Persistent Sessions**: Server continues running even when clients disconnect

## Architecture

The multi-client architecture consists of:

```
┌─────────────────────────────────────────────────┐
│           OpenCode Server (Headless)            │
│  - Manages project instances                    │
│  - Handles AI model requests                    │
│  - Maintains session state                      │
│  - Broadcasts events via SSE                    │
└─────────────┬───────────────────────────────────┘
              │
              ├──────────┬──────────┬──────────┐
              │          │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐
         │Client 1│ │Client 2│ │Client 3│ │Client N│
         │  TUI   │ │  TUI   │ │  TUI   │ │  TUI   │
         └────────┘ └────────┘ └────────┘ └────────┘
```

**Key Concepts:**

- **Server**: A headless OpenCode process that handles all AI requests and file operations
- **Client**: A terminal UI (TUI) that connects to a server and displays the interface
- **Project Instance**: Each unique directory path gets its own isolated project context
- **Event Stream**: Real-time updates from server to clients using Server-Sent Events (SSE)
- **Connection Tracking**: Server maintains information about all connected clients

## Getting Started

### Starting a Server

Start a headless OpenCode server on your machine:

```bash
opencode serve
```

By default, this starts the server on `http://127.0.0.1:4096`.

**With custom settings:**

```bash
# Custom port
opencode serve --port 8080

# Listen on all interfaces (for remote access)
opencode serve --hostname 0.0.0.0 --port 8080

# Write PID to file (useful for process management)
opencode serve --pidfile /var/run/opencode.pid
```

**Expected output:**
```
🚀 OpenCode server listening on http://127.0.0.1:4096
📁 Data directory: /Users/username/.opencode
💡 Connect clients with: opencode --server http://127.0.0.1:4096
```

### Connecting Clients

Once the server is running, connect a client:

```bash
opencode --server http://127.0.0.1:4096
```

You can connect multiple clients to the same server. Each client can work in a different project directory.

**Connect to specific project:**

```bash
opencode --server http://127.0.0.1:4096 /path/to/project
```

**Connection behavior:**

- Clients automatically retry connection with exponential backoff (1s, 2s, 5s, 10s, 30s)
- If the server is not available, the client will show error messages
- Each client gets a unique client ID for tracking

### Verifying Connections

Check server status and see connected clients:

```bash
curl http://127.0.0.1:4096/status
```

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "connectedClients": 3,
  "connectionsByProject": {
    "abc123": 2,
    "def456": 1
  },
  "uptime": 3600.5
}
```

**Health check:**
```bash
curl http://127.0.0.1:4096/health
```

## Use Cases

### 1. Multiple Developers Sharing One Server

Run a single server on a powerful development machine:

```bash
# On powerful machine
opencode serve --hostname 0.0.0.0 --port 8080
```

Team members connect from their workstations:

```bash
# Developer 1
opencode --server http://dev-server:8080 ~/project-a

# Developer 2
opencode --server http://dev-server:8080 ~/project-b
```

**Benefits:**
- Centralized API key management
- Consistent model behavior across team
- Better resource utilization

### 2. Remote Development Setup

Run the server on a cloud instance with GPU access:

```bash
# On cloud instance
opencode serve --hostname 0.0.0.0 --port 8080
```

Connect from your laptop anywhere:

```bash
# On laptop
opencode --server http://cloud-instance:8080 ~/local-project
```

**Benefits:**
- Access powerful hardware from lightweight devices
- Continue work from different locations
- Persistent sessions survive client disconnections

### 3. Development + Mobile Monitoring

Run server on your development machine, connect from both terminal and mobile:

```bash
# On dev machine
opencode serve

# Terminal client
opencode --server http://localhost:4096

# Future: Mobile app connects to same server
```

### 4. CI/CD Integration

Run OpenCode server in a container for automated tasks:

```bash
# In CI pipeline
docker run -d -p 8080:8080 opencode serve --hostname 0.0.0.0 --port 8080

# Connect and run automated tasks
opencode --server http://localhost:8080 --prompt "Run tests and fix any failures"
```

## Configuration

### Server Options

| Flag | Description | Default |
|------|-------------|---------|
| `--port, -p` | Port to listen on | 4096 |
| `--hostname` | Hostname to listen on | 127.0.0.1 |
| `--pidfile` | Write PID to file for process management | (none) |

**Examples:**

```bash
# Development (local only)
opencode serve

# Remote access (all interfaces)
opencode serve --hostname 0.0.0.0

# Custom port
opencode serve --port 8080

# Production with PID file
opencode serve --port 8080 --pidfile /var/run/opencode.pid
```

### Client Options

| Flag | Description | Conflicts With |
|------|-------------|----------------|
| `--server` | URL of OpenCode server to connect to | `--port`, `--hostname` |
| `--port` | Port for auto-spawned server (ignored if `--server` provided) | `--server` |
| `--hostname` | Hostname for auto-spawned server (ignored if `--server` provided) | `--server` |

**Examples:**

```bash
# Connect to external server
opencode --server http://localhost:4096

# Connect to remote server
opencode --server http://192.168.1.100:8080

# Auto-spawn embedded server (legacy mode)
opencode  # No --server flag
```

### Environment Variables

Server and client both respect:

- `OPENCODE_INSTALL_DIR`: Custom installation directory
- `OPENCODE_DISABLE_AUTOUPDATE`: Disable automatic updates
- Standard OpenCode configuration in `~/.opencode/config.json`

## Monitoring

### Using /status Endpoint

The `/status` endpoint provides real-time information about the server:

```bash
curl http://localhost:4096/status | jq
```

**Response fields:**

- `status`: Server health (`"ok"` when healthy)
- `version`: OpenCode version number
- `connectedClients`: Total number of connected clients
- `connectionsByProject`: Client count grouped by project ID
- `uptime`: Server uptime in seconds

**Example monitoring script:**

```bash
#!/bin/bash
while true; do
  curl -s http://localhost:4096/status | jq '{
    clients: .connectedClients,
    uptime: (.uptime | tonumber | . / 3600 | floor),
    projects: (.connectionsByProject | length)
  }'
  sleep 10
done
```

### Understanding Connection Metrics

**Project ID:** Each unique directory path gets a deterministic project ID. Multiple clients connected to the same directory will share the same project ID.

**Connection Lifecycle:**

1. Client establishes SSE connection to `/event?directory=/path/to/project`
2. Server generates unique client ID
3. Server sends `server.connected` event with client info
4. Client receives events filtered by project ID
5. On disconnect, server logs duration and removes client from tracking

**Server Logs:**

```bash
# View server logs (adjust path based on your system)
tail -f ~/.opencode/logs/server.log
```

Example log entries:
```
[INFO] event connected - clientID: abc-123, projectID: proj-456, directory: /path/to/project, totalConnections: 3
[INFO] event disconnected - clientID: abc-123, projectID: proj-456, directory: /path/to/project, duration: 3600.5s, totalConnections: 2
```

### Health Check for Load Balancers

For production deployments, use the `/health` endpoint:

```bash
curl http://localhost:4096/health
```

Returns:
```json
{
  "status": "ok"
}
```

This endpoint is lightweight and suitable for frequent health checks.

## Best Practices

### When to Use Multi-Client Mode

**Good use cases:**
- Remote development with powerful server hardware
- Team environments with shared API keys
- Running OpenCode in containers or VMs
- Multiple projects on one machine
- Long-running tasks that should survive client disconnections

**When to use legacy mode (auto-spawn):**
- Single user on local machine
- Maximum isolation between projects
- No network connectivity to server
- Development/testing of OpenCode itself

### Security Considerations

**Network Security:**

- **Default**: Server binds to `127.0.0.1` (localhost only) - safe for local use
- **Remote Access**: Binding to `0.0.0.0` exposes the server to your network
- **Production**: Use a reverse proxy (nginx, Caddy) with TLS/SSL
- **Firewall**: Restrict access to trusted IP addresses

**Authentication:**

Current version does not include authentication. For secure deployments:

1. Use a reverse proxy with authentication (nginx + basic auth)
2. Use SSH tunneling: `ssh -L 4096:localhost:4096 remote-host`
3. Use VPN to access the server
4. Keep server on trusted networks only

**API Keys:**

- Server reads API keys from `~/.opencode/config.json`
- All clients connecting to the server share these credentials
- Keep the server machine secure
- Use separate API keys per environment (dev/staging/prod)

### Performance Tips

**Server Resources:**

- Server is CPU and memory intensive when processing AI requests
- Allocate at least 2GB RAM for the server process
- More clients = more concurrent requests = more resources needed
- Monitor server with `/status` endpoint

**Network:**

- Low latency is important for responsive UI
- Event stream uses Server-Sent Events (SSE) - one HTTP connection per client
- Typical bandwidth: ~1-10KB/s per client (mostly text)
- Remote access works well on 10Mbps+ connections

**Project Isolation:**

- Each unique directory gets its own project instance
- Project instances are isolated (separate LSP servers, separate state)
- Server manages multiple projects efficiently
- No cross-project interference

**Long-Running Sessions:**

- Server has no idle timeout - connections can stay open indefinitely
- Sessions persist even when clients disconnect
- Restart server periodically for updates and memory management

## Troubleshooting

### Connection Failures

**Error: "Failed to connect to server"**

Check if server is running:
```bash
curl http://localhost:4096/health
```

If server is not running:
```bash
# Check if server process exists
ps aux | grep "opencode serve"

# Check server logs
tail -f ~/.opencode/logs/server.log

# Restart server
opencode serve
```

**Connection refused:**

- Verify the port is correct
- Check firewall settings
- Ensure server is binding to the right interface (`0.0.0.0` for remote access)

**Timeout errors:**

- Check network connectivity
- Verify server is responsive: `curl http://server:port/health`
- Check for firewall or proxy issues

### Event Not Appearing in Other Clients

**Events are project-scoped:** Events are automatically filtered by project directory. Clients connected to different directories won't see each other's events.

**Verify clients are connected to same project:**

```bash
# Check server status
curl http://localhost:4096/status | jq '.connectionsByProject'
```

**Global vs Project Events:**

- Most events include `projectID` and are filtered
- Some events (like server status) are broadcast to all clients
- This is by design for isolation between projects

### Performance Issues

**Slow response times:**

1. Check server CPU/memory usage: `top` or `htop`
2. Check active connections: `curl http://localhost:4096/status`
3. Review server logs for errors
4. Consider reducing concurrent clients
5. Use a more powerful machine for the server

**High memory usage:**

- Server memory grows with number of active sessions
- Each project instance maintains state
- Restart server periodically to free memory
- Close unused sessions in the TUI

**Network lag:**

- Use `ping` to check latency to server
- Check bandwidth: SSE streams use minimal bandwidth
- Consider running server closer to clients (same network)

### Common Errors and Solutions

**Error: "Session locked by another client"**

- Sessions can only be modified by one client at a time
- Wait for other client to finish
- Or abort the session: `ctrl+c` in the client

**Error: "Project directory not found"**

- Server cannot access the path specified by client
- Ensure the directory exists on the server's filesystem
- Check path permissions

**Error: "Model not found" or "Provider not configured"**

- Configure providers on the server: `opencode auth login`
- Server configuration is in `~/.opencode/config.json`
- Clients inherit model configuration from server

**Server won't start:**

- Port already in use: Change port with `--port`
- Permission denied: Use port > 1024 or run with appropriate permissions
- Check logs: `~/.opencode/logs/server.log`

**Client connection drops:**

- Network interruption: Client will automatically retry
- Server crashed: Check server logs and restart
- Idle timeout: Should not happen (server has no idle timeout)

### Getting Help

If you encounter issues not covered here:

1. Check server logs: `~/.opencode/logs/server.log`
2. Check client connection: `curl http://server:port/health`
3. Review server status: `curl http://server:port/status`
4. Visit [OpenCode Discord](https://opencode.ai/discord)
5. Open an issue on [GitHub](https://github.com/sst/opencode)

### Debug Mode

Enable verbose logging:

```bash
# Server with debug logs
DEBUG=opencode:* opencode serve

# Check what events are being sent
curl -N http://localhost:4096/event?directory=$(pwd)
```

This will show all events as they're broadcast to clients.

---

For more information:
- [API Documentation](./API.md) - REST and SSE endpoints
- [Migration Guide](./MIGRATION_TO_MULTI_CLIENT.md) - Upgrading to multi-client mode
- [Examples](../examples/multi-client-setup/) - Sample configurations
