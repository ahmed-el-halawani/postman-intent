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
const DEFAULT_RELAY_PORT = 5000;

interface RelayState {
  socket: CommandSocket;
  localPort?: number;
  direct?: { host: string; port: number };
}

// ponytail: single global map; concurrent setup on same target is not guarded
const states = new Map<string, RelayState>();

/**
 * Connection target: either a device serial (via adb) or a direct
 * host:port to the relay's TCP server over the network (no adb needed).
 */
export interface Target {
  key: string;
  kind: 'adb' | 'direct';
  serial?: string;
  host?: string;
  port?: number;
}

export function resolveTarget(opts: { serial?: string; host?: string; port?: number }): Target {
  if (opts.host) {
    const host = opts.host;
    const port = opts.port ?? DEFAULT_RELAY_PORT;
    return { key: `${host}:${port}`, kind: 'direct', host, port };
  }
  return { key: 'pending', kind: 'adb', serial: opts.serial };
}

/** Resolve a serial param against connected devices (adb path only). */
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

/** Fully resolve an adb target into a concrete device serial. */
export async function finalizeTarget(target: Target): Promise<Target> {
  if (target.kind === 'direct') return target;
  const device = await pickDevice(target.serial);
  return { key: device.serial, kind: 'adb', serial: device.serial };
}

/** Best-effort discovery of the device's Wi-Fi IP so callers can reconnect without adb. */
async function getDeviceWifiIp(serial: string): Promise<string | null> {
  try {
    const out = await shell(serial, 'ip route');
    for (const line of out.split('\n')) {
      if (!line.includes('wlan0')) continue;
      const m = line.match(/src (\d+\.\d+\.\d+\.\d+)/);
      if (m) return m[1];
    }
  } catch {
    // best effort
  }
  return null;
}

async function openAdbConnection(serial: string): Promise<net.Socket> {
  const localPort = await forward(serial, DEFAULT_RELAY_PORT);
  return net.connect({ host: '127.0.0.1', port: localPort });
}

async function connectSocket(target: Target): Promise<void> {
  states.get(target.key)?.socket.disconnect();

  let stream: net.Socket;
  let state: RelayState;

  if (target.kind === 'direct') {
    const host = target.host!;
    const port = target.port!;
    stream = net.connect({ host, port });
    await new Promise<void>((resolve, reject) => {
      stream.once('connect', resolve);
      stream.once('error', (err) =>
        reject(
          new Error(
            `Direct TCP connect to ${host}:${port} failed: ${err.message}. ` +
              'Is the relay service running on the device and reachable over the network?'
          )
        )
      );
    });
    state = { socket: new CommandSocket(), direct: { host, port } };
  } else {
    const serial = target.serial!;
    const localPort = await forward(serial, DEFAULT_RELAY_PORT);
    stream = net.connect({ host: '127.0.0.1', port: localPort });
    await new Promise<void>((resolve, reject) => {
      stream.once('connect', resolve);
      stream.once('error', (err) =>
        reject(new Error(`TCP connect to forwarded port ${localPort} failed: ${err.message}`))
      );
    });
    state = { socket: new CommandSocket(), localPort };
  }

  state.socket.onNotification(pushNotification);
  state.socket.onDisconnect(() => states.delete(target.key));
  state.socket.connect(stream);
  states.set(target.key, state);
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
 * Full setup pipeline over adb: install/upgrade APK from GitHub releases, grant
 * permissions, start the relay service headlessly, forward a port, verify with
 * system.ping and report the device's Wi-Fi IP for future adb-free connections.
 *
 * With a host:port target instead, skips adb entirely and just verifies the
 * direct network connection (APK install requires adb/USB).
 */
export async function setupDevice(opts: { serial?: string; host?: string; port?: number }): Promise<string> {
  if (opts.host) {
    const target = resolveTarget(opts);
    const steps: string[] = [`Direct target: ${target.host}:${target.port} (no adb)`];

    await connectSocket(target);
    steps.push('TCP connected');

    const ping = await rpcCall(target, 'system.ping');
    steps.push(`Handshake OK (${JSON.stringify(ping)})`);

    try {
      const info = (await rpcCall(target, 'system.info')) as Record<string, unknown> | null;
      if (info && typeof info.model === 'string') steps.push(`Model: ${info.model}`);
    } catch {
      // optional
    }
    steps.push('Note: APK install/upgrade requires an adb (USB) setup_device run.');
    return steps.join('\n');
  }

  const target = await finalizeTarget(resolveTarget(opts));
  const s = target.serial!;
  const steps: string[] = [];

  steps.push(`Target device: ${s}`);

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

  await connectSocket(target);
  steps.push(`Port forwarded localhost:${states.get(target.key)!.localPort} → device:${DEFAULT_RELAY_PORT}`);

  // first start after install can bind slightly late -> retry the handshake
  let ping: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      ping = await rpcCall(target, 'system.ping');
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  steps.push(`Handshake OK (${JSON.stringify(ping)})`);

  const wifiIp = await getDeviceWifiIp(s);
  if (wifiIp) {
    steps.push(
      `Wi-Fi direct: ${wifiIp}:${DEFAULT_RELAY_PORT} — you can now use host "${wifiIp}" on any tool without adb`
    );
  }

  return steps.join('\n');
}

async function ensureConnected(target: Target): Promise<CommandSocket> {
  let state = states.get(target.key);
  if (!state || !state.socket.isConnected) {
    if (target.kind === 'direct') {
      // auto-heal: just reconnect over the network (cannot start services remotely)
      await connectSocket(target);
    } else {
      // auto-heal: restart service via adb and reconnect
      await startRelayService(target.serial!);
      await connectSocket(target);
    }
    state = states.get(target.key)!;
  }
  return state.socket;
}

export function isConnected(key: string): boolean {
  return states.get(key)?.socket.isConnected ?? false;
}

/** Send a JSON-RPC command to the relay on the given target, reconnecting if needed. */
export async function rpcCall(
  target: Target,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const socket = await ensureConnected(target);
  const response = await socket.send(method, params);
  if (response.error) {
    throw new Error(`Relay error ${response.error.code}: ${response.error.message}`);
  }
  return response.result;
}
