import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

let cachedAdbPath: string | null = null;

const EXEC_TIMEOUT_MS = 120000;

function resolveAdb(): string {
  if (cachedAdbPath) return cachedAdbPath;

  const candidates: string[] = [];
  if (process.env.ADB_PATH) candidates.push(process.env.ADB_PATH);
  candidates.push('adb');
  if (process.env.ANDROID_HOME) {
    candidates.push(
      path.join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
    );
  }

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['version'], { stdio: 'pipe', timeout: 10000 });
      cachedAdbPath = candidate;
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    'adb not found. Install Android platform-tools, add adb to PATH, or set ADB_PATH to the adb binary.'
  );
}

async function run(args: string[], timeoutMs = EXEC_TIMEOUT_MS): Promise<string> {
  const { stdout } = await execFileAsync(resolveAdb(), args, {
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

export interface DeviceInfo {
  serial: string;
  model: string;
}

export async function listDevices(): Promise<DeviceInfo[]> {
  const out = await run(['devices', '-l']);
  const devices: DeviceInfo[] = [];
  for (const line of out.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts[1] !== 'device') continue;
    const modelPart = parts.find((p) => p.startsWith('model:'));
    devices.push({
      serial: parts[0],
      model: modelPart ? modelPart.slice('model:'.length).replace(/_/g, ' ') : parts[0],
    });
  }
  return devices;
}

export async function shell(serial: string, command: string): Promise<string> {
  return run(['-s', serial, 'shell', command]);
}

export async function install(serial: string, apkPath: string): Promise<void> {
  await run(['-s', serial, 'install', '-r', apkPath], 300000);
}

export async function uninstall(serial: string): Promise<void> {
  try {
    await run(['-s', serial, 'uninstall', 'com.intentpostman']);
  } catch {
    // ignore
  }
}

/** Forward a random local TCP port to the given device port; returns the local port. */
export async function forward(serial: string, devicePort: number): Promise<number> {
  const out = await run(['-s', serial, 'forward', 'tcp:0', `tcp:${devicePort}`]);
  const port = parseInt(out.trim(), 10);
  if (!port) throw new Error(`Failed to parse forwarded port from adb output: "${out.trim()}"`);
  return port;
}

const APP_ID = 'com.intentpostman';

/** Installed versionName of the relay app, or null when not installed. */
export async function getInstalledAppVersion(serial: string): Promise<string | null> {
  try {
    const out = await shell(serial, `dumpsys package ${APP_ID}`);
    const match = out.match(/versionName=(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export const relayStartCommand =
  `am start-foreground-service -n ${APP_ID}/.service.CommandService -a ${APP_ID}.action.START --ei port 5000`;

/** Best-effort permission grants that avoid runtime dialogs blocking headless start. */
export async function grantPermissions(serial: string): Promise<void> {
  try {
    await shell(serial, `pm grant ${APP_ID} android.permission.POST_NOTIFICATIONS`);
  } catch {
    // pre-13 or already granted
  }
  try {
    // Overlay grant prevents MainActivity from opening system Settings when auto-starting via activity
    await shell(serial, `appops set ${APP_ID} SYSTEM_ALERT_WINDOW allow`);
  } catch {
    // overlay is optional (floating indicator only)
  }
}
