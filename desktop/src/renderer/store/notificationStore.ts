import { create } from 'zustand';
import type { JsonRpcNotification } from '../../shared/types';
import { useRequestStore } from './requestStore';

interface NotificationState {
  notifications: JsonRpcNotification[];
  latestResult: Record<string, unknown> | null;
  addNotification: (notification: JsonRpcNotification) => void;
  clearLatestResult: () => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  latestResult: null,

  addNotification: (notification) => {
    // First: update our own state
    set((state) => {
      const updated = [notification, ...state.notifications].slice(0, 200);

      if (notification.method === 'intent.result') {
        const resultParams = notification.params as Record<string, unknown> | undefined;
        return {
          notifications: updated,
          latestResult: resultParams ?? null,
        };
      }

      return { notifications: updated };
    });

    // Then: clear waiting state in request store (outside of set callback)
    if (notification.method === 'intent.result') {
      setTimeout(() => {
        const requestStore = useRequestStore.getState();
        if (requestStore.waitingForResult) {
          requestStore.cancelWaiting();
        }
      }, 0);
    }
  },

  clearLatestResult: () => set({ latestResult: null }),
  clearNotifications: () => set({ notifications: [], latestResult: null }),
}));
