# OpenCode Multiplexer

> **Multi-client server support for OpenCode** - Connect multiple TUI clients to a single persistent server

[![GitHub](https://img.shields.io/badge/github-millerjes37%2Fopencode--multiplexer-blue)](https://github.com/millerjes37/opencode-multiplexer)
[![Original](https://img.shields.io/badge/upstream-sst%2Fopencode-green)](https://github.com/sst/opencode)

---

## What's Different in This Fork?

This fork extends [OpenCode](https://github.com/sst/opencode) with **multi-client server architecture**, allowing multiple TUI clients to connect to a single persistent OpenCode server.

### Key Features

✅ **Multi-Client Support** - Run one server, connect multiple clients  
✅ **Project Isolation** - Events and sessions properly scoped per project  
✅ **Connection Tracking** - Monitor active connections and metrics  
✅ **Authentication** - Optional token-based authentication for security  
✅ **Backward Compatible** - Works exactly like original OpenCode by default  
✅ **Production Ready** - Docker, systemd, nginx examples included  

---

## Quick Start

### Single Server, Multiple Clients

**Terminal 1 - Start the server:**
```bash
opencode serve
# 🚀 OpenCode server listening on http://127.0.0.1:4096
```

**Terminal 2 - Connect client 1:**
```bash
opencode --server http://localhost:4096 ~/my-project
```

**Terminal 3 - Connect client 2 (sees events from client 1):**
```bash
opencode --server http://localhost:4096 ~/my-project
```

**Terminal 4 - Monitor server:**
```bash
curl http://localhost:4096/status
```

### With Authentication

```bash
# Generate token
opencode token create "My Dev Token"
# Output: Token: oc_abc123...

# Start server with auth required
opencode serve --require-auth

# Connect with token
opencode --server http://localhost:4096 --token oc_abc123... ~/project
```

---

## Installation

```bash
# Clone this fork
git clone https://github.com/millerjes37/opencode-multiplexer.git
cd opencode-multiplexer

# Install dependencies
bun install

# Build
bun run build

# Link globally (optional)
bun link

# Use it
opencode serve
```

---

## Use Cases

### 1. **Multiple Developers, Shared Server**
Run one OpenCode server on a powerful machine, let multiple developers connect from their laptops.

### 2. **Remote Development**
Run server on your cloud VM, connect from anywhere (with authentication enabled).

### 3. **Mobile + Desktop Workflow**
Monitor your AI coding session on mobile while working on desktop.

### 4. **CI/CD Integration**
Run OpenCode server in your CI pipeline, monitor from your local terminal.

---

## Architecture

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Client 1 │    │ Client 2 │    │ Client 3 │
│(Project A)│   │(Project A)│   │(Project B)│
└─────┬────┘    └─────┬────┘    └─────┬────┘
      │               │               │
      │ HTTP + SSE    │ HTTP + SSE    │ HTTP + SSE
      │ ?directory=/a │ ?directory=/a │ ?directory=/b
      │               │               │
      └───────────────┴───────────────┘
                      │
                      ▼
           ┌──────────────────┐
           │  OpenCode Server │
           │   (Persistent)   │
           │                  │
           │  ┌────────────┐  │
           │  │ Event Bus  │  │
           │  │  Per Project  │
           │  └────────────┘  │
           │                  │
           │  /status         │
           │  /health         │
           │  /event (SSE)    │
           └──────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │   Storage    │
              │ (File-based) │
              └──────────────┘
```

---

## What's Implemented

### Phase 1: Separate TUI Binary ✅
- `--server` flag to connect to external servers
- Exponential backoff retry logic
- PID file support
- Graceful shutdown

### Phase 2: Multi-Client Session Management ✅
- Global event bus keyed by projectID
- SSE event filtering for isolation
- Automatic cleanup to prevent memory leaks

### Phase 3: Connection Monitoring ✅
- Connection tracking with unique client IDs
- `/status` endpoint with metrics
- `/health` endpoint for monitoring
- Rich logging

### Phase 4: Authentication ✅
- Token generation and management
- SHA-256 hashing with constant-time comparison
- Bearer token authentication
- Optional (disabled by default)

### Phase 5: Testing ✅
- 45+ automated test cases
- Load testing suite
- Race condition testing
- Manual testing scripts

### Phase 6: Documentation ✅
- User guides
- API reference
- Migration guide
- Deployment examples

---

## Documentation

- **[Multi-Client Guide](packages/opencode/docs/MULTI_CLIENT_GUIDE.md)** - Complete usage guide
- **[API Reference](packages/opencode/docs/API.md)** - REST API documentation
- **[Migration Guide](packages/opencode/docs/MIGRATION_TO_MULTI_CLIENT.md)** - Upgrading from vanilla OpenCode
- **[Testing Guide](packages/opencode/TESTING.md)** - How to test the implementation
- **[Implementation Plan](MULTI_CLIENT_IMPLEMENTATION_PLAN.md)** - Technical details
- **[Deployment Examples](packages/opencode/examples/multi-client-setup/)** - Docker, systemd, nginx, etc.

---

## Command Reference

### Server Commands

```bash
# Start server on default port (4096)
opencode serve

# Start on custom port
opencode serve --port 8080

# Start with authentication required
opencode serve --require-auth

# Write PID file
opencode serve --pidfile /var/run/opencode.pid
```

### Client Commands

```bash
# Connect to external server
opencode --server http://localhost:4096 ~/project

# Connect with authentication
opencode --server http://localhost:4096 --token oc_abc123... ~/project

# Traditional mode (auto-spawns server)
opencode ~/project
```

### Token Management

```bash
# Create token
opencode token create "My Token"

# List all tokens
opencode token list

# Revoke token
opencode token revoke <token-id>
```

### Monitoring

```bash
# Server status
curl http://localhost:4096/status

# Health check
curl http://localhost:4096/health
```

---

## Testing

```bash
# Run automated tests
bun test packages/opencode/test/multi-client.test.ts

# Run load tests (10 concurrent clients)
bun packages/opencode/load-test-multi-client.ts

# Run race condition tests
bun packages/opencode/test-race-conditions.ts

# Manual testing (opens 3 clients)
./packages/opencode/test-multi-client.sh
```

---

## Production Deployment

### Docker Compose

```yaml
services:
  opencode-server:
    image: oven/bun:latest
    working_dir: /app
    command: bun run opencode serve --hostname 0.0.0.0
    ports:
      - "4096:4096"
    volumes:
      - ./opencode-data:/root/.local/share/opencode
    restart: unless-stopped
```

See [examples/multi-client-setup/](packages/opencode/examples/multi-client-setup/) for more deployment options.

---

## Backward Compatibility

**This fork is 100% backward compatible with vanilla OpenCode:**

- Default behavior is unchanged (auto-spawns server)
- `--server` flag is optional (opt-in for multi-client mode)
- Authentication is disabled by default
- All existing commands work identically
- No breaking changes to CLI or API

---

## Contributing

This is a personal fork for multi-client experimentation. If you find this useful:

1. Star this repo ⭐
2. Try it out and report issues
3. Consider submitting this as a PR to upstream [sst/opencode](https://github.com/sst/opencode)

---

## Differences from Upstream

| Feature | Upstream OpenCode | This Fork |
|---------|-------------------|-----------|
| Server mode | Auto-spawned per client | Persistent multi-client server |
| `--server` flag | ❌ | ✅ |
| Connection tracking | ❌ | ✅ |
| `/status` endpoint | ❌ | ✅ |
| Authentication | ❌ | ✅ (optional) |
| Event isolation | N/A | ✅ (per project) |
| Production examples | ❌ | ✅ (Docker, systemd, etc.) |

---

## Stats

- **6 core files modified** (~300 lines of code)
- **20+ new files created** (~3,500 lines of documentation/tests)
- **45+ automated test cases**
- **533 lines** of user documentation
- **473 lines** of API documentation
- **8 production deployment examples**

---

## License

Same as upstream OpenCode - check the main [LICENSE](LICENSE) file.

---

## Credits

- **Upstream:** [sst/opencode](https://github.com/sst/opencode) - Original OpenCode project
- **Fork Maintainer:** [@millerjes37](https://github.com/millerjes37)
- **Implementation:** Completed with OpenCode AI assistant using automated subagents

---

## Links

- **This Fork:** https://github.com/millerjes37/opencode-multiplexer
- **Upstream:** https://github.com/sst/opencode
- **Feature Branch:** [feature/multi-client-server](https://github.com/millerjes37/opencode-multiplexer/tree/feature/multi-client-server)
- **Issues:** https://github.com/millerjes37/opencode-multiplexer/issues

---

**Ready to try it?**

```bash
git clone https://github.com/millerjes37/opencode-multiplexer.git
cd opencode-multiplexer
bun install && bun run build
opencode serve
```

🎉 **Enjoy multi-client OpenCode!**
