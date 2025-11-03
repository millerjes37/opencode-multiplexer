#!/bin/bash

################################################################################
# OpenCode Multi-Client Manual Testing Script
#
# This script helps you manually test the multi-client functionality by:
# 1. Starting an OpenCode server on port 4096
# 2. Opening multiple TUI clients in separate terminal tabs/windows
# 3. Providing instructions for manual testing scenarios
#
# Usage: ./test-multi-client.sh [number_of_clients]
# Default: 3 clients
################################################################################

set -e

# Configuration
PORT=${PORT:-4096}
NUM_CLIENTS=${1:-3}
SERVER_PID=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  if [ -n "$SERVER_PID" ]; then
    echo "Stopping server (PID: $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
  fi
  echo -e "${GREEN}Cleanup complete${NC}"
}

# Register cleanup on exit
trap cleanup EXIT INT TERM

# Function to check if server is ready
wait_for_server() {
  echo -e "${BLUE}Waiting for server to be ready on port $PORT...${NC}"
  local max_attempts=30
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
      echo -e "${GREEN}Server is ready!${NC}"
      return 0
    fi
    echo -n "."
    sleep 1
    ((attempt++))
  done
  
  echo -e "\n${RED}Server failed to start within $max_attempts seconds${NC}"
  return 1
}

# Function to open client in new terminal
open_client() {
  local client_num=$1
  local project_dir=$2
  local client_name="Client-$client_num"
  
  # Detect OS and open terminal accordingly
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use AppleScript to open new Terminal tab
    osascript <<EOF
      tell application "Terminal"
        activate
        tell application "System Events" to keystroke "t" using command down
        delay 0.5
        do script "cd \"$SCRIPT_DIR\" && echo -e \"${GREEN}=== $client_name ===${NC}\" && echo \"Project: $project_dir\" && echo \"Connecting to server at http://localhost:$PORT\" && echo \"\" && bun run dev --server http://localhost:$PORT --directory \"$project_dir\"" in front window
      end tell
EOF
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try different terminal emulators
    if command -v gnome-terminal &> /dev/null; then
      gnome-terminal --tab -- bash -c "cd '$SCRIPT_DIR' && echo -e '${GREEN}=== $client_name ===${NC}' && echo 'Project: $project_dir' && echo 'Connecting to server at http://localhost:$PORT' && echo '' && bun run dev --server http://localhost:$PORT --directory '$project_dir'; exec bash"
    elif command -v konsole &> /dev/null; then
      konsole --new-tab -e bash -c "cd '$SCRIPT_DIR' && echo -e '${GREEN}=== $client_name ===${NC}' && echo 'Project: $project_dir' && echo 'Connecting to server at http://localhost:$PORT' && echo '' && bun run dev --server http://localhost:$PORT --directory '$project_dir'; exec bash"
    elif command -v xterm &> /dev/null; then
      xterm -e "cd '$SCRIPT_DIR' && echo -e '${GREEN}=== $client_name ===${NC}' && echo 'Project: $project_dir' && echo 'Connecting to server at http://localhost:$PORT' && echo '' && bun run dev --server http://localhost:$PORT --directory '$project_dir'; exec bash" &
    else
      echo -e "${YELLOW}No supported terminal emulator found. Please open a new terminal and run:${NC}"
      echo "cd '$SCRIPT_DIR' && bun run dev --server http://localhost:$PORT --directory '$project_dir'"
    fi
  else
    echo -e "${YELLOW}Unsupported OS. Please open a new terminal and run:${NC}"
    echo "cd '$SCRIPT_DIR' && bun run dev --server http://localhost:$PORT --directory '$project_dir'"
  fi
}

# Main script
main() {
  echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   OpenCode Multi-Client Testing Script                ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  # Check if bun is installed
  if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: bun is not installed. Please install bun first.${NC}"
    exit 1
  fi
  
  # Create test project directories
  echo -e "${BLUE}Creating test project directories...${NC}"
  for i in $(seq 1 $NUM_CLIENTS); do
    local test_dir="/tmp/opencode-test-project-$i"
    mkdir -p "$test_dir"
    echo "// Test project $i" > "$test_dir/README.md"
    echo -e "  Created: $test_dir"
  done
  echo ""
  
  # Start the server
  echo -e "${BLUE}Starting OpenCode server on port $PORT...${NC}"
  cd "$SCRIPT_DIR"
  PORT=$PORT bun run dev --server-only --port $PORT > /tmp/opencode-server.log 2>&1 &
  SERVER_PID=$!
  echo -e "  Server PID: $SERVER_PID"
  echo -e "  Logs: /tmp/opencode-server.log"
  echo ""
  
  # Wait for server to be ready
  if ! wait_for_server; then
    echo -e "${RED}Failed to start server. Check logs at /tmp/opencode-server.log${NC}"
    tail -n 20 /tmp/opencode-server.log
    exit 1
  fi
  echo ""
  
  # Check server status
  echo -e "${BLUE}Checking server status...${NC}"
  STATUS=$(curl -s "http://localhost:$PORT/status" | jq '.')
  echo "$STATUS"
  echo ""
  
  # Open clients
  echo -e "${BLUE}Opening $NUM_CLIENTS client instances...${NC}"
  for i in $(seq 1 $NUM_CLIENTS); do
    local project_dir="/tmp/opencode-test-project-$i"
    echo -e "  Opening Client $i (project: $project_dir)..."
    open_client $i "$project_dir"
    sleep 1
  done
  echo ""
  
  # Display testing instructions
  cat <<EOF
${GREEN}╔════════════════════════════════════════════════════════╗
║   MANUAL TESTING INSTRUCTIONS                          ║
╚════════════════════════════════════════════════════════╝${NC}

${YELLOW}Test Scenarios:${NC}

${BLUE}1. Connection Verification${NC}
   - Verify that all $NUM_CLIENTS clients are connected
   - Check server status: curl http://localhost:$PORT/status | jq
   - Expected: "connectedClients": $NUM_CLIENTS

${BLUE}2. Project Isolation${NC}
   - Create a session in Client 1
   - Verify it does NOT appear in Client 2 or Client 3
   - Each client should only see sessions from its own project

${BLUE}3. Concurrent Sessions${NC}
   - Create sessions in all clients simultaneously
   - Verify each session is isolated to its project
   - Check for any race conditions or conflicts

${BLUE}4. Event Filtering${NC}
   - Generate messages in Client 1's session
   - Monitor Client 2 and Client 3 - they should not receive these events
   - Only Client 1 should see real-time updates

${BLUE}5. Storage Concurrency${NC}
   - Create multiple sessions across different clients
   - Save content in each session
   - Verify all data is persisted correctly without conflicts

${BLUE}6. Connection Cleanup${NC}
   - Close Client 1 (Ctrl+C)
   - Check server status: curl http://localhost:$PORT/status | jq
   - Expected: "connectedClients" should decrease by 1
   - Remaining clients should continue to function normally

${BLUE}7. Reconnection${NC}
   - Restart Client 1
   - Verify it reconnects successfully
   - Verify it sees its previous sessions

${BLUE}8. High Frequency Operations${NC}
   - Rapidly create/delete sessions in one client
   - Verify other clients remain responsive
   - Check for memory leaks: watch "curl -s http://localhost:$PORT/status | jq"

${BLUE}9. Server Lock Test${NC}
   - Try to start a second server on the same port
   - Expected: Should fail with port already in use

${YELLOW}Useful Commands:${NC}

  # Monitor server status
  watch -n 2 "curl -s http://localhost:$PORT/status | jq"
  
  # View server logs
  tail -f /tmp/opencode-server.log
  
  # Check connections by project
  curl -s http://localhost:$PORT/status | jq '.connectionsByProject'
  
  # Monitor server health
  curl -s http://localhost:$PORT/health

${GREEN}Press Ctrl+C to stop the server and cleanup all test resources.${NC}

EOF

  # Keep script running
  echo -e "${BLUE}Server is running. Press Ctrl+C to stop and cleanup.${NC}"
  wait $SERVER_PID
}

# Run main function
main
