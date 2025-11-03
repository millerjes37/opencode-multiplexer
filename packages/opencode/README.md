# OpenCode

OpenCode is an AI-powered coding assistant that runs in your terminal.

## Installation

```bash
npm install -g opencode-ai
```

Or use the install script:

```bash
curl -fsSL https://opencode.ai/install | bash
```

## Quick Start

### Single-User Mode (Default)

Simply run:

```bash
opencode
```

This starts OpenCode with an embedded server for your session.

### Multi-Client Server Mode

For remote development or multiple concurrent sessions:

**Start a server:**
```bash
opencode serve
```

**Connect clients:**
```bash
opencode --server http://localhost:4096
```

Multiple clients can connect to the same server, enabling:
- Remote development from lightweight devices
- Persistent sessions that survive disconnections
- Shared configuration and API keys
- Better resource utilization for teams

📚 **[Read the Multi-Client Guide](./docs/MULTI_CLIENT_GUIDE.md)** for detailed setup instructions, use cases, and best practices.

## Documentation

- **[Multi-Client Server Guide](./docs/MULTI_CLIENT_GUIDE.md)** - Architecture, setup, and usage
- **[API Documentation](./docs/API.md)** - REST and SSE endpoints
- **[Migration Guide](./docs/MIGRATION_TO_MULTI_CLIENT.md)** - Transitioning to multi-client mode
- **[Configuration Examples](./examples/multi-client-setup/)** - Sample configurations for various deployments

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
