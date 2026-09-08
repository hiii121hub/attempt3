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
SESSION_MANAGER_PID="$LOG_DIR/session-manager.pid"
mkdir -p "$LOG_DIR"

AVAILABLE_RAM=$(free -m | awk 'NR==2 { print $7 }')
CPU_COUNT=$(nproc)
echo "Available RAM: ${AVAILABLE_RAM} MB; CPUs: ${CPU_COUNT}"
if [[ "${AVAILABLE_RAM:-0}" -lt 800 || "${CPU_COUNT:-0}" -lt 1 ]]; then
    echo -e "${RED}ERROR: insufficient resources for the remote browser${NC}"
    exit 1
fi

CHROMIUM_BIN="$(command -v google-chrome 2>/dev/null || command -v chromium 2>/dev/null || true)"
if [[ -z "$CHROMIUM_BIN" ]]; then
    echo -e "${RED}ERROR: missing executable: google-chrome or chromium${NC}"
    exit 1
fi

for executable in Xvfb x11vnc; do
    if ! command -v "$executable" >/dev/null 2>&1; then
        echo -e "${RED}ERROR: missing executable: $executable${NC}"
        exit 1
    fi
done

NOVNC_PROXY="$(command -v novnc_proxy 2>/dev/null || true)"
if [[ -z "$NOVNC_PROXY" && -x /usr/share/novnc/utils/novnc_proxy ]]; then
    NOVNC_PROXY=/usr/share/novnc/utils/novnc_proxy
fi
if [[ -z "$NOVNC_PROXY" ]]; then
    echo -e "${RED}ERROR: missing executable: novnc_proxy${NC}"
    exit 1
fi

LOCK_DIR="$LOG_DIR/lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "Remote browser supervisor is already running"
    exit 0
fi

pid_is_alive() {
    local pid_file=$1
    [[ -s "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

remember_existing_pid() {
    local pid_file=$1
    local pattern=$2
    local pid

    pid=$(pgrep -f -- "$pattern" | head -n 1 || true)
    if [[ -n "$pid" ]]; then
        echo "$pid" >"$pid_file"
        return 0
    fi
    return 1
}

start_xvfb() {
    if pid_is_alive "$LOG_DIR/xvfb.pid"; then return; fi
    remember_existing_pid "$LOG_DIR/xvfb.pid" "^Xvfb $DISPLAY_NUMBER( |$)" && return
    echo -e "${GREEN}Starting Xvfb on $DISPLAY_NUMBER${NC}"
    Xvfb "$DISPLAY_NUMBER" -screen 0 1024x768x24 >>"$LOG_DIR/xvfb.log" 2>&1 &
    echo $! >"$LOG_DIR/xvfb.pid"
    sleep 2
}

start_chromium() {
if pid_is_alive "$LOG_DIR/chromium.pid"; then return; fi
remember_existing_pid "$LOG_DIR/chromium.pid" "--user-data-dir=$PROFILE" && return
echo -e "${GREEN}Starting Chromium${NC}"
mkdir -p "$PROFILE"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-$(id -u)}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

export PULSE_RUNTIME_PATH="$XDG_RUNTIME_DIR/pulse"
mkdir -p "$PULSE_RUNTIME_PATH"

unset PULSE_SERVER
pulseaudio --start --exit-idle-time=-1 >/dev/null 2>&1 || true

export PULSE_SERVER="unix:$PULSE_RUNTIME_PATH/native"
export PULSE_SINK="poxey_output"

for _ in {1..20}; do
    if pactl info >/dev/null 2>&1; then
        break
    fi
    sleep 0.25
done

if ! pactl info >/dev/null 2>&1; then
    echo -e "${RED}WARNING: PulseAudio did not become available${NC}"
else
    if ! pactl list short sinks 2>/dev/null | awk '$2=="poxey_output"{found=1} END{exit !found}'; then
        pactl load-module module-null-sink sink_name=poxey_output sink_properties=device.description=PoxeyAudio >/dev/null
    fi
    pactl set-default-sink poxey_output
fi

"$CHROMIUM_BIN" \
    --disable-gpu \
    --use-pulseaudio \
    --disable-features=AudioServiceOutOfProcess \
    --no-sandbox \
    --user-data-dir="$PROFILE" \
    --no-first-run \
    --no-default-browser-check \
    --start-maximized \
    --display="$DISPLAY_NUMBER" \
    >>"$LOG_DIR/chromium.log" 2>&1 &
echo $! >"$LOG_DIR/chromium.pid"
}

start_x11vnc() {
    if pid_is_alive "$LOG_DIR/x11vnc.pid"; then return; fi
    remember_existing_pid "$LOG_DIR/x11vnc.pid" "x11vnc.*-rfbport $VNC_PORT" && return
    echo -e "${YELLOW}Starting x11vnc${NC}"
    x11vnc -display "$DISPLAY_NUMBER" -rfbport "$VNC_PORT" -localhost -nopw -forever -shared -wait 2 -defer 2 -speeds lan \
        >>"$LOG_DIR/x11vnc.log" 2>&1 &
    echo $! >"$LOG_DIR/x11vnc.pid"
}

start_novnc() {
    if pid_is_alive "$LOG_DIR/novnc.pid"; then return; fi
    remember_existing_pid "$LOG_DIR/novnc.pid" "novnc_proxy.*--listen $WEBSOCKET_PORT" && return
    remember_existing_pid "$LOG_DIR/novnc.pid" "websockify.*$WEBSOCKET_PORT" && return
    echo -e "${YELLOW}Starting noVNC/websockify${NC}"
    "$NOVNC_PROXY" --vnc "localhost:$VNC_PORT" --listen "$WEBSOCKET_PORT" \
        >>"$LOG_DIR/novnc.log" 2>&1 &
    echo $! >"$LOG_DIR/novnc.pid"
}

start_session_manager() {
  if [[ -s "$SESSION_MANAGER_PID" ]] && kill -0 "$(cat "$SESSION_MANAGER_PID")" 2>/dev/null; then
    return
  fi

  if pgrep -f -- "scripts/session-manager.sh" >/dev/null 2>&1; then
    pgrep -f -- "scripts/session-manager.sh" | head -n 1 >"$SESSION_MANAGER_PID"
    return
  fi

  echo -e "${GREEN}Starting Poxey session manager${NC}"
  nohup "$(dirname "$0")/session-manager.sh" >>"$LOG_DIR/session-manager.log" 2>&1 &
  echo $! >"$SESSION_MANAGER_PID"
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
start_session_manager

echo -e "${GREEN}Remote browser available: VNC $VNC_PORT, noVNC/websockify $WEBSOCKET_PORT${NC}"
echo "Automatic session cleanup: 5 minutes without heartbeat"
echo "Logs: $LOG_DIR"

while true; do
    sleep 5
    start_xvfb
    if [[ -f "$LOG_DIR/chromium.pid" ]]; then
            if ! kill -0 "$(cat "$LOG_DIR/chromium.pid")" 2>/dev/null; then
                rm -f "$LOG_DIR/chromium.pid"
                start_chromium
            fi
        else
            if ! pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; then
                start_chromium
            fi
        fi
    start_x11vnc
    start_novnc
done
