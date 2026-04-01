import { create } from 'zustand';
import type { JsonRpcResponse } from '../../shared/types';

export interface ServiceBinding {
  bindingId: string;
  component: string;
  connected: boolean;
  binderClass: string;
  methods?: Array<{
    name: string;
    returnType: string;
    paramTypes: string[];
  }>;
}

export interface ServiceMessage {
  type: 'connected' | 'disconnected' | 'message' | 'call_result' | 'error';
  bindingId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface ServiceState {
  // Bindings
  bindings: ServiceBinding[];
  messages: ServiceMessage[];

  // Operation state
  isOperating: boolean;
  lastResponse: JsonRpcResponse | null;
  lastResponseTime: number | null;

  // Actions
  startService: (component: string, action?: string, pkg?: string) => Promise<void>;
  stopService: (component: string, action?: string, pkg?: string) => Promise<void>;
  bindService: (component: string, bindingId?: string) => Promise<void>;
  unbindService: (bindingId: string) => Promise<void>;
  callMethod: (bindingId: string, method: string, args?: unknown[]) => Promise<void>;
  sendMessage: (bindingId: string, what: number, arg1?: number, arg2?: number, data?: Record<string, unknown>) => Promise<void>;
  refreshBindings: () => Promise<void>;

  // Notification handlers
  handleServiceConnected: (params: Record<string, unknown>) => void;
  handleServiceDisconnected: (params: Record<string, unknown>) => void;
  handleServiceMessage: (params: Record<string, unknown>) => void;

  addMessage: (msg: ServiceMessage) => void;
  clearMessages: () => void;
}

export const useServiceStore = create<ServiceState>((set, get) => ({
  bindings: [],
  messages: [],
  isOperating: false,
  lastResponse: null,
  lastResponseTime: null,

  startService: async (component, action, pkg) => {
    set({ isOperating: true, lastResponse: null, lastResponseTime: null });
    const params: Record<string, unknown> = { component };
    if (action) params.action = action;
    if (pkg) params.package = pkg;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('service.start', params);
    const elapsed = performance.now() - start;

    set({ isOperating: false, lastResponse: response, lastResponseTime: Math.round(elapsed) });
  },

  stopService: async (component, action, pkg) => {
    set({ isOperating: true, lastResponse: null, lastResponseTime: null });
    const params: Record<string, unknown> = { component };
    if (action) params.action = action;
    if (pkg) params.package = pkg;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('service.stop', params);
    const elapsed = performance.now() - start;

    set({ isOperating: false, lastResponse: response, lastResponseTime: Math.round(elapsed) });
  },

  bindService: async (component, bindingId) => {
    set({ isOperating: true, lastResponse: null, lastResponseTime: null });
    const params: Record<string, unknown> = { component };
    if (bindingId) params.bindingId = bindingId;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('service.bind', params);
    const elapsed = performance.now() - start;

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      set((state) => ({
        bindings: [
          ...state.bindings.filter((b) => b.bindingId !== result.bindingId),
          {
            bindingId: result.bindingId as string,
            component,
            connected: false,
            binderClass: 'pending',
          },
        ],
      }));
    }

    set({ isOperating: false, lastResponse: response, lastResponseTime: Math.round(elapsed) });
  },

  unbindService: async (bindingId) => {
    const response = await window.intentPostman.sendCommand('service.unbind', { bindingId });
    if (!response.error) {
      set((state) => ({
        bindings: state.bindings.filter((b) => b.bindingId !== bindingId),
      }));
    }
  },

  callMethod: async (bindingId, method, args) => {
    set({ isOperating: true, lastResponse: null, lastResponseTime: null });
    const params: Record<string, unknown> = { bindingId, method };
    if (args) params.args = args;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('service.call', params);
    const elapsed = performance.now() - start;

    set({ isOperating: false, lastResponse: response, lastResponseTime: Math.round(elapsed) });

    get().addMessage({
      type: 'call_result',
      bindingId,
      timestamp: Date.now(),
      data: {
        method,
        result: response.result,
        error: response.error,
      },
    });
  },

  sendMessage: async (bindingId, what, arg1, arg2, data) => {
    set({ isOperating: true, lastResponse: null, lastResponseTime: null });
    const params: Record<string, unknown> = { bindingId, what };
    if (arg1 !== undefined) params.arg1 = arg1;
    if (arg2 !== undefined) params.arg2 = arg2;
    if (data) params.data = data;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('service.sendMessage', params);
    const elapsed = performance.now() - start;

    set({ isOperating: false, lastResponse: response, lastResponseTime: Math.round(elapsed) });
  },

  refreshBindings: async () => {
    const response = await window.intentPostman.sendCommand('service.listBindings', {});
    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      const bindings = result.bindings as Array<Record<string, unknown>>;
      set({
        bindings: bindings.map((b) => ({
          bindingId: b.bindingId as string,
          component: b.component as string,
          connected: b.connected as boolean,
          binderClass: b.binderClass as string,
        })),
      });
    }
  },

  handleServiceConnected: (params) => {
    const bindingId = params.bindingId as string;
    const methods = params.methods as Array<{ name: string; returnType: string; paramTypes: string[] }> | undefined;

    set((state) => ({
      bindings: state.bindings.map((b) =>
        b.bindingId === bindingId
          ? {
              ...b,
              connected: true,
              binderClass: (params.binderClass as string) || b.binderClass,
              methods: methods || b.methods,
            }
          : b
      ),
    }));

    get().addMessage({
      type: 'connected',
      bindingId,
      timestamp: Date.now(),
      data: params,
    });
  },

  handleServiceDisconnected: (params) => {
    const bindingId = params.bindingId as string;
    set((state) => ({
      bindings: state.bindings.map((b) =>
        b.bindingId === bindingId ? { ...b, connected: false } : b
      ),
    }));

    get().addMessage({
      type: 'disconnected',
      bindingId,
      timestamp: Date.now(),
      data: params,
    });
  },

  handleServiceMessage: (params) => {
    get().addMessage({
      type: 'message',
      bindingId: params.bindingId as string,
      timestamp: Date.now(),
      data: params,
    });
  },

  addMessage: (msg) =>
    set((state) => ({
      messages: [msg, ...state.messages].slice(0, 500),
    })),

  clearMessages: () => set({ messages: [] }),
}));
