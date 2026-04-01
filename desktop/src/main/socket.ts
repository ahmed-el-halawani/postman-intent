import type { Duplex } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from '../shared/types';

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CommandSocket {
  private stream: Duplex | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private notificationHandler: ((notification: JsonRpcNotification) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  connect(stream: Duplex): void {
    this.stream = stream;
    this.buffer = Buffer.alloc(0);

    stream.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parseFrames();
    });

    stream.on('end', () => {
      this.handleDisconnect();
    });

    stream.on('error', (err: Error) => {
      console.error('Socket error:', err.message);
      this.handleDisconnect();
    });
  }

  async send(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<JsonRpcResponse> {
    if (!this.stream || this.stream.destroyed) {
      throw new Error('Not connected');
    }

    const id = uuidv4();
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out after ${this.timeoutMs}ms: ${method}`));
      }, this.timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.writeFrame(JSON.stringify(request));
    });
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  disconnect(): void {
    if (this.stream) {
      this.stream.destroy();
      this.stream = null;
    }
    this.rejectAllPending('Disconnected');
    this.buffer = Buffer.alloc(0);
  }

  get isConnected(): boolean {
    return this.stream !== null && !this.stream.destroyed;
  }

  private writeFrame(json: string): void {
    if (!this.stream) return;

    const payload = Buffer.from(json, 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(payload.length, 0);

    this.stream.write(Buffer.concat([header, payload]));
  }

  private parseFrames(): void {
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32BE(0);

      // Guard against absurd frame sizes (max 10MB)
      if (length > 10 * 1024 * 1024) {
        console.error('Frame too large:', length);
        this.disconnect();
        return;
      }

      if (this.buffer.length < 4 + length) {
        break; // Incomplete frame, wait for more data
      }

      const payload = this.buffer.subarray(4, 4 + length).toString('utf-8');
      this.buffer = this.buffer.subarray(4 + length);

      try {
        const message = JSON.parse(payload);
        this.handleMessage(message);
      } catch (err) {
        console.error('Failed to parse JSON frame:', err);
      }
    }
  }

  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    // Response (has id) → match to pending request
    if ('id' in message && message.id) {
      const pending = this.pendingRequests.get(message.id as string);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(message.id as string);
        pending.resolve(message as JsonRpcResponse);
      }
      return;
    }

    // Notification (has method, no id) → push to handler
    if ('method' in message) {
      this.notificationHandler?.(message as JsonRpcNotification);
    }
  }

  private handleDisconnect(): void {
    this.stream = null;
    this.rejectAllPending('Connection lost');
    this.buffer = Buffer.alloc(0);
    this.disconnectHandler?.();
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }
}
