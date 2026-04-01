declare module 'adbkit' {
  import { Duplex } from 'stream';

  interface AdbDevice {
    id: string;
    type: string;
  }

  interface DeviceTracker {
    on(event: 'changeSet', listener: (changes: { added: AdbDevice[]; removed: AdbDevice[] }) => void): this;
    on(event: 'end', listener: () => void): this;
    end(): void;
  }

  interface AdbClient {
    listDevices(): Promise<AdbDevice[]>;
    trackDevices(): Promise<DeviceTracker>;
    getProperties(serial: string): Promise<Record<string, string>>;
    openTcp(serial: string, port: number): Promise<Duplex>;
    install(serial: string, apkPath: string): Promise<void>;
    shell(serial: string, command: string): Promise<Duplex>;
  }

  interface Adb {
    createClient(options?: { port?: number; host?: string }): AdbClient;
  }

  const adb: Adb;
  export default adb;
}
