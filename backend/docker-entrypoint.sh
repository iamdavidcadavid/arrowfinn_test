#!/bin/sh
set -e
# Migrations and seed run as the schema owner; the server runs as the
# RLS-restricted app role (DATABASE_URL). The owner URL is only in this script's env.
echo "applying migrations..."
DATABASE_URL="$MIGRATE_DATABASE_URL" npx prisma migrate deploy
echo "seeding..."
DATABASE_URL="$MIGRATE_DATABASE_URL" node dist/prisma/seed.js
unset MIGRATE_DATABASE_URL
exec node dist/src/main.js
