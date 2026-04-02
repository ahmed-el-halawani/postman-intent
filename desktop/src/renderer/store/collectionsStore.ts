import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Collection,
  CollectionsData,
  SavedRequest,
  SavedResponse,
  IntentRequest,
  JsonRpcResponse,
} from '../../shared/types';

interface CollectionsState {
  collections: Collection[];
  isLoaded: boolean;
  expandedIds: Set<string>;

  // Lifecycle
  loadFromDisk: () => Promise<void>;
  saveToDisk: () => void;

  // Collection CRUD
  createCollection: (name: string) => string;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  duplicateCollection: (id: string) => void;
  exportCollection: (id: string) => void;

  // Request CRUD
  addRequest: (collectionId: string, name: string, request: IntentRequest) => void;
  addBlankRequest: (collectionId: string) => void;
  updateRequest: (collectionId: string, requestId: string, request: IntentRequest) => void;
  renameRequest: (collectionId: string, requestId: string, name: string) => void;
  deleteRequest: (collectionId: string, requestId: string) => void;
  duplicateRequest: (collectionId: string, requestId: string) => void;
  moveRequestReorder: (collectionId: string, fromIndex: number, toIndex: number) => void;
  moveRequestToCollection: (fromCollectionId: string, toCollectionId: string, requestId: string) => void;

  // Saved responses
  saveResponse: (collectionId: string, requestId: string, name: string, request: IntentRequest, response: JsonRpcResponse, responseTime: number | null, activityResult?: Record<string, unknown> | null) => void;
  renameResponse: (collectionId: string, requestId: string, responseId: string, name: string) => void;
  deleteResponse: (collectionId: string, requestId: string, responseId: string) => void;

  // UI
  toggleExpanded: (id: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(state: CollectionsState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data: CollectionsData = {
      version: 1,
      collections: state.collections,
    };
    window.intentPostman.saveCollections(data);
  }, 300);
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

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  isLoaded: false,
  expandedIds: new Set<string>(),

  loadFromDisk: async () => {
    const data = await window.intentPostman.loadCollections();
    // Ensure savedResponses field exists on all loaded requests (migration)
    const collections = data.collections.map((c) => ({
      ...c,
      requests: c.requests.map((r) => ({
        ...r,
        savedResponses: (r.savedResponses || []).map((sr) => ({
          ...sr,
          request: sr.request ?? r.request,
          activityResult: sr.activityResult ?? null,
        })),
      })),
    }));
    set({ collections, isLoaded: true });
  },

  saveToDisk: () => debouncedSave(get()),

  createCollection: (name) => {
    const id = uuidv4();
    const now = Date.now();
    set((state) => ({
      collections: [
        ...state.collections,
        { id, name, requests: [], createdAt: now, updatedAt: now },
      ],
      expandedIds: new Set([...state.expandedIds, id]),
    }));
    debouncedSave(get());
    return id;
  },

  renameCollection: (id, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c
      ),
    }));
    debouncedSave(get());
  },

  deleteCollection: (id) => {
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
    }));
    debouncedSave(get());
  },

  duplicateCollection: (id) => {
    set((state) => {
      const original = state.collections.find((c) => c.id === id);
      if (!original) return state;
      const newId = uuidv4();
      const now = Date.now();
      const copy: Collection = {
        ...original,
        id: newId,
        name: `${original.name} (copy)`,
        createdAt: now,
        updatedAt: now,
        requests: original.requests.map((r) => ({
          ...r,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        })),
      };
      const idx = state.collections.findIndex((c) => c.id === id);
      const collections = [...state.collections];
      collections.splice(idx + 1, 0, copy);
      return {
        collections,
        expandedIds: new Set([...state.expandedIds, newId]),
      };
    });
    debouncedSave(get());
  },

  exportCollection: (id) => {
    const collection = get().collections.find((c) => c.id === id);
    if (!collection) return;
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      name: collection.name,
      requests: collection.requests,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  addRequest: (collectionId, name, request) => {
    const saved: SavedRequest = {
      id: uuidv4(),
      name,
      request: { ...request },
      savedResponses: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, requests: [...c.requests, saved], updatedAt: Date.now() }
          : c
      ),
    }));
    debouncedSave(get());
  },

  addBlankRequest: (collectionId) => {
    const saved: SavedRequest = {
      id: uuidv4(),
      name: 'New Request',
      request: { ...defaultRequest },
      savedResponses: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? { ...c, requests: [...c.requests, saved], updatedAt: Date.now() }
          : c
      ),
    }));
    debouncedSave(get());
  },

  updateRequest: (collectionId, requestId, request) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              updatedAt: Date.now(),
              requests: c.requests.map((r) =>
                r.id === requestId
                  ? { ...r, request: { ...request }, updatedAt: Date.now() }
                  : r
              ),
            }
          : c
      ),
    }));
    debouncedSave(get());
  },

  renameRequest: (collectionId, requestId, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              updatedAt: Date.now(),
              requests: c.requests.map((r) =>
                r.id === requestId ? { ...r, name, updatedAt: Date.now() } : r
              ),
            }
          : c
      ),
    }));
    debouncedSave(get());
  },

  deleteRequest: (collectionId, requestId) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              updatedAt: Date.now(),
              requests: c.requests.filter((r) => r.id !== requestId),
            }
          : c
      ),
    }));
    debouncedSave(get());
  },

  duplicateRequest: (collectionId, requestId) => {
    set((state) => ({
      collections: state.collections.map((c) => {
        if (c.id !== collectionId) return c;
        const original = c.requests.find((r) => r.id === requestId);
        if (!original) return c;
        const copy: SavedRequest = {
          ...original,
          id: uuidv4(),
          name: `${original.name} (copy)`,
          savedResponses: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const idx = c.requests.findIndex((r) => r.id === requestId);
        const requests = [...c.requests];
        requests.splice(idx + 1, 0, copy);
        return { ...c, requests, updatedAt: Date.now() };
      }),
    }));
    debouncedSave(get());
  },

  moveRequestReorder: (collectionId, fromIndex, toIndex) => {
    set((state) => ({
      collections: state.collections.map((c) => {
        if (c.id !== collectionId) return c;
        const requests = [...c.requests];
        const [item] = requests.splice(fromIndex, 1);
        requests.splice(toIndex, 0, item);
        return { ...c, requests, updatedAt: Date.now() };
      }),
    }));
    debouncedSave(get());
  },

  moveRequestToCollection: (fromCollectionId, toCollectionId, requestId) => {
    set((state) => {
      let movedRequest: SavedRequest | null = null;
      const collections = state.collections.map((c) => {
        if (c.id === fromCollectionId) {
          const req = c.requests.find((r) => r.id === requestId);
          if (req) movedRequest = { ...req };
          return {
            ...c,
            updatedAt: Date.now(),
            requests: c.requests.filter((r) => r.id !== requestId),
          };
        }
        return c;
      });
      if (!movedRequest) return state;
      return {
        collections: collections.map((c) =>
          c.id === toCollectionId
            ? { ...c, requests: [...c.requests, movedRequest!], updatedAt: Date.now() }
            : c
        ),
      };
    });
    debouncedSave(get());
  },

  saveResponse: (collectionId, requestId, name, request, response, responseTime, activityResult) => {
    const saved: SavedResponse = {
      id: uuidv4(),
      name,
      request: { ...request },
      response,
      activityResult: activityResult ?? null,
      responseTime,
      savedAt: Date.now(),
    };
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              updatedAt: Date.now(),
              requests: c.requests.map((r) =>
                r.id === requestId
                  ? { ...r, savedResponses: [...r.savedResponses, saved], updatedAt: Date.now() }
                  : r
              ),
            }
          : c
      ),
    }));
    debouncedSave(get());
  },

  renameResponse: (collectionId, requestId, responseId, name) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              updatedAt: Date.now(),
              requests: c.requests.map((r) =>
                r.id === requestId
                  ? {
                      ...r,
                      savedResponses: r.savedResponses.map((sr) =>
                        sr.id === responseId ? { ...sr, name } : sr
                      ),
                      updatedAt: Date.now(),
                    }
                  : r
              ),
            }
          : c
      ),
    }));
    debouncedSave(get());
  },

  deleteResponse: (collectionId, requestId, responseId) => {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              updatedAt: Date.now(),
              requests: c.requests.map((r) =>
                r.id === requestId
                  ? { ...r, savedResponses: r.savedResponses.filter((sr) => sr.id !== responseId), updatedAt: Date.now() }
                  : r
              ),
            }
          : c
      ),
    }));
    debouncedSave(get());
  },

  toggleExpanded: (id) => {
    set((state) => {
      const next = new Set(state.expandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedIds: next };
    });
  },
}));
