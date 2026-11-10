#!/bin/sh
set -e

# Ensure persistent data directory and existing SQLite database files are owned by node user
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data
  exec su-exec node "$@"
fi

exec "$@"
