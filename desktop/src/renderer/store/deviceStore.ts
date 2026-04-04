import { create } from 'zustand';
import type { Device, ConnectionStatus } from '../../shared/types';

interface DeviceState {
  devices: Device[];
  selectedSerial: string;
  connectionStatus: ConnectionStatus;
  needsInstall: boolean;

  setDevices: (devices: Device[]) => void;
  setSelectedSerial: (serial: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;

  refreshDevices: () => Promise<void>;
  connect: (serial?: string) => Promise<{ success: boolean; error?: string }>;
  installAndConnect: () => Promise<{ success: boolean; error?: string }>;
  dismissInstall: () => void;
  disconnect: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedSerial: '',
  connectionStatus: 'disconnected',
  needsInstall: false,

  setDevices: (devices) => {
    const { connectionStatus, selectedSerial } = get();
    set({ devices });

    // Auto-select first online device
    const onlineDevice = devices.find((d) => d.type === 'device');
    if (onlineDevice && !selectedSerial) {
      set({ selectedSerial: onlineDevice.id });
    }

    // Auto-connect when device detected and not already connected/connecting
    if (onlineDevice && connectionStatus === 'disconnected') {
      get().connect(onlineDevice.id);
    }
  },

  setSelectedSerial: (serial) => {
    const { selectedSerial, connectionStatus } = get();
    if (serial === selectedSerial) return;
    set({ selectedSerial: serial });

    // If currently connected, disconnect and reconnect to new device
    if (connectionStatus === 'connected') {
      window.intentPostman.disconnectDevice().then(() => {
        get().connect(serial);
      });
    } else if (connectionStatus === 'disconnected') {
      get().connect(serial);
    }
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  refreshDevices: async () => {
    const devices = await window.intentPostman.listDevices();
    get().setDevices(devices);
  },

  connect: async (serial) => {
    const selectedSerial = serial || get().selectedSerial;
    if (!selectedSerial) return { success: false, error: 'No device selected' };
    set({ needsInstall: false });
    const result = await window.intentPostman.connectDevice(selectedSerial);
    if (result.needsInstall) {
      set({ needsInstall: true });
    }
    return result;
  },

  disconnect: async () => {
    set({ needsInstall: false });
    await window.intentPostman.disconnectDevice();
  },

  installAndConnect: async () => {
    const { selectedSerial } = get();
    if (!selectedSerial) return { success: false, error: 'No device selected' };
    set({ needsInstall: false });
    return await window.intentPostman.installAndConnectDevice(selectedSerial);
  },

  dismissInstall: () => {
    set({ needsInstall: false, connectionStatus: 'disconnected' });
  },
}));
