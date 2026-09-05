export const LOG_EVENT = 'resona:log';
export const LOG_LEVELS = ['debug', 'log', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogValue = null | boolean | number | string | LogValue[] | { [key: string]: LogValue };
export interface LogEntry {
  version: 1;
  source: 'console' | 'error' | 'unhandledrejection';
  level: LogLevel;
  timestamp: number;
  args: LogValue[];
  url?: string;
  stack?: string;
}
export interface SerializeOptions {
  maxDepth?: number;
  maxEntries?: number;
  maxStringLength?: number;
}
export const MAX_MESSAGE_LENGTH = 256_000;

/** Snapshot values without invoking getters or toJSON. Special values use readable markers. */
export function serializeArgs(args: readonly unknown[], options: SerializeOptions = {}): LogValue[] {
  const limit = (value: number | undefined, fallback: number, max: number) =>
    value === undefined || !Number.isFinite(value) ? fallback : Math.max(1, Math.min(max, Math.floor(value)));
  const maxDepth = limit(options.maxDepth, 5, 20);
  const maxEntries = limit(options.maxEntries, 100, 1000);
  const maxString = limit(options.maxStringLength, 4000, 16000);
  let remaining = 1000;
  let characters = 32000;
  const seen = new WeakSet<object>();
  const clip = (value: string) => {
    const length = Math.min(maxString, Math.max(0, characters));
    characters -= Math.min(value.length, length);
    return value.length > length ? `${value.slice(0, length)}…` : value;
  };
  const visit = (value: unknown, depth: number): LogValue => {
    if (--remaining < 0) return '[Truncated]';
    if (value === null) return null;
    switch (typeof value) {
      case 'string': return clip(value);
      case 'boolean': return value;
      case 'number': return Number.isFinite(value) ? value : String(value);
      case 'undefined': return '[undefined]';
      case 'bigint': return clip(`${value}n`);
      case 'symbol': return clip(String(value));
      case 'function': return '[Function]';
    }
    if (seen.has(value)) return '[Circular]';
    if (depth >= maxDepth) return '[MaxDepth]';
    seen.add(value);
    try {
      if (value instanceof Error) return { name: clip(value.name), message: clip(value.message), stack: clip(value.stack ?? '') };
      if (value instanceof Date) return Date.prototype.toISOString.call(value);
      if (value instanceof RegExp) return clip(String(value));
      if (value instanceof Map) {
        const entries: LogValue[] = [];
        for (const [key, item] of value) {
          if (entries.length >= maxEntries || remaining <= 0) { entries.push('[Truncated]'); break; }
          entries.push([visit(key, depth + 1), visit(item, depth + 1)]);
        }
        return { '[Map]': entries };
      }
      if (value instanceof Set) {
        const entries: LogValue[] = [];
        for (const item of value) {
          if (entries.length >= maxEntries || remaining <= 0) { entries.push('[Truncated]'); break; }
          entries.push(visit(item, depth + 1));
        }
        return { '[Set]': entries };
      }
      if (Array.isArray(value)) {
        const result: LogValue[] = [];
        for (let i = 0; i < Math.min(value.length, maxEntries); i++) {
          if (remaining <= 0) { result.push('[Truncated]'); break; }
          const property = Object.getOwnPropertyDescriptor(value, String(i));
          result.push(property && !('value' in property) ? '[Getter]' : visit(property?.value, depth + 1));
        }
        if (value.length > maxEntries) result.push('[Truncated]');
        return result;
      }
      const result: Record<string, LogValue> = Object.create(null);
      let count = 0;
      for (const key of Object.keys(value)) {
        if (count++ >= maxEntries || remaining <= 0) { result['[Truncated]'] = true; break; }
        const property = Object.getOwnPropertyDescriptor(value, key);
        result[clip(key)] = property && 'value' in property ? visit(property.value, depth + 1) : '[Getter]';
      }
      return result;
    } catch {
      return '[Unserializable]';
    } finally {
      seen.delete(value);
    }
  };
  return args.slice(0, maxEntries).map(value => visit(value, 0));
}

/** Validate data received from a transport before passing it to a logger. */
export function isLogEntry(value: unknown): value is LogEntry {
  try {
    if (!value || typeof value !== 'object') return false;
    const entry = value as LogEntry;
    if (entry.version !== 1 || !LOG_LEVELS.includes(entry.level) ||
        !['console', 'error', 'unhandledrejection'].includes(entry.source) ||
        !Number.isFinite(entry.timestamp) || !Array.isArray(entry.args) ||
        (entry.url !== undefined && typeof entry.url !== 'string') ||
        (entry.stack !== undefined && typeof entry.stack !== 'string')) return false;
    let budget = 5000;
    const valid = (item: unknown, depth: number): boolean => {
      if (--budget < 0 || depth > 25) return false;
      if (item === null || typeof item === 'string' || typeof item === 'boolean') return true;
      if (typeof item === 'number') return Number.isFinite(item);
      if (!item || typeof item !== 'object') return false;
      return Object.values(item).every(child => valid(child, depth + 1));
    };
    return valid(entry.args, 0) && JSON.stringify(entry).length <= MAX_MESSAGE_LENGTH;
  } catch { return false; }
}

export type LogConsole = Pick<Console, LogLevel>;
export interface LoggerOptions {
  console?: LogConsole;
  prefix?: string;
  showStack?: boolean;
}
export function createConsoleLogger(options: LoggerOptions = {}): (entry: LogEntry) => void {
  const target = options.console ?? console;
  return entry => {
    // Keep the user's format string first so %s / %d / %o still work.
    const [first, ...rest] = entry.args;
    const prefix = options.prefix ?? '[browser]';
    const args = typeof first === 'string' ? [`${prefix} ${first}`, ...rest] : [prefix, ...entry.args];
    target[entry.level](...args);
    if (options.showStack && entry.stack) target[entry.level](entry.stack);
  };
}
