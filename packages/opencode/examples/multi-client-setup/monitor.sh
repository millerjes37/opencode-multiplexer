#!/bin/bash
#
# OpenCode Server Monitoring Script
# 
# Continuously monitors the OpenCode server and displays metrics
#

set -e

# Configuration
SERVER_URL="${1:-http://localhost:4096}"
CHECK_INTERVAL="${2:-10}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Help message
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << EOF
OpenCode Server Monitoring Script

Usage: $0 [server-url] [interval]

Arguments:
    server-url    URL of OpenCode server (default: http://localhost:4096)
    interval      Check interval in seconds (default: 10)

Examples:
    # Monitor local server
    $0

    # Monitor remote server
    $0 http://remote-host:8080

    # Custom check interval
    $0 http://localhost:4096 5

EOF
    exit 0
fi

# Check dependencies
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq is recommended for better formatting${NC}"
    HAS_JQ=false
else
    HAS_JQ=true
fi

# Format uptime
format_uptime() {
    local seconds=$1
    local days=$((seconds / 86400))
    local hours=$(((seconds % 86400) / 3600))
    local minutes=$(((seconds % 3600) / 60))
    
    if [ $days -gt 0 ]; then
        echo "${days}d ${hours}h ${minutes}m"
    elif [ $hours -gt 0 ]; then
        echo "${hours}h ${minutes}m"
    else
        echo "${minutes}m"
    fi
}

# Main monitoring loop
echo -e "${GREEN}Monitoring OpenCode server at $SERVER_URL${NC}"
echo -e "Press Ctrl+C to stop"
echo ""

while true; do
    # Clear screen
    clear
    
    # Header
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     OpenCode Server Monitor                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Timestamp
    echo -e "${YELLOW}Last Check: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
    
    # Health check
    if curl -sf "$SERVER_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server Status: HEALTHY${NC}"
    else
        echo -e "${RED}✗ Server Status: DOWN${NC}"
        echo ""
        echo "Cannot connect to server. Please check:"
        echo "  1. Server is running: ps aux | grep 'opencode serve'"
        echo "  2. Port is correct: curl $SERVER_URL/health"
        echo "  3. Firewall allows connections"
        echo ""
        sleep $CHECK_INTERVAL
        continue
    fi
    
    # Get status
    STATUS=$(curl -sf "$SERVER_URL/status" 2>/dev/null)
    
    if [ -z "$STATUS" ]; then
        echo -e "${RED}✗ Cannot fetch server status${NC}"
        sleep $CHECK_INTERVAL
        continue
    fi
    
    # Parse and display metrics
    if [ "$HAS_JQ" = true ]; then
        VERSION=$(echo "$STATUS" | jq -r '.version // "unknown"')
        CLIENTS=$(echo "$STATUS" | jq -r '.connectedClients // 0')
        UPTIME=$(echo "$STATUS" | jq -r '.uptime // 0')
        PROJECTS=$(echo "$STATUS" | jq -r '.connectionsByProject | length')
        
        echo -e "${GREEN}✓ Version: $VERSION${NC}"
        echo ""
        echo -e "${BLUE}Connections:${NC}"
        echo -e "  Total Clients: $CLIENTS"
        echo -e "  Active Projects: $PROJECTS"
        echo ""
        
        # Show connections by project
        if [ $PROJECTS -gt 0 ]; then
            echo -e "${BLUE}Clients per Project:${NC}"
            echo "$STATUS" | jq -r '.connectionsByProject | to_entries | .[] | "  \(.key): \(.value) client(s)"'
            echo ""
        fi
        
        # Uptime
        UPTIME_FORMATTED=$(format_uptime ${UPTIME%.*})
        echo -e "${BLUE}Uptime: $UPTIME_FORMATTED${NC}"
        
    else
        # Fallback without jq
        echo "$STATUS"
    fi
    
    echo ""
    echo -e "${YELLOW}Next update in ${CHECK_INTERVAL}s...${NC}"
    
    # Wait for next check
    sleep $CHECK_INTERVAL
done
