import React from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useColors, useStyles } from '../../styles';
import { useThemeStore } from '../../store/themeStore';

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

  const colors = useColors();
  const { button } = useStyles();
  const { mode, toggleTheme } = useThemeStore();
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
      ? '#22c55e'
      : connectionStatus === 'connecting'
      ? colors.warning
      : connectionStatus === 'error'
      ? colors.error
      : '#94a3b8';

  const statusTextColor =
    connectionStatus === 'connected'
      ? '#16a34a'
      : connectionStatus === 'connecting'
      ? colors.warning
      : connectionStatus === 'error'
      ? colors.error
      : colors.textMuted;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '9px 16px 10px',
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {/* Logo / Branding */}
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: colors.text,
            whiteSpace: 'nowrap',
            letterSpacing: '-0.9px',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          API Architect
        </span>

        {/* Device Connect Section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: colors.surfaceLight,
            border: '1px solid rgba(225, 191, 181, 0.2)',
            borderRadius: '4px',
            padding: '5px',
          }}
        >
          {/* Device Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px',
              borderRadius: '2px',
            }}
          >
            {/* Phone icon */}
            <svg width="13" height="18" viewBox="0 0 13 18" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="1" width="11" height="16" rx="2" stroke={colors.textSecondary} strokeWidth="1.5" fill="none" />
              <circle cx="6.5" cy="14.5" r="1" fill={colors.textSecondary} />
            </svg>

            <select
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.text,
                fontSize: '12px',
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                outline: 'none',
                cursor: 'pointer',
                padding: '0',
                minWidth: '100px',
              }}
              value={selectedSerial}
              onChange={(e) => setSelectedSerial(e.target.value)}
              disabled={isConnected}
            >
              <option value="">-- Select Device --</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.model ? `${d.model} [${d.type}]` : `${d.id} [${d.type}]`}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh button */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isConnected ? 'default' : 'pointer',
              padding: '6px',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isConnected ? 0.4 : 1,
            }}
            onClick={refreshDevices}
            disabled={isConnected}
            title="Refresh devices"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M12 2L12 5.5H8.5M2 12L2 8.5H5.5M1.5 7C1.5 3.96 3.96 1.5 7 1.5C9.1 1.5 10.9 2.7 11.7 4.5M12.5 7C12.5 10.04 10.04 12.5 7 12.5C4.9 12.5 3.1 11.3 2.3 9.5"
                stroke={colors.textSecondary}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Connect button */}
          <button
            style={{
              ...button,
              background: isConnected ? colors.textDim : colors.accent,
              color: colors.white,
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '6px',
            }}
            onClick={handleConnect}
            disabled={!selectedSerial && !isConnected}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>

          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '2px' }}>
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
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: statusTextColor,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {connectionStatus === 'connected'
                ? 'online'
                : connectionStatus === 'connecting'
                ? 'connecting'
                : connectionStatus === 'error'
                ? 'error'
                : 'offline'}
            </span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            padding: '5px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textDim,
            transition: 'all 0.15s',
          }}
          title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = colors.accentOrange;
            (e.currentTarget as HTMLElement).style.color = colors.accentOrange;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = colors.border;
            (e.currentTarget as HTMLElement).style.color = colors.textDim;
          }}
        >
          {mode === 'light' ? (
            /* Moon icon for switching to dark */
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 8.5A6.5 6.5 0 017.5 2 5.5 5.5 0 1014 8.5z" />
            </svg>
          ) : (
            /* Sun icon for switching to light */
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
            </svg>
          )}
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
            background: 'rgba(0, 0, 0, 0.4)',
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
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.warning, marginBottom: '12px' }}>
              Install Intent Postman?
            </div>
            <div style={{ fontSize: '13px', color: colors.textSecondary, lineHeight: 1.5, marginBottom: '20px' }}>
              The Intent Postman Android app is not installed on this device. Install it now to continue?
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                style={{
                  ...button,
                  background: colors.surfaceLight,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
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
