import type { Socket } from 'net';
import { randomUUID } from 'crypto';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const MAX_FRAME_SIZE = 10 * 1024 * 1024;

export class CommandSocket {
  private stream: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private notificationHandler: ((n: JsonRpcNotification) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private timeoutMs: number;

  constructor(timeoutMs = 30000) {
    this.timeoutMs = timeoutMs;
  }

  connect(stream: Socket): void {
    this.stream = stream;
    this.buffer = Buffer.alloc(0);

    stream.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parseFrames();
    });
    stream.on('end', () => this.handleDisconnect());
    stream.on('error', () => this.handleDisconnect());
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    if (!this.stream || this.stream.destroyed) {
      throw new Error('Not connected');
    }

    const request: JsonRpcRequest = { jsonrpc: '2.0', id: randomUUID(), method, params };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timed out after ${this.timeoutMs}ms: ${method}`));
      }, this.timeoutMs);

      this.pendingRequests.set(request.id, { resolve, reject, timer });

      const payload = Buffer.from(JSON.stringify(request), 'utf-8');
      const header = Buffer.alloc(4);
      header.writeUInt32BE(payload.length, 0);
      this.stream!.write(Buffer.concat([header, payload]));
    });
  }

  onNotification(handler: (n: JsonRpcNotification) => void): void {
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

  private parseFrames(): void {
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32BE(0);
      if (length > MAX_FRAME_SIZE || length <= 0) {
        this.disconnect();
        return;
      }
      if (this.buffer.length < 4 + length) break;

      const payload = this.buffer.subarray(4, 4 + length).toString('utf-8');
      this.buffer = this.buffer.subarray(4 + length);

      try {
        const message = JSON.parse(payload);
        if ('id' in message && message.id) {
          const pending = this.pendingRequests.get(message.id as string);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(message.id as string);
            pending.resolve(message as JsonRpcResponse);
          }
        } else if ('method' in message) {
          this.notificationHandler?.(message as JsonRpcNotification);
        }
      } catch {
        // malformed frame, skip
      }
    }
  }

  private handleDisconnect(): void {
    this.stream = null;
    this.rejectAllPending('Connection lost');
    this.buffer = Buffer.alloc(0);
    this.disconnectHandler?.();
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }
}
