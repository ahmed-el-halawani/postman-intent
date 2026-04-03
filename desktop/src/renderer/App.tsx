import React, { useEffect } from 'react';
import { useDeviceStore } from './store/deviceStore';
import { useNotificationStore } from './store/notificationStore';
import { useBroadcastStore } from './store/broadcastStore';
import { useServiceStore } from './store/serviceStore';
import { useTabStore } from './store/tabStore';
import { useCollectionsStore } from './store/collectionsStore';
import { colors } from './styles';
import DeviceBar from './components/DeviceBar/DeviceBar';
import Sidebar from './components/Sidebar/Sidebar';
import RequestPanel from './components/RequestPanel/RequestPanel';
import ResponsePanel from './components/ResponsePanel/ResponsePanel';
import TabBar from './components/TabBar/TabBar';
import SaveToCollectionDialog from './components/Sidebar/SaveToCollectionDialog';

export default function App() {
  const { refreshDevices, setDevices, setConnectionStatus } = useDeviceStore();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const showSaveDialog = useTabStore((s) => s.showSaveDialog);

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

      // Route AIDL notifications to serviceStore
      if (notification.method === 'aidl.connected' && notification.params) {
        useServiceStore.getState().handleAidlConnected(notification.params);
      }
      if (notification.method === 'aidl.disconnected' && notification.params) {
        useServiceStore.getState().handleAidlDisconnected(notification.params);
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
        useTabStore.getState().closeTab(activeTabId);
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
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <DeviceBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        {/* Main content area with tab bar */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <TabBar />

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Request Panel */}
            <div
              style={{
                flex: 1,
                borderRight: `1px solid ${colors.border}`,
                overflow: 'hidden',
              }}
            >
              <RequestPanel />
            </div>

            {/* Response Panel */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ResponsePanel />
            </div>
          </div>
        </div>
      </div>

      {/* Save to collection dialog */}
      {showSaveDialog && <SaveToCollectionDialog />}
    </div>
  );
}
