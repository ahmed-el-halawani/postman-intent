import React, { useState } from 'react';
import { useBroadcastStore } from '../../store/broadcastStore';
import { useTabStore } from '../../store/tabStore';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, monoInput, label, accentButton, ghostButton } from '../../styles';
import ExtrasEditor from './ExtrasEditor';

export default function BroadcastBuilder() {
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';

  // Read from tab request (shared with save/quickActions)
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateRequest = useTabStore((s) => s.updateRequest);
  const setActiveTabResponse = useTabStore((s) => s.setActiveTabResponse);
  const setActiveTabSending = useTabStore((s) => s.setActiveTabSending);
  const request = tab?.request;

  const {
    listeners,
    events,
    startListener,
    stopListener,
    stopAllListeners,
    clearEvents,
  } = useBroadcastStore();

  const [isSending, setIsSending] = useState(false);

  // Listener form
  const [listenAction, setListenAction] = useState('');

  const handleSendBroadcast = async () => {
    if (!request?.action) return;
    setIsSending(true);
    setActiveTabSending(true);

    const params: Record<string, unknown> = { action: request.action };
    if (request.component) params.package = request.component;
    if (request.data) params.data = request.data;
    if (request.mimeType) params.mimeType = request.mimeType;
    if (request.extras.length > 0) {
      params.extras = request.extras
        .filter((e) => e.key)
        .map((e) => ({ key: e.key, type: e.type, value: e.value }));
    }

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('broadcast.send', params);
    const elapsed = Math.round(performance.now() - start);

    setIsSending(false);
    setActiveTabResponse(response, elapsed);
  };

  const handleStartListening = async () => {
    if (!listenAction) return;
    await startListener(listenAction);
    setListenAction('');
  };

  if (!request) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Send Broadcast Section ────────────────────── */}
      <div>
        <div style={sectionHeader}>
          <span style={{ color: colors.intentBroadcast }}>SEND BROADCAST</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <div>
            <div style={label}>Action *</div>
            <input
              style={monoInput}
              value={request.action}
              onChange={(e) => updateRequest({ action: e.target.value })}
              placeholder="android.intent.action.MY_BROADCAST"
            />
          </div>

          <div>
            <div style={label}>Target Package (optional)</div>
            <input
              style={monoInput}
              value={request.component}
              onChange={(e) => updateRequest({ component: e.target.value })}
              placeholder="com.example.app"
            />
          </div>

          {/* Data URI + MIME Type */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 2 }}>
              <div style={label}>Data URI</div>
              <input
                style={monoInput}
                value={request.data}
                onChange={(e) => updateRequest({ data: e.target.value })}
                placeholder="content://... or custom URI"
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

          {/* Extras — reuse the shared ExtrasEditor */}
          <ExtrasEditor />

          <button
            style={{
              ...accentButton,
              background: colors.intentBroadcast,
              opacity: !request.action || isSending || !isConnected ? 0.5 : 1,
              marginTop: '4px',
            }}
            onClick={handleSendBroadcast}
            disabled={!request.action || isSending || !isConnected}
          >
            {isSending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${colors.border}`, margin: '4px 0' }} />

      {/* ── Broadcast Listeners Section ───────────────── */}
      <div>
        <div style={sectionHeader}>
          <span style={{ color: colors.intentBroadcast }}>BROADCAST LISTENERS</span>
          {listeners.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                color: colors.success,
                marginLeft: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: colors.success,
                  display: 'inline-block',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              {listeners.length} active
            </span>
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>

        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <input
            style={{ ...monoInput, flex: 1 }}
            value={listenAction}
            onChange={(e) => setListenAction(e.target.value)}
            placeholder="Action to listen for..."
            onKeyDown={(e) => e.key === 'Enter' && handleStartListening()}
          />
          <button
            onClick={handleStartListening}
            disabled={!listenAction || !isConnected}
            style={{
              ...accentButton,
              background: colors.success,
              opacity: !listenAction || !isConnected ? 0.5 : 1,
              fontSize: '11px',
              padding: '6px 12px',
              whiteSpace: 'nowrap',
            }}
          >
            Start Listening
          </button>
        </div>

        {/* Active listeners */}
        {listeners.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            {listeners.map((l) => (
              <div
                key={l.listenerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: colors.bg,
                  borderRadius: '4px',
                  marginBottom: '4px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: colors.success,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {l.action}
                  </div>
                  <div style={{ fontSize: '10px', color: colors.textDim }}>
                    {l.eventCount} events
                  </div>
                </div>
                <button
                  onClick={() => stopListener(l.listenerId)}
                  style={{
                    ...ghostButton,
                    fontSize: '10px',
                    padding: '3px 8px',
                    color: colors.error,
                    borderColor: colors.error,
                  }}
                >
                  Stop
                </button>
              </div>
            ))}

            <button
              onClick={stopAllListeners}
              style={{
                ...ghostButton,
                fontSize: '10px',
                padding: '4px 10px',
                color: colors.error,
                borderColor: colors.error,
                marginTop: '4px',
                width: '100%',
              }}
            >
              Stop All Listeners
            </button>
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────── */}
      {events.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${colors.border}`, margin: '4px 0' }} />

          {/* ── Live Events Feed ──────────────────────── */}
          <div>
            <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center' }}>
              <span style={{ color: colors.intentBroadcast }}>LIVE EVENTS</span>
              <span style={{ flex: 1 }} />
              <button
                onClick={clearEvents}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>

            <div style={{ marginTop: '8px', maxHeight: '300px', overflow: 'auto' }}>
              {events.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 8px',
                    background: colors.codeBg,
                    borderRadius: '3px',
                    marginBottom: '3px',
                    borderLeft: `3px solid ${colors.intentBroadcast}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: colors.intentBroadcast,
                        fontFamily: 'monospace',
                      }}
                    >
                      {ev.action}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: '9px', color: colors.textMuted }}>
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {ev.extras && Object.keys(ev.extras).length > 0 && (
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: colors.textDim,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(ev.extras, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '1px',
  textTransform: 'uppercase',
};
