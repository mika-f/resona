# Resona

Forward browser `console.debug/log/info/warn/error` calls and unhandled errors to the development server's console while preserving the original browser output.

## Vite

```ts
import { defineConfig } from 'vite';
import { resona } from '@natsuneko-laboratory/resona-vite';

export default defineConfig({
  plugins: [resona()],
});
```

This ESM package supports Vite 6 and 7. It automatically injects the runtime into HTML and forwards logs over the existing HMR WebSocket. The plugin is inactive during production builds. For custom HTML or SSR servers, pass your HTML through Vite's `server.transformIndexHtml()`.

```ts
resona({
  levels: ['warn', 'error'], // Default: debug, log, info, warn, error
  captureErrors: true,     // error / unhandledrejection (independent of levels)
  captureStack: false,     // Capture stack traces for console calls
  showStack: false,        // Print received stack traces alongside logs
  prefix: '[browser]',
  serialize: { maxDepth: 5, maxEntries: 100, maxStringLength: 4000 },
  // enabled: false,
  // onLog: entry => { ... }, // Replace the default console output
});
```

## Packages

| Package | Purpose |
| --- | --- |
| `@natsuneko-laboratory/resona-core` | Versioned log protocol, JSON snapshots, incoming data validation, and console output |
| `@natsuneko-laboratory/resona-browser` | Console and unhandled error capture, cleanup, and forwarding through a custom send function |
| `@natsuneko-laboratory/resona-vite` | Automatic runtime injection during development and Vite HMR transport |

To integrate with Makit or Mikan, connect the browser package's `send` function and the core package's receiver to their development runtimes. Neither core nor browser depends on Vite or Node.js.

```ts
// Browser side (load only during development)
import { installConsoleForwarder } from '@natsuneko-laboratory/resona-browser';

const dispose = installConsoleForwarder({
  send: entry => socket.send(JSON.stringify(entry)),
});
// Call when the runtime shuts down or during HMR disposal
dispose();
```

```ts
// Development server side
import { createConsoleLogger, isLogEntry } from '@natsuneko-laboratory/resona-core';

const output = createConsoleLogger();
function onMessage(data: unknown) {
  if (isLogEntry(data)) output(data);
}
```

Synchronous exceptions and rejected promises from `send` are discarded so they do not interfere with application logging. Custom transports must handle connections, reconnections, and buffering. The Vite adapter uses Vite's connection management.

## Snapshots and limitations

Objects are captured as snapshots when logged. BigInt, undefined, non-finite numbers, functions, and symbols become string representations. Errors retain their name, message, and stack; maps and sets use array representations. Markers indicate circular references and depth or entry limits. Getters and `toJSON` are not invoked. Original types and DOM structures are not fully reconstructed.

Total node and character counts are also bounded, so large values are truncated. Stack traces are forwarded as reported by the browser; source map resolution is not yet supported. Logs emitted before the injected runtime executes and additional methods such as `console.table/group/trace/assert` are not captured. Browser CSS `%c` formatting is not translated for the terminal. Use Resona in development environments, as it sends log arguments and page URLs to the development server.

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm dev
```

Use the buttons in `examples/vite` to try logging, exceptions, and unhandled promise rejections. Tests cover serialization, the capture lifecycle, real Vite HMR WebSocket reception, base URLs, and runtime exclusion from production builds.

Vite transport API: [Client-server Communication](https://vite.dev/guide/api-plugin.html#client-server-communication)

## Publishing

The `Publish packages` GitHub Actions workflow publishes all three packages when a GitHub Release is published. All package versions must match, and the release tag must be `v<version>` (for example, `v0.1.0`). Stable releases use the npm `latest` tag; GitHub prereleases use `next`.

Publishing uses npm Trusted Publishing with GitHub Actions OIDC. Configure `publish.yml` as a trusted publisher for each package on npm, with `mika-f` as the owner and `resona` as the repository, and allow `npm publish`. No npm access token is required after that setup.
