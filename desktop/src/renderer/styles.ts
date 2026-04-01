import type { CSSProperties } from 'react';

// Color palette — Postman-inspired dark theme
export const colors = {
  bg: '#1a1a2e',
  surface: '#16213e',
  surfaceLight: '#1c2a4a',
  border: '#0f3460',
  accent: '#e94560',
  accentHover: '#d63851',
  accentDark: '#0f3460',
  text: '#e0e0e0',
  textDim: '#888888',
  textMuted: '#555555',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  codeBg: '#0d1117',
  white: '#ffffff',
  intentActivity: '#4caf50',
  intentBroadcast: '#2196f3',
  intentService: '#ff9800',
};

// Shared style fragments
export const input: CSSProperties = {
  padding: '7px 10px',
  background: colors.bg,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  borderRadius: '4px',
  fontSize: '13px',
  fontFamily: "'Segoe UI', sans-serif",
  outline: 'none',
  width: '100%',
};

export const monoInput: CSSProperties = {
  ...input,
  fontFamily: "'Consolas', 'Courier New', monospace",
};

export const label: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: colors.textDim,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '4px',
};

export const button: CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s, opacity 0.15s',
};

export const accentButton: CSSProperties = {
  ...button,
  background: colors.accent,
  color: colors.white,
};

export const ghostButton: CSSProperties = {
  ...button,
  background: 'transparent',
  color: colors.textDim,
  border: `1px solid ${colors.border}`,
};

export const select: CSSProperties = {
  ...input,
  cursor: 'pointer',
};

export const badge = (color: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '3px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  background: color,
  color: colors.white,
});

export const card: CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: '6px',
  overflow: 'hidden',
};
