import Adb from 'adbkit';
import fs from 'fs';
import type { Device } from '../shared/types';

const client = Adb.createClient();

export async function listDevices(): Promise<Device[]> {
  const devices = await client.listDevices();
  const result: Device[] = [];

  for (const device of devices) {
    let model: string | undefined;
    if (device.type === 'device') {
      try {
        const properties = await client.getProperties(device.id);
        model = properties['ro.product.model'] || properties['ro.product.name'];
      } catch {
        // Ignore errors getting properties
      }
    }
    result.push({
      id: device.id,
      type: device.type,
      model,
    });
  }

  return result;
}

export async function trackDevices(
  onChange: (devices: Device[]) => void
): Promise<{ cancel: () => void }> {
  const tracker = await client.trackDevices();

  tracker.on('changeSet', async () => {
    const devices = await listDevices();
    onChange(devices);
  });

  tracker.on('end', () => {
    // ADB server disconnected, try to reconnect
    setTimeout(async () => {
      try {
        await trackDevices(onChange);
      } catch {
        // Will retry on next event
      }
    }, 3000);
  });

  return {
    cancel: () => {
      tracker.end();
    },
  };
}

export async function openTcpConnection(
  serial: string,
  port: number = 5000
): Promise<import('stream').Duplex> {
  const stream = await client.openTcp(serial, port);
  return stream;
}

/**
 * Launch the Intent Postman Android app via ADB.
 * Always launches — no check. Idempotent if already running.
 */
export async function launchApp(serial: string): Promise<void> {
  try {
    const stream = await client.shell(
      serial,
      'am start --activity-single-top -n com.intentpostman/.ui.MainActivity'
    );
    // Consume the stream output
    await new Promise<void>((resolve, reject) => {
      stream.on('data', () => {});
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } catch {
    // Best effort
  }
}

/**
 * Read all output from an ADB shell stream into a string.
 */
function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    stream.on('end', () => resolve(output));
    stream.on('error', reject);
  });
}

/**
 * Check if the Intent Postman Android app is installed on the device.
 */
export async function isAppInstalled(serial: string): Promise<boolean> {
  const stream = await client.shell(serial, 'pm path com.intentpostman');
  const output = await readStream(stream);
  return output.includes('package:');
}

/**
 * Install an APK on the device via ADB.
 */
export async function installApk(serial: string, apkPath: string): Promise<void> {
  const stream = fs.createReadStream(apkPath);
  await client.install(serial, stream);
}

export { client as adbClient };
