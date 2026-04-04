import React from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { colors, button } from '../../styles';

export default function DeviceBar() {
  const {
    devices,
    selectedSerial,
    connectionStatus,
    setSelectedSerial,
    refreshDevices,
    connect,
    disconnect,
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
      : connectionStatus === 'installing'
      ? '#2196F3'
      : connectionStatus === 'error'
      ? colors.error
      : '#666';

  return (
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
  );
}
