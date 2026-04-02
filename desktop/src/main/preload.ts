import { contextBridge, ipcRenderer } from 'electron';
import type { IntentPostmanAPI } from '../shared/types';

const api: IntentPostmanAPI = {
  listDevices: () => ipcRenderer.invoke('devices:list'),

  connectDevice: (serial: string) => ipcRenderer.invoke('devices:connect', serial),

  disconnectDevice: () => ipcRenderer.invoke('devices:disconnect'),

  sendCommand: (method: string, params: Record<string, unknown>) =>
    ipcRenderer.invoke('command:send', method, params),

  loadCollections: () => ipcRenderer.invoke('collections:load'),

  saveCollections: (data) => ipcRenderer.invoke('collections:save', data),

  onDeviceChange: (callback) => {
    ipcRenderer.on('devices:changed', (_event, devices) => callback(devices));
  },

  onNotification: (callback) => {
    ipcRenderer.on('command:notification', (_event, notification) =>
      callback(notification)
    );
  },

  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection:status', (_event, status) => callback(status));
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('intentPostman', api);
