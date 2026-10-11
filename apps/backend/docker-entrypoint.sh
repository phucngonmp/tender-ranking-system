#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding initial admin user (skipped if already exists)..."
npx ts-node --transpile-only prisma/seed.ts

echo "Starting backend..."
exec "$@"
