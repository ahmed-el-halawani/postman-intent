import React from 'react';
import { useTabStore } from '../../store/tabStore';
import { colors, monoInput, select, ghostButton, label } from '../../styles';
import type { ExtraType } from '../../../shared/types';

const EXTRA_TYPES: ExtraType[] = [
  'string', 'int', 'long', 'float', 'double', 'bool', 'uri', 'string_array', 'int_array',
];

export default function ExtrasEditor() {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const addExtra = useTabStore((s) => s.addExtra);
  const updateExtra = useTabStore((s) => s.updateExtra);
  const removeExtra = useTabStore((s) => s.removeExtra);
  const request = tab?.request || { extras: [] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={label}>Extras</span>
        <button
          style={{ ...ghostButton, fontSize: '11px', padding: '3px 8px' }}
          onClick={addExtra}
        >
          + Add Extra
        </button>
      </div>

      {request.extras.length === 0 && (
        <span style={{ fontSize: '11px', color: colors.textMuted, fontStyle: 'italic' }}>
          No extras. Click "+ Add Extra" to add key-value pairs.
        </span>
      )}

      {request.extras.map((extra) => (
        <div
          key={extra.id}
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            padding: '4px 0',
          }}
        >
          <input
            style={{ ...monoInput, flex: 2 }}
            placeholder="Key"
            value={extra.key}
            onChange={(e) => updateExtra(extra.id, { key: e.target.value })}
          />
          <select
            style={{ ...select, flex: 1, minWidth: '90px' }}
            value={extra.type}
            onChange={(e) => updateExtra(extra.id, { type: e.target.value as ExtraType })}
          >
            {EXTRA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            style={{ ...monoInput, flex: 3 }}
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
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.error,
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
              lineHeight: 1,
            }}
            onClick={() => removeExtra(extra.id)}
            title="Remove"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
