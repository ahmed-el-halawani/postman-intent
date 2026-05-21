import React, { useState, useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useCollectionsStore } from '../../store/collectionsStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { useColors, useStyles } from '../../styles';
import { useDeviceStore } from '../../store/deviceStore';
import type { SavedResponse, JsonRpcResponse, IntentRequest } from '../../../shared/types';
import SearchableJsonTree from '../SearchableJsonTree';

type ResponseTab = 'request' | 'status' | 'result';
type RequestViewMode = 'adb' | 'json';

/* ── Adb Command Generator ─────────────────────────────────── */

function generateAdbCommand(req: IntentRequest): string {
  const parts: string[] = ['adb shell am'];

  if (req.intentType === 'activity') {
    parts.push(req.forResult ? 'start -f' : 'start');
  } else if (req.intentType === 'broadcast') {
    parts.push('broadcast');
  } else if (req.intentType === 'service') {
    parts.push('startservice');
  }

  if (req.action) parts.push(`-a ${req.action}`);
  if (req.component) parts.push(`-n ${req.component}`);
  if (req.data) parts.push(`-d "${req.data}"`);
  if (req.mimeType) parts.push(`-t ${req.mimeType}`);

  req.categories.forEach((cat) => parts.push(`-c ${cat}`));

  req.extras.forEach((extra) => {
    const { type, key, value } = extra;
    switch (type) {
      case 'string':
        parts.push(`-e "${key}" "${value}"`);
        break;
      case 'int':
        parts.push(`--ei "${key}" ${value}`);
        break;
      case 'long':
        parts.push(`--el "${key}" ${value}`);
        break;
      case 'float':
        parts.push(`--ef "${key}" ${value}`);
        break;
      case 'double':
        parts.push(`--ed "${key}" ${value}`);
        break;
      case 'bool':
        parts.push(`--ez "${key}" ${value}`);
        break;
      case 'uri':
        parts.push(`--eu "${key}" ${value}`);
        break;
      case 'string_array':
        parts.push(`-es "${key}" "${value}"`);
        break;
      case 'int_array':
        parts.push(`--eia "${key}" ${value}`);
        break;
    }
  });

  // Format with line breaks for readability
  const base = parts[0] + ' ' + parts[1];
  const rest = parts.slice(2);
  if (rest.length === 0) return base;
  return base + ' \\\n  ' + rest.join(' \\\n  ');
}

/* ── Syntax-Colored Adb Command ────────────────────────────── */

function AdbCommandView({ request }: { request: IntentRequest | null }) {
  const colors = useColors();
  if (!request) {
    return (
      <span style={{ color: colors.textMuted }}>
        No request data available.
      </span>
    );
  }

  const cmd = generateAdbCommand(request);
  const lines = cmd.split('\n');

  return (
    <div style={{ fontFamily: "'Consolas', 'Courier New', monospace", fontSize: '13px', lineHeight: '22px' }}>
      {lines.map((line, i) => {
        const tokens = tokenizeAdbLine(line, colors);
        return (
          <div key={i}>
            {tokens.map((tok, j) => (
              <span key={j} style={{ color: tok.color }}>{tok.text}</span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function tokenizeAdbLine(line: string, colors: ReturnType<typeof useColors>): { text: string; color: string }[] {
  // Simple tokenizer for adb command syntax coloring
  const tokens: { text: string; color: string }[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Leading whitespace
    const wsMatch = remaining.match(/^(\s+)/);
    if (wsMatch) {
      tokens.push({ text: wsMatch[1], color: colors.textMuted });
      remaining = remaining.slice(wsMatch[0].length);
      continue;
    }

    // Base command: adb shell am start/broadcast/startservice
    const baseMatch = remaining.match(/^(adb shell am\s+(?:start(?:\s+-f)?|broadcast|startservice))/);
    if (baseMatch) {
      tokens.push({ text: baseMatch[1], color: colors.textMuted });
      remaining = remaining.slice(baseMatch[0].length);
      continue;
    }

    // Backslash at end of line
    if (remaining.startsWith('\\')) {
      tokens.push({ text: '\\', color: colors.textDim });
      remaining = remaining.slice(1);
      continue;
    }

    // Option flags: -a, -n, -d, -t, -c, -e, --ei, --el, --ef, --ed, --ez, --eu, --eia, -es
    const flagMatch = remaining.match(/^(-[a-zA-Z]|-es|--e[a-z]{1,2})\s*/);
    if (flagMatch) {
      tokens.push({ text: flagMatch[1], color: colors.accentOrange });
      remaining = remaining.slice(flagMatch[1].length);
      continue;
    }

    // Quoted string
    const strMatch = remaining.match(/^"([^"]*)"/);
    if (strMatch) {
      tokens.push({ text: '"', color: colors.codeGreen });
      tokens.push({ text: strMatch[1], color: colors.codeGreen });
      tokens.push({ text: '"', color: colors.codeGreen });
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // Component name (package/activity with dots)
    const compMatch = remaining.match(/^([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)/);
    if (compMatch) {
      tokens.push({ text: compMatch[1], color: colors.codeCyan });
      remaining = remaining.slice(compMatch[0].length);
      continue;
    }

    // Number
    const numMatch = remaining.match(/^(-?\d+\.?\d*)/);
    if (numMatch) {
      tokens.push({ text: numMatch[1], color: colors.codeAmber });
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // Default: single char
    tokens.push({ text: remaining[0], color: colors.textSecondary });
    remaining = remaining.slice(1);
  }

  return tokens;
}

/* ── Main Component ────────────────────────────────────────── */

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
  const activityResult = activeTab?.activityResult ?? null;

  const collections = useCollectionsStore((s) => s.collections);
  const saveResponse = useCollectionsStore((s) => s.saveResponse);
  const deleteResponse = useCollectionsStore((s) => s.deleteResponse);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected';
  const colors = useColors();
  const { ghostButton } = useStyles();

  const [tab, setTab] = useState<ResponseTab>('status');
  const [requestViewMode, setRequestViewMode] = useState<RequestViewMode>('adb');
  const [showSaveResponseInput, setShowSaveResponseInput] = useState(false);
  const [saveResponseName, setSaveResponseName] = useState('');
  const [showSavedResponses, setShowSavedResponses] = useState(false);
  const [viewingSavedResponse, setViewingSavedResponse] = useState<SavedResponse | null>(null);
  const setSidebarTab = useSidebarStore((s) => s.setActiveTab);

  const isForResult = currentRequest?.forResult ?? false;

  // Get saved responses for current tab's saved request
  const savedResponses: SavedResponse[] = (() => {
    if (!savedRef) return [];
    const col = collections.find((c) => c.id === savedRef.collectionId);
    const req = col?.requests.find((r) => r.id === savedRef.requestId);
    return req?.savedResponses || [];
  })();

  // Auto-switch tabs when request completes
  useEffect(() => {
    if (!isSending && response) {
      if (isForResult) {
        setTab('result');
      } else {
        setTab('status');
      }
    }
  }, [isSending, response, isForResult]);

  // Auto-switch to result tab when activityResult arrives
  useEffect(() => {
    if (activityResult) {
      setTab('result');
    }
  }, [activityResult]);

  // Determine header status
  const displayResponse = viewingSavedResponse ? viewingSavedResponse.response : response;
  const displayResponseTime = viewingSavedResponse
    ? (viewingSavedResponse.responseTime ?? null)
    : responseTime;
  const displayActivityResult = viewingSavedResponse
    ? (viewingSavedResponse.activityResult ?? null)
    : activityResult;
  const displayIsSending = viewingSavedResponse ? false : isSending;
  const displayRequest = viewingSavedResponse ? viewingSavedResponse.request : currentRequest;

  const hasError = displayResponse?.error;
  const resultCodeName = displayActivityResult
    ? String(displayActivityResult.resultCodeName || 'UNKNOWN')
    : '';

  let statusText = '';
  let statusColor = colors.textMuted;
  let statusBg = 'transparent';
  let codeValue: number | string | null = null;

  if (displayIsSending) {
    statusText = 'Sending...';
    statusColor = colors.warning;
    statusBg = colors.warning + '15';
  } else if (hasError) {
    statusText = `Error ${displayResponse.error?.code || ''}`;
    statusColor = colors.error;
    statusBg = colors.error + '15';
    codeValue = displayResponse.error?.code ?? null;
  } else if (displayActivityResult) {
    statusText = resultCodeName;
    if (resultCodeName === 'RESULT_OK') {
      statusColor = colors.success;
      statusBg = colors.success + '15';
    } else if (resultCodeName === 'RESULT_CANCELED') {
      statusColor = colors.warning;
      statusBg = colors.warning + '15';
    } else {
      statusColor = colors.error;
      statusBg = colors.error + '15';
    }
    codeValue = typeof displayActivityResult.resultCode === 'number'
      ? displayActivityResult.resultCode
      : (resultCodeName === 'RESULT_OK' ? 0 : resultCodeName === 'RESULT_CANCELED' ? -1 : 0);
  } else if (displayResponse) {
    statusText = '200 OK';
    statusColor = colors.success;
    statusBg = colors.success + '15';
    codeValue = 0;
  }

  const sizeText = displayResponse
    ? `${(JSON.stringify(displayResponse).length / 1024).toFixed(1)} KB`
    : null;

  const handleCopyResponse = () => {
    if (displayResponse) {
      navigator.clipboard.writeText(JSON.stringify(displayResponse, null, 2));
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
      {/* ── Header Strip ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: `1px solid ${colors.borderLight}`,
          background: colors.surface,
        }}
      >
        {/* Left: Response label + Status Pill + Meta chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text }}>
            Response
          </span>

          {statusText && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 700,
                color: statusColor,
                background: statusBg,
                padding: '3px 10px',
                borderRadius: '3px',
                border: `1px solid ${statusColor}30`,
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: statusColor,
                  display: 'inline-block',
                }}
              />
              {statusText}
            </span>
          )}

          {displayResponseTime !== null && (
            <span style={{ fontSize: '11px', color: colors.textDim }}>
              Time: <span style={{ color: colors.text, fontWeight: 500 }}>{displayResponseTime}ms</span>
            </span>
          )}

          {sizeText && (
            <span style={{ fontSize: '11px', color: colors.textDim }}>
              Size: <span style={{ color: colors.text, fontWeight: 500 }}>{sizeText}</span>
            </span>
          )}

          {codeValue !== null && (
            <span style={{ fontSize: '11px', color: colors.textDim }}>
              Code: <span style={{ color: colors.text, fontWeight: 500 }}>{codeValue}</span>
            </span>
          )}
        </div>

        {/* Right: Icon buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Save Response button */}
          {savedRef && displayResponse && !displayIsSending && !viewingSavedResponse && (
            <button
              onClick={() => {
                setSaveResponseName(
                  displayResponse.error
                    ? `Error ${displayResponse.error.code}`
                    : `Response ${new Date().toLocaleTimeString()}`
                );
                setShowSaveResponseInput(true);
              }}
              style={{
                ...ghostButton,
                fontSize: '10px',
                padding: '3px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Save response"
            >
              {/* Save icon (floppy disk) */}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2h5l3 3v5a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z" />
                <path d="M6 1v4" />
                <path d="M4 9h4" />
              </svg>
              Save
            </button>
          )}

          {/* Saved responses dropdown toggle */}
          {savedResponses.length > 0 && (
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
          {displayResponse && (
            <button
              onClick={handleCopyResponse}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: colors.textMuted,
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Copy response"
            >
              <svg width="14" height="14" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="1" width="8" height="10" rx="1" />
                <path d="M1 4v9a1 1 0 001 1h7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          padding: '0 16px',
          borderBottom: `1px solid ${colors.borderLight}`,
          background: colors.surface,
        }}
      >
        {([
          { id: 'request' as ResponseTab, label: 'Request' },
          { id: 'status' as ResponseTab, label: 'Request Status' },
          { id: 'result' as ResponseTab, label: 'Result' },
        ]).map((t) => {
          const isActive = tab === t.id;
          const isDisabled = t.id === 'result' && !isForResult && !viewingSavedResponse;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (!isDisabled) setTab(t.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${colors.accentOrange}` : '2px solid transparent',
                color: isDisabled ? colors.textMuted + '60' : isActive ? colors.accentOrange : colors.textDim,
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                padding: isActive ? '8px 0 10px' : '8px 0',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'color 0.1s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Save Response Name Input ───────────────────────── */}
      {showSaveResponseInput && savedRef && displayResponse && (
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
                saveResponse(
                  savedRef.collectionId,
                  savedRef.requestId,
                  saveResponseName.trim(),
                  currentRequest,
                  displayResponse,
                  displayResponseTime,
                  displayActivityResult
                );
                setShowSaveResponseInput(false);
              }
              if (e.key === 'Escape') setShowSaveResponseInput(false);
            }}
          />
          <button
            onClick={() => {
              if (saveResponseName.trim() && currentRequest) {
                saveResponse(
                  savedRef.collectionId,
                  savedRef.requestId,
                  saveResponseName.trim(),
                  currentRequest,
                  displayResponse,
                  displayResponseTime,
                  displayActivityResult
                );
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

      {/* ── Saved Responses Dropdown ───────────────────────── */}
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
                setSidebarTab('collections');
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

      {/* ── Viewing saved response banner ──────────────────── */}
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

      {/* ── Body ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'request' && (
          <RequestView
            request={displayRequest}
            isConnected={isConnected}
            viewMode={requestViewMode}
            onViewModeChange={setRequestViewMode}
          />
        )}
        {tab === 'status' && (
          <StatusView
            response={displayResponse}
            isConnected={isConnected}
          />
        )}
        {tab === 'result' && (
          <ResultView
            activityResult={displayActivityResult}
            waitingForResult={viewingSavedResponse ? false : waitingForResult}
            waitingStartTime={viewingSavedResponse ? null : waitingStartTime}
            onCancelWaiting={cancelWaiting}
          />
        )}
      </div>
    </div>
  );
}

/* ── Request View ──────────────────────────────────────────── */

function RequestView({
  request,
  isConnected,
  viewMode,
  onViewModeChange,
}: {
  request: IntentRequest | null;
  isConnected: boolean;
  viewMode: RequestViewMode;
  onViewModeChange: (mode: RequestViewMode) => void;
}) {
  const colors = useColors();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderBottom: `1px solid ${colors.borderLight}`,
          background: colors.surface,
        }}
      >
        <button
          onClick={() => onViewModeChange('adb')}
          style={{
            padding: '4px 10px',
            background: viewMode === 'adb' ? colors.accentOrange + '15' : 'transparent',
            color: viewMode === 'adb' ? colors.accentOrange : colors.textDim,
            border: `1px solid ${viewMode === 'adb' ? colors.accentOrange : colors.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: viewMode === 'adb' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          adb command
        </button>
        <button
          onClick={() => onViewModeChange('json')}
          style={{
            padding: '4px 10px',
            background: viewMode === 'json' ? colors.accentOrange + '15' : 'transparent',
            color: viewMode === 'json' ? colors.accentOrange : colors.textDim,
            border: `1px solid ${viewMode === 'json' ? colors.accentOrange : colors.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: viewMode === 'json' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          raw JSON
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          background: colors.codeBg,
          fontFamily: "'Consolas', 'Courier New', monospace",
          fontSize: '13px',
          lineHeight: '22px',
        }}
      >
        {request ? (
          viewMode === 'adb' ? (
            <AdbCommandView request={request} />
          ) : (
            <SearchableJsonTree data={request} />
          )
        ) : (
          <span style={{ color: colors.textMuted }}>
            {isConnected
              ? 'Send a request to see the request payload here'
              : 'Connect to a device to get started'}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Status View ───────────────────────────────────────────── */

function StatusView({
  response,
  isConnected,
}: {
  response: JsonRpcResponse | null;
  isConnected: boolean;
}) {
  const colors = useColors();

  if (!response) {
    return (
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          color: colors.textMuted,
          fontSize: '13px',
        }}
      >
        {isConnected
          ? 'Send a request to see the response here'
          : 'Connect to a device to get started'}
      </div>
    );
  }

  return <SearchableJsonTree data={response} />;
}

/* ── Result View ───────────────────────────────────────────── */

function ResultView({
  activityResult,
  waitingForResult,
  waitingStartTime,
  onCancelWaiting,
}: {
  activityResult: Record<string, unknown> | null;
  waitingForResult: boolean;
  waitingStartTime: number | null;
  onCancelWaiting: () => void;
}) {
  const colors = useColors();
  const resultCodeName = activityResult
    ? String(activityResult.resultCodeName || 'UNKNOWN')
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Activity Result status bar */}
      {activityResult != null && !waitingForResult && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderBottom: `1px solid ${colors.borderLight}`,
            background: colors.surface,
          }}
        >
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
                resultCodeName === 'RESULT_OK'
                  ? colors.success
                  : resultCodeName === 'RESULT_CANCELED'
                  ? colors.warning
                  : colors.error,
              padding: '2px 8px',
              borderRadius: '2px',
              background:
                resultCodeName === 'RESULT_OK'
                  ? colors.success + '15'
                  : resultCodeName === 'RESULT_CANCELED'
                  ? colors.warning + '15'
                  : colors.error + '15',
            }}
          >
            {resultCodeName}
          </span>
        </div>
      )}

      {/* Waiting for Result banner */}
      {waitingForResult && (
        <WaitingBanner startTime={waitingStartTime} onCancel={onCancelWaiting} />
      )}

      {/* Result body */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activityResult != null && !waitingForResult ? (
          <SearchableJsonTree data={activityResult} />
        ) : !waitingForResult ? (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              color: colors.textMuted,
              fontSize: '13px',
            }}
          >
            No activity result yet. Send a forResult request to see the result here.
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Waiting Banner with animation ─────────────────────────── */

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
