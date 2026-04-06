import React, { useState } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useDeviceStore } from '../../store/deviceStore';
import { useColors, useStyles } from '../../styles';
import type { IntentType } from '../../../shared/types';
import { generateAdbCommand } from '../../../shared/adbCommand';
import IntentBuilder from './IntentBuilder';
import BroadcastBuilder from './BroadcastBuilder';
import ServiceBuilder from './ServiceBuilder';

type RequestSubTab = 'params' | 'extras' | 'flags';

export default function RequestPanel() {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateRequest = useTabStore((s) => s.updateRequest);
  const sendRequest = useTabStore((s) => s.sendRequest);
  const resetRequest = useTabStore((s) => s.resetRequest);
  const saveTab = useTabStore((s) => s.saveTab);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';

  const colors = useColors();
  const { ghostButton } = useStyles();
  const TYPE_COLORS: Record<IntentType, string> = {
    activity: colors.intentActivity,
    broadcast: colors.intentBroadcast,
    service: colors.intentService,
  };
  const [copied, setCopied] = useState(false);
  const [subTab, setSubTab] = useState<RequestSubTab>('params');

  if (!tab) return null;

  const { request, isSending } = tab;

  const handleCopyAdb = () => {
    const cmd = generateAdbCommand(request);
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const SUB_TABS: { id: RequestSubTab; label: string }[] = [
    { id: 'params', label: 'Params' },
    { id: 'extras', label: 'Extras' },
    { id: 'flags', label: 'Flags' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: colors.surface,
      }}
    >
      {/* Workspace Action Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 12px 13px',
          borderBottom: `1px solid ${colors.borderLight}`,
        }}
      >
        {/* Left: Breadcrumb + type selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Home icon */}
          <svg width="10" height="11" viewBox="0 0 10 11" fill="none" stroke={colors.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 5L5 1L9 5V10H1V5Z" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 500, color: colors.textDim }}>
            My Workspace
          </span>
          <span style={{ fontSize: '10px', color: colors.textMuted }}>›</span>
          <span style={{ fontSize: '12px', fontWeight: 500, color: colors.text }}>
            {tab.name}
          </span>

          {/* Type indicator (read-only) */}
          <span
            style={{
              marginLeft: '12px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              border: `1px solid ${TYPE_COLORS[request.intentType]}`,
              borderRadius: '3px',
              background: TYPE_COLORS[request.intentType] + '15',
              color: TYPE_COLORS[request.intentType],
              letterSpacing: '0.3px',
            }}
          >
            {request.intentType.slice(0, 3)}
          </span>
        </div>

        {/* Right: Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Copy ADB Command */}
          <button
            style={{
              ...ghostButton,
              fontSize: '11px',
              padding: '4px 10px',
              color: copied ? colors.success : undefined,
              borderColor: copied ? colors.success : undefined,
            }}
            onClick={handleCopyAdb}
            title="Copy equivalent adb shell am command"
          >
            {copied ? 'Copied!' : 'ADB'}
          </button>

          {/* Save button */}
          <button
            onClick={() => saveTab()}
            title="Save (Ctrl+S)"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              color: colors.textSecondary,
              padding: '8px 16px',
            }}
          >
            Save
          </button>

          {/* For Result toggle — activity only */}
          {request.intentType === 'activity' && (
            <button
              onClick={() => updateRequest({ forResult: !request.forResult })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                border: `1px solid ${request.forResult ? colors.warning : colors.border}`,
                borderRadius: '3px',
                background: request.forResult ? colors.warning + '12' : 'transparent',
                color: request.forResult ? colors.warning : colors.textMuted,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              title="Start activity for result — waits for a response"
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  border: request.forResult ? 'none' : `1.5px solid ${colors.textMuted}`,
                  background: request.forResult ? colors.warning : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {request.forResult && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              forResult
            </button>
          )}

          {/* Send split button */}
          <div style={{ display: 'flex', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <button
              style={{
                background: colors.accent,
                border: 'none',
                color: colors.white,
                fontWeight: 700,
                fontSize: '13px',
                padding: '8px 24px',
                cursor: isSending || !isConnected ? 'default' : 'pointer',
                opacity: isSending || !isConnected ? 0.6 : 1,
              }}
              onClick={sendRequest}
              disabled={isSending || !isConnected}
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <button
              style={{
                background: colors.accent,
                border: 'none',
                color: colors.white,
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={resetRequest}
              title="Clear / Reset"
            >
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
                <path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tab bar (Params / Extras / Flags) — only for activity/broadcast */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          padding: '0 16px',
          borderBottom: `1px solid ${colors.borderLight}`,
        }}
      >
        {SUB_TABS.map((st) => {
          const isActiveSubTab = subTab === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setSubTab(st.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActiveSubTab ? `2px solid ${colors.accentOrange}` : '2px solid transparent',
                color: isActiveSubTab ? colors.accentOrange : colors.textDim,
                fontSize: '12px',
                fontWeight: isActiveSubTab ? 600 : 500,
                padding: isActiveSubTab ? '8px 0 10px' : '8px 0',
                cursor: 'pointer',
                transition: 'color 0.1s',
              }}
            >
              {st.label}
            </button>
          );
        })}
      </div>

      {/* Builder form based on type */}
      <div style={{ flex: 1, overflow: 'auto', background: colors.surface }}>
        {request.intentType === 'activity' && <IntentBuilder section={subTab} />}
        {request.intentType === 'broadcast' && <BroadcastBuilder section={subTab} />}
        {request.intentType === 'service' && <ServiceBuilder section={subTab} />}
      </div>
    </div>
  );
}
