#!/bin/sh
set -e
# A virtual speaker: WhatsApp Web plays the lead's voice here, the extension taps it.
pulseaudio -D --exit-idle-time=-1 --system=false || true
sleep 1
pactl load-module module-null-sink sink_name=agentsdr
pactl set-default-sink agentsdr
export HEADLESS=false
exec xvfb-run -a --server-args="-screen 0 1280x800x24" node --import tsx src/main.ts
