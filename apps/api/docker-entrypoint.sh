#!/bin/sh
set -e

echo "🚀 Starting Stalker API..."

# Run Prisma migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy --skip-generate

# Start the application
echo "✅ Starting application..."
exec node dist/main
