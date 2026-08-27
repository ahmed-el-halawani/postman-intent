import { create } from 'zustand';

type PanelOrientation = 'vertical' | 'horizontal';

interface LayoutState {
  panelOrientation: PanelOrientation;
  setPanelOrientation: (mode: PanelOrientation) => void;
  toggle: () => void;
}

const stored = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('panelOrientation') as PanelOrientation | null)
  : null;

export const useLayoutStore = create<LayoutState>((set, get) => ({
  panelOrientation: stored === 'horizontal' ? 'horizontal' : 'vertical',
  setPanelOrientation: (mode) => {
    set({ panelOrientation: mode });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('panelOrientation', mode);
    }
  },
  toggle: () => {
    const next = get().panelOrientation === 'vertical' ? 'horizontal' : 'vertical';
    get().setPanelOrientation(next);
  },
}));