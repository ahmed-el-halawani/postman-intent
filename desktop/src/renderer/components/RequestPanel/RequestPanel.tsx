import React from 'react';
import { useRequestStore } from '../../store/requestStore';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, accentButton, badge } from '../../styles';
import type { IntentType } from '../../../shared/types';
import IntentBuilder from './IntentBuilder';

const TYPE_COLORS: Record<IntentType, string> = {
  activity: colors.intentActivity,
  broadcast: colors.intentBroadcast,
  service: colors.intentService,
};

export default function RequestPanel() {
  const { request, updateRequest, sendRequest, isSending, resetRequest } = useRequestStore();
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';

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

        <button
          style={{
            ...accentButton,
            fontSize: '11px',
            padding: '4px 10px',
            background: 'transparent',
            color: colors.textDim,
            border: `1px solid ${colors.border}`,
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
      </div>

      {/* Intent builder form */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <IntentBuilder />
      </div>
    </div>
  );
}
