import React, { useEffect } from 'react';
import { useDeviceStore } from './store/deviceStore';
import { useNotificationStore } from './store/notificationStore';
import { colors } from './styles';
import DeviceBar from './components/DeviceBar/DeviceBar';
import Sidebar from './components/Sidebar/Sidebar';
import RequestPanel from './components/RequestPanel/RequestPanel';
import ResponsePanel from './components/ResponsePanel/ResponsePanel';

export default function App() {
  const { refreshDevices, setDevices, setConnectionStatus } = useDeviceStore();
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    refreshDevices();

    window.intentPostman.onDeviceChange((devices) => {
      setDevices(devices);
    });

    window.intentPostman.onConnectionStatus((status) => {
      setConnectionStatus(status);
    });

    window.intentPostman.onNotification((notification) => {
      addNotification(notification);
    });

    return () => {
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
  );
}
