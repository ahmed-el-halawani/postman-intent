import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { listDevices, trackDevices, openTcpConnection } from './adb';
import { CommandSocket } from './socket';
import type { ConnectionStatus } from '../shared/types';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let commandSocket: CommandSocket | null = null;
let deviceTracker: { cancel: () => void } | null = null;

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

    // Open TCP connection to Android app on port 5000
    const stream = await openTcpConnection(serial, 5000);

    commandSocket = new CommandSocket();
    commandSocket.connect(stream);

    // Forward notifications to renderer
    commandSocket.onNotification((notification) => {
      sendToRenderer('command:notification', notification);
    });

    // Handle disconnection
    commandSocket.onDisconnect(() => {
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
  setConnectionStatus('disconnected');
});

ipcMain.handle(
  'command:send',
  async (_event, method: string, params: Record<string, unknown>) => {
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
