import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  IntentRequest,
  IntentExtra,
  JsonRpcResponse,
  HistoryEntry,
} from '../../shared/types';
import { useNotificationStore } from './notificationStore';

interface RequestState {
  // Current request
  request: IntentRequest;
  updateRequest: (partial: Partial<IntentRequest>) => void;
  resetRequest: () => void;
  loadRequest: (request: IntentRequest) => void;

  // Extras helpers
  addExtra: () => void;
  updateExtra: (id: string, partial: Partial<IntentExtra>) => void;
  removeExtra: (id: string) => void;

  // Response
  response: JsonRpcResponse | null;
  responseTime: number | null;
  isSending: boolean;

  // For-result waiting state
  waitingForResult: boolean;
  waitingRequestId: string | null;
  waitingStartTime: number | null;
  cancelWaiting: () => void;

  // Send
  sendRequest: () => Promise<void>;

  // History
  history: HistoryEntry[];
  clearHistory: () => void;
}

const defaultRequest: IntentRequest = {
  intentType: 'activity',
  action: '',
  component: '',
  categories: [],
  data: '',
  mimeType: '',
  flags: [],
  extras: [],
  forResult: false,
};

export const useRequestStore = create<RequestState>((set, get) => ({
  request: { ...defaultRequest },

  updateRequest: (partial) =>
    set((state) => ({ request: { ...state.request, ...partial } })),

  resetRequest: () =>
    set({
      request: { ...defaultRequest },
      response: null,
      responseTime: null,
      waitingForResult: false,
      waitingRequestId: null,
      waitingStartTime: null,
    }),

  loadRequest: (request) =>
    set({ request, response: null, responseTime: null }),

  addExtra: () =>
    set((state) => ({
      request: {
        ...state.request,
        extras: [
          ...state.request.extras,
          { id: uuidv4(), key: '', type: 'string', value: '' },
        ],
      },
    })),

  updateExtra: (id, partial) =>
    set((state) => ({
      request: {
        ...state.request,
        extras: state.request.extras.map((e) =>
          e.id === id ? { ...e, ...partial } : e
        ),
      },
    })),

  removeExtra: (id) =>
    set((state) => ({
      request: {
        ...state.request,
        extras: state.request.extras.filter((e) => e.id !== id),
      },
    })),

  response: null,
  responseTime: null,
  isSending: false,

  waitingForResult: false,
  waitingRequestId: null,
  waitingStartTime: null,

  cancelWaiting: () =>
    set({
      waitingForResult: false,
      waitingRequestId: null,
      waitingStartTime: null,
    }),

  sendRequest: async () => {
    const { request } = get();
    // Clear previous responses (including latestResult from notification store)
    useNotificationStore.getState().clearLatestResult();
    set({
      isSending: true,
      response: null,
      responseTime: null,
      waitingForResult: false,
      waitingRequestId: null,
      waitingStartTime: null,
    });

    const params: Record<string, unknown> = {
      type: request.intentType,
    };
    if (request.action) params.action = request.action;
    if (request.component) params.component = request.component;
    if (request.data) params.data = request.data;
    if (request.mimeType) params.mimeType = request.mimeType;
    if (request.categories.length > 0) params.categories = request.categories;
    if (request.flags.length > 0) params.flags = request.flags;
    if (request.forResult) params.forResult = true;
    if (request.extras.length > 0) {
      params.extras = request.extras
        .filter((e) => e.key)
        .map((e) => ({ key: e.key, type: e.type, value: e.value }));
    }

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('intent.send', params);
    const elapsed = performance.now() - start;

    // If this was a forResult request, enter waiting state
    const isForResult = request.forResult && !response.error;
    const requestId =
      isForResult && response.result && typeof response.result === 'object'
        ? (response.result as Record<string, unknown>).requestId as string
        : null;

    set({
      response,
      responseTime: Math.round(elapsed),
      isSending: false,
      waitingForResult: isForResult,
      waitingRequestId: requestId,
      waitingStartTime: isForResult ? Date.now() : null,
    });

    // Add to history
    set((state) => ({
      history: [
        {
          id: uuidv4(),
          timestamp: Date.now(),
          request: { ...request },
          response,
          responseTime: Math.round(elapsed),
        },
        ...state.history,
      ].slice(0, 500),
    }));
  },

  history: [],
  clearHistory: () => set({ history: [] }),
}));
