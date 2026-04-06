import React, { useEffect, useState, useCallback } from 'react';
import { useDeviceStore } from './store/deviceStore';
import { useNotificationStore } from './store/notificationStore';
import { useBroadcastStore } from './store/broadcastStore';
import { useServiceStore } from './store/serviceStore';
import { useTabStore } from './store/tabStore';
import { useCollectionsStore } from './store/collectionsStore';
import { useColors } from './styles';
import DeviceBar from './components/DeviceBar/DeviceBar';
import Sidebar from './components/Sidebar/Sidebar';
import RequestPanel from './components/RequestPanel/RequestPanel';
import ResponsePanel from './components/ResponsePanel/ResponsePanel';
import TabBar from './components/TabBar/TabBar';
import SaveToCollectionDialog from './components/Sidebar/SaveToCollectionDialog';
import UnsavedChangesDialog from './components/TabBar/UnsavedChangesDialog';

export default function App() {
  const { refreshDevices, setDevices, setConnectionStatus } = useDeviceStore();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const showSaveDialog = useTabStore((s) => s.showSaveDialog);
  const showUnsavedDialog = useTabStore((s) => s.showUnsavedDialog);
  const colors = useColors();

  // Resize state for request/response horizontal split
  const [requestPanelRatio, setRequestPanelRatio] = useState(0.5);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const mainArea = document.getElementById('main-content-area');
      if (!mainArea) return;
      const rect = mainArea.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setRequestPanelRatio(Math.max(0.25, Math.min(0.75, ratio)));
    };

    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    refreshDevices();

    // Load collections from disk
    useCollectionsStore.getState().loadFromDisk();

    window.intentPostman.onDeviceChange((devices) => {
      setDevices(devices);
    });

    window.intentPostman.onConnectionStatus((status) => {
      setConnectionStatus(status);
    });

    window.intentPostman.onNotification((notification) => {
      // Route broadcast events to broadcastStore
      if (notification.method === 'broadcast.event' && notification.params) {
        useBroadcastStore.getState().addEvent({
          listenerId: notification.params.listenerId as string,
          action: notification.params.action as string,
          timestamp: (notification.params.timestamp as string) || new Date().toISOString(),
          extras: notification.params.extras as Record<string, unknown> | undefined,
          dataUri: notification.params.dataUri as string | undefined,
          mimeType: notification.params.mimeType as string | undefined,
        });
      }

      // Route service notifications to serviceStore
      if (notification.method === 'service.connected' && notification.params) {
        useServiceStore.getState().handleServiceConnected(notification.params);
      }
      if (notification.method === 'service.disconnected' && notification.params) {
        useServiceStore.getState().handleServiceDisconnected(notification.params);
      }

      // Cancel waiting state on any tab when activity result arrives
      if (notification.method === 'intent.result') {
        useTabStore.getState().cancelWaiting();
      }

      // Always add to general notification store
      addNotification(notification);
    });

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        useTabStore.getState().saveTab();
      }
      // Ctrl+N: New tab
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        useTabStore.getState().createTab();
      }
      // Ctrl+W: Close tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        const { activeTabId } = useTabStore.getState();
        useTabStore.getState().requestCloseTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.intentPostman.removeAllListeners('devices:changed');
      window.intentPostman.removeAllListeners('connection:status');
      window.intentPostman.removeAllListeners('command:notification');
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: colors.bg,
        color: colors.text,
        fontFamily: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <DeviceBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        {/* Main content area with tab bar */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <TabBar />

          {/* Horizontal split: Request (left) / Response (right) */}
          <div
            id="main-content-area"
            style={{
              display: 'flex',
              flexDirection: 'row',
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {/* Request Panel */}
            <div
              style={{
                width: `${requestPanelRatio * 100}%`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <RequestPanel />
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={handleResizeMouseDown}
              style={{
                width: '4px',
                minWidth: '4px',
                background: colors.borderLight,
                cursor: 'col-resize',
                flexShrink: 0,
                borderLeft: `1px solid ${colors.border}`,
                transition: isResizing ? 'none' : 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.accentOrange + '40';
              }}
              onMouseLeave={(e) => {
                if (!isResizing) {
                  (e.currentTarget as HTMLElement).style.background = colors.borderLight;
                }
              }}
            />

            {/* Response Panel */}
            <div style={{ flex: 1, overflow: 'hidden', minWidth: '200px' }}>
              <ResponsePanel />
            </div>
          </div>
        </div>

        {/* Right Action Sidebar */}
        <div
          style={{
            width: '48px',
            minWidth: '48px',
            background: colors.surfaceLight,
            borderLeft: `1px solid ${colors.borderLight}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            padding: '16px 0',
          }}
        >
          {/* Code icon */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: colors.textMuted,
              fontSize: '16px',
            }}
            title="Code"
          >
            {'</>'}
          </button>
          {/* Docs icon */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: colors.textMuted,
              fontSize: '14px',
            }}
            title="Documentation"
          >
            &#128196;
          </button>
          {/* Comments icon */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: colors.textMuted,
              fontSize: '14px',
            }}
            title="Comments"
          >
            &#128172;
          </button>
        </div>
      </div>

      {/* Save to collection dialog */}
      {showSaveDialog && <SaveToCollectionDialog />}

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && <UnsavedChangesDialog />}
    </div>
  );
}
