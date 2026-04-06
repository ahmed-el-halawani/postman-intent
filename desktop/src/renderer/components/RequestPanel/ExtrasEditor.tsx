import React from 'react';
import { useTabStore } from '../../store/tabStore';
import { useColors, useStyles } from '../../styles';
import type { ExtraType } from '../../../shared/types';

const EXTRA_TYPES: ExtraType[] = [
  'string', 'int', 'long', 'float', 'double', 'bool', 'uri', 'string_array', 'int_array',
];

export default function ExtrasEditor() {
  const colors = useColors();
  const { ghostButton, label } = useStyles();
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const addExtra = useTabStore((s) => s.addExtra);
  const updateExtra = useTabStore((s) => s.updateExtra);
  const removeExtra = useTabStore((s) => s.removeExtra);
  const request = tab?.request || { extras: [] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...label, marginBottom: 0 }}>Extras</span>
        <button
          style={{ ...ghostButton, fontSize: '11px', padding: '4px 10px' }}
          onClick={addExtra}
        >
          + Add Extra
        </button>
      </div>

      {request.extras.length === 0 && (
        <span style={{ fontSize: '12px', color: colors.textMuted, fontStyle: 'italic' }}>
          No extras. Click "+ Add Extra" to add key-value pairs.
        </span>
      )}

      {/* Table layout for extras */}
      {request.extras.length > 0 && (
        <div style={{ border: `1px solid ${colors.borderLight}` }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${colors.borderLight}`,
            }}
          >
            <div style={{
              flex: 2, padding: '8px 12px', fontSize: '11px', fontWeight: 600,
              color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}>
              Key
            </div>
            <div style={{
              width: '110px', flexShrink: 0, padding: '8px 12px', fontSize: '11px', fontWeight: 600,
              color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}>
              Type
            </div>
            <div style={{
              flex: 3, padding: '8px 12px', fontSize: '11px', fontWeight: 600,
              color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}>
              Value
            </div>
            <div style={{ width: '40px', flexShrink: 0 }} />
          </div>

          {/* Rows */}
          {request.extras.map((extra) => (
            <div
              key={extra.id}
              style={{
                display: 'flex',
                borderBottom: `1px solid ${colors.borderLight}`,
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 2, padding: '4px 8px', borderRight: `1px solid ${colors.borderLight}` }}>
                <input
                  style={{
                    width: '100%',
                    padding: '6px 4px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '13px',
                    color: colors.textSecondary,
                    fontFamily: "'Consolas', 'Courier New', monospace",
                  }}
                  placeholder="Key"
                  value={extra.key}
                  onChange={(e) => updateExtra(extra.id, { key: e.target.value })}
                />
              </div>
              <div style={{ width: '110px', flexShrink: 0, padding: '4px 8px', borderRight: `1px solid ${colors.borderLight}` }}>
                <select
                  style={{
                    width: '100%',
                    padding: '6px 4px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '12px',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                  }}
                  value={extra.type}
                  onChange={(e) => updateExtra(extra.id, { type: e.target.value as ExtraType })}
                >
                  {EXTRA_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 3, padding: '4px 8px', borderRight: `1px solid ${colors.borderLight}` }}>
                <input
                  style={{
                    width: '100%',
                    padding: '6px 4px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '13px',
                    color: colors.textSecondary,
                    fontFamily: "'Consolas', 'Courier New', monospace",
                  }}
                  placeholder={
                    extra.type === 'bool'
                      ? 'true / false'
                      : extra.type.includes('array')
                      ? 'comma-separated values'
                      : 'Value'
                  }
                  value={extra.value}
                  onChange={(e) => updateExtra(extra.id, { value: e.target.value })}
                />
              </div>
              <div style={{ width: '40px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textMuted,
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '4px',
                    lineHeight: 1,
                    borderRadius: '3px',
                  }}
                  onClick={() => removeExtra(extra.id)}
                  title="Remove"
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.color = colors.error;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.color = colors.textMuted;
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
