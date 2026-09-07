#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Remote Browser services...${NC}"

# Stop Poxey session manager
if [ -f /tmp/remote-browser/session-manager.pid ]; then
    SESSION_MANAGER_PID=$(cat /tmp/remote-browser/session-manager.pid)
    echo "Killing Poxey session manager (PID: $SESSION_MANAGER_PID)"
    kill "$SESSION_MANAGER_PID" 2>/dev/null || true
fi

pkill -f -- "scripts/session-manager.sh" 2>/dev/null || true

# Read PIDs from files
if [ -f /tmp/remote-browser/xvfb.pid ]; then
    XVFB_PID=$(cat /tmp/remote-browser/xvfb.pid)
    echo "Killing Xvfb (PID: $XVFB_PID)"
    kill $XVFB_PID 2>/dev/null || true
fi

if [ -f /tmp/remote-browser/x11vnc.pid ]; then
    VNC_PID=$(cat /tmp/remote-browser/x11vnc.pid)
    echo "Killing x11vnc (PID: $VNC_PID)"
    kill $VNC_PID 2>/dev/null || true
fi

if [ -f /tmp/remote-browser/novnc.pid ]; then
    NOVNC_PID=$(cat /tmp/remote-browser/novnc.pid)
    echo "Killing noVNC/websockify (PID: $NOVNC_PID)"
    kill $NOVNC_PID 2>/dev/null || true
fi

if [ -f /tmp/remote-browser/chromium.pid ]; then
    CHROME_PID=$(cat /tmp/remote-browser/chromium.pid)
    echo "Killing Chromium (PID: $CHROME_PID)"
    kill $CHROME_PID 2>/dev/null || true
fi

# Also use pkill as fallback
pkill -f "Xvfb.*:1" 2>/dev/null || true
pkill -f "x11vnc -display :1 -rfbport 5901" 2>/dev/null || true
pkill -f "novnc_proxy.*--listen 6080" 2>/dev/null || true
pkill -f "websockify.*6080" 2>/dev/null || true

# Clean up
rm -rf /tmp/remote-browser
rm -rf /tmp/chromium-remote-profile
rm -rf /tmp/poxey-session
rm -f /tmp/xvfb.log /tmp/vnc.log /tmp/websockify.log /tmp/chromium.log

echo -e "${GREEN}Remote Browser services stopped${NC}"
