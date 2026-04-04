// Device info from ADB
export interface Device {
  id: string;
  type: string; // 'device' | 'offline' | 'unauthorized'
  model?: string;
}

// JSON-RPC 2.0 types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
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

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// IPC API exposed to renderer via preload
export interface IntentPostmanAPI {
  listDevices: () => Promise<Device[]>;
  connectDevice: (serial: string) => Promise<{ success: boolean; error?: string; needsInstall?: boolean }>;
  installAndConnectDevice: (serial: string) => Promise<{ success: boolean; error?: string }>;
  disconnectDevice: () => Promise<void>;
  sendCommand: (method: string, params: Record<string, unknown>) => Promise<JsonRpcResponse>;
  loadCollections: () => Promise<CollectionsData>;
  saveCollections: (data: CollectionsData) => Promise<void>;
  onDeviceChange: (callback: (devices: Device[]) => void) => void;
  onNotification: (callback: (notification: JsonRpcNotification) => void) => void;
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Intent request types
export type IntentType = 'activity' | 'broadcast' | 'service';

export type ExtraType =
  | 'string'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'bool'
  | 'uri'
  | 'string_array'
  | 'int_array';

export interface IntentExtra {
  id: string;
  key: string;
  type: ExtraType;
  value: string;
}

export const INTENT_FLAGS = [
  'FLAG_ACTIVITY_NEW_TASK',
  'FLAG_ACTIVITY_CLEAR_TOP',
  'FLAG_ACTIVITY_SINGLE_TOP',
  'FLAG_ACTIVITY_CLEAR_TASK',
  'FLAG_ACTIVITY_NO_HISTORY',
  'FLAG_ACTIVITY_NO_ANIMATION',
  'FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS',
  'FLAG_ACTIVITY_FORWARD_RESULT',
  'FLAG_ACTIVITY_MULTIPLE_TASK',
  'FLAG_ACTIVITY_REORDER_TO_FRONT',
  'FLAG_INCLUDE_STOPPED_PACKAGES',
  'FLAG_RECEIVER_FOREGROUND',
] as const;

export const COMMON_ACTIONS = [
  'android.intent.action.VIEW',
  'android.intent.action.SEND',
  'android.intent.action.SENDTO',
  'android.intent.action.DIAL',
  'android.intent.action.CALL',
  'android.intent.action.PICK',
  'android.intent.action.EDIT',
  'android.intent.action.DELETE',
  'android.intent.action.MAIN',
  'android.intent.action.WEB_SEARCH',
  'android.intent.action.SEARCH',
  'android.intent.action.GET_CONTENT',
  'android.intent.action.CHOOSER',
  'android.intent.action.BATTERY_LOW',
  'android.intent.action.BATTERY_CHANGED',
  'android.intent.action.POWER_CONNECTED',
  'android.intent.action.POWER_DISCONNECTED',
  'android.intent.action.SCREEN_ON',
  'android.intent.action.SCREEN_OFF',
  'android.intent.action.BOOT_COMPLETED',
  'android.net.conn.CONNECTIVITY_CHANGE',
] as const;

export interface IntentRequest {
  intentType: IntentType;
  action: string;
  component: string;
  categories: string[];
  data: string;
  mimeType: string;
  flags: string[];
  extras: IntentExtra[];
  forResult: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  request: IntentRequest;
  response: JsonRpcResponse | null;
  responseTime: number | null;
}

// ── Tab System ───────────────────────────────────────────────

export interface RequestTab {
  id: string;
  name: string;
  request: IntentRequest;
  savedRequestRef: { collectionId: string; requestId: string } | null;
  savedResponseId: string | null;
  isDirty: boolean;
  response: JsonRpcResponse | null;
  responseTime: number | null;
  isSending: boolean;
  waitingForResult: boolean;
  waitingRequestId: string | null;
  waitingStartTime: number | null;
}

// ── Collections ──────────────────────────────────────────────

export interface SavedResponse {
  id: string;
  name: string;
  request: IntentRequest;
  response: JsonRpcResponse;
  activityResult: Record<string, unknown> | null;
  responseTime: number | null;
  savedAt: number;
}

export interface SavedRequest {
  id: string;
  name: string;
  request: IntentRequest;
  savedResponses: SavedResponse[];
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
  createdAt: number;
  updatedAt: number;
}

export interface CollectionsData {
  version: 1;
  collections: Collection[];
}

declare global {
  interface Window {
    intentPostman: IntentPostmanAPI;
  }
}
