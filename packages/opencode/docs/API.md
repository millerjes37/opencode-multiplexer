# OpenCode Multi-Client API Documentation

This document describes the HTTP endpoints used by OpenCode's multi-client server feature.

## Base URL

When running `opencode serve`, the default base URL is:

```
http://127.0.0.1:4096
```

## Authentication

Currently, OpenCode does not implement authentication on the HTTP API. For secure deployments:

- Use a reverse proxy (nginx, Caddy) with authentication
- Use SSH tunneling for remote access
- Deploy on trusted networks only

## Common Query Parameters

Many endpoints accept a `directory` query parameter to specify which project instance to operate on:

```
GET /endpoint?directory=/path/to/project
```

If not provided, defaults to the server's current working directory.

## Endpoints

### Health Check

Check if the server is running and healthy.

**Request:**
```http
GET /health
```

**Response:** `200 OK`
```json
{
  "status": "ok"
}
```

**Use Cases:**
- Load balancer health checks
- Monitoring and alerting
- Connection verification before client connects

---

### Server Status

Get detailed server status including connected clients and metrics.

**Request:**
```http
GET /status
```

**Response:** `200 OK`
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

**Response Fields:**
- `status` (string): Server health status (`"ok"` when healthy)
- `version` (string): OpenCode version number
- `connectedClients` (number): Total number of connected clients
- `connectionsByProject` (object): Map of project IDs to client count
- `uptime` (number): Server uptime in seconds

**Use Cases:**
- Monitoring dashboards
- Capacity planning
- Debugging connection issues

---

### Event Stream (SSE)

Subscribe to server events using Server-Sent Events.

**Request:**
```http
GET /event?directory=/path/to/project
```

**Query Parameters:**
- `directory` (optional): Project directory path. Events are filtered by project.

**Response:** `200 OK`
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Format:**
```
data: {"type": "event.name", "properties": {...}}

data: {"type": "another.event", "properties": {...}}
```

**Connection Lifecycle:**

1. Client connects to `/event?directory=/path/to/project`
2. Server sends initial `server.connected` event:
   ```json
   {
     "type": "server.connected",
     "properties": {
       "clientID": "550e8400-e29b-41d4-a716-446655440000",
       "projectID": "abc123",
       "directory": "/path/to/project"
     }
   }
   ```
3. Client receives events filtered by project ID
4. Connection stays open indefinitely (no timeout)
5. On disconnect, server logs connection duration

**Event Types:**

Events include (but are not limited to):

- `server.connected`: Sent immediately after connection
- `session.created`: New session created
- `session.updated`: Session properties changed
- `message.created`: New message in session
- `message.updated`: Message content changed
- `tool.started`: Tool execution started
- `tool.completed`: Tool execution completed
- `permission.requested`: Permission requested from user
- `tui.*`: TUI-specific events

**Event Filtering:**

- Events with `projectID` property are filtered - only sent to clients with matching project
- Events without `projectID` are broadcast to all clients (rare)
- This ensures isolation between projects

**Client Example (curl):**
```bash
curl -N http://localhost:4096/event?directory=$(pwd)
```

**Client Example (JavaScript):**
```javascript
const eventSource = new EventSource(
  `http://localhost:4096/event?directory=${encodeURIComponent(cwd)}`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.properties);
};

eventSource.onerror = (error) => {
  console.error('Connection error:', error);
  eventSource.close();
};
```

**Use Cases:**
- Real-time UI updates in clients
- Multi-client synchronization
- Monitoring and logging
- Building custom clients

---

### Path Information

Get file system paths for the current project instance.

**Request:**
```http
GET /path?directory=/path/to/project
```

**Response:** `200 OK`
```json
{
  "state": "/Users/username/.opencode/state",
  "config": "/Users/username/.opencode/config",
  "worktree": "/path/to/project/.git",
  "directory": "/path/to/project"
}
```

**Response Fields:**
- `state` (string): OpenCode state directory
- `config` (string): OpenCode config directory
- `worktree` (string): Git worktree path (or project root if not in git)
- `directory` (string): Current project directory

---

## Session Endpoints

OpenCode exposes many session-related endpoints. Here are the most relevant for multi-client scenarios:

### List Sessions

```http
GET /session?directory=/path/to/project
```

### Get Session

```http
GET /session/:id?directory=/path/to/project
```

### Create Session

```http
POST /session?directory=/path/to/project
Content-Type: application/json

{
  "title": "Optional session title",
  "model": "anthropic/claude-3-5-sonnet-20241022"
}
```

### List Messages

```http
GET /session/:id/message?directory=/path/to/project
```

### Send Message

```http
POST /session/:id/message?directory=/path/to/project
Content-Type: application/json

{
  "prompt": "Your message to the AI"
}
```

For complete API documentation, visit:
```http
GET /doc
```

This returns OpenAPI 3.1 specification for all endpoints.

---

## Rate Limiting

Currently, OpenCode does not implement rate limiting on the server. Consider adding rate limiting at the reverse proxy level for production deployments.

---

## Error Responses

### 400 Bad Request

Invalid request parameters or body.

```json
{
  "data": null,
  "errors": [
    {
      "message": "Invalid parameter: ...",
      "path": ["field", "name"]
    }
  ],
  "success": false
}
```

### 404 Not Found

Resource not found (e.g., session ID doesn't exist).

```json
{
  "name": "NotFoundError",
  "message": "Session not found: abc123",
  "data": {}
}
```

### 500 Internal Server Error

Server error during request processing.

```json
{
  "name": "UnknownError",
  "message": "Error message or stack trace",
  "data": {}
}
```

---

## CORS

The server enables CORS for all origins. This allows browser-based clients to connect from any domain.

---

## Connection Timeouts

- **HTTP Requests**: 2 minute timeout (default for most endpoints)
- **SSE Connections**: No timeout - stays open indefinitely
- **Idle Timeout**: Server has no idle timeout

---

## Best Practices

### For Client Developers

1. **Connection Retry**: Implement exponential backoff for failed connections
2. **Event Handling**: Always handle events asynchronously to avoid blocking
3. **Project Filtering**: Remember that events are filtered by project ID
4. **Health Checks**: Use `/health` for simple connectivity checks
5. **Error Handling**: Gracefully handle network errors and reconnections

### For Server Operators

1. **Monitoring**: Poll `/status` endpoint periodically for metrics
2. **Logging**: Server logs all connections/disconnections - use for debugging
3. **Resource Limits**: Monitor server memory and CPU usage
4. **Network**: Ensure low latency between server and clients
5. **Security**: Use reverse proxy with TLS and authentication for remote access

---

## WebSocket Alternative

OpenCode currently uses Server-Sent Events (SSE) for server-to-client communication. SSE was chosen because:

- Simpler than WebSockets
- Works through most proxies and firewalls
- Automatic reconnection in browsers
- Sufficient for one-way (server → client) communication
- HTTP/2 multiplexing support

Client-to-server communication uses regular HTTP POST requests.

---

## Examples

### Monitoring Script

```bash
#!/bin/bash
# Monitor server status every 10 seconds

while true; do
  STATUS=$(curl -s http://localhost:4096/status)
  
  echo "=== $(date) ==="
  echo "$STATUS" | jq '{
    clients: .connectedClients,
    projects: (.connectionsByProject | length),
    uptime_hours: (.uptime / 3600 | floor),
    version: .version
  }'
  
  sleep 10
done
```

### Health Check for systemd

```ini
[Unit]
Description=OpenCode Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/opencode serve --port 8080
ExecStartPost=/bin/sleep 2
ExecStartPost=/usr/bin/curl -f http://localhost:8080/health
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### Load Balancer Health Check (nginx)

```nginx
upstream opencode {
    server 127.0.0.1:4096 max_fails=3 fail_timeout=30s;
    
    # Health check (nginx plus)
    health_check uri=/health interval=10s fails=3 passes=2;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://opencode;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;  # Long timeout for SSE
    }
}
```

### Event Stream Consumer (Python)

```python
import requests
import json
import os

def listen_to_events(directory):
    url = f"http://localhost:4096/event?directory={directory}"
    
    with requests.get(url, stream=True) as response:
        for line in response.iter_lines():
            if line.startswith(b'data: '):
                data = json.loads(line[6:])
                print(f"Event: {data['type']}")
                print(f"  Properties: {data['properties']}")

if __name__ == "__main__":
    directory = os.getcwd()
    print(f"Listening for events in: {directory}")
    listen_to_events(directory)
```

---

## Related Documentation

- [Multi-Client Guide](./MULTI_CLIENT_GUIDE.md) - Usage and architecture
- [Migration Guide](./MIGRATION_TO_MULTI_CLIENT.md) - Upgrading from legacy mode
- [Examples](../examples/multi-client-setup/) - Configuration examples

---

## Support

For API questions or issues:

- [OpenCode Discord](https://opencode.ai/discord)
- [GitHub Issues](https://github.com/sst/opencode/issues)
- [Documentation](https://opencode.ai/docs)
