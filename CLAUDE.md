# Intent Postman

Postman-like desktop tool for testing Android intents. Compose, send, and debug activities, broadcasts, and services from a desktop GUI.

## Architecture

Two-component system communicating via ADB + TCP:

- **Desktop** (`desktop/`) — Electron 41 + React 19 + TypeScript + Zustand + Vite
- **Android** (`android/`) — Kotlin, foreground TCP server (port 12345), JSON-RPC 2.0

## Key Directories

```
desktop/src/
├── main/           # Electron main process (adb.ts, socket.ts, preload.ts)
├── renderer/       # React UI (components/, store/)
└── shared/         # Types and utilities

android/app/src/main/
├── java/.../       # Kotlin source (CommandService, MainActivity, Protocol)
└── AndroidManifest.xml
```

## Build Commands

```bash
# Desktop
cd desktop && npm install && npm run make

# Android
cd android && ./gradlew build && ./gradlew installDebug
```

## Communication Protocol

- ADB port forward: `adb forward tcp:12345 tcp:12345`
- TCP socket with JSON-RPC 2.0
- API: system.*, intent.*, broadcast.*, service.*, package.*

## State Management (Desktop)

Zustand stores: `deviceStore`, `requestStore`, `serviceStore`, `broadcastStore`, `collectionsStore`, `tabStore`, `notificationStore`

## Intent Types Supported

- startActivity / startActivityForResult
- Broadcast (send + monitor)
- startService / stopService
- bindService / unbindService / service.call / service.sendMessage
- Package queries (list, components, quick actions, intent filters)
