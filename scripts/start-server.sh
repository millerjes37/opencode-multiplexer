#!/usr/bin/env bash
set -e

# OpenCode Server Startup Script
# Automatically configures PATH and starts the OpenCode server

echo "🚀 OpenCode Server Startup"
echo "=========================="
echo ""

# Detect OpenCode installation
OPENCODE_PATHS=(
    "$HOME/.opencode/bin"
    "$HOME/.local/bin"
    "/usr/local/bin"
    "$HOME/bin"
)

OPENCODE_BIN=""
for path in "${OPENCODE_PATHS[@]}"; do
    if [ -f "$path/opencode" ]; then
        OPENCODE_BIN="$path/opencode"
        echo "✅ Found OpenCode at: $OPENCODE_BIN"
        break
    fi
done

if [ -z "$OPENCODE_BIN" ]; then
    echo "❌ Error: OpenCode not found in standard locations"
    echo ""
    echo "Searched in:"
    for path in "${OPENCODE_PATHS[@]}"; do
        echo "  - $path"
    done
    echo ""
    echo "Please install OpenCode first:"
    echo "  curl -fsSL https://opencode.ai/install | bash"
    echo ""
    echo "Or specify OPENCODE_BIN environment variable:"
    echo "  OPENCODE_BIN=/path/to/opencode $0"
    exit 1
fi

# Add to PATH if not already present
OPENCODE_DIR=$(dirname "$OPENCODE_BIN")
if [[ ":$PATH:" != *":$OPENCODE_DIR:"* ]]; then
    export PATH="$OPENCODE_DIR:$PATH"
    echo "📦 Added to PATH: $OPENCODE_DIR"
fi

# Parse command line arguments
PORT="${PORT:-4096}"
HOSTNAME="${HOSTNAME:-127.0.0.1}"
REQUIRE_AUTH="${REQUIRE_AUTH:-false}"
PIDFILE=""

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
  --port PORT         Server port (default: 4096)
  --hostname HOST     Server hostname (default: 127.0.0.1)
  --require-auth      Enable authentication (default: disabled)
  --pidfile FILE      Write PID to file
  -h, --help          Show this help message

Environment Variables:
  PORT                Server port (default: 4096)
  HOSTNAME            Server hostname (default: 127.0.0.1)
  REQUIRE_AUTH        Enable authentication (default: false)
  OPENCODE_BIN        Path to opencode binary

Examples:
  # Start with defaults
  $0

  # Custom port and hostname
  $0 --port 8080 --hostname 0.0.0.0

  # With authentication
  $0 --require-auth

  # Write PID file
  $0 --pidfile /var/run/opencode.pid

  # Using environment variables
  PORT=8080 HOSTNAME=0.0.0.0 $0
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --hostname)
            HOSTNAME="$2"
            shift 2
            ;;
        --require-auth)
            REQUIRE_AUTH="true"
            shift
            ;;
        --pidfile)
            PIDFILE="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
done

# Display configuration
echo ""
echo "Configuration:"
echo "  • Port:     $PORT"
echo "  • Hostname: $HOSTNAME"
echo "  • Auth:     $([ "$REQUIRE_AUTH" = "true" ] && echo "enabled" || echo "disabled")"
[ -n "$PIDFILE" ] && echo "  • PID file: $PIDFILE"
echo ""

# Build command
CMD_ARGS=(serve --port "$PORT" --hostname "$HOSTNAME")
if [ "$REQUIRE_AUTH" = "true" ]; then
    CMD_ARGS+=(--require-auth)
fi
if [ -n "$PIDFILE" ]; then
    CMD_ARGS+=(--pidfile "$PIDFILE")
fi

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Warning: Port $PORT is already in use"
    echo ""
    read -p "Kill existing process? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t)
        echo "🔪 Killing process $PID..."
        kill -9 "$PID" 2>/dev/null || true
        sleep 1
    else
        echo "❌ Cannot start server while port is in use"
        exit 1
    fi
fi

# Set up signal handlers for graceful shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down OpenCode server..."
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    [ -n "$PIDFILE" ] && rm -f "$PIDFILE"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start server
echo "🚀 Starting OpenCode server..."
echo "Command: opencode ${CMD_ARGS[*]}"
echo ""
echo "📊 Server will be available at: http://$HOSTNAME:$PORT"
echo "📊 Status endpoint:             http://$HOSTNAME:$PORT/status"
echo "💚 Health check:                http://$HOSTNAME:$PORT/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================="
echo ""

# Start server in foreground
"$OPENCODE_BIN" "${CMD_ARGS[@]}" &
SERVER_PID=$!

# Write PID file if requested
if [ -n "$PIDFILE" ]; then
    echo "$SERVER_PID" > "$PIDFILE"
fi

# Wait for server to be ready
sleep 2

# Health check
if curl -f -s "http://$HOSTNAME:$PORT/health" > /dev/null 2>&1; then
    echo "✅ Server is healthy and ready!"
    echo ""
    echo "💡 Connect clients with:"
    echo "   opencode --server http://$HOSTNAME:$PORT"
    echo ""
    echo "💡 Or use Zellij multiplexer:"
    echo "   zellij --layout opencode-multiplexer"
else
    echo "⚠️  Server started but health check failed"
    echo "   Check logs above for errors"
fi

echo ""

# Wait for server process
wait "$SERVER_PID"
