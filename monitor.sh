#!/bin/bash
# OpenClaw UI Health Monitor

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

HEALTH_URL="http://localhost:3456/api/health"
LAUNCHCTL_LABEL="com.openclaw.ui.server"
LOG="/tmp/openclaw-ui-monitor.log"
MAX_FAILS=3

fail_count=0

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

log "Monitor started (PID $$)"

while true; do
  STATUS=$(/usr/bin/curl -sf --max-time 5 "$HEALTH_URL" 2>/dev/null)

  if [ -z "$STATUS" ]; then
    fail_count=$((fail_count + 1))
    log "⚠️  Health check failed ($fail_count/$MAX_FAILS)"

    if [ "$fail_count" -ge "$MAX_FAILS" ]; then
      log "❌ Restarting server..."
      /bin/launchctl unload "/Users/silvia/Library/LaunchAgents/${LAUNCHCTL_LABEL}.plist" 2>/dev/null
      sleep 2
      /bin/launchctl load "/Users/silvia/Library/LaunchAgents/${LAUNCHCTL_LABEL}.plist"
      sleep 5
      fail_count=0
      log "🔄 Restart triggered"
    fi
  else
    if [ "$fail_count" -gt 0 ]; then
      log "✅ Server recovered"
    fi
    fail_count=0
  fi

  sleep 30
done
