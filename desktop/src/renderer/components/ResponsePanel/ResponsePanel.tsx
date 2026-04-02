import React, { useState, useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useCollectionsStore } from '../../store/collectionsStore';
import { colors, label, ghostButton } from '../../styles';
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

  const { notifications, latestResult, clearNotifications } = useNotificationStore();
  const collections = useCollectionsStore((s) => s.collections);
  const saveResponse = useCollectionsStore((s) => s.saveResponse);
  const deleteResponse = useCollectionsStore((s) => s.deleteResponse);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';
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
  const statusColor = hasError ? colors.error : response ? colors.success : colors.textMuted;
  const statusText = hasError
    ? `Error (${response.error?.code})`
    : response
    ? 'Success'
    : '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header with tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
        }}
      >
        <button
          onClick={() => setTab('response')}
          style={{
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            borderBottom: tab === 'response' ? `2px solid ${colors.accent}` : '2px solid transparent',
            color: tab === 'response' ? colors.text : colors.textDim,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: 'pointer',
          }}
        >
          Response
        </button>
        <button
          onClick={() => setTab('notifications')}
          style={{
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            borderBottom: tab === 'notifications' ? `2px solid ${colors.accent}` : '2px solid transparent',
            color: tab === 'notifications' ? colors.text : colors.textDim,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          Notifications
          {notifications.length > 0 && (
            <span
              style={{
                background: colors.accent,
                color: colors.white,
                borderRadius: '8px',
                padding: '0 6px',
                fontSize: '10px',
                lineHeight: '16px',
              }}
            >
              {notifications.length}
            </span>
          )}
        </button>

        <div style={{ flex: 1 }} />

        {tab === 'response' && statusText && !waitingForResult && (
          <>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: statusColor,
                padding: '2px 8px',
                borderRadius: '3px',
                background: statusColor + '18',
              }}
            >
              {statusText}
            </span>
            {responseTime !== null && (
              <span style={{ fontSize: '11px', color: colors.textDim, marginRight: '12px', marginLeft: '6px' }}>
                {responseTime}ms
              </span>
            )}
          </>
        )}

        {tab === 'response' && isSending && (
          <span style={{ fontSize: '11px', color: colors.warning, marginRight: '12px' }}>
            Sending...
          </span>
        )}

        {/* Save Response button — only when tab has a saved request ref and a response */}
        {tab === 'response' && savedRef && response && !isSending && (
          <div style={{ position: 'relative', marginRight: '4px' }}>
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
              Save Response
            </button>
          </div>
        )}

        {/* Saved responses dropdown toggle */}
        {tab === 'response' && savedResponses.length > 0 && (
          <div style={{ position: 'relative', marginRight: '8px' }}>
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
          </div>
        )}
      </div>

      {/* Save Response Name Input */}
      {showSaveResponseInput && savedRef && response && (
        <div
          style={{
            padding: '8px 12px',
            background: colors.surfaceLight,
            borderBottom: `1px solid ${colors.border}`,
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
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              outline: 'none',
            }}
            value={saveResponseName}
            onChange={(e) => setSaveResponseName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && saveResponseName.trim()) {
                saveResponse(savedRef.collectionId, savedRef.requestId, saveResponseName.trim(), response, responseTime, latestResult);
                setShowSaveResponseInput(false);
              }
              if (e.key === 'Escape') setShowSaveResponseInput(false);
            }}
          />
          <button
            onClick={() => {
              if (saveResponseName.trim()) {
                saveResponse(savedRef.collectionId, savedRef.requestId, saveResponseName.trim(), response, responseTime, latestResult);
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
            borderBottom: `1px solid ${colors.border}`,
            maxHeight: '200px',
            overflow: 'auto',
            background: colors.surfaceLight,
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
                borderBottom: `1px solid ${colors.border}`,
                cursor: 'pointer',
              }}
              onClick={() => {
                setViewingSavedResponse(sr);
                setShowSavedResponses(false);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.bg;
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
                x
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
            background: colors.success + '15',
            borderBottom: `1px solid ${colors.success}30`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: colors.success, fontWeight: 600 }}>
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
            padding: '12px',
            background: colors.warning + '0a',
            borderBottom: `1px solid ${colors.warning}30`,
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
                fontSize: '11px',
                fontWeight: 600,
                color:
                  (latestResult as Record<string, unknown>).resultCodeName === 'RESULT_OK'
                    ? colors.success
                    : colors.error,
                padding: '1px 8px',
                borderRadius: '3px',
                background:
                  ((latestResult as Record<string, unknown>).resultCodeName === 'RESULT_OK'
                    ? colors.success
                    : colors.error) + '18',
              }}
            >
              {String((latestResult as Record<string, unknown>).resultCodeName || 'UNKNOWN')}
            </span>
          </div>
          <div
            style={{
              background: colors.codeBg,
              padding: '10px',
              borderRadius: '4px',
              fontFamily: "'Consolas', 'Courier New', monospace",
              fontSize: '12px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: colors.text,
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            <JsonTree data={latestResult} />
          </div>
        </div>
      )}

      {/* Regular Response */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px',
          background: colors.codeBg,
          fontFamily: "'Consolas', 'Courier New', monospace",
          fontSize: '13px',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {response ? (
          <JsonTree data={response} />
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

// ── Waiting Banner with animation ─────────────────────────────

function WaitingBanner({
  startTime,
  onCancel,
}: {
  startTime: number | null;
  onCancel: () => void;
}) {
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
        background: `linear-gradient(135deg, ${colors.warning}12, ${colors.warning}08)`,
        borderBottom: `2px solid ${colors.warning}40`,
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
          (e.target as HTMLElement).style.background = colors.error + '20';
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
  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Clear button */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '6px 12px',
            borderBottom: `1px solid ${colors.border}`,
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
              borderBottom: `1px solid ${colors.border}`,
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
                  background: colors.codeBg,
                  padding: '6px 8px',
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  color: colors.textDim,
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

// ── JSON Tree Renderer ────────────────────────────────────────

function JsonTree({ data, indent = 0 }: { data: unknown; indent?: number }) {
  const pad = '  '.repeat(indent);

  if (data === null) return <span style={{ color: '#7c8491' }}>null</span>;
  if (data === undefined) return <span style={{ color: '#7c8491' }}>undefined</span>;

  if (typeof data === 'string') {
    return <span style={{ color: '#a5d6ff' }}>"{data}"</span>;
  }
  if (typeof data === 'number') {
    return <span style={{ color: '#79c0ff' }}>{data}</span>;
  }
  if (typeof data === 'boolean') {
    return <span style={{ color: '#ff7b72' }}>{String(data)}</span>;
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
            {pad}  <span style={{ color: '#d2a8ff' }}>"{key}"</span>: <JsonTree data={value} indent={indent + 1} />
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
