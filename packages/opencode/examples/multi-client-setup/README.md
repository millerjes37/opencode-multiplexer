# Multi-Client Setup Examples

This directory contains example configurations for deploying OpenCode in multi-client server mode.

## Overview

These examples demonstrate various ways to run OpenCode server in production-like environments:

- **Docker Compose** - Containerized deployment
- **systemd Service** - Linux system service
- **nginx Reverse Proxy** - Secure remote access with TLS
- **SSH Tunnel** - Secure remote access without reverse proxy

## Quick Start

### Local Development

```bash
# Start server
opencode serve

# Connect client
opencode --server http://localhost:4096
```

### Production Deployment

Choose the setup that fits your needs:

| Setup | Use Case | Complexity |
|-------|----------|------------|
| **Local Server** | Single machine, multiple projects | Simple |
| **systemd** | Always-on server on Linux | Medium |
| **Docker** | Containerized, portable deployment | Medium |
| **nginx + TLS** | Secure remote access | Advanced |
| **SSH Tunnel** | Quick secure remote access | Simple |

## Example Files

### 1. Docker Compose (`docker-compose.yml`)

Run OpenCode server in a container.

**Use case:** Isolated, reproducible deployment

**Usage:**
```bash
docker-compose up -d
opencode --server http://localhost:8080
```

### 2. systemd Service (`opencode-server.service`)

Run OpenCode as a system service on Linux.

**Use case:** Always-on server that starts at boot

**Usage:**
```bash
sudo cp opencode-server.service /etc/systemd/system/
sudo systemctl enable opencode-server
sudo systemctl start opencode-server
```

### 3. nginx Reverse Proxy (`nginx-proxy.conf`)

Secure remote access with TLS/SSL and optional authentication.

**Use case:** Production deployment with HTTPS

**Usage:**
```bash
sudo cp nginx-proxy.conf /etc/nginx/sites-available/opencode
sudo ln -s /etc/nginx/sites-available/opencode /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### 4. SSH Tunnel (`ssh-tunnel.sh`)

Simple secure remote access without complex setup.

**Use case:** Quick remote development

**Usage:**
```bash
./ssh-tunnel.sh remote-host
opencode --server http://localhost:4096
```

### 5. Environment Configuration (`.env.example`)

Environment variables for server configuration.

**Usage:**
```bash
cp .env.example .env
# Edit .env with your settings
source .env
opencode serve
```

## Security Considerations

### Default Configuration (localhost)

```bash
opencode serve
# Listens on 127.0.0.1:4096 - only accessible from local machine
```

**Security:** ✅ Safe for local development

### Remote Access (all interfaces)

```bash
opencode serve --hostname 0.0.0.0
# Listens on all network interfaces - accessible from network
```

**Security:** ⚠️ Requires additional security measures:
- Firewall rules to restrict access
- Reverse proxy with authentication
- TLS/SSL encryption
- VPN or SSH tunnel

### Authentication Options

OpenCode server does not include built-in authentication. For secure deployments, use:

1. **SSH Tunnel** (Simplest)
   ```bash
   ssh -L 4096:localhost:4096 remote-host
   opencode --server http://localhost:4096
   ```

2. **nginx with Basic Auth** (Recommended)
   ```nginx
   auth_basic "OpenCode Server";
   auth_basic_user_file /etc/nginx/.htpasswd;
   ```

3. **VPN** (Most Secure)
   - Deploy server on VPN network
   - Only accessible via VPN

## Monitoring

### Health Check

```bash
curl http://localhost:4096/health
```

### Server Status

```bash
curl http://localhost:4096/status | jq
```

### Monitoring Script

See `monitor.sh` for a simple monitoring script that checks server health and logs metrics.

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :4096

# Use different port
opencode serve --port 8080
```

### Permission Denied

```bash
# Don't use privileged ports (< 1024) or run with sudo
opencode serve --port 4096  # ✅ Works without sudo
opencode serve --port 80    # ❌ Requires sudo
```

### Container Can't Start

```bash
# Check logs
docker-compose logs opencode-server

# Common issues:
# - Port already in use
# - Volume mount permissions
# - Missing environment variables
```

### systemd Service Won't Start

```bash
# Check service status
sudo systemctl status opencode-server

# View logs
sudo journalctl -u opencode-server -f

# Common issues:
# - OpenCode not installed at expected path
# - Permissions on config directory
# - Port already in use
```

## Performance Tips

### Resource Allocation

Recommended minimum resources:
- **CPU:** 2 cores
- **RAM:** 2GB
- **Disk:** 1GB for installation + storage for sessions

### Connection Limits

The server can handle many clients, but consider:
- Each client = 1 SSE connection
- Concurrent AI requests consume CPU/memory
- Network bandwidth for event streams

Monitor with:
```bash
curl http://localhost:4096/status | jq '.connectedClients'
```

### Load Balancing

For high availability, run multiple OpenCode servers:

```nginx
upstream opencode_pool {
    server server1:4096;
    server server2:4096;
    server server3:4096;
}
```

Note: Clients must connect to the same server for session continuity.

## Contributing

Have a useful configuration? Submit a PR with:
- Configuration file
- Documentation in this README
- Use case description

## Support

- [Multi-Client Guide](../../docs/MULTI_CLIENT_GUIDE.md)
- [API Documentation](../../docs/API.md)
- [GitHub Issues](https://github.com/sst/opencode/issues)
- [Discord Community](https://opencode.ai/discord)
