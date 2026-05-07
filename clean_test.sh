#!/bin/bash

echo "=== PTTPorto Schone Testomgeving ==="
echo ""

# Kill all existing processes
echo "🛑 Stopping existing processes..."
lsof -ti:8082 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "pttporto-backend-all.jar" 2>/dev/null
sleep 2
echo "✓ Done."
echo ""

# Clean and Build Backend
echo "🔨 Building Backend..."
cd /Users/gast/Downloads/PTTPorto/backend
./gradlew clean build -x test
if [ $? -ne 0 ]; then
    echo "✗ Backend build failed!"
    exit 1
fi
echo "✓ Backend built successfully."
echo ""

# Clean and Build Frontend
echo "🔨 Building Frontend..."
cd /Users/gast/Downloads/PTTPorto/web-client
rm -rf dist .vite
npm run build
if [ $? -ne 0 ]; then
    echo "✗ Frontend build failed!"
    exit 1
fi
echo "✓ Frontend built successfully."
echo ""

# Start Backend
echo "🚀 Starting Backend..."
nohup java -jar /Users/gast/Downloads/PTTPorto/backend/build/libs/pttporto-backend-all.jar > /tmp/pttporto_backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 8

# Check backend
if curl -s http://localhost:8082/health | grep -q "ok"; then
    echo "✓ Backend running on http://localhost:8082"
else
    echo "✗ Backend failed to start"
    tail -20 /tmp/pttporto_backend.log
    exit 1
fi
echo ""

# Start Frontend (dev mode for testing)
echo "🚀 Starting Frontend (dev mode)..."
cd /Users/gast/Downloads/PTTPorto/web-client
nohup npm run dev -- --host 0.0.0.0 > /tmp/pttporto_webclient.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
sleep 15

# Get frontend port (try multiple ports)
FRONTEND_PORT=""
for port in 3000 3001 3002 3003 3004; do
    if lsof -ti:$port >/dev/null 2>&1; then
        FRONTEND_PORT=$port
        break
    fi
done

if [ -z "$FRONTEND_PORT" ]; then
    echo "✗ Frontend failed to start - no port found"
    tail -20 /tmp/pttporto_webclient.log
    exit 1
fi

# Check frontend
if curl -s http://localhost:$FRONTEND_PORT | grep -q "Channels\|PTT"; then
    echo "✓ Frontend running on http://localhost:$FRONTEND_PORT"
    echo "✓ LAN access: http://192.168.2.10:$FRONTEND_PORT"
else
    echo "✗ Frontend failed to start"
    tail -20 /tmp/pttporto_webclient.log
    exit 1
fi

# Check frontend
if curl -s http://localhost:$FRONTEND_PORT | grep -q "Channels\|PTT"; then
    echo "✓ Frontend running on http://localhost:$FRONTEND_PORT"
    echo "✓ LAN access: http://192.168.2.10:$FRONTEND_PORT"
else
    echo "✗ Frontend failed to start"
    tail -20 /tmp/pttporto_webclient.log
    exit 1
fi
echo ""

echo "=== ✅ Testomgeving Ready! ==="
echo ""
echo "Backend:     http://localhost:8082/health"
echo "Frontend:    http://localhost:$FRONTEND_PORT"
echo "Frontend LAN: http://192.168.2.10:$FRONTEND_PORT"
echo ""
echo "Test users:"
echo "  - roy@test.com / roy123 (admin channel 103, member channel 2)"
echo "  - test5 / test123 (member channel 2)"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/pttporto_backend.log"
echo "  Frontend: tail -f /tmp/pttporto_webclient.log"
echo ""
echo "To stop: pkill -f 'pttporto-backend-all.jar' && pkill -f 'vite'"
