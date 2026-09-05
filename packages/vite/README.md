# @natsuneko-laboratory/resona-vite

Forward browser console calls and unhandled errors to your Vite development server's terminal. Browser DevTools output stays available.

The plugin injects a browser runtime and sends entries over Vite's existing HMR WebSocket. No separate logging server or application code is required. It runs only during development and is inactive in production builds.

## Installation

```sh
npm install -D @natsuneko-laboratory/resona-vite
```

Requires Vite 6 or 7 and a Node.js version supported by your Vite installation. The package is ESM and includes TypeScript declarations.

## Quick start

Add the plugin to `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { resona } from '@natsuneko-laboratory/resona-vite';

export default defineConfig({
  plugins: [resona()],
});
```

Start your Vite development server, open the application, and log from browser code:

```ts
console.log('Hello from the browser', { count: 1 });
console.warn('Something needs attention');
```

The development server prints these logs with a `[browser]` prefix at the corresponding console level. The plugin is also available as the package's default export.

## Configuration

```ts
resona({
  levels: ['warn', 'error'],
  captureErrors: true,
  captureStack: true,
  showStack: true,
  prefix: '[browser]',
  serialize: {
    maxDepth: 5,
    maxEntries: 100,
    maxStringLength: 4000,
  },
});
```

All options are optional. The `ResonaOptions` type is exported from this package.

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Set to `false` to disable capture injection and reception |
| `levels` | `['debug', 'log', 'info', 'warn', 'error']` | Browser console methods to capture |
| `captureErrors` | `true` | Forward window `error` and `unhandledrejection` events |
| `captureStack` | `false` | Capture additional stack traces in the browser |
| `showStack` | `false` | Print the entry's stack as an additional server console call |
| `prefix` | `'[browser]'` | Prefix for the default logger |
| `console` | Server's global `console` | Custom output target with the five supported methods |
| `serialize` | Values shown above | Limits for argument snapshots |
| `onLog` | Default console logger | `(entry: LogEntry) => void` replacing the default output |

`captureErrors` operates independently of `levels`. For example, `levels: ['warn']` still forwards unhandled errors at the `error` level unless `captureErrors` is `false`.

`captureStack` controls stack capture; `showStack` controls printing the entry's separate stack field. Serialized Error arguments can also contain their own stacks. Source map resolution is not implemented.

### Custom output

Use `onLog` to send validated entries to your own logger:

```ts
resona({
  onLog(entry) {
    console.log({
      source: entry.source,
      level: entry.level,
      timestamp: entry.timestamp,
      url: entry.url,
      args: entry.args,
      stack: entry.stack,
    });
  },
});
```

When `onLog` is provided, `prefix`, `console`, and `showStack` do not affect output. The shared `LogEntry` type is exported by `@natsuneko-laboratory/resona-core`.

## Custom HTML and SSR servers

Automatic injection uses Vite's `transformIndexHtml` hook. If your server serves its own HTML, pass it through `await server.transformIndexHtml(url, html)` before sending the response. Pages that bypass that transformation will not receive the runtime. HMR must be available for forwarding to work.

## Behavior and limitations

- Captures `console.debug/log/info/warn/error`, window errors, and unhandled promise rejections.
- Preserves the browser's original console calls and validates received entries before output.
- Uses Vite's connection management and disposes browser capture during HMR replacement.
- Serializes argument snapshots, including readable representations of BigInt, Error, Map, Set, and circular references. Large or deeply nested values are truncated.
- Does not capture logs emitted before the injected runtime executes or additional console methods such as `table`, `group`, `trace`, or `assert`.
- Does not translate browser CSS `%c` formatting or resolve source maps.

Log arguments and page URLs are sent to your development server. The plugin is intended for development and adds no capture runtime to production builds.

## Related packages

- `@natsuneko-laboratory/resona-core`: protocol, serialization, validation, and console output for custom servers.
- `@natsuneko-laboratory/resona-browser`: browser capture with a custom transport for runtimes such as Makit or Mikan.

## License

MIT
