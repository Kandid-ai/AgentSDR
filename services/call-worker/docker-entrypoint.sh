#!/bin/sh
set -e
echo "[entrypoint] starting PulseAudio"
# A virtual speaker: WhatsApp Web plays the lead's voice here, the extension taps it.
pulseaudio -D --exit-idle-time=-1 --system=false 2>/dev/null || true
sleep 1
pactl load-module module-null-sink sink_name=agentsdr >/dev/null
pactl set-default-sink agentsdr
# A virtual screen, started directly: xvfb-run hung as the container's PID 1
# (it needs xauth, which --no-install-recommends leaves out, and waits on a
# signal from Xvfb) — the worker never started and logged nothing (23 Oct 2026).
echo "[entrypoint] starting Xvfb on :99"
rm -f /tmp/.X99-lock
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
export DISPLAY=:99
for i in 1 2 3 4 5 6 7 8 9 10; do
  [ -e /tmp/.X11-unix/X99 ] && break
  sleep 0.5
done
[ -e /tmp/.X11-unix/X99 ] || { echo "[entrypoint] Xvfb did not start:"; cat /tmp/xvfb.log; exit 1; }
export HEADLESS=false
echo "[entrypoint] starting the worker"
exec node --import tsx src/main.ts
