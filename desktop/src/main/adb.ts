import Adb from 'adbkit';
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
 * Ensure the Intent Postman Android app is running on the device.
 * If the process is not alive, launch it via `am start` and wait for the server to start.
 */
export async function ensureAppRunning(serial: string): Promise<void> {
  const PACKAGE = 'com.intentpostman';
  const ACTIVITY = `${PACKAGE}/.ui.MainActivity`;

  try {
    // Check if the app process is running
    const pidStream = await client.shell(serial, `pidof ${PACKAGE}`);
    const pidOutput = await readStreamToString(pidStream);

    if (pidOutput.trim()) {
      // Process is alive — foreground service is running
      return;
    }
  } catch {
    // pidof failed — app not running
  }

  // Launch the app
  try {
    const launchStream = await client.shell(serial, `am start -n ${ACTIVITY}`);
    await readStreamToString(launchStream); // consume output
  } catch {
    // Best effort — connection retry will handle failures
  }

  // Wait for the server to bind the port
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

function readStreamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

export { client as adbClient };
