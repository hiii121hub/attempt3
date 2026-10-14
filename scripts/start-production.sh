#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_ENV=production
umask 077

# Validate before starting PulseAudio or creating state. Never fall back to --no-sandbox.
node --input-type=module -e "import { readRuntimeConfig } from './scripts/security-policy.mjs'; import { openAccountingState } from './scripts/accounting-state.mjs'; openAccountingState(readRuntimeConfig().stateDir).assertReady()"
for binary in node pulseaudio pactl ffmpeg Xvfb x11vnc xdotool unshare curl; do
  command -v "$binary" >/dev/null || { echo "Missing production dependency: $binary" >&2; exit 1; }
done
test -x /usr/bin/google-chrome || { echo 'Google Chrome is required' >&2; exit 1; }
unshare --user --map-root-user true || {
  echo 'User namespaces unavailable. Configure the host sandbox; do not disable Chrome sandboxing.' >&2
  exit 1
}
if ! pactl info >/dev/null 2>&1; then
  pulseaudio --start --exit-idle-time=-1
fi
pactl info >/dev/null
exec node scripts/poxey-session-manager.mjs
