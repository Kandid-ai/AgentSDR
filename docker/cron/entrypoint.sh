#!/bin/sh
# busybox crond does not pass the container's environment to jobs, so the
# values the crontab needs are written to a file each job sources.
set -eu
apk add --no-cache curl >/dev/null
umask 077
{
  for name in APP_URL CRON_SECRET OUTREACH_TICK_SECRET; do
    eval "value=\${$name}"
    # Single-quote the value; escape any single quotes inside it.
    printf "export %s='%s'\n" "$name" "$(printf '%s' "$value" | sed "s/'/'\\\\''/g")"
  done
} > /etc/agentsdr/env
cp /etc/agentsdr/crontab /etc/crontabs/root
echo "agentsdr cron: schedules loaded"
exec crond -f -l 8
