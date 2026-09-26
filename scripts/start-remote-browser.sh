#!/usr/bin/env bash
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}macOS mode: Bypassing Linux VNC/Chromium backend dependencies to run frontend UI.${NC}"

# Dummy loop to keep the background process happy so start-project.sh doesn't crash
while true; do
    sleep 3600
done
