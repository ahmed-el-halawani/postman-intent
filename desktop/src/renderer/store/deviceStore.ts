import { create } from 'zustand';
import type { Device, ConnectionStatus } from '../../shared/types';

interface DeviceState {
  devices: Device[];
  selectedSerial: string;
  connectionStatus: ConnectionStatus;

  setDevices: (devices: Device[]) => void;
  setSelectedSerial: (serial: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;

  refreshDevices: () => Promise<void>;
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedSerial: '',
  connectionStatus: 'disconnected',

  setDevices: (devices) => {
    set({ devices });
    if (devices.length > 0 && !get().selectedSerial) {
      set({ selectedSerial: devices[0].id });
    }
  },

  setSelectedSerial: (serial) => set({ selectedSerial: serial }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  refreshDevices: async () => {
    const devices = await window.intentPostman.listDevices();
    get().setDevices(devices);
  },

  connect: async () => {
    const { selectedSerial } = get();
    if (!selectedSerial) return { success: false, error: 'No device selected' };
    const result = await window.intentPostman.connectDevice(selectedSerial);
    return result;
  },

  disconnect: async () => {
    await window.intentPostman.disconnectDevice();
  },
}));
