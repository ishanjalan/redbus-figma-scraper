#!/bin/bash
# Double-click this file to start the RedBus Figma Plugin server

cd "$(dirname "$0")/vercel-backend"

echo "🚀 Starting RedBus Data Server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first time only)..."
    npm install
    echo ""
fi

echo "✅ Server running at http://localhost:3000"
echo "👉 Keep this window open while using the Figma plugin"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
