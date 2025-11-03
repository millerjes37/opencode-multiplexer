# OpenCode Multiplexer with Zellij

Run 30+ OpenCode TUI instances efficiently with a single persistent server.

## Prerequisites

- [Zellij](https://zellij.dev/) terminal multiplexer
- OpenCode Multiplexer fork installed

## Quick Start

### Option 1: Using the Start Script (Recommended)

```bash
# Clone and build
git clone https://github.com/millerjes37/opencode-multiplexer.git
cd opencode-multiplexer
git checkout feature/multi-client-server

# Build (requires Bun)
bun install
bun run build

# Start server with auto-configured PATH
./scripts/start-server.sh

# In another terminal: Install Zellij layout
bash scripts/install-zellij-layout.sh

# Launch 30-client multiplexer!
zellij --layout opencode-multiplexer
```

### Option 2: Manual Start

```bash
# Start server manually
opencode serve --port 4096

# In another terminal: Launch clients
zellij --layout opencode-multiplexer
```

## Add Shell Alias (Recommended)

Add to `~/.zshrc` or `~/.bashrc`:
```bash
alias ocmux='zellij --layout opencode-multiplexer'
```

Then simply run:
```bash
ocmux
```

## Server Management

### Using start-server.sh

The `start-server.sh` script automatically configures your PATH and starts the server:

```bash
# Basic usage (uses defaults)
./scripts/start-server.sh

# Custom port and hostname
./scripts/start-server.sh --port 8080 --hostname 0.0.0.0

# With authentication
./scripts/start-server.sh --require-auth

# With PID file for daemon management
./scripts/start-server.sh --pidfile /var/run/opencode.pid

# Using environment variables
PORT=8080 HOSTNAME=0.0.0.0 ./scripts/start-server.sh
```

**Features:**
- Auto-detects OpenCode in `~/.opencode/bin`, `~/.local/bin`, etc.
- Port conflict detection and resolution
- Health check verification
- Graceful shutdown (Ctrl+C)
- PID file support

### Manual Server Start

```bash
# Ensure opencode is in PATH
export PATH="$HOME/.opencode/bin:$PATH"

# Start server
opencode serve --port 4096 --hostname 127.0.0.1
```

## Layout Structure

- **Server Tab**: Persistent OpenCode server on port 4096
- **8 Client Tabs**: 4 TUI clients per tab (30 total)
- **Monitor Tab**: Real-time server status + htop

## Zellij Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+t` + `1-9` | Switch to tab number |
| `Ctrl+p` + arrows | Navigate panes |
| `Alt+n` | New pane |
| `Alt+[` / `Alt+]` | Resize panes |
| `Ctrl+t` + `c` | Close current pane |

## Architecture

```
Server Tab: opencode serve --port 4096
Client Tabs: opencode --server http://localhost:4096 (x30)
```

**Benefits:**
- Single server = lower memory usage
- Shared AI context across clients
- Centralized monitoring via `/status` endpoint

## Customization

Edit `~/.config/zellij/layouts/opencode-multiplexer.kdl`:

```kdl
// Change server port
args "-c" "opencode serve --port 8080"

// Change client connection
args "-c" "opencode --server http://localhost:8080"

// Add more clients by duplicating pane blocks
```

## Monitoring

### Via Monitor Tab
Switch to the "📊 Monitor" tab to see:
- Auto-refreshing server status
- System resources (htop)

### Via Command Line
```bash
# Server status
curl http://localhost:4096/status | json_pp

# Health check
curl http://localhost:4096/health

# Connected clients
curl http://localhost:4096/status | jq '.connectedClients'
```

## Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -i :4096

# Kill existing process
kill -9 $(lsof -t -i:4096)

# Restart layout
zellij kill-all-sessions
ocmux
```

### Clients Can't Connect
```bash
# Verify server is running (switch to Server tab)
# Check logs for errors

# Test connection manually
curl http://localhost:4096/health
```

### Performance Issues
- Reduce client count (edit KDL file)
- Monitor memory with `htop`
- Use local models to avoid API rate limits

## Performance Tips

1. **Staggered Startup**: Clients have `sleep` delays to prevent connection storms
2. **Resource Monitoring**: One server uses ~1GB RAM vs ~30GB for 30 independent instances
3. **API Limits**: Use high-tier API plans or local models for 30 concurrent agents

## Advanced Usage

### With Authentication
```bash
# Generate token
opencode token create "my-token"

# Start server with auth
opencode serve --port 4096 --require-auth

# Update KDL layout to use token
args "-c" "opencode --server http://localhost:4096 --token YOUR_TOKEN"
```

### Remote Server
```bash
# Start server on remote machine
ssh remote-host "opencode serve --port 4096 --hostname 0.0.0.0"

# Connect from local machine (update KDL)
args "-c" "opencode --server http://remote-host:4096"
```

## See Also

- [Multi-Client Guide](./packages/opencode/docs/MULTI_CLIENT_GUIDE.md)
- [Routing Analysis](./ROUTING_ANALYSIS.md)
- [Implementation Details](./IMPLEMENTATION_COMPLETE.md)
- [Zellij Documentation](https://zellij.dev/documentation/)

---

**Enjoy your AI coding swarm!** 🚀
