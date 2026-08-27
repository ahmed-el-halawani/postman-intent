import React, { useEffect, useState, useCallback } from 'react';
import { useDeviceStore } from './store/deviceStore';
import { useNotificationStore } from './store/notificationStore';
import { useBroadcastStore } from './store/broadcastStore';
import { useServiceStore } from './store/serviceStore';
import { useTabStore } from './store/tabStore';
import { useCollectionsStore } from './store/collectionsStore';
import { useLayoutStore } from './store/layoutStore';
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
  const panelOrientation = useLayoutStore((s) => s.panelOrientation);
  const toggleOrientation = useLayoutStore((s) => s.toggle);
  const isHorizontal = panelOrientation === 'horizontal';
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
      if (isHorizontal) {
        const ratio = (e.clientY - rect.top) / rect.height;
        setRequestPanelRatio(Math.max(0.25, Math.min(0.75, ratio)));
      } else {
        const ratio = (e.clientX - rect.left) / rect.width;
        setRequestPanelRatio(Math.max(0.25, Math.min(0.75, ratio)));
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isHorizontal]);

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

      // Route activity result to the correct tab by requestId
      if (notification.method === 'intent.result' && notification.params) {
        const params = notification.params as Record<string, unknown>;
        const resultRequestId = params.requestId as string | undefined;
        if (resultRequestId) {
          useTabStore.getState().setActivityResult(resultRequestId, params);
        }
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

          {/* Split: Request / Response — orientation-aware */}
          <div
            id="main-content-area"
            style={{
              display: 'flex',
              flexDirection: isHorizontal ? 'column' : 'row',
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {/* Request Panel */}
            <div
              style={{
                ...(isHorizontal
                  ? { height: `${requestPanelRatio * 100}%` }
                  : { width: `${requestPanelRatio * 100}%` }),
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
                ...(isHorizontal
                  ? { height: '4px', minHeight: '4px', cursor: 'row-resize', borderTop: `1px solid ${colors.border}` }
                  : { width: '4px', minWidth: '4px', cursor: 'col-resize', borderLeft: `1px solid ${colors.border}` }),
                background: colors.borderLight,
                flexShrink: 0,
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
            <div style={{ flex: 1, overflow: 'hidden', ...(isHorizontal ? { minHeight: '100px' } : { minWidth: '200px' }) }}>
              <ResponsePanel />
            </div>
          </div>
        </div>

        {/* Right Action Sidebar */}
        <div
          style={{
            position: 'relative',
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

          {/* Layout toggle */}
          <button
            onClick={toggleOrientation}
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: colors.textMuted,
            }}
            title={isHorizontal ? 'Switch to side-by-side' : 'Switch to stacked'}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = colors.accentOrange;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = colors.textMuted;
            }}
          >
            {isHorizontal ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="8" height="14" rx="1" />
                <rect x="11" y="3" width="8" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="1" width="14" height="8" rx="1" />
                <rect x="3" y="11" width="14" height="8" rx="1" />
              </svg>
            )}
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
