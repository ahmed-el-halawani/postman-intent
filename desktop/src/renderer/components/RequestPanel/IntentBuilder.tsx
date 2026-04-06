import React, { useState, useRef } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useColors, useStyles } from '../../styles';
import { COMMON_ACTIONS, INTENT_FLAGS } from '../../../shared/types';
import ExtrasEditor from './ExtrasEditor';

// Group flags by category for Figma-style display
const ACTIVITY_LIFECYCLE_FLAGS = INTENT_FLAGS.filter((f) =>
  f.startsWith('FLAG_ACTIVITY_')
);
const RECEIVER_FLAGS = INTENT_FLAGS.filter((f) =>
  f.startsWith('FLAG_RECEIVER_')
);
const OTHER_FLAGS = INTENT_FLAGS.filter(
  (f) => !f.startsWith('FLAG_ACTIVITY_') && !f.startsWith('FLAG_RECEIVER_')
);

type Section = 'params' | 'extras' | 'flags';

interface IntentBuilderProps {
  section?: Section;
}

export default function IntentBuilder({ section = 'params' }: IntentBuilderProps) {
  const colors = useColors();
  const { label } = useStyles();
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateRequest = useTabStore((s) => s.updateRequest);
  const request = tab?.request || { action: '', component: '', data: '', mimeType: '', categories: [] as string[], flags: [] as string[], intentType: 'activity' as const, extras: [], forResult: false };
  const [showActions, setShowActions] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const actionRef = useRef<HTMLDivElement>(null);

  const filteredActions = COMMON_ACTIONS.filter((a) =>
    a.toLowerCase().includes((actionFilter || request.action).toLowerCase())
  );

  const toggleFlag = (flag: string) => {
    const flags = request.flags.includes(flag)
      ? request.flags.filter((f) => f !== flag)
      : [...request.flags, flag];
    updateRequest({ flags });
  };

  // Table row data for Params section
  const paramRows = [
    { key: 'ACTION', value: request.action, field: 'action' as const, description: 'Primary operation to perform', hasAutocomplete: true },
    { key: 'COMPONENT', value: request.component, field: 'component' as const, description: 'Specific component to start' },
    { key: 'CATEGORY', value: request.categories.join(', '), field: 'categories' as const, description: 'Additional information for resolution' },
    { key: 'DATA URI', value: request.data, field: 'data' as const, description: 'Target data URI for the intent' },
    { key: 'MIME TYPE', value: request.mimeType, field: 'mimeType' as const, description: 'Explicit type of the intent data' },
  ];

  if (section === 'extras') {
    return (
      <div style={{ padding: '16px' }}>
        <ExtrasEditor />
      </div>
    );
  }

  if (section === 'flags') {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Activity Lifecycle Flags */}
        {ACTIVITY_LIFECYCLE_FLAGS.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ ...label, marginBottom: 0 }}>Activity Lifecycle Flags</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ACTIVITY_LIFECYCLE_FLAGS.map((flag) => {
                const active = request.flags.includes(flag);
                return (
                  <label
                    key={flag}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      onClick={() => toggleFlag(flag)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '2px',
                        border: active ? 'none' : `1px solid ${colors.border}`,
                        background: active ? colors.accent : colors.surface,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {active && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: colors.textSecondary,
                      }}
                    >
                      {flag}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Receiver Flags */}
        {RECEIVER_FLAGS.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ ...label, marginBottom: 0 }}>Receiver Flags</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {RECEIVER_FLAGS.map((flag) => {
                const active = request.flags.includes(flag);
                return (
                  <label
                    key={flag}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      onClick={() => toggleFlag(flag)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '2px',
                        border: active ? 'none' : `1px solid ${colors.border}`,
                        background: active ? colors.accent : colors.surface,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {active && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: colors.textSecondary,
                      }}
                    >
                      {flag}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Other Flags */}
        {OTHER_FLAGS.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ ...label, marginBottom: 0 }}>Other Flags</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {OTHER_FLAGS.map((flag) => {
                const active = request.flags.includes(flag);
                return (
                  <label
                    key={flag}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      onClick={() => toggleFlag(flag)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '2px',
                        border: active ? 'none' : `1px solid ${colors.border}`,
                        background: active ? colors.accent : colors.surface,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {active && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: colors.textSecondary,
                      }}
                    >
                      {flag}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

      </div>
    );
  }

  // Params section — Table layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px' }}>
      {/* Section heading */}
      <div style={{ ...label, marginBottom: 0 }}>Intent Configuration</div>

      {/* Table */}
      <div style={{ border: `1px solid ${colors.borderLight}`, borderRadius: '0' }}>
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${colors.borderLight}`,
          }}
        >
          <div style={{ width: '40px', padding: '8px 12px', flexShrink: 0 }} />
          <div
            style={{
              width: '192px',
              flexShrink: 0,
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}
          >
            Key
          </div>
          <div
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '-0.55px',
              borderRight: `1px solid ${colors.borderLight}`,
            }}
          >
            Value
          </div>
          <div
            style={{
              width: '250px',
              flexShrink: 0,
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '-0.55px',
            }}
          >
            Description
          </div>
        </div>

        {/* Data rows */}
        {paramRows.map((row, idx) => (
          <div
            key={row.field}
            style={{
              display: 'flex',
              borderBottom: `1px solid ${colors.borderLight}`,
              alignItems: 'center',
            }}
          >
            {/* Checkbox */}
            <div style={{ width: '40px', padding: '12px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '2px',
                  border: row.value ? 'none' : `1px solid ${colors.border}`,
                  background: row.value ? colors.accent : colors.surface,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {row.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>

            {/* Key (dropdown-style label) */}
            <div
              style={{
                width: '192px',
                flexShrink: 0,
                padding: '6px 8px',
                borderRight: `1px solid ${colors.borderLight}`,
                background: colors.surfaceLight + '4D',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 12px',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary }}>
                  {row.key}
                </span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: 0.4 }}>
                  <path d="M1 1L5 5L9 1" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Value */}
            <div
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRight: `1px solid ${colors.borderLight}`,
                position: 'relative',
              }}
              ref={row.hasAutocomplete ? actionRef : undefined}
            >
              <input
                style={{
                  width: '100%',
                  padding: '4px 0',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  color: colors.textSecondary,
                  fontFamily: "'Inter', sans-serif",
                }}
                value={row.field === 'categories' ? request.categories.join(', ') : row.value}
                onChange={(e) => {
                  if (row.field === 'categories') {
                    updateRequest({
                      categories: e.target.value
                        .split(',')
                        .map((c) => c.trim())
                        .filter(Boolean),
                    });
                  } else {
                    updateRequest({ [row.field]: e.target.value });
                  }
                  if (row.hasAutocomplete) setShowActions(true);
                }}
                onFocus={() => {
                  if (row.hasAutocomplete) setShowActions(true);
                }}
                onBlur={() => {
                  if (row.hasAutocomplete) setTimeout(() => setShowActions(false), 200);
                }}
                placeholder={
                  row.field === 'action' ? 'e.g. android.intent.action.VIEW' :
                  row.field === 'component' ? 'com.example.app/.MainActivity' :
                  row.field === 'categories' ? 'android.intent.category.DEFAULT' :
                  row.field === 'data' ? 'https://example.com' :
                  'application/json'
                }
              />

              {/* Action autocomplete dropdown */}
              {row.hasAutocomplete && showActions && filteredActions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '180px',
                    overflow: 'auto',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0 0 4px 4px',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                >
                  {filteredActions.map((action) => (
                    <div
                      key={action}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        color: colors.textSecondary,
                      }}
                      onMouseDown={() => {
                        updateRequest({ action });
                        setShowActions(false);
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.background = colors.surfaceLight;
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      {action}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div
              style={{
                width: '250px',
                flexShrink: 0,
                padding: '12px',
                fontSize: '13px',
                fontStyle: 'italic',
                color: colors.textMuted,
              }}
            >
              {row.description}
            </div>
          </div>
        ))}

        {/* Empty row for adding new params */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${colors.borderLight}`,
            alignItems: 'center',
            opacity: 0.6,
          }}
        >
          <div style={{ width: '40px', padding: '12px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '2px',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
              }}
            />
          </div>
          <div
            style={{
              width: '192px',
              flexShrink: 0,
              padding: '8px 20px',
              borderRight: `1px solid ${colors.borderLight}`,
              background: colors.surfaceLight + '4D',
              fontSize: '13px',
              fontWeight: 500,
              color: colors.textMuted,
            }}
          >
            Select Key
          </div>
          <div
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRight: `1px solid ${colors.borderLight}`,
              fontSize: '13px',
              color: colors.textMuted,
            }}
          >
            Value
          </div>
          <div
            style={{
              width: '250px',
              flexShrink: 0,
              padding: '8px 12px',
              fontSize: '13px',
              color: colors.textMuted,
            }}
          >
            Description
          </div>
        </div>
      </div>
    </div>
  );
}
