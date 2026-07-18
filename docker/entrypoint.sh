#!/bin/sh
set -e

# Load secrets from *_FILE paths if provided
load_secret() {
  VAR_NAME="$1"
  FILE_VAR_NAME="${VAR_NAME}_FILE"
  eval FILE_PATH="\${$FILE_VAR_NAME}"
  if [ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ]; then
    VALUE=$(cat "$FILE_PATH")
    export "$VAR_NAME"="$VALUE"
    # Unset the _FILE var to avoid leaking paths
    unset "$FILE_VAR_NAME"
  fi
}

for var in NEXTAUTH_SECRET DATABASE_URL SENTRY_DSN SENTRY_AUTH_TOKEN REDIS_URL; do
  load_secret "$var"
done

# Execute the provided command
exec "$@"
