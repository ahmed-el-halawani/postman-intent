# Intent Postman MCP

A standalone [Model Context Protocol](https://modelcontextprotocol.io) server for testing Android intents, broadcasts, services and packages from any MCP-capable AI client.

**No desktop app required.** It talks directly to your Android device over adb and a TCP JSON-RPC connection to the lightweight relay app.

## How it works

```
MCP client (Claude/OpenCode/Copilot)
   │ stdio
   ▼
intent-postman-mcp (this server)
   │ adb binary                    │ TCP localhost:<random>
   ▼                               ▼
Android device  ◄──────────  Intent Postman relay (port 5000)
install APK / grant perms     length-prefixed JSON-RPC 2.0
start service headlessly      intents · broadcasts · services · packages
```

On first use it downloads the latest `app-debug.apk` from the
[GitHub releases](https://github.com/ahmed-el-halawani/postman-intent/releases),
installs it on the device, pre-grants permissions, starts the relay service
headlessly (no UI taps needed) and verifies connectivity with a ping.

## Two connection modes

- **adb (USB)** — full control: APK install, permissions, service start, port forward.
  The setup output reports the device's Wi-Fi IP for adb-free reuse.
- **Direct TCP (no adb)** — pass `host` (+ optional `port`, default 5000) to any tool
  to connect straight to the relay over the network. Works because the relay's
  `ServerSocket` binds all interfaces. APK install/upgrade still requires an adb run.

```
setup_device { "host": "192.168.0.187" }   // direct, no adb
send_intent  { "host": "192.168.0.187", "type": "activity", "component": "..." }
```

## Prerequisites

- **Node.js 18+**
- **adb** — on PATH, or set `ADB_PATH`, or `ANDROID_HOME` pointing to the Android SDK

## Build

```bash
cd mcp
npm install
npm run build
```

## Client setup

### OpenCode (`~/.config/opencode/opencode.json`)

```json
{
  "mcp": {
    "intent-postman": {
      "type": "local",
      "command": ["node", "<ABSOLUTE PATH>/mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Claude Code

```bash
claude mcp add intent-postman -s user -- node "<ABSOLUTE PATH>/mcp/dist/index.js"
```

Or project-scoped `.mcp.json`:

```json
{
  "mcpServers": {
    "intent-postman": {
      "command": "node",
      "args": ["<ABSOLUTE PATH>/mcp/dist/index.js"]
    }
  }
}
```

### GitHub Copilot / VS Code (user `settings.json`)

```json
{
  "mcp": {
    "servers": {
      "intent-postman": {
        "type": "stdio",
        "command": "node",
        "args": ["<ABSOLUTE PATH>/mcp/dist/index.js"]
      }
    }
  }
}
```

> **ChatGPT is not supported**: ChatGPT connectors only fetch remote HTTPS URLs
> from OpenAI's cloud and cannot reach local stdio servers.

## Tools

| Tool | Purpose |
|---|---|
| `list_devices` | List connected Android devices |
| `setup_device` | Install/upgrade relay APK from GitHub releases → grant perms → start service headlessly → forward port → verify. Run this once per device session. |
| `device_info` | Ping relay + device info (model, Android version, SDK) |
| `send_intent` | Launch activity / deliver broadcast / start service with action, component, data URI, mime type, categories, flags, typed extras; optional result waiting via `forResult` |
| `broadcast_send` | Send a broadcast by action with string extras |
| `broadcast_listen` | Register/unregister/list broadcast listeners |
| `broadcast_events` | Drain captured broadcast + service lifecycle events since last call |
| `service_manage` | start / stop / bind / unbind / call / sendMessage / listBindings |
| `package_query` | listPackages / queryComponents / getQuickActions / queryIntents |

All tools accept an optional `serial`; omit it when exactly one device is connected.

## Example usage

Ask your AI client:

- *"List my connected Android devices"*
- *"Set up my device for intent testing"* → runs `setup_device`
- *"Open https://example.com in Chrome on my phone"*
- *"Send a broadcast with action com.example.SYNC and extra key `mode`=fast, then listen for replies"*
- *"Start the service com.example/.SyncService, bind to it and call method syncNow"*
- *"What activities does com.example.app expose? Query its intent filters."*

## Troubleshooting

| Problem | Fix |
|---|---|
| `adb not found` | Install platform-tools; add to PATH or set `ADB_PATH` env var |
| `No Android devices connected` | Enable USB debugging; check `adb devices` |
| Relay errors after reinstall | Run `setup_device` again — it auto-heals the connection |
| Signature mismatch during install | Handled automatically: uninstalls the old build then reinstalls |
| Multiple devices | Pass the device `serial` argument to tools |

## Architecture notes

- Transport mirrors the desktop app exactly: **4-byte big-endian length-prefixed JSON-RPC 2.0** frames over an adb TCP tunnel (`adb forward tcp:0 tcp:5000`)
- Service start tries `am start-foreground-service` directly and falls back to launching the exported `MainActivity` (which starts the service itself) on builds that forbid shell-starting non-exported components
- APKs are cached per release tag in `<tmp>/intent-postman-mcp/`
