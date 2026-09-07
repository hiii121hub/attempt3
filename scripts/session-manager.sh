#!/usr/bin/env bash
set -u

SESSION_DIR="/tmp/poxey-session"
PROFILE="/tmp/chromium-remote-profile"
LOG_DIR="/tmp/remote-browser"

HEARTBEAT_FILE="$SESSION_DIR/heartbeat"
TIMEOUT=300

mkdir -p "$SESSION_DIR"

log() {
  echo "[Poxey Session] $*"
}

cleanup_browser() {
  log "Session expired. Cleaning up remote browser..."

  # Stop Chromium
  if [[ -f "$LOG_DIR/chromium.pid" ]]; then
    PID="$(cat "$LOG_DIR/chromium.pid" 2>/dev/null || true)"
    if [[ -n "$PID" ]]; then
      kill "$PID" 2>/dev/null || true
    fi
  fi

  pkill -f -- "--user-data-dir=$PROFILE" 2>/dev/null || true

  sleep 2

  # Remove the complete browser profile.
  # This removes browser cookies, cache, history, local storage, etc.
  rm -rf "$PROFILE"

  rm -f "$HEARTBEAT_FILE"

  log "Chromium profile removed."
  log "Waiting for the remote-browser supervisor to start a fresh browser..."
}

while true; do
  sleep 10

  if [[ ! -f "$HEARTBEAT_FILE" ]]; then
    continue
  fi

  NOW="$(date +%s)"
  LAST="$(cat "$HEARTBEAT_FILE" 2>/dev/null || echo 0)"

  if ! [[ "$LAST" =~ ^[0-9]+$ ]]; then
    continue
  fi

  AGE=$((NOW - LAST))

  if (( AGE >= TIMEOUT )); then
    cleanup_browser
  fi
done
