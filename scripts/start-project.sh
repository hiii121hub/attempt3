#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="/tmp/poxey"
mkdir -p "$LOG_DIR"

echo "======================================"
echo "          Starting Poxey X"
echo "======================================"

echo "[1/3] Starting remote browser..."
"$ROOT_DIR/scripts/start-remote-browser.sh" >"$LOG_DIR/remote-browser.log" 2>&1 &

echo "[2/3] Starting audio server..."
if pgrep -f "scripts/audio-server.mjs" >/dev/null 2>&1; then
    echo "Audio server already running."
else
    export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-$(id -u)}"
    export PULSE_RUNTIME_PATH="$XDG_RUNTIME_DIR/pulse"
    export PULSE_SERVER="unix:$PULSE_RUNTIME_PATH/native"
    export PULSE_SINK="poxey_output"

    node "$ROOT_DIR/scripts/audio-server.mjs" >"$LOG_DIR/audio-server.log" 2>&1 &
fi

echo "[3/3] Starting Poxey frontend..."
echo ""
echo "Poxey frontend: http://localhost:3999"
echo "Audio server:   ws://localhost:3998"
echo ""

cd "$ROOT_DIR/frontend"
exec npm run dev -- --host 0.0.0.0 --port 3999
