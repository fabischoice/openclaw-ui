#!/bin/bash
set -e

cd ~/Projects/openclaw-ui

# Pull latest changes
echo "🔄 Pulling latest changes from GitHub..."
git pull origin main

# Check if dist needs rebuild (package.json or src changed)
echo "🔨 Rebuilding frontend..."
npm run build

# Reload the LaunchAgent
echo "🔄 Reloading OpenClaw UI server..."
launchctl unload ~/Library/LaunchAgents/com.openclaw.ui.server.plist 2>/dev/null || true
sleep 1
launchctl load ~/Library/LaunchAgents/com.openclaw.ui.server.plist

echo "✅ OpenClaw UI updated successfully"
