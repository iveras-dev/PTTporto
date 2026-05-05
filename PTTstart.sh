#!/bin/bash

# PTTPorto Start Script
# Starts PostgreSQL (Docker), builds web apps, and starts Ktor backend

PROJECT_ROOT="/Users/gast/Downloads/PTTPorto"
cd "$PROJECT_ROOT" || exit 1

echo "=== Starting PTTPorto ==="

# 1. Start PostgreSQL via Docker
echo "[1/4] Starting PostgreSQL container..."
cd "$PROJECT_ROOT/docker" || exit 1
docker compose up -d
echo "Waiting for PostgreSQL to be ready..."
sleep 5
cd "$PROJECT_ROOT" || exit 1

# 2. Build web-client
echo "[2/4] Building web-client..."
cd "$PROJECT_ROOT/web-client" || exit 1
npm run build 2>&1 | tail -5
cd "$PROJECT_ROOT" || exit 1

# 3. Build web-admin
echo "[3/4] Building web-admin..."
cd "$PROJECT_ROOT/web-admin" || exit 1
npm run build 2>&1 | tail -5
cd "$PROJECT_ROOT" || exit 1

# 4. Start Backend (Ktor) - this will also serve the web clients from build/dist
echo "[4/4] Starting Ktor Backend (serving APIs + web clients)..."
echo "Backend will be available at: http://localhost:8080"
echo "Web Client at: http://localhost:8080"
echo "Web Admin at: http://localhost:8080/admin"
echo "Press Ctrl+C to stop."
echo ""

cd "$PROJECT_ROOT/backend" || exit 1
./gradlew run --no-daemon
