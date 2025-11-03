#!/usr/bin/env bash
set -e

echo "📦 Installing OpenCode Multiplexer Zellij layout..."

# Detect config directory
if [ -n "$XDG_CONFIG_HOME" ]; then
    CONFIG_DIR="$XDG_CONFIG_HOME/zellij/layouts"
else
    CONFIG_DIR="$HOME/.config/zellij/layouts"
fi

# Create directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Copy layout file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYOUT_FILE="$SCRIPT_DIR/../configs/zellij/opencode-multiplexer.kdl"

if [ -f "$LAYOUT_FILE" ]; then
    cp "$LAYOUT_FILE" "$CONFIG_DIR/opencode-multiplexer.kdl"
    echo "✅ Layout installed to: $CONFIG_DIR/opencode-multiplexer.kdl"
    echo ""
    echo "🚀 Usage:"
    echo "   zellij --layout opencode-multiplexer"
    echo ""
    echo "💡 Or add an alias to your shell profile:"
    echo "   alias ocmux='zellij --layout opencode-multiplexer'"
else
    echo "❌ Error: Layout file not found at $LAYOUT_FILE"
    exit 1
fi
