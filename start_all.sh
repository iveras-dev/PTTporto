#!/bin/bash#

echo "=== PTTPorto Startup Script ==="
echo ""

# Kill all existing processes
echo "Stopping existing processes..."
lsof -ti:8082 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2
echo "Done."
echo ""

# Start Backend
echo "Starting Backend (Java 17)..."
cd /Users/gast/Downloads/PTTPorto/backend
nohup /Users/gast/.sdkman/candidates/java/17.0.13-tem/bin/java -jar build/libs/pttporto-backend-all.jar > /tmp/pttporto_backend.log 2>&1 &
sleep 5

# Check backend
if curl -s http://localhost:8082/health | grep -q "ok"; then
    echo "✓ Backend running on http://localhost:8082"
else
    echo "✗ Backend failed to start"
    tail -20 /tmp/pttporto_backend.log
    exit 1
fi
echo ""

# Start Web Client
echo "Starting Web Client..."
cd /Users/gast/Downloads/PTTPorto/web-client
nohup /usr/local/bin/npm run dev > /tmp/pttporto_webclient.log 2>&1 &
sleep 15

# Check web client
if curl -s http://localhost:3000 | grep -q "Channels"; then
    echo "✓ Web Client running on http://localhost:3000"
else
    echo "✗ Web Client failed to start"
    tail -20 /tmp/pttporto_webclient.log
    exit 1
fi
echo ""

# Start Web Admin
echo "Starting Web Admin..."
cd /Users/gast/Downloads/PTTPorto/web-admin
nohup /usr/local/bin/npm run dev > /tmp/pttporto_webadmin.log 2>&1 &
sleep 15

# Check web admin
if curl -s http://127.0.0.1:3001 | grep -q "PTTPorto Admin"; then
    echo "✓ Web Admin running on http://127.0.0.1:3001"
else
    echo "✗ Web Admin failed to start"
    tail -20 /tmp/pttporto_webadmin.log
    exit 1
fi
echo ""

echo "=== All services started successfully! ==="
echo ""
echo "Backend:   http://localhost:8082/health"
echo "Web Client: http://localhost:3000 (login: test2@test.com / test123)"
echo "Web Admin: http://127.0.0.1:3001 (login: admin@ptt.com / admin123)"
echo ""
echo "To stop all: lsof -ti:8082,3000,3001 | xargs kill -9"
