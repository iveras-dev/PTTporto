# PTTPorto Project

## Overview
PTTPorto is a push-to-talk (PTT) portofoon simulation app that works on Android and web browsers.

## Architecture
- **Backend**: Kotlin Ktor server with PostgreSQL, JWT auth, WebRTC signaling
- **Android App**: Kotlin + Jetpack Compose + Hilt + Room (offline caching)
- **Web Client**: React 18 + TypeScript + Vite + Tailwind CSS
- **Web Admin**: React 18 + TypeScript + Vite + Tailwind CSS (superadmin dashboard)

## Project Structure
```
PTTPorto/
├── backend/           # Ktor server (serves web clients, APIs, WebSocket)
├── android-app/       # Android application
├── web-client/        # Browser-based PTT client
├── web-admin/         # Superadmin dashboard
└── docker/           # Docker Compose for PostgreSQL
```

## Quick Start

### Prerequisites
- JDK 17+
- Node.js 18+
- Android SDK (for Android app)
- Docker (for PostgreSQL)

### Backend
```bash
cd backend
./gradlew build
java -jar build/libs/pttporto-backend-1.0.0.jar
```

### Web Client
```bash
cd web-client
npm install
npm run dev  # Development on port 3000
npm run build  # Production build
```

### Web Admin
```bash
cd web-admin
npm install
npm run dev  # Development on port 3001
npm run build  # Production build
```

### Database
```bash
cd docker
docker-compose up -d
```

## Testing
- Backend: `./gradlew test`
- Web Client: `npm test`
- Web Admin: `npm test`
- Android: Use Android Studio

## Phases
1. ✅ Phase 1: Architecture & Foundation
2. 🔄 Phase 2: User Management (Next)
3. Phase 3: Channel Management
4. Phase 4: PTT Audio
5. Phase 5: Robustness & Superadmin
6. Phase 6: 2FA & Final Regression

## Features
- User registration/login with email + callsign
- Channel creation/management with admin roles
- Real-time PTT audio via WebRTC
- Offline channel caching (Android + Web)
- Superadmin dashboard for user/channel management
- Future: TOTP 2FA support
