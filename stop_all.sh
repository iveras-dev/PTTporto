#!/bin/bash

echo "=== PTTPorto Stop All Services ==="
echo ""

# Kill all existing processes
echo "🛑 Stopping existing processes..."
pkill -f "pttporto-backend-all.jar" 2>/dev/null
pkill -f "vite" 2>/dev/null
lsof -ti:8082 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null
sleep 2
echo "✓ All services stopped."
