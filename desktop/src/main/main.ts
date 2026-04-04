import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { listDevices, trackDevices, openTcpConnection, launchApp, isAppInstalled, installApk } from './adb';
import { CommandSocket } from './socket';
import type { ConnectionStatus, CollectionsData } from '../shared/types';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let commandSocket: CommandSocket | null = null;
let deviceTracker: { cancel: () => void } | null = null;
let connectedSerial: string | null = null;

function sendToRenderer(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args);
}

function setConnectionStatus(status: ConnectionStatus) {
  sendToRenderer('connection:status', status);
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Intent Postman',
  });

  // In development, Vite dev server URL is injected by electron-forge
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Vite dev server URL constants (injected by electron-forge plugin-vite)
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('devices:list', async () => {
  try {
    return await listDevices();
  } catch (err) {
    console.error('Failed to list devices:', err);
    return [];
  }
});

ipcMain.handle('devices:connect', async (_event, serial: string) => {
  try {
    setConnectionStatus('connecting');

    // Disconnect existing connection
    if (commandSocket?.isConnected) {
      commandSocket.disconnect();
    }

    // Check if the Android app is installed
    const installed = await isAppInstalled(serial);
    if (!installed) {
      setConnectionStatus('disconnected');
      return { success: false, needsInstall: true };
    }

    // Launch the Android app
    await launchApp(serial);

    // Open TCP connection with retry (server may still be starting)
    let stream: import('stream').Duplex | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 2000 : 1000));
        stream = await openTcpConnection(serial, 5000);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
      }
    }

    connectedSerial = serial;
    commandSocket = new CommandSocket();
    commandSocket.connect(stream!);

    // Forward notifications to renderer
    commandSocket.onNotification((notification) => {
      sendToRenderer('command:notification', notification);
    });

    // Handle disconnection
    commandSocket.onDisconnect(() => {
      connectedSerial = null;
      setConnectionStatus('disconnected');
    });

    setConnectionStatus('connected');
    return { success: true };
  } catch (err) {
    console.error('Failed to connect:', err);
    setConnectionStatus('error');
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('devices:disconnect', async () => {
  commandSocket?.disconnect();
  commandSocket = null;
  connectedSerial = null;
  setConnectionStatus('disconnected');
});

function getApkPath(): string {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return path.join(process.cwd(), 'apk', 'app-debug.apk');
  }
  return path.join(process.resourcesPath, 'apk', 'app-debug.apk');
}

ipcMain.handle('devices:installAndConnect', async (_event, serial: string) => {
  try {
    setConnectionStatus('connecting');

    // Disconnect existing connection
    if (commandSocket?.isConnected) {
      commandSocket.disconnect();
    }

    // Install the APK
    const apkPath = getApkPath();
    if (!fs.existsSync(apkPath)) {
      setConnectionStatus('disconnected');
      return { success: false, error: 'APK file not found. Please build the Android app first.' };
    }

    await installApk(serial, apkPath);

    // Launch the Android app
    await launchApp(serial);

    // Open TCP connection with retry every 5s for up to 2 minutes
    let stream: import('stream').Duplex | null = null;
    for (let attempt = 1; attempt <= 24; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 2000 : 5000));
        stream = await openTcpConnection(serial, 5000);
        break;
      } catch (err) {
        if (attempt === 24) throw err;
      }
    }

    connectedSerial = serial;
    commandSocket = new CommandSocket();
    commandSocket.connect(stream!);

    commandSocket.onNotification((notification) => {
      sendToRenderer('command:notification', notification);
    });

    commandSocket.onDisconnect(() => {
      connectedSerial = null;
      setConnectionStatus('disconnected');
    });

    setConnectionStatus('connected');
    return { success: true };
  } catch (err) {
    console.error('Failed to install & connect:', err);
    setConnectionStatus('error');
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle(
  'command:send',
  async (_event, method: string, params: Record<string, unknown>) => {
    // If not connected but we have a serial, try to auto-reconnect
    if (!commandSocket?.isConnected && connectedSerial) {
      try {
        await launchApp(connectedSerial);
        await new Promise((r) => setTimeout(r, 2000));

        let stream: import('stream').Duplex | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            stream = await openTcpConnection(connectedSerial, 5000);
            break;
          } catch (err) {
            if (attempt === 3) throw err;
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        commandSocket = new CommandSocket();
        commandSocket.connect(stream!);
        commandSocket.onNotification((notification) => {
          sendToRenderer('command:notification', notification);
        });
        commandSocket.onDisconnect(() => {
          connectedSerial = null;
          setConnectionStatus('disconnected');
        });
        setConnectionStatus('connected');
      } catch {
        return {
          jsonrpc: '2.0',
          id: '',
          error: { code: -1, message: 'Failed to auto-reconnect to device' },
        };
      }
    }

    if (!commandSocket?.isConnected) {
      return {
        jsonrpc: '2.0',
        id: '',
        error: { code: -1, message: 'Not connected to device' },
      };
    }

    try {
      return await commandSocket.send(method, params);
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id: '',
        error: { code: -1, message: (err as Error).message },
      };
    }
  }
);

// ── Collections Persistence ──────────────────────────────────

function getCollectionsPath(): string {
  return path.join(app.getPath('userData'), 'collections.json');
}

ipcMain.handle('collections:load', async () => {
  try {
    const filePath = getCollectionsPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as CollectionsData;
    }
  } catch (err) {
    console.error('Failed to load collections:', err);
  }
  return { version: 1, collections: [] } as CollectionsData;
});

ipcMain.handle('collections:save', async (_event, data: CollectionsData) => {
  try {
    const filePath = getCollectionsPath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save collections:', err);
  }
});

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(async () => {
  createWindow();

  // Start tracking device changes
  try {
    deviceTracker = await trackDevices((devices) => {
      sendToRenderer('devices:changed', devices);
    });
  } catch (err) {
    console.error('Failed to start device tracking:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  commandSocket?.disconnect();
  deviceTracker?.cancel();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
