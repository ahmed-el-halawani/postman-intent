#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { pickDevice, setupDevice, rpcCall, resolveTarget, finalizeTarget, type Target } from './relay';
import { listDevices } from './adb';
import { drainBroadcastEvents, drainServiceEvents, waitForIntentResult } from './events';

const targetParam = {
  serial: z.string().optional().describe('Device serial (adb path). Omit when exactly one device is connected.'),
  host: z.string().optional().describe('Direct connection: relay device IP/hostname — connects over the network without adb.'),
  port: z.number().optional().describe('Relay port for direct host connections. Default 5000.'),
};

const extraValue = z.union([z.string(), z.number(), z.boolean()]);

function ok(result: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

function fail(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Strip undefined/empty values so the relay receives omitted-if-empty params like the desktop app sends them. */
function clean(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/** Resolve the tool's serial/host args into a concrete connection target. */
async function target(opts: { serial?: string; host?: string; port?: number }): Promise<Target> {
  return finalizeTarget(resolveTarget(opts));
}

const server = new McpServer(
  { name: 'intent-postman-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.registerTool(
  'list_devices',
  {
    description: 'List Android devices connected via adb. Run this first to discover device serials.',
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await listDevices());
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'setup_device',
  {
    description:
      'One-stop setup for an Android device. With adb (serial or single USB device): installs/updates the Intent Postman relay APK from GitHub releases, grants permissions, starts the relay service headlessly, forwards a TCP port, verifies connectivity and reports the device Wi-Fi IP for adb-free reuse. With host (+optional port): verifies the direct network connection to the relay without adb.',
    inputSchema: targetParam,
  },
  async ({ serial, host, port }) => {
    try {
      return ok(await setupDevice({ serial, host, port }));
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'device_info',
  {
    description: 'Ping the relay and get device info (Android version, SDK, model).',
    inputSchema: targetParam,
  },
  async ({ serial, host, port }) => {
    try {
      const t = await target({ serial, host, port });
      const ping = await rpcCall(t, 'system.ping');
      let info: unknown = null;
      try {
        info = await rpcCall(t, 'system.info');
      } catch {
        // optional
      }
      return ok({ ping, info });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'send_intent',
  {
    description:
      'Send an Android intent: launch an activity, deliver a broadcast, or start a service. Supports action, component, data URI, mime type, categories, flags and typed extras.',
    inputSchema: {
      ...targetParam,
      type: z.enum(['activity', 'broadcast', 'service']).describe('Intent kind.'),
      action: z.string().optional().describe('Intent action, e.g. android.intent.action.VIEW.'),
      component: z.string().optional().describe('Target component as package/class, e.g. com.example/.MainActivity.'),
      data: z.string().optional().describe('Data URI, e.g. https://example.com or content://...'),
      mimeType: z.string().optional(),
      categories: z.array(z.string()).optional(),
      flags: z.union([z.string(), z.number()]).optional().describe('Intent flags as int or hex string, e.g. "0x10000000".'),
      extras: z
        .array(
          z.object({
            key: z.string(),
            type: z
              .enum(['string', 'int', 'long', 'float', 'double', 'bool', 'uri', 'string_array', 'int_array', 'bundle'])
              .optional()
              .describe('Extra value type; defaults to string.'),
            value: extraValue,
          })
        )
        .optional(),
      forResult: z.boolean().optional().describe('Request a result back (activity intents).'),
      waitForResultMs: z.number().optional().describe('When forResult=true, block up to this long for the result notification. Default 10000.'),
    },
  },
  async ({ serial, host, port, waitForResultMs, ...params }) => {
    try {
      const t = await target({ serial, host, port });
      const result = await rpcCall(t, 'intent.send', clean(params));
      const requestId =
        result && typeof result === 'object' && 'requestId' in result
          ? (result as Record<string, unknown>).requestId
          : null;
      if (params.forResult && typeof requestId === 'string') {
        const activityResult = await waitForIntentResult(requestId, waitForResultMs ?? 10000);
        return ok({ sent: result, result: activityResult });
      }
      return ok(result);
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'broadcast_send',
  {
    description: 'Send a broadcast intent by action, optionally targeting a package, with string extras.',
    inputSchema: {
      ...targetParam,
      action: z.string().describe('Broadcast action, e.g. com.example.MY_ACTION.'),
      packageName: z.string().optional().describe('Restrict delivery to this package.'),
      extras: z.array(z.object({ key: z.string(), value: extraValue })).optional(),
    },
  },
  async ({ serial, host, port, packageName, ...params }) => {
    try {
      const t = await target({ serial, host, port });
      const p = clean(params);
      if (packageName) p.package = packageName;
      return ok(await rpcCall(t, 'broadcast.send', p));
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'broadcast_listen',
  {
    description:
      'Manage broadcast listeners: register (listen), unregister (unlisten/unlistenAll), or list active listeners. Captured broadcasts are retrieved via broadcast_events.',
    inputSchema: {
      ...targetParam,
      op: z.enum(['listen', 'unlisten', 'unlistenAll', 'list']).describe('Listener operation.'),
      filterAction: z.string().optional().describe('For listen: broadcast action to capture.'),
      listenerId: z.string().optional().describe('For listen/unlisten: stable id for the listener.'),
    },
  },
  async ({ serial, host, port, op, filterAction, listenerId }) => {
    try {
      const t = await target({ serial, host, port });
      switch (op) {
        case 'listen':
          return ok(await rpcCall(t, 'broadcast.listen', clean({ action: filterAction, listenerId })));
        case 'unlisten':
          if (!listenerId) throw new Error('listenerId is required for unlisten');
          return ok(await rpcCall(t, 'broadcast.unlisten', { listenerId }));
        case 'unlistenAll':
          return ok(await rpcCall(t, 'broadcast.unlistenAll'));
        case 'list':
          return ok(await rpcCall(t, 'broadcast.listListeners'));
      }
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'broadcast_events',
  {
    description:
      'Drain captured events since the last call: broadcast events from registered listeners plus service connect/disconnect lifecycle events.',
    inputSchema: targetParam,
  },
  async ({ serial, host, port }) => {
    try {
      if (serial || host) await target({ serial, host, port }); // validate when given
      return ok({ broadcastEvents: drainBroadcastEvents(), serviceEvents: drainServiceEvents() });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'service_manage',
  {
    description: 'Manage Android services: start, stop, bind/unbind, call binder methods, send messages, list bindings.',
    inputSchema: {
      ...targetParam,
      op: z
        .enum(['start', 'stop', 'bind', 'unbind', 'call', 'sendMessage', 'listBindings'])
        .describe('Service operation.'),
      component: z.string().optional().describe('Service component, e.g. com.example/.MyService (required for start/stop/bind).'),
      intentAction: z.string().optional().describe('Optional intent action for start/stop.'),
      packageName: z.string().optional(),
      bindingId: z.string().optional().describe('Binding id returned by bind (required for unbind/call/sendMessage).'),
      method: z.string().optional().describe('For call: binder method name.'),
      args: z.array(extraValue).optional().describe('For call: positional arguments.'),
      what: z.number().optional().describe('For sendMessage: message what.'),
      arg1: z.number().optional(),
      arg2: z.number().optional(),
      data: z.string().optional().describe('For sendMessage: message data.'),
    },
  },
  async ({ serial, host, port, op, intentAction, packageName, ...rest }) => {
    try {
      const t = await target({ serial, host, port });
      const methodMap: Record<string, string> = {
        start: 'service.start',
        stop: 'service.stop',
        bind: 'service.bind',
        unbind: 'service.unbind',
        call: 'service.call',
        sendMessage: 'service.sendMessage',
        listBindings: 'service.listBindings',
      };
      const base: Record<string, unknown> = { ...rest };
      if (intentAction) base.action = intentAction;
      if (packageName) base.package = packageName;
      return ok(await rpcCall(t, methodMap[op], clean(base)));
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'package_query',
  {
    description:
      'Query installed packages and their components: listPackages, queryComponents, getQuickActions, queryIntents.',
    inputSchema: {
      ...targetParam,
      op: z.enum(['listPackages', 'queryComponents', 'getQuickActions', 'queryIntents']).describe('Query kind.'),
      packageName: z.string().optional().describe('Target package (required by most queries).'),
      params: z.record(z.unknown()).optional().describe('Additional raw params passed through to the relay.'),
    },
  },
  async ({ serial, host, port, op, packageName, params }) => {
    try {
      const t = await target({ serial, host, port });
      const merged = clean({ packageName, ...(params ?? {}) });
      return ok(await rpcCall(t, `package.${op}`, merged));
    } catch (err) {
      return fail(err);
    }
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('intent-postman-mcp running on stdio');
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
