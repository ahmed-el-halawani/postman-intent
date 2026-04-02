import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  IntentRequest,
  IntentExtra,
  JsonRpcResponse,
  RequestTab,
  HistoryEntry,
} from '../../shared/types';
import { useNotificationStore } from './notificationStore';
import { useCollectionsStore } from './collectionsStore';

interface TabState {
  tabs: RequestTab[];
  activeTabId: string;
  history: HistoryEntry[];

  // Tab management
  createTab: (name?: string, request?: IntentRequest, savedRef?: { collectionId: string; requestId: string }) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;

  // Active tab helpers
  getActiveTab: () => RequestTab | undefined;
  updateRequest: (partial: Partial<IntentRequest>) => void;
  resetRequest: () => void;

  // Extras helpers
  addExtra: () => void;
  updateExtra: (id: string, partial: Partial<IntentExtra>) => void;
  removeExtra: (id: string) => void;

  // Per-tab operations
  sendRequest: () => Promise<void>;
  cancelWaiting: () => void;

  // Save
  saveTab: (tabId?: string) => void;
  showSaveDialog: boolean;
  setShowSaveDialog: (show: boolean) => void;

  // History
  clearHistory: () => void;

  // Load from collection/history
  loadRequest: (request: IntentRequest) => void;
  openSavedRequest: (collectionId: string, requestId: string, name: string, request: IntentRequest) => void;
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

function createNewTab(name?: string, request?: IntentRequest, savedRef?: { collectionId: string; requestId: string }): RequestTab {
  return {
    id: uuidv4(),
    name: name || 'Untitled',
    request: request ? { ...request } : { ...defaultRequest },
    savedRequestRef: savedRef || null,
    isDirty: false,
    response: null,
    responseTime: null,
    isSending: false,
    waitingForResult: false,
    waitingRequestId: null,
    waitingStartTime: null,
  };
}

const initialTab = createNewTab();

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  history: [],
  showSaveDialog: false,

  createTab: (name, request, savedRef) => {
    const tab = createNewTab(name, request, savedRef);
    set((state) => {
      // Insert after active tab
      const activeIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
      const tabs = [...state.tabs];
      tabs.splice(activeIndex + 1, 0, tab);
      return { tabs, activeTabId: tab.id };
    });
    return tab.id;
  },

  renameTab: (id, name) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
    }));
  },

  closeTab: (id) => {
    set((state) => {
      const remaining = state.tabs.filter((t) => t.id !== id);
      // Always keep at least one tab
      if (remaining.length === 0) {
        const newTab = createNewTab();
        return { tabs: [newTab], activeTabId: newTab.id };
      }
      // If closing the active tab, switch to the nearest tab
      let activeTabId = state.activeTabId;
      if (activeTabId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        const newIndex = Math.min(closedIndex, remaining.length - 1);
        activeTabId = remaining[newIndex].id;
      }
      return { tabs: remaining, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },

  updateRequest: (partial) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? {
              ...t,
              request: { ...t.request, ...partial },
              isDirty: true,
              name: t.savedRequestRef
                ? t.name
                : partial.action || partial.component || t.name,
            }
          : t
      ),
    }));
  },

  resetRequest: () => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? {
              ...t,
              request: { ...defaultRequest },
              isDirty: false,
              response: null,
              responseTime: null,
              waitingForResult: false,
              waitingRequestId: null,
              waitingStartTime: null,
              name: 'Untitled',
              savedRequestRef: null,
            }
          : t
      ),
    }));
  },

  addExtra: () => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? {
              ...t,
              isDirty: true,
              request: {
                ...t.request,
                extras: [
                  ...t.request.extras,
                  { id: uuidv4(), key: '', type: 'string' as const, value: '' },
                ],
              },
            }
          : t
      ),
    }));
  },

  updateExtra: (id, partial) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? {
              ...t,
              isDirty: true,
              request: {
                ...t.request,
                extras: t.request.extras.map((e) =>
                  e.id === id ? { ...e, ...partial } : e
                ),
              },
            }
          : t
      ),
    }));
  },

  removeExtra: (id) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? {
              ...t,
              isDirty: true,
              request: {
                ...t.request,
                extras: t.request.extras.filter((e) => e.id !== id),
              },
            }
          : t
      ),
    }));
  },

  sendRequest: async () => {
    const { activeTabId } = get();
    const tab = get().getActiveTab();
    if (!tab) return;

    const { request } = tab;

    // Clear previous results
    useNotificationStore.getState().clearLatestResult();

    // Mark sending
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              isSending: true,
              response: null,
              responseTime: null,
              waitingForResult: false,
              waitingRequestId: null,
              waitingStartTime: null,
            }
          : t
      ),
    }));

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

    const isForResult = request.forResult && !response.error;
    const requestId =
      isForResult && response.result && typeof response.result === 'object'
        ? (response.result as Record<string, unknown>).requestId as string
        : null;

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              response,
              responseTime: Math.round(elapsed),
              isSending: false,
              waitingForResult: isForResult,
              waitingRequestId: requestId,
              waitingStartTime: isForResult ? Date.now() : null,
            }
          : t
      ),
    }));

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

  cancelWaiting: () => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.waitingForResult
          ? {
              ...t,
              waitingForResult: false,
              waitingRequestId: null,
              waitingStartTime: null,
            }
          : t
      ),
    }));
  },

  saveTab: (tabId) => {
    const id = tabId || get().activeTabId;
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;

    if (tab.savedRequestRef) {
      // Update existing saved request in collection
      useCollectionsStore
        .getState()
        .updateRequest(tab.savedRequestRef.collectionId, tab.savedRequestRef.requestId, tab.request);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === id ? { ...t, isDirty: false } : t
        ),
      }));
    } else {
      // Open save dialog
      set({ showSaveDialog: true });
    }
  },

  setShowSaveDialog: (show) => set({ showSaveDialog: show }),

  clearHistory: () => set({ history: [] }),

  loadRequest: (request) => {
    // Open in a new tab
    get().createTab(request.action || request.component || 'Untitled', request);
  },

  openSavedRequest: (collectionId, requestId, name, request) => {
    // Check if already open
    const existing = get().tabs.find(
      (t) =>
        t.savedRequestRef?.collectionId === collectionId &&
        t.savedRequestRef?.requestId === requestId
    );
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    get().createTab(name, request, { collectionId, requestId });
  },
}));
