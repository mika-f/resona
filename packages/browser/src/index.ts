import { LOG_LEVELS, serializeArgs } from '@natsuneko-laboratory/resona-core';
import type { LogConsole, LogEntry, LogLevel, SerializeOptions } from '@natsuneko-laboratory/resona-core';

export interface BrowserOptions {
  send: (entry: LogEntry) => void | Promise<void>;
  levels?: readonly LogLevel[];
  captureErrors?: boolean;
  captureStack?: boolean;
  serialize?: SerializeOptions;
  console?: LogConsole;
  window?: Window & { console: LogConsole };
}
const installations = new WeakMap<LogConsole, () => void>();

/** Install once per console; reinstalling disposes the previous capture. Returns cleanup. */
export function installConsoleForwarder(options: BrowserOptions): () => void {
  const targetWindow = options.window ?? (typeof window === 'undefined' ? undefined : window);
  const target = options.console ?? targetWindow?.console;
  if (!target) return () => { };
  installations.get(target)?.();
  let forwarding = false;
  let active = true;
  const forward = (level: LogLevel, args: unknown[], source: LogEntry['source'], stack?: string) => {
    if (!active || forwarding) return;
    forwarding = true;
    try {
      const entry: LogEntry = {
        version: 1, level, source, timestamp: Date.now(),
        args: serializeArgs(args, options.serialize),
        url: targetWindow?.location.href.slice(0, 8000),
        stack: (stack ?? (options.captureStack ? new Error().stack : undefined))?.slice(0, 16000),
      };
      // Transport failures must never break application logging or trigger rejection loops.
      void Promise.resolve(options.send(entry)).catch(() => { });
    } catch { /* Best-effort development logging. */ }
    finally { forwarding = false; }
  };
  const restore: (() => void)[] = [];
  for (const level of new Set(options.levels ?? LOG_LEVELS)) {
    const original = target[level];
    const wrapped = (...args: unknown[]) => {
      original.apply(target, args);
      forward(level, args, 'console');
    };
    target[level] = wrapped;
    restore.push(() => { if (target[level] === wrapped) target[level] = original; });
  }
  const onError = (event: ErrorEvent) => forward('error', [event.error ?? event.message], 'error',
    event.error instanceof Error ? event.error.stack : `${event.filename}:${event.lineno}:${event.colno}`);
  const onRejection = (event: PromiseRejectionEvent) => forward('error', [event.reason], 'unhandledrejection');
  if (options.captureErrors !== false) {
    targetWindow?.addEventListener('error', onError);
    targetWindow?.addEventListener('unhandledrejection', onRejection);
  }
  const dispose = () => {
    if (!active) return;
    active = false;
    restore.forEach(fn => fn());
    targetWindow?.removeEventListener('error', onError);
    targetWindow?.removeEventListener('unhandledrejection', onRejection);
    if (installations.get(target) === dispose) installations.delete(target);
  };
  installations.set(target, dispose);
  return dispose;
}
