import React, { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useColors } from '../../styles';
import type { IntentType } from '../../../shared/types';

const TYPE_ABBREV: Record<IntentType, string> = {
  activity: 'ACT',
  broadcast: 'BRO',
  service: 'SVC',
};

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, createTab, requestCloseTab, renameTab } = useTabStore();
  const colors = useColors();
  const TYPE_COLORS: Record<IntentType, string> = {
    activity: colors.intentActivity,
    broadcast: colors.intentBroadcast,
    service: colors.intentService,
  };
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to end whenever a new tab is added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [tabs.length]);

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleCommitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameTab(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: colors.surfaceLight,
        borderBottom: `1px solid ${colors.border}`,
        height: '36px',
        overflow: 'hidden',
        position: 'relative',
        paddingLeft: '8px',
      }}
    >
      {/* Scrollable tab area */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          gap: '1px',
        }}
      >
        <style>{`.tab-scroll::-webkit-scrollbar { display: none; }`}</style>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const typeColor = TYPE_COLORS[tab.request.intentType];
          const typeAbbrev = TYPE_ABBREV[tab.request.intentType];
          const isRenaming = renamingId === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0 16px',
                minWidth: '120px',
                maxWidth: '280px',
                cursor: 'pointer',
                background: isActive ? colors.surface : 'transparent',
                borderTop: isActive
                  ? `2px solid ${colors.accentOrange}`
                  : '2px solid transparent',
                borderRight: isActive ? 'none' : `1px solid ${colors.border}30`,
                transition: 'background 0.1s',
                flexShrink: 0,
                paddingTop: isActive ? '0' : '2px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = colors.surface + '80';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              {/* Type abbreviation badge */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  color: typeColor,
                  flexShrink: 0,
                  letterSpacing: '0.3px',
                }}
              >
                {typeAbbrev}
              </span>

              {/* Tab name — editable on double-click */}
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={handleCommitRename}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '1px 4px',
                    fontSize: '12px',
                    color: colors.text,
                    background: colors.surfaceLight,
                    border: `1px solid ${colors.accentOrange}`,
                    borderRadius: '2px',
                    outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(tab.id, tab.name);
                  }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: isActive ? colors.textSecondary : colors.textDim,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {tab.name}
                </span>
              )}

              {/* Dirty indicator */}
              {tab.isDirty && !isRenaming && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: colors.textMuted,
                    opacity: 0.6,
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  requestCloseTab(tab.id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '0 2px',
                  lineHeight: 1,
                  flexShrink: 0,
                  borderRadius: '3px',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = colors.error;
                  (e.target as HTMLElement).style.background = colors.error + '15';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = colors.textMuted;
                  (e.target as HTMLElement).style.background = 'transparent';
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* New tab button — always pinned at end */}
      <button
        onClick={() => createTab()}
        style={{
          background: 'transparent',
          border: 'none',
          borderLeft: `1px solid ${colors.border}`,
          color: colors.textMuted,
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0 12px',
          transition: 'color 0.1s',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.color = colors.text;
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.color = colors.textMuted;
        }}
        title="New Tab (Ctrl+N)"
      >
        +
      </button>
    </div>
  );
}
