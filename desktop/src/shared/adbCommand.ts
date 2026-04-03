import type { IntentRequest } from './types';

/**
 * Map FLAG_* names to their hex values for adb shell am.
 */
const FLAG_VALUES: Record<string, number> = {
  FLAG_ACTIVITY_NEW_TASK: 0x10000000,
  FLAG_ACTIVITY_CLEAR_TOP: 0x04000000,
  FLAG_ACTIVITY_SINGLE_TOP: 0x20000000,
  FLAG_ACTIVITY_CLEAR_TASK: 0x00008000,
  FLAG_ACTIVITY_NO_HISTORY: 0x40000000,
  FLAG_ACTIVITY_NO_ANIMATION: 0x00010000,
  FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS: 0x00800000,
  FLAG_ACTIVITY_FORWARD_RESULT: 0x02000000,
  FLAG_ACTIVITY_MULTIPLE_TASK: 0x08000000,
  FLAG_ACTIVITY_REORDER_TO_FRONT: 0x00020000,
  FLAG_INCLUDE_STOPPED_PACKAGES: 0x00000020,
  FLAG_RECEIVER_FOREGROUND: 0x10000000,
};

/**
 * Generate an `adb shell am` command string from an IntentRequest.
 */
export function generateAdbCommand(request: IntentRequest): string {
  const parts: string[] = ['adb', 'shell', 'am'];

  // am subcommand
  switch (request.intentType) {
    case 'activity':
      parts.push('start');
      break;
    case 'broadcast':
      parts.push('broadcast');
      break;
    case 'service':
      parts.push('startservice');
      break;
  }

  // Action
  if (request.action) {
    parts.push('-a', shellEscape(request.action));
  }

  // Data URI
  if (request.data) {
    parts.push('-d', shellEscape(request.data));
  }

  // MIME type
  if (request.mimeType) {
    parts.push('-t', shellEscape(request.mimeType));
  }

  // Categories
  for (const cat of request.categories) {
    if (cat) parts.push('-c', shellEscape(cat));
  }

  // Component
  if (request.component) {
    parts.push('-n', shellEscape(request.component));
  }

  // Flags (combine into single hex value)
  if (request.flags.length > 0) {
    let combined = 0;
    for (const flag of request.flags) {
      combined |= FLAG_VALUES[flag] || 0;
    }
    if (combined !== 0) {
      parts.push('-f', '0x' + combined.toString(16));
    }
  }

  // Extras
  for (const extra of request.extras) {
    if (!extra.key) continue;
    const flag = extraTypeToFlag(extra.type);
    if (flag) {
      parts.push(flag, shellEscape(extra.key), shellEscape(extra.value));
    }
  }

  return parts.join(' ');
}

function extraTypeToFlag(type: string): string | null {
  switch (type) {
    case 'string': return '--es';
    case 'int': return '--ei';
    case 'long': return '--el';
    case 'float': return '--ef';
    case 'double': return '--ed'; // adb doesn't have --ed natively, but included for completeness
    case 'bool': return '--ez';
    case 'uri': return '--eu';
    case 'string_array': return '--esa';
    case 'int_array': return '--eia';
    default: return '--es';
  }
}

function shellEscape(s: string): string {
  // If the string contains special chars, wrap in single quotes
  if (/^[a-zA-Z0-9._/:@=+,-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
