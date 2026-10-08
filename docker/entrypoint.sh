#!/bin/sh
# Image entrypoint: makes the container runnable with no .env file.
#
# Secrets are generated ONCE, kept in a volume (/var/lib/agentsdr), and every
# service of the Compose project reads the same file. Anything set in the
# environment wins over the generated value, so supplying your own secrets
# (in .env or the shell) always works. Then it runs the real command.
set -eu

DIR="${AGENTSDR_SECRETS_DIR:-/var/lib/agentsdr}"
FILE="$DIR/secrets.env"
PGFILE="$DIR/postgres-password"
NAMES="BETTER_AUTH_SECRET INTEGRATION_CREDENTIALS_KEY UNSUBSCRIBE_SECRET CRON_SECRET OUTREACH_TICK_SECRET POSTGRES_PASSWORD"

random() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

generate() {
  umask 077
  tmp="$FILE.$$"
  for name in $NAMES; do
    # A POSTGRES_PASSWORD already in the environment (an install that had one
    # in .env) is adopted, so the existing database keeps working.
    if [ "$name" = POSTGRES_PASSWORD ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
      value="$POSTGRES_PASSWORD"
    else
      value="$(random)"
    fi
    printf '%s=%s\n' "$name" "$value"
  done > "$tmp"
  # The official postgres image reads POSTGRES_PASSWORD_FILE as the postgres
  # user, so this one file is world-readable; the volume is private to the project.
  sed -n 's/^POSTGRES_PASSWORD=//p' "$tmp" | tr -d '\n' > "$PGFILE.$$"
  chmod 644 "$PGFILE.$$"
  mv "$PGFILE.$$" "$PGFILE"
  mv "$tmp" "$FILE"   # last: its presence means "complete"
}

ensure_secrets() {
  [ -f "$FILE" ] && return 0
  # mkdir is atomic: exactly one starter generates, the others wait for the file.
  if mkdir "$DIR/.lock" 2>/dev/null; then
    [ -f "$FILE" ] || generate
    rmdir "$DIR/.lock"
    return 0
  fi
  i=0
  while [ ! -f "$FILE" ]; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
      echo "agentsdr: gave up waiting for $FILE (stale $DIR/.lock?)" >&2
      exit 1
    fi
    sleep 0.5
  done
}

ensure_secrets

# Export each secret from the file unless the environment already has it.
for name in $NAMES; do
  eval "current=\${$name:-}"
  if [ -z "$current" ]; then
    value="$(sed -n "s/^$name=//p" "$FILE")"
    export "$name=$value"
  fi
done

# Public origin: APP_URL is the one setting; the specific names win if set.
APP_URL="${APP_URL:-http://localhost:3000}"
APP_URL="${APP_URL%/}"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-$APP_URL}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-$APP_URL}"
export OPENROUTER_SITE_URL="${OPENROUTER_SITE_URL:-$APP_URL}"

# Bundled database, unless DATABASE_URL points elsewhere.
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgres://agentsdr:$(cat "$PGFILE")@db:5432/agentsdr"
  export DATABASE_SSL="${DATABASE_SSL:-disable}"
fi

exec "$@"
