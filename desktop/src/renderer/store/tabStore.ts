import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  IntentRequest,
  IntentExtra,
  JsonRpcResponse,
  RequestTab,
  HistoryEntry,
  SavedResponse,
} from '../../shared/types';
import { useNotificationStore } from './notificationStore';
import { useCollectionsStore } from './collectionsStore';
import { useSidebarStore } from './sidebarStore';

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
  addExtra: (parentId?: string) => void;
  updateExtra: (id: string, partial: Partial<IntentExtra>) => void;
  removeExtra: (id: string) => void;

  // Per-tab operations
  sendRequest: () => Promise<void>;
  setActiveTabResponse: (response: JsonRpcResponse, responseTime: number) => void;
  setActiveTabSending: (isSending: boolean) => void;
  cancelWaiting: () => void;
  setActivityResult: (requestId: string, result: Record<string, unknown>) => void;

  // Save
  saveTab: (tabId?: string) => void;
  showSaveDialog: boolean;
  setShowSaveDialog: (show: boolean) => void;

  // Unsaved changes dialog
  pendingCloseTabId: string | null;
  showUnsavedDialog: boolean;
  setShowUnsavedDialog: (show: boolean) => void;
  requestCloseTab: (id: string) => void;
  confirmDiscardClose: () => void;
  saveAndCloseTab: () => void;

  // History
  clearHistory: () => void;

  // Load from collection/history
  loadRequest: (request: IntentRequest) => void;
  openSavedRequest: (collectionId: string, requestId: string, name: string, request: IntentRequest) => void;
  openSavedResponseTab: (savedResponse: SavedResponse) => void;
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
  descriptions: {},
};

function makeExtra(partial?: Partial<IntentExtra>): IntentExtra {
  return { id: uuidv4(), key: '', type: 'string', value: '', enabled: true, subExtras: [], ...partial };
}

function migrateExtra(e: any): IntentExtra {
  return {
    id: e.id || uuidv4(),
    key: e.key || '',
    type: e.type || 'string',
    value: e.value || '',
    enabled: e.enabled ?? true,
    subExtras: (e.subExtras || []).map(migrateExtra),
  };
}

function migrateExtras(extras: any[]): IntentExtra[] {
  return (extras || []).map(migrateExtra);
}

function serializeExtras(extras: IntentExtra[]) {
  return extras
    .filter((e) => e.enabled && e.key)
    .map((e) => {
      const o: Record<string, unknown> = { key: e.key, type: e.type, value: e.value };
      if (e.type === 'bundle') o.subExtras = serializeExtras(e.subExtras);
      return o;
    });
}

function updateExtraRecursive(extras: IntentExtra[], id: string, partial: Partial<IntentExtra>): IntentExtra[] {
  return extras.map((e) => {
    if (e.id === id) return { ...e, ...partial };
    if (e.subExtras.length > 0) return { ...e, subExtras: updateExtraRecursive(e.subExtras, id, partial) };
    return e;
  });
}

function removeExtraRecursive(extras: IntentExtra[], id: string): IntentExtra[] {
  return extras
    .filter((e) => e.id !== id)
    .map((e) => e.subExtras.length > 0 ? { ...e, subExtras: removeExtraRecursive(e.subExtras, id) } : e);
}

function addSubExtraRecursive(extras: IntentExtra[], parentId: string, newExtra: IntentExtra): IntentExtra[] {
  return extras.map((e) => {
    if (e.id === parentId) return { ...e, subExtras: [...e.subExtras, newExtra] };
    if (e.subExtras.length > 0) return { ...e, subExtras: addSubExtraRecursive(e.subExtras, parentId, newExtra) };
    return e;
  });
}

function createNewTab(name?: string, request?: IntentRequest, savedRef?: { collectionId: string; requestId: string }): RequestTab {
  return {
    id: uuidv4(),
    name: name || 'Untitled',
    request: request ? { ...request, extras: migrateExtras(request.extras as any) } : { ...defaultRequest },
    savedRequestRef: savedRef || null,
    savedResponseId: null,
    isDirty: false,
    response: null,
    responseTime: null,
    isSending: false,
    waitingForResult: false,
    waitingRequestId: null,
    waitingStartTime: null,
    activityResult: null,
  };
}

const initialTab = createNewTab();

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  history: [],
  showSaveDialog: false,
  pendingCloseTabId: null,
  showUnsavedDialog: false,

  createTab: (name, request, savedRef) => {
    const tab = createNewTab(name, request, savedRef);
    set((state) => {
      // Insert after active tab
      const activeIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
      const tabs = [...state.tabs];
      tabs.splice(activeIndex + 1, 0, tab);
      return { tabs, activeTabId: tab.id };
    });
    useSidebarStore.getState().setActiveTab('collections');
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
              activityResult: null,
              name: 'Untitled',
              savedRequestRef: null,
              savedResponseId: null,
            }
          : t
      ),
    }));
  },

  addExtra: (parentId) => {
    const newExtra = makeExtra();
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? {
              ...t,
              isDirty: true,
              request: {
                ...t.request,
                extras: parentId
                  ? addSubExtraRecursive(t.request.extras, parentId, newExtra)
                  : [...t.request.extras, newExtra],
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
                extras: updateExtraRecursive(t.request.extras, id, partial),
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
                extras: removeExtraRecursive(t.request.extras, id),
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
              activityResult: null,
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
      const serialized = serializeExtras(request.extras);
      if (serialized.length > 0) params.extras = serialized;
    }

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('intent.send', params);
    const elapsed = performance.now() - start;

    const isForResult = request.forResult && !response.error;
    const requestId =
      isForResult && response.result && typeof response.result === 'object'
        ? (response.result as Record<string, unknown>).requestId as string
        : null;

    const alreadyReceived =
      isForResult &&
      requestId != null &&
      useNotificationStore.getState().latestResultRequestId === requestId;

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              response,
              responseTime: Math.round(elapsed),
              isSending: false,
              waitingForResult: isForResult && !alreadyReceived,
              waitingRequestId: requestId,
              waitingStartTime: isForResult && !alreadyReceived ? Date.now() : null,
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

  setActiveTabResponse: (response, responseTime) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? { ...t, response, responseTime, isSending: false }
          : t
      ),
    }));

    // Add to history
    const tab = get().getActiveTab();
    if (tab) {
      set((state) => ({
        history: [
          {
            id: uuidv4(),
            timestamp: Date.now(),
            request: { ...tab.request },
            response,
            responseTime,
          },
          ...state.history,
        ].slice(0, 500),
      }));
    }
  },

  setActiveTabSending: (isSending) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId
          ? { ...t, isSending, ...(isSending ? { response: null, responseTime: null } : {}) }
          : t
      ),
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

  setActivityResult: (requestId: string, result: Record<string, unknown>) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.waitingRequestId === requestId
          ? {
              ...t,
              activityResult: result,
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

    const wasPendingClose = get().pendingCloseTabId === id;

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

      // Auto-close if this was a pending close
      if (wasPendingClose) {
        get().closeTab(id);
        set({ pendingCloseTabId: null, showUnsavedDialog: false });
      }
    } else {
      // Open save dialog — keep pendingCloseTabId so we can close after save
      set({ showSaveDialog: true });
    }
  },

  setShowSaveDialog: (show) => {
    set({ showSaveDialog: show });
    if (!show) {
      const { pendingCloseTabId } = get();
      if (pendingCloseTabId) {
        const tab = get().tabs.find((t) => t.id === pendingCloseTabId);
        if (tab && !tab.isDirty) {
          // Save was successful — close the tab
          get().closeTab(pendingCloseTabId);
        }
        // Either saved+closed or cancelled — clear pending state
        set({ pendingCloseTabId: null, showUnsavedDialog: false });
      }
    }
  },

  // Unsaved changes dialog handlers
  requestCloseTab: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (tab?.isDirty) {
      set({ pendingCloseTabId: id, showUnsavedDialog: true });
    } else {
      get().closeTab(id);
    }
  },

  confirmDiscardClose: () => {
    const { pendingCloseTabId } = get();
    if (pendingCloseTabId) {
      get().closeTab(pendingCloseTabId);
    }
    set({ pendingCloseTabId: null, showUnsavedDialog: false });
  },

  saveAndCloseTab: () => {
    const { pendingCloseTabId } = get();
    if (pendingCloseTabId) {
      get().saveTab(pendingCloseTabId);
      // If saveTab opened the save dialog (no savedRequestRef), pendingCloseTabId
      // stays set so the tab closes after the user completes the save.
      // If saveTab saved directly, it already closed the tab and cleared state.
    }
  },

  setShowUnsavedDialog: (show) => {
    if (!show) {
      set({ pendingCloseTabId: null, showUnsavedDialog: false });
    }
  },

  clearHistory: () => set({ history: [] }),

  loadRequest: (request) => {
    // Open in a new tab
    get().createTab(request.action || request.component || 'Untitled', request);
    useSidebarStore.getState().setActiveTab('collections');
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
      useSidebarStore.getState().setActiveTab('collections');
      return;
    }
    get().createTab(name, request, { collectionId, requestId });
  },

  openSavedResponseTab: (savedResponse) => {
    // Check if this saved response is already open in a tab
    const existing = get().tabs.find((t) => t.savedResponseId === savedResponse.id);
    if (existing) {
      set({ activeTabId: existing.id });
      useSidebarStore.getState().setActiveTab('collections');
      return;
    }

    // Create a new tab pre-populated with the saved request snapshot + response
    const tab: RequestTab = {
      id: uuidv4(),
      name: `${savedResponse.name}`,
      request: { ...savedResponse.request, extras: migrateExtras(savedResponse.request.extras as any) },
      savedRequestRef: null,
      savedResponseId: savedResponse.id,
      isDirty: false,
      response: savedResponse.response,
      responseTime: savedResponse.responseTime,
      isSending: false,
      waitingForResult: false,
      waitingRequestId: null,
      waitingStartTime: null,
      activityResult: savedResponse.activityResult,
    };
    set((state) => {
      const activeIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
      const tabs = [...state.tabs];
      tabs.splice(activeIndex + 1, 0, tab);
      return { tabs, activeTabId: tab.id };
    });
    useSidebarStore.getState().setActiveTab('collections');
  },
}));
