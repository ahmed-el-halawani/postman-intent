import React, { useState, useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useCollectionsStore } from '../../store/collectionsStore';
import { useColors, useStyles } from '../../styles';
import { useDeviceStore } from '../../store/deviceStore';
import type { SavedResponse, JsonRpcResponse } from '../../../shared/types';

type ResponseTab = 'response' | 'notifications';

export default function ResponsePanel() {
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const cancelWaiting = useTabStore((s) => s.cancelWaiting);

  const response = activeTab?.response ?? null;
  const responseTime = activeTab?.responseTime ?? null;
  const isSending = activeTab?.isSending ?? false;
  const waitingForResult = activeTab?.waitingForResult ?? false;
  const waitingStartTime = activeTab?.waitingStartTime ?? null;
  const savedRef = activeTab?.savedRequestRef ?? null;
  const currentRequest = activeTab?.request ?? null;

  const { notifications, latestResult, clearNotifications } = useNotificationStore();
  const collections = useCollectionsStore((s) => s.collections);
  const saveResponse = useCollectionsStore((s) => s.saveResponse);
  const deleteResponse = useCollectionsStore((s) => s.deleteResponse);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';
  const colors = useColors();
  const { ghostButton } = useStyles();
  const [tab, setTab] = useState<ResponseTab>('response');
  const [showSaveResponseInput, setShowSaveResponseInput] = useState(false);
  const [saveResponseName, setSaveResponseName] = useState('');
  const [showSavedResponses, setShowSavedResponses] = useState(false);
  const [viewingSavedResponse, setViewingSavedResponse] = useState<SavedResponse | null>(null);

  // Get saved responses for current tab's saved request
  const savedResponses: SavedResponse[] = (() => {
    if (!savedRef) return [];
    const col = collections.find((c) => c.id === savedRef.collectionId);
    const req = col?.requests.find((r) => r.id === savedRef.requestId);
    return req?.savedResponses || [];
  })();

  // Auto-switch to response tab when a new result arrives
  useEffect(() => {
    if (latestResult) {
      setTab('response');
    }
  }, [latestResult]);

  const hasError = response?.error;
  const statusText = hasError
    ? `Error ${response.error?.code || ''}`
    : response
    ? '200 OK'
    : '';
  const statusBg = hasError ? '#fee2e2' : response ? colors.successLight : 'transparent';
  const statusColor = hasError ? colors.error : response ? colors.successDark : colors.textMuted;

  const handleCopyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: colors.surfaceLight,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px 9px',
          borderBottom: `1px solid ${colors.borderLight}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Response label */}
          <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text }}>
            Response
          </span>

          {/* Status + metrics */}
          {tab === 'response' && statusText && !waitingForResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: statusColor,
                  background: statusBg,
                  padding: '2px 8px',
                  borderRadius: '2px',
                }}
              >
                {statusText}
              </span>
              {responseTime !== null && (
                <span style={{ fontSize: '10px', fontWeight: 500, color: colors.textDim }}>
                  Time: <span style={{ color: colors.text }}>{responseTime} ms</span>
                </span>
              )}
              {response && (
                <span style={{ fontSize: '10px', fontWeight: 500, color: colors.textDim }}>
                  Size: <span style={{ color: colors.text }}>{(JSON.stringify(response).length / 1024).toFixed(1)} KB</span>
                </span>
              )}
            </div>
          )}

          {tab === 'response' && isSending && (
            <span style={{ fontSize: '11px', color: colors.warning, fontWeight: 500 }}>
              Sending...
            </span>
          )}
        </div>

        {/* Right side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Notifications tab toggle */}
          <button
            onClick={() => setTab(tab === 'notifications' ? 'response' : 'notifications')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
              color: tab === 'notifications' ? colors.accentOrange : colors.textMuted,
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Notifications
            {notifications.length > 0 && (
              <span
                style={{
                  background: colors.accentOrange,
                  color: colors.white,
                  borderRadius: '8px',
                  padding: '0 5px',
                  fontSize: '9px',
                  lineHeight: '16px',
                }}
              >
                {notifications.length}
              </span>
            )}
          </button>

          {/* Save Response button */}
          {tab === 'response' && savedRef && response && !isSending && (
            <button
              onClick={() => {
                setSaveResponseName(
                  response.error
                    ? `Error ${response.error.code}`
                    : `Response ${new Date().toLocaleTimeString()}`
                );
                setShowSaveResponseInput(true);
              }}
              style={{
                ...ghostButton,
                fontSize: '10px',
                padding: '3px 8px',
              }}
            >
              Save
            </button>
          )}

          {/* Saved responses dropdown toggle */}
          {tab === 'response' && savedResponses.length > 0 && (
            <button
              onClick={() => setShowSavedResponses(!showSavedResponses)}
              style={{
                ...ghostButton,
                fontSize: '10px',
                padding: '3px 8px',
                color: colors.success,
                borderColor: colors.success + '40',
              }}
            >
              Saved ({savedResponses.length})
            </button>
          )}

          {/* Copy button */}
          {response && tab === 'response' && (
            <button
              onClick={handleCopyResponse}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: colors.textMuted,
              }}
              title="Copy response"
            >
              <svg width="13" height="15" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="1" width="8" height="10" rx="1" />
                <path d="M1 4v9a1 1 0 001 1h7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Save Response Name Input */}
      {showSaveResponseInput && savedRef && response && (
        <div
          style={{
            padding: '8px 12px',
            background: colors.surface,
            borderBottom: `1px solid ${colors.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: colors.textDim }}>Name:</span>
          <input
            autoFocus
            style={{
              flex: 1,
              padding: '4px 8px',
              background: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              outline: 'none',
            }}
            value={saveResponseName}
            onChange={(e) => setSaveResponseName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && saveResponseName.trim() && currentRequest) {
                saveResponse(savedRef.collectionId, savedRef.requestId, saveResponseName.trim(), currentRequest, response, responseTime, latestResult);
                setShowSaveResponseInput(false);
              }
              if (e.key === 'Escape') setShowSaveResponseInput(false);
            }}
          />
          <button
            onClick={() => {
              if (saveResponseName.trim() && currentRequest) {
                saveResponse(savedRef.collectionId, savedRef.requestId, saveResponseName.trim(), currentRequest, response, responseTime, latestResult);
              }
              setShowSaveResponseInput(false);
            }}
            style={{
              padding: '4px 10px',
              background: colors.success,
              color: colors.white,
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Save
          </button>
          <button
            onClick={() => setShowSaveResponseInput(false)}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Saved Responses Dropdown */}
      {showSavedResponses && savedResponses.length > 0 && savedRef && (
        <div
          style={{
            borderBottom: `1px solid ${colors.borderLight}`,
            maxHeight: '200px',
            overflow: 'auto',
            background: colors.surface,
          }}
        >
          {savedResponses.map((sr) => (
            <div
              key={sr.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderBottom: `1px solid ${colors.borderLight}`,
                cursor: 'pointer',
              }}
              onClick={() => {
                setViewingSavedResponse(sr);
                setShowSavedResponses(false);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.surfaceLight;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: sr.response.error ? colors.error : colors.success,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '11px', color: colors.text, flex: 1 }}>{sr.name}</span>
              {sr.responseTime && (
                <span style={{ fontSize: '10px', color: colors.textMuted }}>{sr.responseTime}ms</span>
              )}
              <span style={{ fontSize: '9px', color: colors.textMuted }}>
                {new Date(sr.savedAt).toLocaleDateString()}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteResponse(savedRef.collectionId, savedRef.requestId, sr.id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '0 4px',
                  opacity: 0.4,
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.opacity = '1';
                  (e.target as HTMLElement).style.color = colors.error;
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.opacity = '0.4';
                  (e.target as HTMLElement).style.color = colors.textMuted;
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Viewing saved response banner */}
      {viewingSavedResponse && (
        <div
          style={{
            padding: '6px 12px',
            background: colors.successLight,
            borderBottom: `1px solid ${colors.success}30`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: colors.successDark, fontWeight: 600 }}>
            Viewing: {viewingSavedResponse.name}
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setViewingSavedResponse(null)}
            style={{
              ...ghostButton,
              fontSize: '10px',
              padding: '2px 8px',
              color: colors.textDim,
            }}
          >
            Back to Live
          </button>
        </div>
      )}

      {/* Body */}
      {tab === 'response' ? (
        <ResponseView
          response={viewingSavedResponse ? viewingSavedResponse.response : response}
          latestResult={viewingSavedResponse ? (viewingSavedResponse.activityResult ?? null) : latestResult}
          waitingForResult={viewingSavedResponse ? false : waitingForResult}
          waitingStartTime={viewingSavedResponse ? null : waitingStartTime}
          isSending={viewingSavedResponse ? false : isSending}
          isConnected={isConnected}
          onCancelWaiting={cancelWaiting}
        />
      ) : (
        <NotificationsView
          notifications={notifications}
          onClear={clearNotifications}
        />
      )}
    </div>
  );
}

// ── Response View ─────────────────────────────────────────────

function ResponseView({
  response,
  latestResult,
  waitingForResult,
  waitingStartTime,
  isSending,
  isConnected,
  onCancelWaiting,
}: {
  response: ReturnType<typeof useTabStore.getState>['tabs'][0]['response'];
  latestResult: Record<string, unknown> | null;
  waitingForResult: boolean;
  waitingStartTime: number | null;
  isSending: boolean;
  isConnected: boolean;
  onCancelWaiting: () => void;
}) {
  const colors = useColors();
  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Waiting for Result banner */}
      {waitingForResult && (
        <WaitingBanner startTime={waitingStartTime} onCancel={onCancelWaiting} />
      )}

      {/* Latest Activity Result */}
      {latestResult != null && !waitingForResult && (
        <div
          style={{
            padding: '12px 16px',
            background: colors.warning + '08',
            borderBottom: `1px solid ${colors.warning}20`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: colors.warning,
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: colors.warning,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Activity Result
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color:
                  (latestResult as Record<string, unknown>).resultCodeName === 'RESULT_OK'
                    ? colors.successDark
                    : colors.error,
                padding: '2px 8px',
                borderRadius: '2px',
                background:
                  (latestResult as Record<string, unknown>).resultCodeName === 'RESULT_OK'
                    ? colors.successLight
                    : '#fee2e2',
              }}
            >
              {String((latestResult as Record<string, unknown>).resultCodeName || 'UNKNOWN')}
            </span>
          </div>
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.borderLight}`,
              padding: '10px',
              borderRadius: '4px',
              fontFamily: "'Consolas', 'Courier New', monospace",
              fontSize: '12px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: colors.textSecondary,
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            <JsonTree data={latestResult} />
          </div>
        </div>
      )}

      {/* Regular Response with line numbers */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          fontFamily: "'Liberation Mono', 'Consolas', 'Courier New', monospace",
          fontSize: '13px',
          lineHeight: '20px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {response ? (
          <JsonWithLineNumbers data={response} />
        ) : (
          <span style={{ color: colors.textMuted }}>
            {isSending
              ? ''
              : isConnected
              ? 'Send a request to see the response here'
              : 'Connect to a device to get started'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── JSON with Line Numbers ────────────────────────────────────

function JsonWithLineNumbers({ data }: { data: unknown }) {
  const colors = useColors();
  const jsonStr = JSON.stringify(data, null, 2);
  const lines = jsonStr.split('\n');

  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      {/* Line numbers gutter */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '32px', userSelect: 'none' }}>
        {lines.map((_, i) => (
          <span key={i} style={{ color: colors.textMuted, fontSize: '13px', lineHeight: '20px' }}>
            {i + 1}
          </span>
        ))}
      </div>

      {/* Code content */}
      <div style={{ flex: 1 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ lineHeight: '20px' }}>
            <SyntaxHighlightedLine line={line} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SyntaxHighlightedLine({ line }: { line: string }) {
  const colors = useColors();
  // Simple regex-based syntax highlighting
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Match quoted key before colon: "key":
    const keyMatch = remaining.match(/^(\s*)"([^"]+)"(\s*:\s*)/);
    if (keyMatch) {
      parts.push(<span key={keyIdx++}>{keyMatch[1]}"</span>);
      parts.push(<span key={keyIdx++} style={{ color: colors.codeKey }}>{keyMatch[2]}</span>);
      parts.push(<span key={keyIdx++}>"{ keyMatch[3]}</span>);
      remaining = remaining.slice(keyMatch[0].length);
      continue;
    }

    // Match string value: "value"
    const strMatch = remaining.match(/^"([^"]*)"/);
    if (strMatch) {
      parts.push(<span key={keyIdx++}>"</span>);
      parts.push(<span key={keyIdx++} style={{ color: colors.codeString }}>{strMatch[1]}</span>);
      parts.push(<span key={keyIdx++}>"</span>);
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // Match number
    const numMatch = remaining.match(/^(-?\d+\.?\d*)/);
    if (numMatch) {
      parts.push(<span key={keyIdx++} style={{ color: colors.codeNumber }}>{numMatch[1]}</span>);
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // Match boolean/null
    const boolMatch = remaining.match(/^(true|false|null)/);
    if (boolMatch) {
      parts.push(<span key={keyIdx++} style={{ color: colors.codeBool }}>{boolMatch[1]}</span>);
      remaining = remaining.slice(boolMatch[0].length);
      continue;
    }

    // Default: single character
    parts.push(<span key={keyIdx++} style={{ color: colors.textSecondary }}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}

// ── Waiting Banner with animation ─────────────────────────────

function WaitingBanner({
  startTime,
  onCancel,
}: {
  startTime: number | null;
  onCancel: () => void;
}) {
  const colors = useColors();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (startTime) {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const dots = '.'.repeat((elapsed % 3) + 1);

  return (
    <div
      style={{
        padding: '16px',
        background: colors.warning + '08',
        borderBottom: `2px solid ${colors.warning}30`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: '20px',
          height: '20px',
          border: `2px solid ${colors.warning}30`,
          borderTopColor: colors.warning,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: colors.warning,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          Waiting for activity result{dots}
        </div>
        <div style={{ fontSize: '11px', color: colors.textDim, marginTop: '2px' }}>
          The target activity is open on your device. Complete the action or press back to return a result.
          <span style={{ color: colors.textMuted, marginLeft: '8px' }}>
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      <button
        onClick={onCancel}
        style={{
          padding: '6px 16px',
          background: 'transparent',
          border: `1px solid ${colors.error}`,
          borderRadius: '4px',
          color: colors.error,
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = colors.error + '10';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = 'transparent';
        }}
      >
        Cancel
      </button>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ── Notifications View ────────────────────────────────────────

function NotificationsView({
  notifications,
  onClear,
}: {
  notifications: Array<{ method: string; params?: Record<string, unknown> }>;
  onClear: () => void;
}) {
  const colors = useColors();
  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Clear button */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '6px 12px',
            borderBottom: `1px solid ${colors.borderLight}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>
            No notifications yet. Activity results and broadcast events will appear here.
          </span>
        </div>
      ) : (
        notifications.map((n, i) => (
          <div
            key={i}
            style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${colors.borderLight}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: n.method === 'intent.result' ? colors.warning : colors.intentBroadcast,
                  fontFamily: 'monospace',
                }}
              >
                {n.method}
              </span>
            </div>
            {n.params && (
              <div
                style={{
                  marginTop: '4px',
                  background: colors.surface,
                  border: `1px solid ${colors.borderLight}`,
                  padding: '6px 8px',
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  color: colors.textSecondary,
                  maxHeight: '120px',
                  overflow: 'auto',
                }}
              >
                <JsonTree data={n.params} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── JSON Tree Renderer (fallback) ────────────────────────────

function JsonTree({ data, indent = 0 }: { data: unknown; indent?: number }) {
  const colors = useColors();
  const pad = '  '.repeat(indent);

  if (data === null) return <span style={{ color: colors.textMuted }}>null</span>;
  if (data === undefined) return <span style={{ color: colors.textMuted }}>undefined</span>;

  if (typeof data === 'string') {
    return <span style={{ color: colors.codeString }}>"{data}"</span>;
  }
  if (typeof data === 'number') {
    return <span style={{ color: colors.codeNumber }}>{data}</span>;
  }
  if (typeof data === 'boolean') {
    return <span style={{ color: colors.codeBool }}>{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>{'[]'}</span>;
    return (
      <span>
        {'[\n'}
        {data.map((item, i) => (
          <span key={i}>
            {pad}  <JsonTree data={item} indent={indent + 1} />
            {i < data.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {pad}{']'}
      </span>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span>{'{}'}</span>;
    return (
      <span>
        {'{\n'}
        {entries.map(([key, value], i) => (
          <span key={key}>
            {pad}  <span style={{ color: colors.codeKey }}>"{key}"</span>: <JsonTree data={value} indent={indent + 1} />
            {i < entries.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {pad}{'}'}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}
