#!/bin/sh
set -e

if [ -n "${DATABASE_URL:-}" ]; then
  ./node_modules/.bin/prisma migrate deploy
  node dist-seed/seed.js
fi

exec "$@"
