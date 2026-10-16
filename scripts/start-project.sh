#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Refuse startup before Pulse/Vite or supervisor creation if accounting is blocked.
node --input-type=module -e 'import { readRuntimeConfig } from "./scripts/security-policy.mjs"; import { openAccountingState } from "./scripts/accounting-state.mjs"; openAccountingState(readRuntimeConfig().stateDir).assertReady()'

ensure_pulseaudio() {
  if ! command -v pulseaudio >/dev/null || ! command -v pactl >/dev/null; then
    echo "[Poxey Audio] PulseAudio tools are required but unavailable." >&2
    exit 1
  fi

  if ! pactl info >/dev/null 2>&1; then
    pulseaudio --start --exit-idle-time=-1
  fi

  if ! pactl info >/dev/null 2>&1; then
    echo "[Poxey Audio] PulseAudio did not become available." >&2
    exit 1
  fi
}

ensure_pulseaudio

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
