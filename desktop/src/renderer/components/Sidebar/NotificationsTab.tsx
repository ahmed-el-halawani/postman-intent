import React from 'react';
import { useNotificationStore } from '../../store/notificationStore';
import { useColors } from '../../styles';
import JsonTree from '../JsonTree';

export default function NotificationsTab() {
  const colors = useColors();
  const { notifications, clearNotifications } = useNotificationStore();

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Clear button */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '6px 12px',
            borderBottom: `1px solid ${colors.sidebarBorder}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={clearNotifications}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.sidebarTextDim,
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
          <span style={{ fontSize: '12px', color: colors.sidebarTextDim }}>
            No notifications yet. Activity results and broadcast events will appear here.
          </span>
        </div>
      ) : (
        notifications.map((n, i) => (
          <div
            key={i}
            style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${colors.sidebarBorder}`,
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
