#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT_DIR/scripts/start-remote-browser.sh" &
REMOTE_BROWSER_PID=$!

node "$ROOT_DIR/scripts/poxey-session-manager.mjs" &
SESSION_PID=$!

node "$ROOT_DIR/scripts/audio-server.mjs" &
AUDIO_PID=$!

cleanup() {
  kill "$REMOTE_BROWSER_PID" "$SESSION_PID" "$AUDIO_PID" 2>/dev/null || true
}

trap cleanup TERM INT EXIT

cd "$ROOT_DIR/frontend"
npm run dev -- --host 0.0.0.0
