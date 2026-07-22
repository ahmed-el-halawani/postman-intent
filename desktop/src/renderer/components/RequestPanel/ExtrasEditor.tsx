import React from 'react';
import { useTabStore } from '../../store/tabStore';
import { useColors, useStyles } from '../../styles';
import type { ExtraType, IntentExtra } from '../../../shared/types';

const EXTRA_TYPES: ExtraType[] = [
  'string', 'int', 'long', 'float', 'double', 'bool', 'uri', 'string_array', 'int_array', 'bundle',
];

export default function ExtrasEditor() {
  const colors = useColors();
  const { ghostButton, label } = useStyles();
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const addExtra = useTabStore((s) => s.addExtra);
  const request = tab?.request || { extras: [] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...label, marginBottom: 0 }}>Extras</span>
        <button
          style={{ ...ghostButton, fontSize: '11px', padding: '4px 10px' }}
          onClick={() => addExtra()}
        >
          + Add Extra
        </button>
      </div>

      {request.extras.length === 0 && (
        <span style={{ fontSize: '12px', color: colors.textMuted, fontStyle: 'italic' }}>
          No extras. Click "+ Add Extra" to add key-value pairs.
        </span>
      )}

      {request.extras.length > 0 && (
        <div style={{ border: `1px solid ${colors.borderLight}` }}>
          {/* Header */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${colors.borderLight}` }}>
            <div style={{ width: '28px', flexShrink: 0, padding: '8px 4px', textAlign: 'center', borderRight: `1px solid ${colors.borderLight}` }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: colors.textMuted }}>#</span>
            </div>
            <div style={{
              flex: 2, padding: '8px 12px', fontSize: '11px', fontWeight: 600,
              color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}>Key</div>
            <div style={{
              width: '110px', flexShrink: 0, padding: '8px 12px', fontSize: '11px', fontWeight: 600,
              color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}>Type</div>
            <div style={{
              flex: 3, padding: '8px 12px', fontSize: '11px', fontWeight: 600,
              color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}>Value</div>
            <div style={{ width: '32px', flexShrink: 0 }} />
          </div>

          {/* Rows */}
          {request.extras.map((extra) => (
            <ExtraRow key={extra.id} extra={extra} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Recursive Extra Row ───────────────────────────────────── */

function ExtraRow({ extra, depth }: { extra: IntentExtra; depth: number }) {
  const colors = useColors();
  const { ghostButton } = useStyles();
  const updateExtra = useTabStore((s) => s.updateExtra);
  const removeExtra = useTabStore((s) => s.removeExtra);
  const addExtra = useTabStore((s) => s.addExtra);

  const isBundle = extra.type === 'bundle';
  const indent = depth * 20;
  const disabled = !extra.enabled;

  return (
    <div>
      {/* Row */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${colors.borderLight}`,
          alignItems: 'center',
          background: depth > 0 ? colors.surfaceLight : 'transparent',
        }}
      >
        {/* Checkbox */}
        <div style={{ width: '28px', flexShrink: 0, display: 'flex', justifyContent: 'center', borderRight: `1px solid ${colors.borderLight}`, paddingLeft: `${indent}px` }}>
          <input
            type="checkbox"
            checked={extra.enabled}
            onChange={(e) => updateExtra(extra.id, { enabled: e.target.checked })}
            style={{ cursor: 'pointer', accentColor: colors.accentOrange }}
            title={extra.enabled ? 'Disable' : 'Enable'}
          />
        </div>

        {/* Key */}
        <div style={{ flex: 2, padding: '4px 8px', borderRight: `1px solid ${colors.borderLight}` }}>
          {depth > 0 && <span style={{ color: colors.textMuted, fontSize: '12px' }}>↳ </span>}
          <input
            style={{
              width: 'calc(100% - ' + (depth > 0 ? '20px' : '0px') + ')',
              padding: '6px 4px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: disabled ? colors.textMuted : colors.textSecondary,
              fontFamily: "'Consolas', 'Courier New', monospace",
              opacity: disabled ? 0.5 : 1,
            }}
            placeholder="Key"
            value={extra.key}
            onChange={(e) => updateExtra(extra.id, { key: e.target.value })}
          />
        </div>

        {/* Type */}
        <div style={{ width: '110px', flexShrink: 0, padding: '4px 8px', borderRight: `1px solid ${colors.borderLight}` }}>
          <select
            style={{
              width: '100%',
              padding: '6px 4px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '12px',
              color: disabled ? colors.textMuted : colors.textSecondary,
              cursor: 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
            value={extra.type}
            onChange={(e) => {
              const newType = e.target.value as ExtraType;
              updateExtra(extra.id, { type: newType });
            }}
          >
            {EXTRA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div style={{ flex: 3, padding: '4px 8px', borderRight: `1px solid ${colors.borderLight}` }}>
          {isBundle ? (
            <span style={{ fontSize: '11px', color: colors.textMuted, fontStyle: 'italic' }}>
              {extra.subExtras.length} sub-extra{extra.subExtras.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <input
              style={{
                width: '100%',
                padding: '6px 4px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                color: disabled ? colors.textMuted : colors.textSecondary,
                fontFamily: "'Consolas', 'Courier New', monospace",
                opacity: disabled ? 0.5 : 1,
              }}
              placeholder={
                extra.type === 'bool' ? 'true / false' :
                extra.type.includes('array') ? 'comma-separated values' : 'Value'
              }
              value={extra.value}
              onChange={(e) => updateExtra(extra.id, { value: e.target.value })}
            />
          )}
        </div>

        {/* Remove */}
        <div style={{ width: '32px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
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
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = colors.error; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = colors.textMuted; }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Sub-extras for bundle type */}
      {isBundle && extra.enabled && (
        <div>
          {extra.subExtras.map((sub) => (
            <ExtraRow key={sub.id} extra={sub} depth={depth + 1} />
          ))}
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${colors.borderLight}`,
              background: colors.surfaceLight,
              paddingLeft: `${(depth + 1) * 20 + 28}px`,
            }}
          >
            <button
              style={{
                ...ghostButton,
                fontSize: '11px',
                padding: '4px 10px',
                margin: '4px 8px',
              }}
              onClick={() => addExtra(extra.id)}
            >
              + Add Sub Extra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}