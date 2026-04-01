# Intent Postman

A Postman-like desktop application for testing Android Intents, Broadcasts, and Services. Send intents to Android apps, listen to broadcasts, manage services, and query package information through a modern, intuitive interface.

## Features

### 🔗 Intent Testing
- **Activity Intents**: Launch activities with custom actions, data URIs, extras, and flags
- **Broadcast Intents**: Send broadcasts to apps and system components
- **Service Intents**: Start, stop, bind, and communicate with Android services

### 📡 Broadcast Monitoring
- Listen to system and app broadcasts in real-time
- Filter broadcasts by action or sender
- View broadcast extras and metadata

### 🔧 Service Management
- Start and stop services
- Bind to services with custom interfaces
- Send messages to bound services
- Monitor service lifecycle

### 📦 Package Queries
- List installed packages
- Query package components (activities, services, receivers)
- Get app quick actions and intent filters

### 📱 Device Management
- Connect to Android devices via ADB
- Support for multiple connected devices
- Real-time device status monitoring

## Architecture

Intent Postman consists of two main components:

### Desktop App (Electron + React)
- Modern desktop interface built with Electron and React
- Device connection management via ADB
- Request/response panels similar to Postman
- Real-time notifications and logging

### Android Companion App
- Lightweight HTTP server running on Android device
- JSON-RPC 2.0 API for command execution
- Background service for persistent operation
- Minimal UI focused on server management

## Prerequisites

- **Node.js** 16+ and npm
- **Android SDK** with ADB installed
- **Android device** with USB debugging enabled
- **Java 11+** for Android development

## Installation

### Desktop App

```bash
cd desktop
npm install
npm run make
```

This will create platform-specific installers in the `out/make` directory.

### Android App

```bash
cd android
./gradlew build
```

Install the generated APK on your Android device:

```bash
./gradlew installDebug
```

## Usage

### 1. Start the Android Server

1. Launch the Intent Postman app on your Android device
2. Tap "Start Server" (default port: 5000)
3. Note the server status turns green

### 2. Connect via ADB

Forward the port from your Android device to your computer:

```bash
adb forward tcp:5000 tcp:5000
```

### 3. Launch Desktop App

1. Open the desktop application
2. Select your connected Android device
3. The connection status should show "Connected"

### 4. Send Commands

Use the interface to:
- **Send Intents**: Choose intent type, set action/data/extras, send
- **Listen to Broadcasts**: Add broadcast listeners with filters
- **Manage Services**: Start/stop/bind services by component name
- **Query Packages**: Browse installed apps and their components

## API Reference

The Android server exposes a JSON-RPC 2.0 API with the following methods:

### System
- `system.ping` - Test server connectivity
- `system.info` - Get device information

### Intents
- `intent.send` - Send activity/service intent

### Broadcasts
- `broadcast.send` - Send broadcast intent
- `broadcast.listen` - Start listening to broadcasts
- `broadcast.unlisten` - Stop listening to broadcasts
- `broadcast.listListeners` - List active listeners
- `broadcast.unlistenAll` - Stop all listeners

### Services
- `service.start` - Start a service
- `service.stop` - Stop a service
- `service.bind` - Bind to a service
- `service.unbind` - Unbind from a service
- `service.call` - Call service method
- `service.sendMessage` - Send message to service
- `service.listBindings` - List active bindings

### Packages
- `package.listPackages` - List installed packages
- `package.queryComponents` - Query package components
- `package.getQuickActions` - Get app quick actions
- `package.queryIntents` - Query package intent filters

## Development

### Desktop App

```bash
cd desktop
npm install
npm start          # Development mode
npm run package    # Package for current platform
npm run make       # Create distributables
```

### Android App

```bash
cd android
./gradlew assembleDebug    # Build debug APK
./gradlew installDebug     # Install on connected device
./gradlew runDebug         # Run on device
```

## Building from Source

### Complete Build

```bash
# Build Android app
cd android
./gradlew assembleRelease

# Build desktop app
cd ../desktop
npm install
npm run make
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both Android and desktop platforms
5. Submit a pull request

## Troubleshooting

### Connection Issues
- Ensure ADB is installed and Android device is connected
- Verify USB debugging is enabled on Android device
- Check that port forwarding is active: `adb forward --list`
- Confirm the Android server is running on the device

### Permission Errors
- Grant all requested permissions to the Android app
- For Android 13+, ensure notification permission is granted

### Build Issues
- Clear Gradle cache: `cd android && ./gradlew clean`
- Reinstall Node modules: `cd desktop && rm -rf node_modules && npm install`

## License

ISC License

## Acknowledgments

- Built with Electron, React, and Android Jetpack Compose
- Uses ADB Kit for device communication
- Inspired by Postman's intuitive API testing interface</content>
<parameter name="filePath">c:\Users\pc\OneDrive\Desktop\ai apps\claude\postman intent\README.md