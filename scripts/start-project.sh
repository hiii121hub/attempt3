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

# Legacy audio broadcasts one shared sink without token validation.
# Keep it disabled for multi-user use until per-session isolation is implemented.
if [[ "${POXEY_ENABLE_UNSAFE_AUDIO:-0}" == "1" ]]; then
  echo "[Poxey Supervisor] WARNING: shared audio enabled for single-user development"
  (
    while true; do
      node "$ROOT_DIR/scripts/audio-server.mjs"
      sleep 1
    done
  ) &
  AUDIO_SUPERVISOR_PID=$!
else
  echo "[Poxey Supervisor] Shared audio disabled (requires session isolation)"
fi

cleanup() {
  trap - EXIT INT TERM
  kill "$SESSION_SUPERVISOR_PID" 2>/dev/null || true
  if [[ -n "${AUDIO_SUPERVISOR_PID:-}" ]]; then
    kill "$AUDIO_SUPERVISOR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR/frontend"
npm run dev -- --host 0.0.0.0
