import { readFileSync } from 'node:fs';
import { createConsoleLogger, isLogEntry, LOG_EVENT } from '@natsuneko-laboratory/resona-core';
import type { LogEntry, LoggerOptions } from '@natsuneko-laboratory/resona-core';
import type { BrowserOptions } from '@natsuneko-laboratory/resona-browser';
import type { Plugin } from 'vite';

export interface ResonaOptions extends Pick<BrowserOptions, 'levels' | 'captureErrors' | 'captureStack' | 'serialize'>, LoggerOptions {
  enabled?: boolean;
  onLog?: (entry: LogEntry) => void;
}
const clientId = 'virtual:resona/client';
const runtimeId = 'virtual:resona/runtime';

export function resona(options: ResonaOptions = {}): Plugin {
  const output = options.onLog ?? createConsoleLogger(options);
  let base = '/';
  return {
    name: 'resona',
    apply: 'serve',
    configResolved(config) { base = config.base; },
    configureServer(server) {
      if (options.enabled === false) return;
      const receive = (data: unknown) => { if (isLogEntry(data)) output(data); };
      server.ws.on(LOG_EVENT, receive);
      server.httpServer?.once('close', () => server.ws.off(LOG_EVENT, receive));
    },
    resolveId(id) {
      if (id === clientId || id === runtimeId) return '\0' + id;
    },
    load(id) {
      if (id === '\0' + runtimeId) return readFileSync(new URL('./browser.js', import.meta.url), 'utf8');
      if (id !== '\0' + clientId) return;
      if (options.enabled === false) return 'export {};';
      const config = JSON.stringify({
        levels: options.levels, captureErrors: options.captureErrors,
        captureStack: options.captureStack, serialize: options.serialize
      });
      return `import { installConsoleForwarder } from '${runtimeId}';
if (import.meta.hot) {
  const dispose = installConsoleForwarder({ ...${config}, send: entry => import.meta.hot.send('${LOG_EVENT}', entry) });
  import.meta.hot.accept();
  import.meta.hot.dispose(dispose);
}`;
    },
    transformIndexHtml: {
      order: 'post',
      handler() {
        if (options.enabled === false) return;
        return [{ tag: 'script', attrs: { type: 'module', src: `${base}@id/__x00__${clientId}` }, injectTo: 'head-prepend' }];
      },
    },
  };
}
export default resona;
