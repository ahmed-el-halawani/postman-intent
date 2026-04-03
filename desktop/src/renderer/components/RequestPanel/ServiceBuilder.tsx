import React, { useState, useEffect } from 'react';
import { useServiceStore } from '../../store/serviceStore';
import { useTabStore } from '../../store/tabStore';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, monoInput, label, accentButton, ghostButton } from '../../styles';
import ExtrasEditor from './ExtrasEditor';
import type { AidlDefinition, AidlMethod } from '../../../shared/types';

type ServiceAction = 'start' | 'stop' | 'bind';

// Parse methods text like "String hello(int arg1, String arg2)" into AidlMethod[]
function parseMethodsText(text: string): AidlMethod[] {
  const methods: AidlMethod[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: returnType methodName(type param, type param)
    const match = trimmed.match(/^(\w+)\s+(\w+)\s*\(([^)]*)\)\s*;?\s*$/);
    if (match) {
      const [, returnType, name, paramsStr] = match;
      const params = paramsStr
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p)
        .map((p) => {
          const parts = p.split(/\s+/);
          return { type: parts[0], name: parts[1] || 'arg' };
        });
      methods.push({ name, returnType, params });
    }
  }
  return methods;
}

// Serialize AidlMethod[] back to text representation
function methodsToText(methods: AidlMethod[]): string {
  return methods
    .map(
      (m) =>
        `${m.returnType} ${m.name}(${m.params.map((p) => `${p.type} ${p.name}`).join(', ')})`
    )
    .join('\n');
}

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
    // AIDL
    sdkConfig,
    loadedInterfaces,
    aidlBindings,
    isCompiling,
    compileResult,
    loadSdkConfig,
    saveSdkConfig,
    compileAndPush,
    loadInterface,
    bindAidlService,
    callAidlMethod,
    unbindAidlService,
    unloadInterface,
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

  // ── AIDL form state ────────────────────────────────
  const [aidlPackageName, setAidlPackageName] = useState('');
  const [aidlInterfaceName, setAidlInterfaceName] = useState('');
  const [aidlMethodsText, setAidlMethodsText] = useState('');
  const [showAidlDef, setShowAidlDef] = useState(false);
  const [showSdkConfig, setShowSdkConfig] = useState(false);

  // SDK config form (global)
  const [sdkPath, setSdkPath] = useState('');
  const [buildToolsVersion, setBuildToolsVersion] = useState('34.0.0');
  const [platformVersion, setPlatformVersion] = useState('android-34');

  // AIDL bind form
  const [aidlInterfaceId, setAidlInterfaceId] = useState('');
  const [aidlComponent, setAidlComponent] = useState('');

  // AIDL call form
  const [aidlBindingId, setAidlBindingId] = useState('');
  const [aidlMethodName, setAidlMethodName] = useState('');
  const [aidlMethodArgs, setAidlMethodArgs] = useState('');

  // Load SDK config on mount
  useEffect(() => {
    loadSdkConfig();
  }, []);

  // Sync SDK config from store
  useEffect(() => {
    if (sdkConfig) {
      setSdkPath(sdkConfig.sdkPath);
      setBuildToolsVersion(sdkConfig.buildToolsVersion);
      setPlatformVersion(sdkConfig.platformVersion);
    }
  }, [sdkConfig]);

  // Populate AIDL form from saved request
  useEffect(() => {
    if (request?.aidlDefinition) {
      setAidlPackageName(request.aidlDefinition.packageName);
      setAidlInterfaceName(request.aidlDefinition.interfaceName);
      setAidlMethodsText(methodsToText(request.aidlDefinition.methods));
    }
  }, [tab?.id]);

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

  // ── AIDL handlers ──────────────────────────────────
  const handleCompileAndPush = async () => {
    if (!aidlPackageName || !aidlInterfaceName || !aidlMethodsText.trim()) return;

    const methods = parseMethodsText(aidlMethodsText);
    const definition: AidlDefinition = {
      packageName: aidlPackageName,
      interfaceName: aidlInterfaceName,
      methods,
    };

    // Save to request
    updateRequest({ aidlDefinition: definition });

    await compileAndPush(definition);
  };

  const handleSaveSdkConfig = () => {
    saveSdkConfig({ sdkPath, buildToolsVersion, platformVersion });
  };

  const handleLoadInterface = async () => {
    if (!compileResult?.remotePath || !aidlPackageName || !aidlInterfaceName) return;
    await loadInterface(compileResult.remotePath, aidlPackageName, aidlInterfaceName);
  };

  const handleBindAidl = async () => {
    if (!aidlInterfaceId || !aidlComponent) return;
    await bindAidlService(aidlInterfaceId, aidlComponent);
  };

  const handleCallAidl = async () => {
    if (!aidlBindingId || !aidlMethodName) return;
    let args: unknown[] | undefined;
    if (aidlMethodArgs.trim()) {
      try {
        args = JSON.parse(`[${aidlMethodArgs}]`);
      } catch {
        args = [aidlMethodArgs];
      }
    }
    await callAidlMethod(aidlBindingId, aidlMethodName, args);
  };

  const connectedBindings = bindings.filter((b) => b.connected);
  const connectedAidlBindings = aidlBindings.filter((b) => b.connected);

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

      {/* ══════════════════════════════════════════════════════
          AIDL CROSS-PROCESS SECTION
          ══════════════════════════════════════════════════════ */}
      <div style={{ borderTop: `2px solid #9333ea`, margin: '8px 0 4px' }} />

      <div>
        <div style={sectionHeader}>
          <span style={{ color: '#a855f7' }}>⚡ AIDL CROSS-PROCESS</span>
        </div>

        {/* ── AIDL Definition ──────────────────────────── */}
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => setShowAidlDef(!showAidlDef)}
            style={{
              ...ghostButton,
              fontSize: '10px',
              padding: '4px 10px',
              width: '100%',
              textAlign: 'left',
              color: '#a855f7',
              borderColor: '#9333ea40',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>AIDL DEFINITION</span>
            <span>{showAidlDef ? '▾' : '▸'}</span>
          </button>

          {showAidlDef && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div>
                <div style={label}>Package Name</div>
                <input
                  style={monoInput}
                  value={aidlPackageName}
                  onChange={(e) => setAidlPackageName(e.target.value)}
                  placeholder="com.example.sampleapp"
                />
              </div>
              <div>
                <div style={label}>Interface Name</div>
                <input
                  style={monoInput}
                  value={aidlInterfaceName}
                  onChange={(e) => setAidlInterfaceName(e.target.value)}
                  placeholder="ITestService"
                />
              </div>
              <div>
                <div style={label}>Methods (one per line: returnType methodName(type param, ...))</div>
                <textarea
                  style={{
                    ...monoInput,
                    minHeight: '80px',
                    resize: 'vertical',
                  }}
                  value={aidlMethodsText}
                  onChange={(e) => setAidlMethodsText(e.target.value)}
                  placeholder={'String hello()\nint add(int a, int b)\nvoid setName(String name)'}
                />
              </div>

              <button
                onClick={handleCompileAndPush}
                disabled={!aidlPackageName || !aidlInterfaceName || !aidlMethodsText.trim() || isCompiling || !sdkConfig?.sdkPath}
                style={{
                  ...accentButton,
                  background: '#9333ea',
                  opacity: !aidlPackageName || !aidlInterfaceName || !aidlMethodsText.trim() || isCompiling || !sdkConfig?.sdkPath ? 0.5 : 1,
                }}
              >
                {isCompiling ? 'Compiling...' : 'Compile & Push'}
              </button>

              {!sdkConfig?.sdkPath && (
                <span style={{ fontSize: '10px', color: colors.warning }}>
                  ⚠ Configure SDK path below first
                </span>
              )}

              {/* Compile result */}
              {compileResult && (
                <div
                  style={{
                    padding: '8px',
                    background: colors.codeBg,
                    borderRadius: '4px',
                    borderLeft: `3px solid ${compileResult.success ? colors.success : colors.error}`,
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                >
                  {compileResult.success ? (
                    <div>
                      <div style={{ color: colors.success }}>✓ Compiled & pushed successfully</div>
                      {compileResult.remotePath && (
                        <div style={{ color: colors.textDim, marginTop: '4px' }}>
                          Device: {compileResult.remotePath}
                        </div>
                      )}
                      <button
                        onClick={handleLoadInterface}
                        disabled={!isConnected}
                        style={{
                          ...accentButton,
                          background: '#9333ea',
                          fontSize: '10px',
                          padding: '4px 10px',
                          marginTop: '6px',
                          opacity: !isConnected ? 0.5 : 1,
                        }}
                      >
                        Load on Device
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: colors.error }}>
                        ✗ Failed at stage: {compileResult.stage}
                      </div>
                      <div style={{ color: colors.textDim, marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {compileResult.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SDK Config ──────────────────────────────── */}
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => setShowSdkConfig(!showSdkConfig)}
            style={{
              ...ghostButton,
              fontSize: '10px',
              padding: '4px 10px',
              width: '100%',
              textAlign: 'left',
              color: '#a855f7',
              borderColor: '#9333ea40',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>SDK CONFIG</span>
            <span>{showSdkConfig ? '▾' : '▸'}</span>
          </button>

          {showSdkConfig && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div>
                <div style={label}>Android SDK Path</div>
                <input
                  style={monoInput}
                  value={sdkPath}
                  onChange={(e) => setSdkPath(e.target.value)}
                  placeholder="C:\\Users\\user\\AppData\\Local\\Android\\Sdk"
                />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1 }}>
                  <div style={label}>Build Tools Version</div>
                  <input
                    style={monoInput}
                    value={buildToolsVersion}
                    onChange={(e) => setBuildToolsVersion(e.target.value)}
                    placeholder="34.0.0"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={label}>Platform Version</div>
                  <input
                    style={monoInput}
                    value={platformVersion}
                    onChange={(e) => setPlatformVersion(e.target.value)}
                    placeholder="android-34"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveSdkConfig}
                style={{
                  ...ghostButton,
                  fontSize: '11px',
                  color: '#a855f7',
                  borderColor: '#9333ea',
                }}
              >
                Save Config
              </button>
            </div>
          )}
        </div>

        {/* ── Loaded Interfaces ──────────────────────── */}
        {loadedInterfaces.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ ...sectionHeader, color: '#a855f7' }}>LOADED INTERFACES</div>
            {loadedInterfaces.map((iface) => (
              <div
                key={iface.interfaceId}
                style={{
                  padding: '8px 10px',
                  background: colors.bg,
                  borderRadius: '4px',
                  marginTop: '4px',
                  border: `1px solid #9333ea40`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: colors.text }}>
                      {iface.packageName}.{iface.interfaceName}
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textDim }}>
                      {iface.methods.length} methods | {iface.interfaceId.slice(0, 8)}
                    </div>
                  </div>
                  <button
                    onClick={() => unloadInterface(iface.interfaceId)}
                    style={{
                      ...ghostButton,
                      fontSize: '10px',
                      padding: '3px 8px',
                      color: colors.error,
                      borderColor: colors.error,
                    }}
                  >
                    Unload
                  </button>
                </div>

                {/* Methods list — click to auto-fill AIDL call form */}
                {iface.methods.length > 0 && (
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '4px' }}>
                      Methods — click to call:
                    </div>
                    {iface.methods.map((m, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          // Auto-fill AIDL bind/call forms
                          setAidlInterfaceId(iface.interfaceId);
                          setAidlMethodName(m.name);
                          setAidlMethodArgs('');
                          // If there's a connected binding for this interface, select it
                          const existing = aidlBindings.find(
                            (b) => b.interfaceId === iface.interfaceId && b.connected
                          );
                          if (existing) setAidlBindingId(existing.bindingId);
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
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── AIDL Bind Service ─────────────────────── */}
        {loadedInterfaces.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ ...sectionHeader, color: '#a855f7' }}>AIDL BIND SERVICE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div>
                <div style={label}>Interface</div>
                <select
                  style={{ ...monoInput, cursor: 'pointer' }}
                  value={aidlInterfaceId}
                  onChange={(e) => setAidlInterfaceId(e.target.value)}
                >
                  <option value="">Select interface...</option>
                  {loadedInterfaces.map((iface) => (
                    <option key={iface.interfaceId} value={iface.interfaceId}>
                      {iface.packageName}.{iface.interfaceName} ({iface.interfaceId.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Component</div>
                <input
                  style={monoInput}
                  value={aidlComponent}
                  onChange={(e) => setAidlComponent(e.target.value)}
                  placeholder="com.example.app/.AidlService"
                />
              </div>
              <button
                onClick={handleBindAidl}
                disabled={!aidlInterfaceId || !aidlComponent || !isConnected}
                style={{
                  ...accentButton,
                  background: '#9333ea',
                  opacity: !aidlInterfaceId || !aidlComponent || !isConnected ? 0.5 : 1,
                }}
              >
                Bind AIDL Service
              </button>
            </div>
          </div>
        )}

        {/* ── AIDL Active Bindings ─────────────────── */}
        {aidlBindings.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ ...sectionHeader, color: '#a855f7' }}>
              AIDL BINDINGS
              <span style={{ fontSize: '10px', color: colors.textDim, marginLeft: '8px', fontWeight: 400, textTransform: 'none' }}>
                {connectedAidlBindings.length}/{aidlBindings.length} connected
              </span>
            </div>
            {aidlBindings.map((b) => (
              <div
                key={b.bindingId}
                style={{
                  padding: '8px 10px',
                  background: colors.bg,
                  borderRadius: '4px',
                  marginTop: '4px',
                  border: `1px solid ${b.connected ? '#9333ea40' : colors.border}`,
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
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.component}
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textDim }}>
                      {b.connected ? b.proxyClass : 'connecting...'} | {b.bindingId.slice(0, 8)}
                    </div>
                  </div>
                  <button
                    onClick={() => unbindAidlService(b.bindingId)}
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
              </div>
            ))}
          </div>
        )}

        {/* ── AIDL Call Method ─────────────────────── */}
        {connectedAidlBindings.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ ...sectionHeader, color: '#a855f7' }}>AIDL CALL METHOD</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div>
                <div style={label}>Binding</div>
                <select
                  style={{ ...monoInput, cursor: 'pointer' }}
                  value={aidlBindingId}
                  onChange={(e) => setAidlBindingId(e.target.value)}
                >
                  <option value="">Select AIDL binding...</option>
                  {connectedAidlBindings.map((b) => (
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
                  value={aidlMethodName}
                  onChange={(e) => setAidlMethodName(e.target.value)}
                  placeholder="hello"
                />
              </div>
              <div>
                <div style={label}>Arguments (comma-separated JSON values)</div>
                <input
                  style={monoInput}
                  value={aidlMethodArgs}
                  onChange={(e) => setAidlMethodArgs(e.target.value)}
                  placeholder='"hello", 42'
                />
              </div>
              <button
                onClick={handleCallAidl}
                disabled={!aidlBindingId || !aidlMethodName || !isConnected}
                style={{
                  ...accentButton,
                  background: '#9333ea',
                  opacity: !aidlBindingId || !aidlMethodName || !isConnected ? 0.5 : 1,
                }}
              >
                Call AIDL Method
              </button>
            </div>
          </div>
        )}
      </div>

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
