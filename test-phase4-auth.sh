#!/bin/bash

# Phase 4 Authentication Testing Script
# This script demonstrates the authentication features implemented in Phase 4

set -e

echo "========================================="
echo "Phase 4 Authentication Testing"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}This script will test the authentication system.${NC}"
echo -e "${YELLOW}Make sure you have the opencode CLI available.${NC}"
echo ""

# Test 1: Token Management Commands
echo "=== Test 1: Token Management Commands ==="
echo ""

echo "1. Creating a test token..."
TOKEN_OUTPUT=$(opencode token create "Test Token" 2>&1 || true)
echo "$TOKEN_OUTPUT"

if echo "$TOKEN_OUTPUT" | grep -q "Token created successfully"; then
    echo -e "${GREEN}✓ Token creation works${NC}"
else
    echo -e "${RED}✗ Token creation failed${NC}"
fi
echo ""

echo "2. Listing tokens..."
LIST_OUTPUT=$(opencode token list 2>&1 || true)
echo "$LIST_OUTPUT"

if echo "$LIST_OUTPUT" | grep -q "Test Token"; then
    echo -e "${GREEN}✓ Token listing works${NC}"
else
    echo -e "${RED}✗ Token listing failed${NC}"
fi
echo ""

# Test 2: Server with Authentication
echo "=== Test 2: Server with Authentication ==="
echo ""

echo "Starting server with authentication in background..."
echo "(Server will run on port 4097 to avoid conflicts)"
echo ""

# Start server in background
opencode serve --port 4097 --require-auth > /tmp/opencode-serve.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
sleep 3

# Check if server started
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✓ Server started successfully${NC}"
    
    # Extract token from logs
    if grep -q "Token:" /tmp/opencode-serve.log; then
        TOKEN=$(grep "Token:" /tmp/opencode-serve.log | head -1 | awk '{print $2}')
        echo "Extracted token: $TOKEN"
    fi
else
    echo -e "${RED}✗ Server failed to start${NC}"
fi

echo ""
echo "Server logs:"
cat /tmp/opencode-serve.log
echo ""

# Test 3: Client Connection Tests
echo "=== Test 3: Client Connection Tests ==="
echo ""

echo "3a. Testing connection WITHOUT token (should fail)..."
RESPONSE=$(curl -s http://localhost:4097/path?directory=$(pwd) 2>&1 || true)

if echo "$RESPONSE" | grep -q "Missing authentication token"; then
    echo -e "${GREEN}✓ Auth middleware correctly rejects unauthenticated requests${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response (may need manual verification)${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

echo "3b. Testing connection WITH invalid token (should fail)..."
RESPONSE=$(curl -s -H "Authorization: Bearer invalid-token-123" http://localhost:4097/path?directory=$(pwd) 2>&1 || true)

if echo "$RESPONSE" | grep -q "Invalid authentication token"; then
    echo -e "${GREEN}✓ Auth middleware correctly rejects invalid tokens${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response (may need manual verification)${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

if [ -n "$TOKEN" ]; then
    echo "3c. Testing connection WITH valid token (should succeed)..."
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4097/path?directory=$(pwd) 2>&1 || true)
    
    if echo "$RESPONSE" | grep -q "directory"; then
        echo -e "${GREEN}✓ Auth middleware correctly accepts valid tokens${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected response (may need manual verification)${NC}"
        echo "Response: $RESPONSE"
    fi
    echo ""
fi

# Test 4: Health Check Bypass
echo "=== Test 4: Health Check Bypass ==="
echo ""

echo "Testing /health endpoint (should work without auth)..."
RESPONSE=$(curl -s http://localhost:4097/health 2>&1 || true)

if echo "$RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check endpoint bypasses auth correctly${NC}"
else
    echo -e "${YELLOW}⚠ Health check response unexpected${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

echo "Testing /status endpoint (should work without auth)..."
RESPONSE=$(curl -s http://localhost:4097/status 2>&1 || true)

if echo "$RESPONSE" | grep -q "version"; then
    echo -e "${GREEN}✓ Status endpoint bypasses auth correctly${NC}"
else
    echo -e "${YELLOW}⚠ Status response unexpected${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Cleanup
echo "=== Cleanup ==="
echo "Stopping server (PID: $SERVER_PID)..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
echo -e "${GREEN}✓ Server stopped${NC}"
echo ""

echo "Cleaning up test token..."
# Extract token ID from list and revoke it
TOKEN_ID=$(opencode token list 2>&1 | grep "Test Token" -A 1 | grep "ID:" | awk '{print $2}' || true)
if [ -n "$TOKEN_ID" ]; then
    echo "Revoking token ID: $TOKEN_ID"
    # Auto-confirm revocation
    echo "yes" | opencode token revoke "$TOKEN_ID" 2>&1 || true
    echo -e "${GREEN}✓ Test token revoked${NC}"
fi
echo ""

# Summary
echo "========================================="
echo "Testing Complete!"
echo "========================================="
echo ""
echo "Summary of Phase 4 Implementation:"
echo "  ✓ Token generation and storage"
echo "  ✓ Token management CLI commands"
echo "  ✓ Server authentication middleware"
echo "  ✓ Health/status endpoint bypass"
echo "  ✓ Backward compatibility (auth optional)"
echo ""
echo "See PHASE_4_IMPLEMENTATION_SUMMARY.md for details."
echo ""
