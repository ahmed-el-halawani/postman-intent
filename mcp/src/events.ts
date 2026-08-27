import type { JsonRpcNotification } from './rpc';

const MAX_BUFFER = 500;

interface BufferedNotification extends JsonRpcNotification {
  receivedAt: number;
}

const buffer: BufferedNotification[] = [];
const resultWaiters = new Map<string, (params: Record<string, unknown>) => void>();

/** Feed every notification coming off any connected relay socket into here. */
export function pushNotification(n: JsonRpcNotification): void {
  buffer.push({ ...n, receivedAt: Date.now() });
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);

  if (n.method === 'intent.result' && n.params && typeof n.params.requestId === 'string') {
    const waiter = resultWaiters.get(n.params.requestId);
    if (waiter) {
      resultWaiters.delete(n.params.requestId);
      waiter(n.params);
    }
  }
}

function drain(methodPrefix: string): JsonRpcNotification[] {
  const kept: BufferedNotification[] = [];
  const drained: JsonRpcNotification[] = [];
  for (const item of buffer) {
    if (item.method.startsWith(methodPrefix)) {
      drained.push({ jsonrpc: item.jsonrpc, method: item.method, params: item.params });
    } else {
      kept.push(item);
    }
  }
  buffer.length = 0;
  buffer.push(...kept);
  return drained;
}

/** Drain buffered broadcast events since the last call. */
export function drainBroadcastEvents(): JsonRpcNotification[] {
  return drain('broadcast.');
}

/** Drain buffered service connection lifecycle notifications. */
export function drainServiceEvents(): JsonRpcNotification[] {
  return drain('service.');
}

/**
 * Wait for an intent.result notification matching requestId.
 * Resolves immediately if already buffered.
 */
export function waitForIntentResult(
  requestId: string,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const existing = buffer.find((b) => b.method === 'intent.result' && b.params?.requestId === requestId);
  if (existing) return Promise.resolve(existing.params!);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resultWaiters.delete(requestId);
      reject(new Error(`No intent.result received for ${requestId} within ${timeoutMs}ms`));
    }, timeoutMs);
    resultWaiters.set(requestId, (params) => {
      clearTimeout(timer);
      resolve(params);
    });
  });
}
