#!/bin/sh
set -e

echo "🚀 Starting Stalker API..."

# Apply any pending database migrations before the app boots.
echo "📦 Running database migrations (prisma migrate deploy)..."
npx prisma migrate deploy --schema=prisma/schema.prisma --skip-generate

# Start the application (Nest builds to dist/src/main.js)
echo "✅ Starting application..."
exec node dist/src/main
