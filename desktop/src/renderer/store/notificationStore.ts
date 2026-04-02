import { create } from 'zustand';
import type { JsonRpcNotification } from '../../shared/types';

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
    // NOTE: waiting state cancellation is handled in App.tsx onNotification handler
  },

  clearLatestResult: () => set({ latestResult: null }),
  clearNotifications: () => set({ notifications: [], latestResult: null }),
}));
