import React from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, button } from '../../styles';

export default function DeviceBar() {
  const {
    devices,
    selectedSerial,
    connectionStatus,
    needsInstall,
    setSelectedSerial,
    refreshDevices,
    connect,
    disconnect,
    installAndConnect,
    dismissInstall,
  } = useDeviceStore();

  const isConnected = connectionStatus === 'connected';

  const handleConnect = async () => {
    if (isConnected) {
      await disconnect();
    } else {
      await connect();
    }
  };

  const statusColor =
    connectionStatus === 'connected'
      ? colors.success
      : connectionStatus === 'connecting'
      ? colors.warning
      : connectionStatus === 'error'
      ? colors.error
      : '#666';

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 14px',
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <span
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: colors.accent,
            whiteSpace: 'nowrap',
            letterSpacing: '-0.3px',
          }}
        >
          Intent Postman
        </span>

        <div style={{ width: '1px', height: '20px', background: colors.border }} />

        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
          }}
          title={connectionStatus}
        />
        <span style={{ fontSize: '11px', color: colors.textDim, whiteSpace: 'nowrap' }}>
          {connectionStatus}
        </span>

        <select
          style={{
            flex: 1,
            maxWidth: '300px',
            padding: '5px 8px',
            background: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
            fontSize: '12px',
          }}
          value={selectedSerial}
          onChange={(e) => setSelectedSerial(e.target.value)}
          disabled={isConnected}
        >
          <option value="">-- Select Device --</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.model ? `${d.model} (${d.id})` : d.id} [{d.type}]
            </option>
          ))}
        </select>

        <button
          style={{
            ...button,
            background: colors.accentDark,
            color: colors.text,
            fontSize: '11px',
            padding: '5px 10px',
          }}
          onClick={refreshDevices}
          disabled={isConnected}
        >
          Refresh
        </button>

        <button
          style={{
            ...button,
            background: isConnected ? '#444' : colors.accent,
            color: colors.white,
            fontSize: '11px',
            padding: '5px 12px',
          }}
          onClick={handleConnect}
          disabled={!selectedSerial && !isConnected}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {needsInstall && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '24px 32px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.warning, marginBottom: '12px' }}>
              Install Intent Postman?
            </div>
            <div style={{ fontSize: '13px', color: colors.text, lineHeight: 1.5, marginBottom: '20px' }}>
              The Intent Postman Android app is not installed on this device. Install it now to continue?
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                style={{
                  ...button,
                  background: '#555',
                  color: colors.text,
                  fontSize: '13px',
                  padding: '8px 24px',
                }}
                onClick={dismissInstall}
              >
                Cancel
              </button>
              <button
                style={{
                  ...button,
                  background: colors.accent,
                  color: colors.white,
                  fontSize: '13px',
                  padding: '8px 24px',
                }}
                onClick={installAndConnect}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
