import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const getInitialTheme = (): ThemeMode => {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.dataset.theme = next;
      return { mode: next };
    }),
  setTheme: (mode) => {
    localStorage.setItem('theme', mode);
    document.documentElement.dataset.theme = mode;
    set({ mode });
  },
}));

// Set initial data-theme attribute
document.documentElement.dataset.theme = getInitialTheme();
