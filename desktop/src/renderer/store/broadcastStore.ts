import { create } from 'zustand';
import type { JsonRpcResponse } from '../../shared/types';

export interface BroadcastListener {
  listenerId: string;
  action: string;
  startedAt: number;
  eventCount: number;
}

export interface BroadcastEvent {
  listenerId: string;
  action: string;
  timestamp: string;
  extras?: Record<string, unknown>;
  dataUri?: string;
  mimeType?: string;
}

interface BroadcastState {
  // Listeners
  listeners: BroadcastListener[];
  events: BroadcastEvent[];

  // Send broadcast state
  isSending: boolean;
  lastResponse: JsonRpcResponse | null;
  lastResponseTime: number | null;

  // Actions
  sendBroadcast: (action: string, pkg?: string, extras?: Array<{ key: string; value: string }>) => Promise<void>;
  startListener: (action: string, listenerId?: string) => Promise<void>;
  stopListener: (listenerId: string) => Promise<void>;
  stopAllListeners: () => Promise<void>;
  refreshListeners: () => Promise<void>;
  addEvent: (event: BroadcastEvent) => void;
  clearEvents: () => void;
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  listeners: [],
  events: [],
  isSending: false,
  lastResponse: null,
  lastResponseTime: null,

  sendBroadcast: async (action, pkg, extras) => {
    set({ isSending: true, lastResponse: null, lastResponseTime: null });
    const params: Record<string, unknown> = { action };
    if (pkg) params.package = pkg;
    if (extras && extras.length > 0) params.extras = extras;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('broadcast.send', params);
    const elapsed = performance.now() - start;

    set({
      isSending: false,
      lastResponse: response,
      lastResponseTime: Math.round(elapsed),
    });
  },

  startListener: async (action, listenerId) => {
    const params: Record<string, unknown> = { action };
    if (listenerId) params.listenerId = listenerId;

    const response = await window.intentPostman.sendCommand('broadcast.listen', params);
    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      set((state) => ({
        listeners: [
          ...state.listeners.filter((l) => l.listenerId !== result.listenerId),
          {
            listenerId: result.listenerId as string,
            action,
            startedAt: Date.now(),
            eventCount: 0,
          },
        ],
      }));
    }
  },

  stopListener: async (listenerId) => {
    await window.intentPostman.sendCommand('broadcast.unlisten', { listenerId });
    set((state) => ({
      listeners: state.listeners.filter((l) => l.listenerId !== listenerId),
    }));
  },

  stopAllListeners: async () => {
    await window.intentPostman.sendCommand('broadcast.unlistenAll', {});
    set({ listeners: [] });
  },

  refreshListeners: async () => {
    const response = await window.intentPostman.sendCommand('broadcast.listListeners', {});
    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      const bindings = result.listeners as Array<{ listenerId: string }>;
      // Merge with existing data
      set((state) => ({
        listeners: bindings.map((b) => {
          const existing = state.listeners.find((l) => l.listenerId === b.listenerId);
          return existing || {
            listenerId: b.listenerId,
            action: 'unknown',
            startedAt: Date.now(),
            eventCount: 0,
          };
        }),
      }));
    }
  },

  addEvent: (event) =>
    set((state) => {
      const updated = [event, ...state.events].slice(0, 500);
      const listeners = state.listeners.map((l) =>
        l.listenerId === event.listenerId
          ? { ...l, eventCount: l.eventCount + 1 }
          : l
      );
      return { events: updated, listeners };
    }),

  clearEvents: () => set({ events: [] }),
}));
