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

cd "$ROOT_DIR/frontend"
npm run dev -- --host 0.0.0.0
