import React, { useState } from 'react';
import { useServiceStore } from '../../store/serviceStore';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, monoInput, label, accentButton, ghostButton } from '../../styles';

type ServiceAction = 'start' | 'stop' | 'bind';

export default function ServiceBuilder() {
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';

  const {
    bindings,
    messages,
    isOperating,
    lastResponse,
    lastResponseTime,
    startService,
    stopService,
    bindService,
    unbindService,
    callMethod,
    sendMessage,
    clearMessages,
  } = useServiceStore();

  // Service form
  const [serviceAction, setServiceAction] = useState<ServiceAction>('start');
  const [component, setComponent] = useState('');
  const [intentAction, setIntentAction] = useState('');

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
    if (!component) return;
    switch (serviceAction) {
      case 'start':
        await startService(component, intentAction || undefined);
        break;
      case 'stop':
        await stopService(component, intentAction || undefined);
        break;
      case 'bind':
        await bindService(component);
        break;
    }
  };

  const handleCallMethod = async () => {
    if (!selectedBinding || !methodName) return;
    let args: unknown[] | undefined;
    if (methodArgs.trim()) {
      try {
        args = JSON.parse(`[${methodArgs}]`);
      } catch {
        args = [methodArgs];
      }
    }
    await callMethod(selectedBinding, methodName, args);
  };

  const handleSendMessage = async () => {
    if (!msgBinding) return;
    await sendMessage(
      msgBinding,
      parseInt(msgWhat) || 0,
      parseInt(msgArg1) || 0,
      parseInt(msgArg2) || 0,
    );
  };

  const connectedBindings = bindings.filter((b) => b.connected);

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
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              placeholder="com.example.app/.MyService"
            />
          </div>

          {serviceAction !== 'bind' && (
            <div>
              <div style={label}>Action (optional)</div>
              <input
                style={monoInput}
                value={intentAction}
                onChange={(e) => setIntentAction(e.target.value)}
                placeholder="com.example.action.START"
              />
            </div>
          )}

          <button
            style={{
              ...accentButton,
              background:
                serviceAction === 'stop' ? colors.error : colors.intentService,
              opacity: !component || isOperating || !isConnected ? 0.5 : 1,
              marginTop: '4px',
            }}
            onClick={handleServiceOp}
            disabled={!component || isOperating || !isConnected}
          >
            {isOperating
              ? 'Processing...'
              : serviceAction === 'start'
              ? 'Start Service'
              : serviceAction === 'stop'
              ? 'Stop Service'
              : 'Bind to Service'}
          </button>

          {lastResponse && (
            <div
              style={{
                padding: '6px 8px',
                background: colors.codeBg,
                borderRadius: '3px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: lastResponse.error ? colors.error : colors.success,
              }}
            >
              {lastResponse.error
                ? `Error: ${lastResponse.error.message}`
                : `OK (${lastResponseTime}ms) - ${JSON.stringify(lastResponse.result)}`}
            </div>
          )}
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

                  {/* Show discovered methods */}
                  {b.methods && b.methods.length > 0 && (
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${colors.border}` }}>
                      <div style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '4px' }}>
                        Methods:
                      </div>
                      <div style={{ maxHeight: '100px', overflow: 'auto' }}>
                        {b.methods.map((m, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setSelectedBinding(b.bindingId);
                              setMethodName(m.name);
                            }}
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              color: colors.text,
                              padding: '2px 6px',
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
                <div style={label}>Arguments (comma-separated)</div>
                <input
                  style={monoInput}
                  value={methodArgs}
                  onChange={(e) => setMethodArgs(e.target.value)}
                  placeholder='"hello", 42, true'
                />
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
