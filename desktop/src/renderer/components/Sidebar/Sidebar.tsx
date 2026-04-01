import React, { useState } from 'react';
import { useRequestStore } from '../../store/requestStore';
import { colors, label } from '../../styles';
import type { IntentType, IntentRequest, HistoryEntry } from '../../../shared/types';
import QuickActions from '../QuickActions/QuickActions';

const TYPE_COLORS: Record<IntentType, string> = {
  activity: colors.intentActivity,
  broadcast: colors.intentBroadcast,
  service: colors.intentService,
};

type Tab = 'quick' | 'history' | 'collections';

export default function Sidebar() {
  const [tab, setTab] = useState<Tab>('quick');
  const { history, clearHistory, loadRequest } = useRequestStore();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '240px',
        minWidth: '240px',
        background: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {(['quick', 'history', 'collections'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${colors.accent}` : '2px solid transparent',
              color: tab === t ? colors.text : colors.textDim,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'quick' ? (
          <QuickActions />
        ) : tab === 'history' ? (
          <HistoryTab
            history={history}
            onLoad={loadRequest}
            onClear={clearHistory}
          />
        ) : (
          <CollectionsTab />
        )}
      </div>
    </div>
  );
}

function HistoryTab({
  history,
  onLoad,
  onClear,
}: {
  history: HistoryEntry[];
  onLoad: (req: IntentRequest) => void;
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>
          No history yet. Send a request to see it here.
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px 8px',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <button
          onClick={onClear}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textMuted,
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          Clear All
        </button>
      </div>
      {history.map((entry) => {
        const time = new Date(entry.timestamp);
        const hasError = entry.response?.error;
        return (
          <div
            key={entry.id}
            onClick={() => onLoad(entry.request)}
            style={{
              padding: '8px 10px',
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
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: TYPE_COLORS[entry.request.intentType],
                  letterSpacing: '0.3px',
                }}
              >
                {entry.request.intentType.slice(0, 3)}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {entry.request.action || entry.request.component || 'intent.send'}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  color: hasError ? colors.error : colors.success,
                }}
              >
                {hasError ? 'ERR' : 'OK'}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>
              {time.toLocaleTimeString()} {entry.responseTime ? `- ${entry.responseTime}ms` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollectionsTab() {
  return (
    <div style={{ padding: '16px', textAlign: 'center' }}>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>
        Collections coming soon. Save and organize your requests.
      </span>
    </div>
  );
}
