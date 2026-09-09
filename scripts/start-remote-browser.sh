#!/usr/bin/env bash
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="/tmp/remote-browser"
SESSION_DIR="/tmp/poxey-sessions"
TOKEN_DIR="$SESSION_DIR/tokens"
TOKEN_FILE="$TOKEN_DIR/poxey.tokens"

SESSION_MANAGER_PORT=3997
WEBSOCKET_PORT=6080

mkdir -p "$LOG_DIR" "$SESSION_DIR" "$TOKEN_DIR"
touch "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

AVAILABLE_RAM=$(free -m | awk 'NR==2 { print $7 }')
CPU_COUNT=$(nproc)

echo "Available RAM: ${AVAILABLE_RAM} MB; CPUs: ${CPU_COUNT}"

if [[ "${AVAILABLE_RAM:-0}" -lt 800 || "${CPU_COUNT:-0}" -lt 1 ]]; then
    echo -e "${RED}ERROR: insufficient resources for the remote browser${NC}"
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}ERROR: missing executable: node${NC}"
    exit 1
fi

if ! command -v websockify >/dev/null 2>&1; then
    echo -e "${RED}ERROR: missing executable: websockify${NC}"
    exit 1
fi

if ! command -v pulseaudio >/dev/null 2>&1; then
    echo -e "${RED}ERROR: missing executable: pulseaudio${NC}"
    exit 1
fi

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-$(id -u)}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

export PULSE_RUNTIME_PATH="$XDG_RUNTIME_DIR/pulse"
mkdir -p "$PULSE_RUNTIME_PATH"

echo -e "${GREEN}Starting PulseAudio${NC}"
pulseaudio --start --exit-idle-time=-1 >/dev/null 2>&1 || true

export PULSE_SERVER="unix:$PULSE_RUNTIME_PATH/native"

for _ in {1..20}; do
    if pactl info >/dev/null 2>&1; then
        break
    fi
    sleep 0.25
done

if ! pactl info >/dev/null 2>&1; then
    echo -e "${RED}ERROR: PulseAudio did not become available${NC}"
    exit 1
fi

if ! pactl list short sinks 2>/dev/null | awk '$2=="poxey_output"{found=1} END{exit !found}'; then
    echo -e "${GREEN}Creating Poxey audio sink${NC}"
    pactl load-module module-null-sink \
        sink_name=poxey_output \
        sink_properties=device.description=PoxeyAudio >/dev/null
fi

pactl set-default-sink poxey_output

start_session_manager() {
    if pgrep -f -- "poxey-session-manager.mjs" >/dev/null 2>&1; then
        echo -e "${GREEN}Session manager already running${NC}"
        return
    fi

    echo -e "${GREEN}Starting Poxey session manager on :${SESSION_MANAGER_PORT}${NC}"

    nohup node "$ROOT_DIR/scripts/poxey-session-manager.mjs" \
        >"$LOG_DIR/session-manager.log" 2>&1 &

    echo $! >"$LOG_DIR/session-manager.pid"

    for _ in {1..40}; do
        if curl -fsS "http://127.0.0.1:${SESSION_MANAGER_PORT}/health" >/dev/null 2>&1; then
            break
        fi
        sleep 0.25
    done

    if ! curl -fsS "http://127.0.0.1:${SESSION_MANAGER_PORT}/health" >/dev/null 2>&1; then
        echo -e "${RED}ERROR: session manager failed to start${NC}"
        tail -n 80 "$LOG_DIR/session-manager.log" 2>/dev/null || true
        exit 1
    fi
}

start_websockify() {
    if pgrep -f -- "websockify.*${WEBSOCKET_PORT}" >/dev/null 2>&1; then
        echo -e "${GREEN}Websockify already running${NC}"
        return
    fi

    echo -e "${YELLOW}Starting token-routed Websockify on :${WEBSOCKET_PORT}${NC}"

    nohup websockify \
        --token-plugin TokenFile \
        --token-source "$TOKEN_FILE" \
        "$WEBSOCKET_PORT" \
        >"$LOG_DIR/websockify.log" 2>&1 &

    echo $! >"$LOG_DIR/websockify.pid"

    sleep 1

    if ! kill -0 "$!" 2>/dev/null; then
        echo -e "${RED}ERROR: Websockify failed to start${NC}"
        tail -n 80 "$LOG_DIR/websockify.log" 2>/dev/null || true
        exit 1
    fi
}

start_session_manager
start_websockify

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}        Poxey Remote Browser${NC}"
echo -e "${GREEN}======================================${NC}"
echo "Session manager: http://127.0.0.1:${SESSION_MANAGER_PORT}"
echo "Websockify:      :${WEBSOCKET_PORT}"
echo "Token file:      $TOKEN_FILE"
echo "Audio sink:      poxey_output"
echo ""
echo "Chrome sessions are created per user."
echo "Automatic session cleanup is handled by the session manager."
echo "Logs: $LOG_DIR"
echo ""

while true; do
    sleep 10

    if ! curl -fsS "http://127.0.0.1:${SESSION_MANAGER_PORT}/health" >/dev/null 2>&1; then
        echo -e "${RED}WARNING: session manager stopped${NC}"
        start_session_manager
    fi

    if ! pgrep -f -- "websockify.*${WEBSOCKET_PORT}" >/dev/null 2>&1; then
        echo -e "${YELLOW}WARNING: Websockify stopped${NC}"
        start_websockify
    fi
done
