import { create } from 'zustand';
import type {
  JsonRpcResponse,
  AidlDefinition,
  AidlSdkConfig,
  AidlCompileResult,
  AidlLoadedInterface,
  AidlBinding,
} from '../../shared/types';
import { useTabStore } from './tabStore';

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

  // AIDL state
  sdkConfig: AidlSdkConfig | null;
  loadedInterfaces: AidlLoadedInterface[];
  aidlBindings: AidlBinding[];
  isCompiling: boolean;
  compileResult: AidlCompileResult | null;

  // Actions
  startService: (component: string, action?: string, pkg?: string) => Promise<void>;
  stopService: (component: string, action?: string, pkg?: string) => Promise<void>;
  bindService: (component: string, bindingId?: string) => Promise<void>;
  unbindService: (bindingId: string) => Promise<void>;
  callMethod: (bindingId: string, method: string, args?: unknown[]) => Promise<void>;
  sendMessage: (bindingId: string, what: number, arg1?: number, arg2?: number, data?: Record<string, unknown>) => Promise<void>;
  refreshBindings: () => Promise<void>;

  // AIDL actions
  loadSdkConfig: () => Promise<void>;
  saveSdkConfig: (config: AidlSdkConfig) => Promise<void>;
  compileAndPush: (definition: AidlDefinition) => Promise<AidlCompileResult | null>;
  loadInterface: (jarRemotePath: string, packageName: string, interfaceName: string) => Promise<void>;
  bindAidlService: (interfaceId: string, component: string) => Promise<void>;
  callAidlMethod: (bindingId: string, method: string, args?: unknown[]) => Promise<void>;
  unbindAidlService: (bindingId: string) => Promise<void>;
  unloadInterface: (interfaceId: string) => Promise<void>;

  // Notification handlers
  handleServiceConnected: (params: Record<string, unknown>) => void;
  handleServiceDisconnected: (params: Record<string, unknown>) => void;
  handleServiceMessage: (params: Record<string, unknown>) => void;
  handleAidlConnected: (params: Record<string, unknown>) => void;
  handleAidlDisconnected: (params: Record<string, unknown>) => void;

  addMessage: (msg: ServiceMessage) => void;
  clearMessages: () => void;
}

export const useServiceStore = create<ServiceState>((set, get) => ({
  bindings: [],
  messages: [],
  isOperating: false,
  lastResponse: null,
  lastResponseTime: null,

  // AIDL initial state
  sdkConfig: null,
  loadedInterfaces: [],
  aidlBindings: [],
  isCompiling: false,
  compileResult: null,

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

  // ── AIDL Actions ──────────────────────────────────────────

  loadSdkConfig: async () => {
    try {
      const config = await window.intentPostman.loadAidlConfig();
      set({ sdkConfig: config });
    } catch (e) {
      console.error('Failed to load AIDL SDK config:', e);
    }
  },

  saveSdkConfig: async (config) => {
    try {
      await window.intentPostman.saveAidlConfig(config);
      set({ sdkConfig: config });
    } catch (e) {
      console.error('Failed to save AIDL SDK config:', e);
    }
  },

  compileAndPush: async (definition) => {
    const { sdkConfig } = get();
    if (!sdkConfig) return null;

    set({ isCompiling: true, compileResult: null });
    try {
      const compileResult = await window.intentPostman.compileAidl(definition, sdkConfig);
      if (!compileResult.success) {
        set({ isCompiling: false, compileResult });
        return compileResult;
      }

      // Push to device
      const { remotePath } = await window.intentPostman.pushAidlJar(compileResult.jarPath!);
      const finalResult: AidlCompileResult = { ...compileResult, remotePath };
      set({ isCompiling: false, compileResult: finalResult });
      return finalResult;
    } catch (e) {
      const errorResult: AidlCompileResult = { success: false, error: String(e), stage: 'push' };
      set({ isCompiling: false, compileResult: errorResult });
      return errorResult;
    }
  },

  loadInterface: async (jarRemotePath, packageName, interfaceName) => {
    const start = performance.now();
    const response = await window.intentPostman.sendCommand('aidl.load', {
      jarPath: jarRemotePath,
      packageName,
      interfaceName,
    });
    const elapsed = Math.round(performance.now() - start);

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      const methods = (result.methods as Array<{ name: string; returnType: string; paramTypes: string[] }>) || [];
      set((state) => ({
        loadedInterfaces: [
          ...state.loadedInterfaces,
          {
            interfaceId: result.interfaceId as string,
            packageName,
            interfaceName,
            methods,
            jarRemotePath,
          },
        ],
      }));
    }

    useTabStore.getState().setActiveTabResponse(response, elapsed);
  },

  bindAidlService: async (interfaceId, component) => {
    const start = performance.now();
    const response = await window.intentPostman.sendCommand('aidl.bind', {
      interfaceId,
      component,
    });
    const elapsed = Math.round(performance.now() - start);

    if (response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      set((state) => ({
        aidlBindings: [
          ...state.aidlBindings,
          {
            bindingId: result.bindingId as string,
            interfaceId,
            component,
            connected: false,
            proxyClass: 'pending',
            methods: [],
          },
        ],
      }));
    }

    useTabStore.getState().setActiveTabResponse(response, elapsed);
  },

  callAidlMethod: async (bindingId, method, args) => {
    const params: Record<string, unknown> = { bindingId, method };
    if (args) params.args = args;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('aidl.call', params);
    const elapsed = Math.round(performance.now() - start);

    useTabStore.getState().setActiveTabResponse(response, elapsed);

    get().addMessage({
      type: 'call_result',
      bindingId,
      timestamp: Date.now(),
      data: { method, result: response.result, error: response.error },
    });
  },

  unbindAidlService: async (bindingId) => {
    const response = await window.intentPostman.sendCommand('aidl.unbind', { bindingId });
    if (!response.error) {
      set((state) => ({
        aidlBindings: state.aidlBindings.filter((b) => b.bindingId !== bindingId),
      }));
    }
  },

  unloadInterface: async (interfaceId) => {
    const response = await window.intentPostman.sendCommand('aidl.unload', { interfaceId });
    if (!response.error) {
      set((state) => ({
        loadedInterfaces: state.loadedInterfaces.filter((i) => i.interfaceId !== interfaceId),
        aidlBindings: state.aidlBindings.filter((b) => b.interfaceId !== interfaceId),
      }));
    }
  },

  // ── AIDL Notification handlers ────────────────────────────

  handleAidlConnected: (params) => {
    const bindingId = params.bindingId as string;
    const methods = params.methods as Array<{ name: string; returnType: string; paramTypes: string[] }> | undefined;
    const proxyClass = (params.proxyClass as string) || 'unknown';

    set((state) => ({
      aidlBindings: state.aidlBindings.map((b) =>
        b.bindingId === bindingId
          ? { ...b, connected: true, proxyClass, methods: methods || b.methods }
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

  handleAidlDisconnected: (params) => {
    const bindingId = params.bindingId as string;
    set((state) => ({
      aidlBindings: state.aidlBindings.map((b) =>
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

  addMessage: (msg) =>
    set((state) => ({
      messages: [msg, ...state.messages].slice(0, 500),
    })),

  clearMessages: () => set({ messages: [] }),
}));
