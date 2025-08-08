#!/bin/bash

# Kill any existing processes
pkill -f "next dev" 2>/dev/null
pkill -f "node.*next" 2>/dev/null

# Wait for ports to be released
sleep 2

# Remove cache
rm -rf .next

# Start the server
echo "Starting Next.js server..."
npx next dev