import React, { useState } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useCollectionsStore } from '../../store/collectionsStore';
import { useColors } from '../../styles';
import type { IntentType, IntentRequest, HistoryEntry } from '../../../shared/types';
import QuickActions from '../QuickActions/QuickActions';
import CollectionsTab from './CollectionsTab';
import ImportDialog from './ImportDialog';
import CreateNewIntentDialog from './CreateNewIntentDialog';

type Tab = 'quick' | 'history' | 'collections';

const ICON_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'collections',
    label: 'Collections',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'quick',
    label: 'Environments',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'History',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12,7 12,12 15,15" />
        <path d="M3 12a9 9 0 0 1 9-9" />
      </svg>
    ),
  },
  {
    id: 'collections' as Tab, // Placeholder "Flows" — maps to collections but acts as label only
    label: 'Flows',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3v18M19 3v18M5 12h14M5 7h14M5 17h14" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const [tab, setTab] = useState<Tab>('collections');
  const [showImport, setShowImport] = useState(false);
  const [showNewIntent, setShowNewIntent] = useState(false);
  const { history, clearHistory, loadRequest } = useTabStore();
  const { createCollection } = useCollectionsStore();
  const colors = useColors();

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '350px',
        minWidth: '350px',
        background: colors.sidebarBg,
        borderRight: `1px solid ${colors.sidebarBorder}`,
        overflow: 'hidden',
      }}
    >
      {/* Icon Bar */}
      <div
        style={{
          width: '72px',
          minWidth: '72px',
          background: colors.sidebarBg,
          borderRight: `1px solid ${colors.sidebarBorder}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          padding: '16px 0',
        }}
      >
        {ICON_TABS.map((item, idx) => {
          // Skip duplicate "Flows" entry for click handling
          const isFlows = idx === 3;
          const isActive = !isFlows && tab === item.id;

          return (
            <button
              key={idx}
              onClick={() => {
                if (!isFlows) setTab(item.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: isFlows ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '0',
                color: isActive ? colors.iconActive : colors.sidebarTextDim,
                opacity: isFlows ? 0.5 : 1,
              }}
            >
              <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </div>
              <span
                style={{
                  fontSize: '9px',
                  whiteSpace: 'nowrap',
                  color: isActive ? colors.iconActive : colors.sidebarTextDim,
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content Panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Content Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '56px',
            padding: '0 16px',
            borderBottom: `1px solid ${colors.sidebarBorder}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke={colors.sidebarText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2h12v14H2V2z" />
              <path d="M5 6h6M5 9h6M5 12h3" />
            </svg>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: colors.white,
                letterSpacing: '-0.35px',
              }}
            >
              {tab === 'collections' ? 'Collections' : tab === 'history' ? 'History' : 'Quick Actions'}
            </span>
          </div>

          {tab === 'collections' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowNewIntent(true)}
                style={{
                  background: colors.sidebarButton,
                  border: 'none',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                New
              </button>
              <button
                onClick={() => setShowImport(true)}
                style={{
                  background: colors.sidebarButton,
                  border: 'none',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                Import
              </button>
            </div>
          )}
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

      {/* Import Dialog */}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}

      {/* Create New Intent Dialog */}
      {showNewIntent && <CreateNewIntentDialog onClose={() => setShowNewIntent(false)} />}
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
  const colors = useColors();
  const TYPE_COLORS: Record<IntentType, string> = {
    activity: colors.intentActivity,
    broadcast: colors.intentBroadcast,
    service: colors.intentService,
  };

  if (history.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: colors.sidebarTextDim }}>
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
          borderBottom: `1px solid ${colors.sidebarBorder}`,
        }}
      >
        <button
          onClick={onClear}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.sidebarTextDim,
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
              padding: '8px 12px',
              borderBottom: `1px solid ${colors.sidebarBorder}`,
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = colors.sidebarActive;
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
                  color: colors.sidebarText,
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
            <div style={{ fontSize: '10px', color: colors.sidebarTextDim, marginTop: '2px' }}>
              {time.toLocaleTimeString()} {entry.responseTime ? `- ${entry.responseTime}ms` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
