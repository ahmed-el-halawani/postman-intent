import React, { useState, useEffect } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useRequestStore } from '../../store/requestStore';
import { colors, input, label, badge } from '../../styles';
import type { IntentType } from '../../../shared/types';

interface QuickAction {
  label: string;
  type: string;
  action: string;
  source: string;
  forResult: boolean;
  component?: string;
  data?: string;
  mimeType?: string;
  extras?: { key: string; type: string; value: string }[];
}

const TYPE_COLORS: Record<string, string> = {
  activity: colors.intentActivity,
  broadcast: colors.intentBroadcast,
  service: colors.intentService,
};

export default function QuickActions() {
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [filter, setFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'common' | 'device'>('all');
  const [loading, setLoading] = useState(false);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const { updateRequest } = useRequestStore();
  const isConnected = connectionStatus === 'connected';

  const fetchQuickActions = async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const response = await window.intentPostman.sendCommand('package.getQuickActions', {});
      if (response.result && Array.isArray(response.result)) {
        setQuickActions(response.result as QuickAction[]);
      }
    } catch (e) {
      console.error('Failed to fetch quick actions:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isConnected) {
      fetchQuickActions();
    } else {
      setQuickActions([]);
    }
  }, [isConnected]);

  const filtered = quickActions.filter((a) => {
    if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      a.label.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      (a.component || '').toLowerCase().includes(q)
    );
  });

  const applyAction = (action: QuickAction) => {
    updateRequest({
      intentType: action.type as IntentType,
      action: action.action,
      component: action.component || '',
      data: action.data || '',
      mimeType: action.mimeType || '',
      flags: [],
      categories: [],
      extras: action.extras
        ? action.extras.map((e) => ({
            id: crypto.randomUUID(),
            key: e.key,
            type: e.type as any,
            value: e.value,
          }))
        : [],
    });

    // Also set forResult in the store
    if (action.forResult) {
      useRequestStore.getState().updateRequest({ forResult: true } as any);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ padding: '12px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>
          Connect to a device to see quick actions
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ ...label, margin: 0, flex: 1 }}>Quick Actions</span>
          <button
            onClick={fetchQuickActions}
            disabled={loading}
            style={{
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              color: colors.textDim,
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>

        <input
          style={{ ...input, fontSize: '11px', padding: '5px 8px' }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search actions..."
        />

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'common', 'device'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              style={{
                flex: 1,
                padding: '3px',
                fontSize: '10px',
                border: `1px solid ${sourceFilter === s ? colors.accent : colors.border}`,
                borderRadius: '3px',
                background: sourceFilter === s ? colors.accent + '22' : 'transparent',
                color: sourceFilter === s ? colors.accent : colors.textDim,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: colors.textMuted }}>
              {loading ? 'Loading...' : 'No matching actions'}
            </span>
          </div>
        )}

        {filtered.map((action, i) => (
          <div
            key={`${action.action}-${action.component}-${i}`}
            onClick={() => applyAction(action)}
            style={{
              padding: '7px 10px',
              borderBottom: `1px solid ${colors.border}`,
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = colors.bg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  ...badge(TYPE_COLORS[action.type] || colors.textDim),
                  fontSize: '8px',
                  padding: '1px 5px',
                }}
              >
                {action.type.slice(0, 3)}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: colors.text,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {action.label}
              </span>
              {action.forResult && (
                <span
                  style={{
                    fontSize: '8px',
                    color: colors.warning,
                    border: `1px solid ${colors.warning}`,
                    borderRadius: '2px',
                    padding: '0 4px',
                  }}
                >
                  RESULT
                </span>
              )}
              <span
                style={{
                  fontSize: '8px',
                  color: action.source === 'common' ? colors.accentDark : colors.textMuted,
                  opacity: 0.7,
                }}
              >
                {action.source}
              </span>
            </div>
            <div
              style={{
                fontSize: '10px',
                color: colors.textMuted,
                fontFamily: 'monospace',
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {action.action}
              {action.component ? ` -> ${action.component}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
