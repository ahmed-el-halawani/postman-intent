import React, { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { colors } from '../../styles';
import type { IntentType } from '../../../shared/types';

const TYPE_COLORS: Record<IntentType, string> = {
  activity: colors.intentActivity,
  broadcast: colors.intentBroadcast,
  service: colors.intentService,
};

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, createTab, requestCloseTab, renameTab } = useTabStore();
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
        background: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
        height: '34px',
        overflow: 'hidden',
        position: 'relative',
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
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const typeColor = TYPE_COLORS[tab.request.intentType];
          const isRenaming = renamingId === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 12px',
                minWidth: '100px',
                maxWidth: '200px',
                cursor: 'pointer',
                background: isActive ? colors.surface : 'transparent',
                borderRight: `1px solid ${colors.border}`,
                borderTop: isActive
                  ? `2px solid ${typeColor}`
                  : '2px solid transparent',
                transition: 'background 0.1s',
                flexShrink: 0,
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
              {/* Type dot */}
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: typeColor,
                  flexShrink: 0,
                }}
              />

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
                    fontSize: '11px',
                    color: colors.text,
                    background: colors.bg,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: '2px',
                    outline: 'none',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(tab.id, tab.name);
                  }}
                  style={{
                    fontSize: '11px',
                    color: isActive ? colors.text : colors.textDim,
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
                    background: colors.white,
                    opacity: 0.5,
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
                  fontSize: '14px',
                  padding: '0 2px',
                  lineHeight: 1,
                  flexShrink: 0,
                  borderRadius: '3px',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = colors.error;
                  (e.target as HTMLElement).style.background = colors.error + '20';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = colors.textMuted;
                  (e.target as HTMLElement).style.background = 'transparent';
                }}
              >
                x
              </button>
            </div>
          );
        })}
      </div>

      {/* New tab button — always pinned at end */}
      <button
        onClick={() => createTab()}
        style={{
          background: colors.surface,
          border: 'none',
          borderLeft: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          color: colors.textDim,
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
          (e.target as HTMLElement).style.color = colors.textDim;
        }}
        title="New Tab (Ctrl+N)"
      >
        +
      </button>
    </div>
  );
}
