import React, { useState } from 'react';
import { useServiceStore } from '../../store/serviceStore';
import { useTabStore } from '../../store/tabStore';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, monoInput, label, accentButton, ghostButton } from '../../styles';
import ExtrasEditor from './ExtrasEditor';

type ServiceAction = 'start' | 'stop' | 'bind';

export default function ServiceBuilder() {
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';

  // Read from tab request (shared with save/quickActions)
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateRequest = useTabStore((s) => s.updateRequest);
  const setActiveTabResponse = useTabStore((s) => s.setActiveTabResponse);
  const setActiveTabSending = useTabStore((s) => s.setActiveTabSending);
  const request = tab?.request;

  const {
    bindings,
    messages,
    bindService,
    unbindService,
    callMethod,
    sendMessage,
    clearMessages,
  } = useServiceStore();

  // UI mode — not saved with request
  const [serviceAction, setServiceAction] = useState<ServiceAction>('start');
  const [isOperating, setIsOperating] = useState(false);

  // Method call form
  const [selectedBinding, setSelectedBinding] = useState('');
  const [methodName, setMethodName] = useState('');
  const [methodArgs, setMethodArgs] = useState('');

  // Message form
  const [msgBinding, setMsgBinding] = useState('');
  const [msgWhat, setMsgWhat] = useState('0');
  const [msgArg1, setMsgArg1] = useState('0');
  const [msgArg2, setMsgArg2] = useState('0');

  const handleServiceOp = async () => {
    if (!request?.component) return;
    setIsOperating(true);
    setActiveTabSending(true);

    const params: Record<string, unknown> = { component: request.component };
    if (request.action) params.action = request.action;
    if (request.data) params.data = request.data;
    if (request.extras.length > 0) {
      params.extras = request.extras
        .filter((e) => e.key)
        .map((e) => ({ key: e.key, type: e.type, value: e.value }));
    }

    let method = 'service.start';
    if (serviceAction === 'stop') method = 'service.stop';
    if (serviceAction === 'bind') method = 'service.bind';

    const start = performance.now();
    const response = await window.intentPostman.sendCommand(method, params);
    const elapsed = Math.round(performance.now() - start);

    // For bind, track the binding in serviceStore
    if (serviceAction === 'bind' && response.result && typeof response.result === 'object') {
      const result = response.result as Record<string, unknown>;
      useServiceStore.getState().bindings;
      // Add to bindings if not already there
      useServiceStore.setState((state) => ({
        bindings: [
          ...state.bindings.filter((b) => b.bindingId !== result.bindingId),
          {
            bindingId: result.bindingId as string,
            component: request.component,
            connected: false,
            binderClass: 'pending',
          },
        ],
      }));
    }

    setIsOperating(false);
    setActiveTabResponse(response, elapsed);
  };

  const handleCallMethod = async () => {
    if (!selectedBinding || !methodName) return;
    setIsOperating(true);
    setActiveTabSending(true);

    let args: unknown[] | undefined;
    if (methodArgs.trim()) {
      try {
        args = JSON.parse(`[${methodArgs}]`);
      } catch {
        args = [methodArgs];
      }
    }

    const params: Record<string, unknown> = { bindingId: selectedBinding, method: methodName };
    if (args) params.args = args;

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('service.call', params);
    const elapsed = Math.round(performance.now() - start);

    setIsOperating(false);
    setActiveTabResponse(response, elapsed);

    // Also log to service messages
    useServiceStore.getState().addMessage({
      type: 'call_result',
      bindingId: selectedBinding,
      timestamp: Date.now(),
      data: {
        method: methodName,
        result: response.result,
        error: response.error,
      },
    });
  };

  const handleSendMessage = async () => {
    if (!msgBinding) return;
    setIsOperating(true);
    setActiveTabSending(true);

    const params: Record<string, unknown> = {
      bindingId: msgBinding,
      what: parseInt(msgWhat) || 0,
    };
    if (parseInt(msgArg1)) params.arg1 = parseInt(msgArg1);
    if (parseInt(msgArg2)) params.arg2 = parseInt(msgArg2);

    const start = performance.now();
    const response = await window.intentPostman.sendCommand('service.sendMessage', params);
    const elapsed = Math.round(performance.now() - start);

    setIsOperating(false);
    setActiveTabResponse(response, elapsed);
  };

  const connectedBindings = bindings.filter((b) => b.connected);

  if (!request) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Service Operations ────────────────────────── */}
      <div>
        <div style={sectionHeader}>
          <span style={{ color: colors.intentService }}>SERVICE OPERATIONS</span>
        </div>

        {/* Action selector */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          {(['start', 'stop', 'bind'] as ServiceAction[]).map((act) => (
            <button
              key={act}
              onClick={() => setServiceAction(act)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                border: `1px solid ${serviceAction === act ? colors.intentService : colors.border}`,
                background: serviceAction === act ? colors.intentService : 'transparent',
                color: serviceAction === act ? colors.white : colors.textDim,
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {act}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <div>
            <div style={label}>Component *</div>
            <input
              style={monoInput}
              value={request.component}
              onChange={(e) => updateRequest({ component: e.target.value })}
              placeholder="com.example.app/.MyService"
            />
          </div>

          {serviceAction !== 'bind' && (
            <div>
              <div style={label}>Action (optional)</div>
              <input
                style={monoInput}
                value={request.action}
                onChange={(e) => updateRequest({ action: e.target.value })}
                placeholder="com.example.action.START"
              />
            </div>
          )}

          {/* Data URI */}
          {serviceAction !== 'bind' && (
            <div>
              <div style={label}>Data URI (optional)</div>
              <input
                style={monoInput}
                value={request.data}
                onChange={(e) => updateRequest({ data: e.target.value })}
                placeholder="content://... or custom URI"
              />
            </div>
          )}

          {/* Extras — for start/stop service intents */}
          {serviceAction !== 'bind' && <ExtrasEditor />}

          <button
            style={{
              ...accentButton,
              background:
                serviceAction === 'stop' ? colors.error : colors.intentService,
              opacity: !request.component || isOperating || !isConnected ? 0.5 : 1,
              marginTop: '4px',
            }}
            onClick={handleServiceOp}
            disabled={!request.component || isOperating || !isConnected}
          >
            {isOperating
              ? 'Processing...'
              : serviceAction === 'start'
              ? 'Start Service'
              : serviceAction === 'stop'
              ? 'Stop Service'
              : 'Bind to Service'}
          </button>
        </div>
      </div>

      {/* ── Active Bindings ───────────────────────────── */}
      {bindings.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${colors.border}`, margin: '4px 0' }} />

          <div>
            <div style={sectionHeader}>
              <span style={{ color: colors.intentService }}>ACTIVE BINDINGS</span>
              <span
                style={{
                  fontSize: '10px',
                  color: colors.textDim,
                  marginLeft: '8px',
                  fontWeight: 400,
                  textTransform: 'none',
                }}
              >
                {connectedBindings.length}/{bindings.length} connected
              </span>
            </div>

            <div style={{ marginTop: '8px' }}>
              {bindings.map((b) => (
                <div
                  key={b.bindingId}
                  style={{
                    padding: '8px 10px',
                    background: colors.bg,
                    borderRadius: '4px',
                    marginBottom: '4px',
                    border: `1px solid ${b.connected ? colors.success + '40' : colors.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: b.connected ? colors.success : colors.warning,
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
                        {b.component}
                      </div>
                      <div style={{ fontSize: '10px', color: colors.textDim }}>
                        {b.connected ? b.binderClass : 'connecting...'}
                      </div>
                    </div>
                    <button
                      onClick={() => unbindService(b.bindingId)}
                      style={{
                        ...ghostButton,
                        fontSize: '10px',
                        padding: '3px 8px',
                        color: colors.error,
                        borderColor: colors.error,
                      }}
                    >
                      Unbind
                    </button>
                  </div>

                  {/* Show discovered methods — click to auto-fill call form */}
                  {b.methods && b.methods.length > 0 && (
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${colors.border}` }}>
                      <div style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '4px' }}>
                        Methods — click to call:
                      </div>
                      <div style={{ maxHeight: '120px', overflow: 'auto' }}>
                        {b.methods.map((m, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setSelectedBinding(b.bindingId);
                              setMethodName(m.name);
                              setMethodArgs(m.paramTypes.length > 0 ? '' : '');
                            }}
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              color: colors.text,
                              padding: '3px 6px',
                              cursor: 'pointer',
                              borderRadius: '2px',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = colors.surfaceLight;
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            <span style={{ color: '#79c0ff' }}>{m.returnType}</span>{' '}
                            <span style={{ color: '#d2a8ff' }}>{m.name}</span>
                            <span style={{ color: colors.textDim }}>
                              ({m.paramTypes.join(', ')})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Call Method ───────────────────────────────── */}
      {connectedBindings.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${colors.border}`, margin: '4px 0' }} />

          <div>
            <div style={sectionHeader}>
              <span style={{ color: colors.intentService }}>CALL METHOD</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div>
                <div style={label}>Binding</div>
                <select
                  style={{
                    ...monoInput,
                    cursor: 'pointer',
                  }}
                  value={selectedBinding}
                  onChange={(e) => setSelectedBinding(e.target.value)}
                >
                  <option value="">Select binding...</option>
                  {connectedBindings.map((b) => (
                    <option key={b.bindingId} value={b.bindingId}>
                      {b.component} ({b.bindingId.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={label}>Method Name *</div>
                <input
                  style={monoInput}
                  value={methodName}
                  onChange={(e) => setMethodName(e.target.value)}
                  placeholder="getStatus"
                />
              </div>

              <div>
                <div style={label}>Arguments (comma-separated JSON values)</div>
                <input
                  style={monoInput}
                  value={methodArgs}
                  onChange={(e) => setMethodArgs(e.target.value)}
                  placeholder='"hello", 42, true'
                />
                <span style={{ fontSize: '10px', color: colors.textMuted }}>
                  e.g. "hello", 42, true — parsed as JSON array elements
                </span>
              </div>

              <button
                onClick={handleCallMethod}
                disabled={!selectedBinding || !methodName || isOperating || !isConnected}
                style={{
                  ...accentButton,
                  background: colors.intentService,
                  opacity:
                    !selectedBinding || !methodName || isOperating || !isConnected ? 0.5 : 1,
                }}
              >
                {isOperating ? 'Calling...' : 'Call Method'}
              </button>
            </div>
          </div>

          {/* ── Send Message (Messenger) ──────────────── */}
          <div style={{ borderTop: `1px solid ${colors.border}`, margin: '4px 0' }} />

          <div>
            <div style={sectionHeader}>
              <span style={{ color: colors.intentService }}>SEND MESSAGE (MESSENGER)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div>
                <div style={label}>Binding</div>
                <select
                  style={{ ...monoInput, cursor: 'pointer' }}
                  value={msgBinding}
                  onChange={(e) => setMsgBinding(e.target.value)}
                >
                  <option value="">Select binding...</option>
                  {connectedBindings.map((b) => (
                    <option key={b.bindingId} value={b.bindingId}>
                      {b.component} ({b.bindingId.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1 }}>
                  <div style={label}>what</div>
                  <input
                    style={monoInput}
                    value={msgWhat}
                    onChange={(e) => setMsgWhat(e.target.value)}
                    type="number"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={label}>arg1</div>
                  <input
                    style={monoInput}
                    value={msgArg1}
                    onChange={(e) => setMsgArg1(e.target.value)}
                    type="number"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={label}>arg2</div>
                  <input
                    style={monoInput}
                    value={msgArg2}
                    onChange={(e) => setMsgArg2(e.target.value)}
                    type="number"
                  />
                </div>
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!msgBinding || isOperating || !isConnected}
                style={{
                  ...accentButton,
                  background: colors.intentService,
                  opacity: !msgBinding || isOperating || !isConnected ? 0.5 : 1,
                }}
              >
                Send Message
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Service Messages Log ──────────────────────── */}
      {messages.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${colors.border}`, margin: '4px 0' }} />

          <div>
            <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center' }}>
              <span style={{ color: colors.intentService }}>SERVICE LOG</span>
              <span style={{ flex: 1 }} />
              <button
                onClick={clearMessages}
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

            <div style={{ marginTop: '8px', maxHeight: '250px', overflow: 'auto' }}>
              {messages.map((msg, i) => {
                const typeColors: Record<string, string> = {
                  connected: colors.success,
                  disconnected: colors.error,
                  message: colors.intentBroadcast,
                  call_result: colors.intentService,
                  error: colors.error,
                };
                return (
                  <div
                    key={i}
                    style={{
                      padding: '6px 8px',
                      background: colors.codeBg,
                      borderRadius: '3px',
                      marginBottom: '3px',
                      borderLeft: `3px solid ${typeColors[msg.type] || colors.textDim}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: typeColors[msg.type] || colors.textDim,
                          textTransform: 'uppercase',
                        }}
                      >
                        {msg.type}
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: '9px', color: colors.textMuted }}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
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
                      {JSON.stringify(msg.data, null, 2)}
                    </div>
                  </div>
                );
              })}
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
