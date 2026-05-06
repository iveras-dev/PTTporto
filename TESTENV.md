# PTTPorto Testomgeving

## Scripts

### Schone testomgeving starten
```bash
./clean_test.sh
```
- Stopt alle draaiende processen
- Clean build van backend en frontend
- Start backend op poort 8082
- Start frontend in dev mode (http://localhost:3000 + LAN http://192.168.2.10:3000)

### Alles stoppen
```bash
./stop_all.sh
```

## Test gebruikers
- **roy@test.com** / roy123 (admin van channel 103 "RoyTest", lid van channel 2)
- **test5** / test123 (lid van channel 2)

## Test stappen (Spacebar PTT)
1. Open http://192.168.2.10:3000 (of localhost:3000)
2. Login met roy@test.com / roy123
3. Ga naar "Channels" → Join channel 2 (als nog niet gedaan)
4. Klik "Open PTT" voor channel 2
5. **Houd spatiebalk ingedrukt** → moet zenden (status: "Transmitting...")
6. **Laat spatiebalk los** → moet stoppen (status: "Transmission ended")
7. Check F12 Console voor logs

## Test met twee browsers
- **Browser 1 (Sender):** roy@test.com op http://localhost:3000
- **Browser 2 (Receiver):** test5 op http://192.168.2.10:3000 (of andere device)
- Browser 1: Houd spatiebalk in → Browser 2 moet audio horen
- Browser 1: Laat los → Browser 2 audio stopt

## Logs bekijken
```bash
# Backend
tail -f /tmp/pttporto_backend.log

# Frontend
tail -f /tmp/pttporto_webclient.log
```

## Bekende issues
- Soms blijft audio stromen na loslaten (fix: closeAllConnections() toegevoegd)
- Spacebar events kunnen dubbel vuren (opgelost met spacePressedRef)
- WebRTC PeerConnections worden nu gesloten bij PTT stop

## Backup tags op GitHub
- `backup-before-websocket-fix` - Staat van voor WebSocket fixes
- `backup-after-userlist-and-singlesender` - Na user list en single-sender logic
- `backup-20260506-180156` - Laatste backup
