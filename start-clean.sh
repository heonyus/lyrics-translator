#!/bin/bash

echo "🧹 Cleaning Next.js project..."

# Kill any existing processes
pkill -f "next dev" 2>/dev/null
pkill -f "node.*next" 2>/dev/null

# Wait for ports to be released
sleep 2

# Remove all cache directories
echo "📦 Removing cache directories..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc

# Clear npm cache
echo "🔄 Clearing npm cache..."
npm cache clean --force

# Start the dev server
echo "🚀 Starting Next.js server..."
npx next dev