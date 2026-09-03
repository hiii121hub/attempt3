#!/usr/bin/env bash
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DISPLAY_NUMBER=:1
export DISPLAY=$DISPLAY_NUMBER
VNC_PORT=5901
WEBSOCKET_PORT=6080
PROFILE=/tmp/chromium-remote-profile
LOG_DIR=/tmp/remote-browser
mkdir -p "$LOG_DIR"

AVAILABLE_RAM=$(free -m | awk 'NR==2 { print $7 }')
CPU_COUNT=$(nproc)
echo "Available RAM: ${AVAILABLE_RAM} MB; CPUs: ${CPU_COUNT}"
if [[ "${AVAILABLE_RAM:-0}" -lt 800 || "${CPU_COUNT:-0}" -lt 1 ]]; then
    echo -e "${RED}ERROR: insufficient resources for the remote browser${NC}"
    exit 1
fi

for executable in Xvfb x11vnc google-chrome; do
    if ! command -v "$executable" >/dev/null 2>&1; then
        echo -e "${RED}ERROR: missing executable: $executable${NC}"
        exit 1
    fi
done

NOVNC_PROXY=/usr/share/novnc/utils/novnc_proxy
if [[ ! -x "$NOVNC_PROXY" ]]; then
    echo -e "${RED}ERROR: missing executable: $NOVNC_PROXY${NC}"
    exit 1
fi

LOCK_DIR="$LOG_DIR/lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "Remote browser supervisor is already running"
    exit 0
fi

start_xvfb() {
    if pgrep -f -- "Xvfb $DISPLAY_NUMBER" >/dev/null; then return; fi
    echo -e "${GREEN}Starting Xvfb on $DISPLAY_NUMBER${NC}"
    Xvfb "$DISPLAY_NUMBER" -screen 0 1024x768x24 >>"$LOG_DIR/xvfb.log" 2>&1 &
    echo $! >"$LOG_DIR/xvfb.pid"
    sleep 2
}

start_chromium() {
    if pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null; then return; fi
    echo -e "${GREEN}Starting Chromium${NC}"
    mkdir -p "$PROFILE"
    google-chrome \
        --user-data-dir="$PROFILE" \
        --no-first-run \
        --no-default-browser-check \
        --start-maximized \
        --display="$DISPLAY_NUMBER" \
        >>"$LOG_DIR/chromium.log" 2>&1 &
    echo $! >"$LOG_DIR/chromium.pid"
}

start_x11vnc() {
    if ss -ltn 2>/dev/null | grep -q ":$VNC_PORT "; then return; fi
    echo -e "${YELLOW}Starting x11vnc${NC}"
    x11vnc -display "$DISPLAY_NUMBER" -rfbport "$VNC_PORT" -localhost -nopw \
        >>"$LOG_DIR/x11vnc.log" 2>&1 &
    echo $! >"$LOG_DIR/x11vnc.pid"
}

start_novnc() {
    if ss -ltn 2>/dev/null | grep -q ":$WEBSOCKET_PORT "; then return; fi
    echo -e "${YELLOW}Starting noVNC/websockify${NC}"
    "$NOVNC_PROXY" --vnc "localhost:$VNC_PORT" --listen "$WEBSOCKET_PORT" \
        >>"$LOG_DIR/novnc.log" 2>&1 &
    echo $! >"$LOG_DIR/novnc.pid"
}

cleanup() {
    trap - TERM INT EXIT
    rmdir "$LOCK_DIR" 2>/dev/null || true
    for pid_file in "$LOG_DIR/novnc.pid" "$LOG_DIR/x11vnc.pid" "$LOG_DIR/chromium.pid" "$LOG_DIR/xvfb.pid"; do
        if [[ -f "$pid_file" ]]; then
            kill "$(cat "$pid_file")" 2>/dev/null || true
        fi
    done
}
trap cleanup TERM INT EXIT

start_xvfb
start_chromium
start_x11vnc
start_novnc

echo -e "${GREEN}Remote browser available: VNC $VNC_PORT, noVNC/websockify $WEBSOCKET_PORT${NC}"
echo "Logs: $LOG_DIR"

while true; do
    sleep 5
    start_xvfb
    if [[ -f "$LOG_DIR/chromium.pid" ]] && ! kill -0 "$(cat "$LOG_DIR/chromium.pid")" 2>/dev/null; then start_chromium; fi
    start_x11vnc
    start_novnc
done
