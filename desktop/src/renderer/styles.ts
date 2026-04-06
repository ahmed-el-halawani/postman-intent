import type { CSSProperties } from 'react';
import { useThemeStore } from './store/themeStore';

// ── Color Palettes ──────────────────────────────────────────

const lightPalette = {
  // Main area
  bg: '#f8f9fa',
  surface: '#ffffff',
  surfaceLight: '#f3f4f5',
  border: '#e2e8f0',
  borderLight: '#edeeef',

  // Accent
  accent: '#ac3500',
  accentHover: '#9a2f00',
  accentOrange: '#ea580c',

  // Text
  text: '#0f172a',
  textSecondary: '#334155',
  textDim: '#64748b',
  textMuted: '#94a3b8',

  // Status
  success: '#16a34a',
  successLight: '#d1fae5',
  successDark: '#047857',
  warning: '#f59e0b',
  error: '#dc2626',

  // Code
  codeBg: '#f8f9fa',
  codeKey: '#005bbe',
  codeString: '#059669',
  codeNumber: '#0369a1',
  codeBool: '#dc2626',

  white: '#ffffff',

  // Sidebar
  sidebarBg: '#f0f0f3',
  sidebarBorder: '#dcdce0',
  sidebarSurface: '#e6e6ea',
  sidebarText: '#1a1a2e',
  sidebarTextDim: '#64748b',
  sidebarActive: '#e0e0e4',
  sidebarButton: '#d4d4d8',
  iconActive: '#ea580c',

  // Intent types
  intentActivity: '#f59e0b',
  intentBroadcast: '#2563eb',
  intentService: '#ea580c',
};

const darkPalette = {
  // Main area
  bg: '#1a1a1a',
  surface: '#242424',
  surfaceLight: '#2a2a2a',
  border: '#3a3a3a',
  borderLight: '#333333',

  // Accent
  accent: '#ea580c',
  accentHover: '#dc4c04',
  accentOrange: '#f97316',

  // Text
  text: '#e4e4e7',
  textSecondary: '#b0b0b8',
  textDim: '#888892',
  textMuted: '#5a5a64',

  // Status
  success: '#22c55e',
  successLight: '#052e16',
  successDark: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',

  // Code
  codeBg: '#1e1e1e',
  codeKey: '#569cd6',
  codeString: '#6a9955',
  codeNumber: '#4fc1ff',
  codeBool: '#f44747',

  white: '#ffffff',

  // Sidebar
  sidebarBg: '#121212',
  sidebarBorder: '#2a2a2a',
  sidebarSurface: '#1e1e1e',
  sidebarText: '#e0e0e0',
  sidebarTextDim: '#94a3b8',
  sidebarActive: '#262626',
  sidebarButton: '#333333',
  iconActive: '#fbbf24',

  // Intent types
  intentActivity: '#fbbf24',
  intentBroadcast: '#60a5fa',
  intentService: '#f97316',
};

export type ColorPalette = typeof lightPalette;

// ── Reactive Hooks ──────────────────────────────────────────

/** Returns the active color palette based on current theme */
export function useColors(): ColorPalette {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'dark' ? darkPalette : lightPalette;
}

/** Returns shared style fragments based on current theme */
export function useStyles() {
  const c = useColors();

  const input: CSSProperties = {
    padding: '7px 10px',
    background: c.surface,
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    outline: 'none',
    width: '100%',
  };

  const monoInput: CSSProperties = {
    ...input,
    fontFamily: "'Consolas', 'Courier New', monospace",
  };

  const sidebarInput: CSSProperties = {
    padding: '7px 10px',
    background: c.sidebarSurface,
    color: c.sidebarText,
    border: `1px solid ${c.sidebarBorder}`,
    borderRadius: '2px',
    fontSize: '13px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    outline: 'none',
    width: '100%',
  };

  const labelStyle: CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '1.1px',
    marginBottom: '4px',
  };

  const buttonStyle: CSSProperties = {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, opacity 0.15s',
  };

  const accentButton: CSSProperties = {
    ...buttonStyle,
    background: c.accent,
    color: c.white,
  };

  const ghostButton: CSSProperties = {
    ...buttonStyle,
    background: 'transparent',
    color: c.textDim,
    border: `1px solid ${c.border}`,
  };

  const selectStyle: CSSProperties = {
    ...input,
    cursor: 'pointer',
  };

  const badgeFn = (color: string): CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: color,
    color: c.white,
  });

  const card: CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: '6px',
    overflow: 'hidden',
  };

  const tableHeader: CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '-0.55px',
    padding: '8px 12px',
    borderBottom: `1px solid ${c.borderLight}`,
    borderTop: `1px solid ${c.borderLight}`,
  };

  const tableCell: CSSProperties = {
    padding: '12px',
    fontSize: '13px',
    color: c.textSecondary,
    borderBottom: `1px solid ${c.borderLight}`,
  };

  return {
    input,
    monoInput,
    sidebarInput,
    label: labelStyle,
    button: buttonStyle,
    accentButton,
    ghostButton,
    select: selectStyle,
    badge: badgeFn,
    card,
    tableHeader,
    tableCell,
  };
}

// ── Static exports (backward compat — used by module-level constants) ──

/** @deprecated Use useColors() hook inside components */
export const colors = lightPalette;

/** @deprecated Use useStyles().label */
export const label: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '1.1px',
  marginBottom: '4px',
};

/** @deprecated Use useStyles().input */
export const input: CSSProperties = {
  padding: '7px 10px',
  background: '#ffffff',
  color: '#0f172a',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  fontSize: '13px',
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  outline: 'none',
  width: '100%',
};

/** @deprecated Use useStyles().monoInput */
export const monoInput: CSSProperties = {
  ...input,
  fontFamily: "'Consolas', 'Courier New', monospace",
};

/** @deprecated Use useStyles().sidebarInput */
export const sidebarInput: CSSProperties = {
  padding: '7px 10px',
  background: '#1e1e1e',
  color: '#e0e0e0',
  border: '1px solid #2a2a2a',
  borderRadius: '2px',
  fontSize: '13px',
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  outline: 'none',
  width: '100%',
};

/** @deprecated Use useStyles().button */
export const button: CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s, opacity 0.15s',
};

/** @deprecated Use useStyles().accentButton */
export const accentButton: CSSProperties = {
  ...button,
  background: '#ac3500',
  color: '#ffffff',
};

/** @deprecated Use useStyles().ghostButton */
export const ghostButton: CSSProperties = {
  ...button,
  background: 'transparent',
  color: '#64748b',
  border: '1px solid #e2e8f0',
};

/** @deprecated Use useStyles().select */
export const select: CSSProperties = {
  ...input,
  cursor: 'pointer',
};

/** @deprecated Use useStyles().badge */
export const badge = (color: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '3px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  background: color,
  color: '#ffffff',
});

/** @deprecated Use useStyles().card */
export const card: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  overflow: 'hidden',
};

/** @deprecated Use useStyles().tableHeader */
export const tableHeader: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '-0.55px',
  padding: '8px 12px',
  borderBottom: '1px solid #edeeef',
  borderTop: '1px solid #edeeef',
};

/** @deprecated Use useStyles().tableCell */
export const tableCell: CSSProperties = {
  padding: '12px',
  fontSize: '13px',
  color: '#334155',
  borderBottom: '1px solid #edeeef',
};
