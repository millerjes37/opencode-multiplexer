#!/bin/bash
#
# OpenCode SSH Tunnel Helper
# 
# This script creates an SSH tunnel to securely access a remote OpenCode server
# without requiring a reverse proxy or TLS certificates.
#

set -e

# Configuration
REMOTE_HOST="${1:-}"
REMOTE_PORT="${2:-4096}"
LOCAL_PORT="${3:-4096}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Help message
show_help() {
    cat << EOF
OpenCode SSH Tunnel Helper

Usage: $0 <remote-host> [remote-port] [local-port]

Arguments:
    remote-host     SSH hostname or IP address (required)
    remote-port     Port OpenCode server is running on (default: 4096)
    local-port      Local port to bind to (default: 4096)

Examples:
    # Basic usage
    $0 my-server.com

    # Custom remote port
    $0 my-server.com 8080

    # Custom local and remote ports
    $0 my-server.com 8080 9090

What this does:
    1. Creates an SSH tunnel from your local machine to the remote server
    2. Forwards local port to remote OpenCode server port
    3. Keeps the tunnel open in the foreground
    4. Press Ctrl+C to close the tunnel

After running this script, connect with:
    opencode --server http://localhost:$LOCAL_PORT

EOF
}

# Validate arguments
if [ -z "$REMOTE_HOST" ]; then
    echo -e "${RED}Error: Remote host is required${NC}"
    echo ""
    show_help
    exit 1
fi

# Check if SSH is available
if ! command -v ssh &> /dev/null; then
    echo -e "${RED}Error: SSH is not installed${NC}"
    exit 1
fi

# Check if local port is available
if lsof -Pi :$LOCAL_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port $LOCAL_PORT is already in use${NC}"
    echo "Choose a different local port:"
    echo "    $0 $REMOTE_HOST $REMOTE_PORT <different-port>"
    exit 1
fi

# Test SSH connection
echo -e "${GREEN}Testing SSH connection to $REMOTE_HOST...${NC}"
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE_HOST" exit 2>/dev/null; then
    echo -e "${YELLOW}SSH connection requires authentication${NC}"
    echo "Please ensure you can connect with: ssh $REMOTE_HOST"
fi

# Create the tunnel
echo ""
echo -e "${GREEN}Creating SSH tunnel...${NC}"
echo "  Remote: $REMOTE_HOST:$REMOTE_PORT"
echo "  Local:  localhost:$LOCAL_PORT"
echo ""
echo -e "${YELLOW}Tunnel is now active. Press Ctrl+C to close.${NC}"
echo ""
echo "In another terminal, connect with:"
echo -e "  ${GREEN}opencode --server http://localhost:$LOCAL_PORT${NC}"
echo ""

# Create the tunnel (keep it in foreground)
ssh -N -L "$LOCAL_PORT:localhost:$REMOTE_PORT" "$REMOTE_HOST"

# Cleanup message (only shown if tunnel closes gracefully)
echo ""
echo -e "${GREEN}Tunnel closed.${NC}"
