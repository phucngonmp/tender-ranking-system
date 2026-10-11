#!/bin/sh
set -e

# xvfb-run relies on a SIGUSR1 readiness signal that can hang forever when the
# wrapping shell is PID 1 inside a container, so we start Xvfb ourselves
# instead and just wait briefly before handing off to uvicorn.
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
export DISPLAY=:99

for i in $(seq 1 20); do
  if [ -e /tmp/.X11-unix/X99 ]; then
    break
  fi
  sleep 0.2
done

exec "$@"
