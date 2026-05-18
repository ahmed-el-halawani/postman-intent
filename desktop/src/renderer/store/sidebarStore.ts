import { create } from 'zustand';

interface SidebarState {
  activeTab: 'collections' | 'quick' | 'history' | 'notifications';
  setActiveTab: (tab: SidebarState['activeTab']) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  activeTab: 'collections',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
