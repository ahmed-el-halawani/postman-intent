import React from 'react';
import { useTabStore } from '../../store/tabStore';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, accentButton, ghostButton, badge } from '../../styles';
import type { IntentType } from '../../../shared/types';
import IntentBuilder from './IntentBuilder';
import BroadcastBuilder from './BroadcastBuilder';
import ServiceBuilder from './ServiceBuilder';

const TYPE_COLORS: Record<IntentType, string> = {
  activity: colors.intentActivity,
  broadcast: colors.intentBroadcast,
  service: colors.intentService,
};

export default function RequestPanel() {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateRequest = useTabStore((s) => s.updateRequest);
  const sendRequest = useTabStore((s) => s.sendRequest);
  const resetRequest = useTabStore((s) => s.resetRequest);
  const saveTab = useTabStore((s) => s.saveTab);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';

  if (!tab) return null;

  const { request, isSending } = tab;
  const showIntentSend = request.intentType === 'activity';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Top bar: type selector + send button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
        }}
      >
        {(['activity', 'broadcast', 'service'] as IntentType[]).map((type) => {
          const active = request.intentType === type;
          return (
            <button
              key={type}
              onClick={() => updateRequest({ intentType: type })}
              style={{
                ...badge(active ? TYPE_COLORS[type] : 'transparent'),
                border: `1px solid ${active ? TYPE_COLORS[type] : colors.border}`,
                color: active ? colors.white : colors.textDim,
                cursor: 'pointer',
                padding: '4px 12px',
                fontSize: '11px',
                transition: 'all 0.15s',
              }}
            >
              {type}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Save button */}
        <button
          style={{
            ...ghostButton,
            fontSize: '11px',
            padding: '4px 10px',
          }}
          onClick={() => saveTab()}
          title="Save (Ctrl+S)"
        >
          Save
        </button>

        {showIntentSend && (
          <>
            <button
              style={{
                ...ghostButton,
                fontSize: '11px',
                padding: '4px 10px',
              }}
              onClick={resetRequest}
            >
              Clear
            </button>

            <button
              style={{
                ...accentButton,
                opacity: isSending || !isConnected ? 0.5 : 1,
                padding: '5px 20px',
                fontSize: '12px',
              }}
              onClick={sendRequest}
              disabled={isSending || !isConnected}
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </>
        )}
      </div>

      {/* Builder form based on type */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {request.intentType === 'activity' && <IntentBuilder />}
        {request.intentType === 'broadcast' && <BroadcastBuilder />}
        {request.intentType === 'service' && <ServiceBuilder />}
      </div>
    </div>
  );
}
