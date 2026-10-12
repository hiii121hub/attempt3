#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

start_session_manager() {
  while true; do
    echo "[Poxey Supervisor] Starting session manager..."
    node "$ROOT_DIR/scripts/poxey-session-manager.mjs"
    echo "[Poxey Supervisor] Session manager exited. Restarting in 1 second..."
    sleep 1
  done
}

start_session_manager &
SESSION_SUPERVISOR_PID=$!

# Audio is served securely by the session manager on port 3997.
cleanup() {
  trap - EXIT INT TERM
  kill "$SESSION_SUPERVISOR_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR/frontend"
npm run dev -- --host 0.0.0.0
