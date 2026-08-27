import net from 'net';
import { CommandSocket } from './rpc';
import { pushNotification } from './events';
import {
  listDevices,
  shell,
  install,
  uninstall,
  forward,
  getInstalledAppVersion,
  grantPermissions,
  relayStartCommand,
  type DeviceInfo,
} from './adb';
import { ensureLatestApk } from './releases';

const APP_ID = 'com.intentpostman';

interface RelayState {
  socket: CommandSocket;
  localPort: number;
}

// ponytail: single global map; concurrent setup on same serial is not guarded
const states = new Map<string, RelayState>();

/** Resolve a serial param against connected devices. */
export async function pickDevice(serial?: string): Promise<DeviceInfo> {
  const devices = await listDevices();
  if (devices.length === 0) throw new Error('No Android devices connected via adb');
  if (serial) {
    const found = devices.find((d) => d.serial === serial);
    if (!found) throw new Error(`Device "${serial}" not connected. Available: ${devices.map((d) => d.serial).join(', ')}`);
    return found;
  }
  if (devices.length > 1) {
    throw new Error(
      `Multiple devices connected (${devices.map((d) => d.serial).join(', ')}). Pass "serial" to pick one.`
    );
  }
  return devices[0];
}

async function connectSocket(serial: string): Promise<void> {
  states.get(serial)?.socket.disconnect();

  const localPort = await forward(serial, 5000);
  const stream = net.connect({ host: '127.0.0.1', port: localPort });
  await new Promise<void>((resolve, reject) => {
    stream.once('connect', resolve);
    stream.once('error', (err) => reject(new Error(`TCP connect to forwarded port ${localPort} failed: ${err.message}`)));
  });

  const socket = new CommandSocket();
  socket.onNotification(pushNotification);
  socket.onDisconnect(() => states.delete(serial));
  socket.connect(stream);
  states.set(serial, { socket, localPort });
}

async function startRelayService(serial: string): Promise<void> {
  try {
    await shell(serial, relayStartCommand);
  } catch {
    // Many Android builds refuse shell-starting non-exported services.
    // Fall back to the exported launcher activity, which starts the service itself and finishes.
    // Permissions are pre-granted by grantPermissions() before this runs, so no dialogs appear.
    await shell(serial, `am start --activity-single-top -n ${APP_ID}/.ui.MainActivity`);
  }
  // give the server a moment to bind port 5000
  await new Promise((r) => setTimeout(r, 1500));
}

/**
 * Full setup pipeline: install/upgrade APK from GitHub releases, grant permissions,
 * start the relay service headlessly, forward a port and verify with system.ping.
 */
export async function setupDevice(serial?: string): Promise<string> {
  const device = await pickDevice(serial);
  const s = device.serial;
  const steps: string[] = [];

  steps.push(`Target device: ${device.model} (${s})`);

  const release = await ensureLatestApk();
  steps.push(`Latest release ${release.tag}; APK cached at ${release.apkPath}`);

  const installedVersion = await getInstalledAppVersion(s);
  if (!installedVersion) {
    steps.push('Relay app not installed → installing');
    await install(s, release.apkPath).catch(async (err: Error) => {
      // CI builds are debug-signed with an ephemeral key → signature mismatch needs clean reinstall
      if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures|INSTALL_FAILED_VERSION_DOWNGRADE/i.test(err.message)) {
        steps.push('Existing install incompatible → uninstalling first');
        await uninstall(s);
        await install(s, release.apkPath);
      } else {
        throw err;
      }
    });
  } else if (installedVersion !== release.version) {
    steps.push(`Upgrading relay app ${installedVersion} → ${release.version}`);
    await install(s, release.apkPath);
  } else {
    steps.push(`Relay app up to date (${installedVersion})`);
  }

  await grantPermissions(s);

  await startRelayService(s);
  steps.push('Relay service started');

  await connectSocket(s);
  steps.push(`Port forwarded localhost:${states.get(s)!.localPort} → device:5000`);

  const ping = await rpcCall(s, 'system.ping');
  steps.push(`Handshake OK (${JSON.stringify(ping)})`);

  return steps.join('\n');
}

async function ensureConnected(serial: string): Promise<CommandSocket> {
  let state = states.get(serial);
  if (!state || !state.socket.isConnected) {
    // auto-heal: restart service and reconnect instead of failing
    await startRelayService(serial);
    await connectSocket(serial);
    state = states.get(serial)!;
  }
  return state.socket;
}

export function isConnected(serial: string): boolean {
  return states.get(serial)?.socket.isConnected ?? false;
}

/** Send a JSON-RPC command to the relay on the given device, reconnecting if needed. */
export async function rpcCall(
  serial: string,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const socket = await ensureConnected(serial);
  const response = await socket.send(method, params);
  if (response.error) {
    throw new Error(`Relay error ${response.error.code}: ${response.error.message}`);
  }
  return response.result;
}
