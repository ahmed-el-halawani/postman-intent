import React, { useState, useRef } from 'react';
import { useTabStore } from '../../store/tabStore';
import { colors, input, monoInput, label } from '../../styles';
import { COMMON_ACTIONS, INTENT_FLAGS } from '../../../shared/types';
import ExtrasEditor from './ExtrasEditor';

export default function IntentBuilder() {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateRequest = useTabStore((s) => s.updateRequest);
  const request = tab?.request || { action: '', component: '', data: '', mimeType: '', categories: [] as string[], flags: [] as string[], intentType: 'activity' as const, extras: [], forResult: false };
  const [showActions, setShowActions] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const actionRef = useRef<HTMLDivElement>(null);

  const filteredActions = COMMON_ACTIONS.filter((a) =>
    a.toLowerCase().includes((actionFilter || request.action).toLowerCase())
  );

  const toggleFlag = (flag: string) => {
    const flags = request.flags.includes(flag)
      ? request.flags.filter((f) => f !== flag)
      : [...request.flags, flag];
    updateRequest({ flags });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto', flex: 1 }}>
      {/* Action */}
      <div>
        <div style={label}>Action</div>
        <div style={{ position: 'relative' }} ref={actionRef}>
          <input
            style={monoInput}
            value={request.action}
            onChange={(e) => {
              updateRequest({ action: e.target.value });
              setShowActions(true);
            }}
            onFocus={() => setShowActions(true)}
            onBlur={() => setTimeout(() => setShowActions(false), 200)}
            placeholder="e.g. android.intent.action.VIEW"
          />
          {showActions && filteredActions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '180px',
                overflow: 'auto',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '0 0 4px 4px',
                zIndex: 100,
              }}
            >
              {filteredActions.map((action) => (
                <div
                  key={action}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    color: colors.text,
                  }}
                  onMouseDown={() => {
                    updateRequest({ action });
                    setShowActions(false);
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = colors.accentDark;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {action}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Component */}
      <div>
        <div style={label}>Component (optional)</div>
        <input
          style={monoInput}
          value={request.component}
          onChange={(e) => updateRequest({ component: e.target.value })}
          placeholder="com.example.app/.MainActivity"
        />
      </div>

      {/* Data URI + MIME Type side by side */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 2 }}>
          <div style={label}>Data URI</div>
          <input
            style={monoInput}
            value={request.data}
            onChange={(e) => updateRequest({ data: e.target.value })}
            placeholder="https://example.com or content://..."
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={label}>MIME Type</div>
          <input
            style={monoInput}
            value={request.mimeType}
            onChange={(e) => updateRequest({ mimeType: e.target.value })}
            placeholder="text/plain"
          />
        </div>
      </div>

      {/* Categories */}
      <div>
        <div style={label}>Categories</div>
        <input
          style={monoInput}
          value={request.categories.join(', ')}
          onChange={(e) =>
            updateRequest({
              categories: e.target.value
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean),
            })
          }
          placeholder="android.intent.category.DEFAULT, android.intent.category.BROWSABLE"
        />
        <span style={{ fontSize: '10px', color: colors.textMuted }}>Comma-separated</span>
      </div>

      {/* Flags */}
      <div>
        <div style={label}>Flags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {INTENT_FLAGS.map((flag) => {
            const active = request.flags.includes(flag);
            return (
              <button
                key={flag}
                onClick={() => toggleFlag(flag)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  border: `1px solid ${active ? colors.accent : colors.border}`,
                  borderRadius: '3px',
                  background: active ? colors.accent + '22' : 'transparent',
                  color: active ? colors.accent : colors.textDim,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {flag.replace('FLAG_', '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* For Result toggle (only for activity) */}
      {request.intentType === 'activity' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            background: request.forResult ? colors.warning + '15' : 'transparent',
            border: `1px solid ${request.forResult ? colors.warning : colors.border}`,
            borderRadius: '4px',
          }}
        >
          <input
            type="checkbox"
            id="forResult"
            checked={request.forResult}
            onChange={(e) => updateRequest({ forResult: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <label
            htmlFor="forResult"
            style={{
              fontSize: '12px',
              color: request.forResult ? colors.warning : colors.textDim,
              cursor: 'pointer',
              fontWeight: request.forResult ? 600 : 400,
            }}
          >
            Start for Result
          </label>
          {request.forResult && (
            <span style={{ fontSize: '10px', color: colors.textMuted, marginLeft: 'auto' }}>
              Result arrives as notification
            </span>
          )}
        </div>
      )}

      {/* Extras */}
      <ExtrasEditor />
    </div>
  );
}
