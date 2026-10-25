#!/bin/sh
set -e

: "${DATABASE_URL:=file:/app/data/app.db}"

# Make sure the volume path exists even on a brand-new volume.
DB_PATH="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$DB_PATH")"
mkdir -p "${STORAGE_DIR:-/app/data/uploads}"

# Idempotent schema creation (no Prisma CLI needed at runtime).
node scripts/init-db.mjs

exec node server.js
