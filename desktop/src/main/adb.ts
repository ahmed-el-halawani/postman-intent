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

export { client as adbClient };
