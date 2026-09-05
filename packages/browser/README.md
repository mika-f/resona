# @natsuneko-laboratory/resona-browser

Capture browser console calls and unhandled errors, then forward them through your own transport. Original browser console output is preserved.

This ESM package includes TypeScript declarations and has no Vite or Node.js dependency. Use it to integrate Resona into a custom development runtime such as Makit or Mikan. For a Vite project, use `@natsuneko-laboratory/resona-vite` for automatic setup.

## Installation

```sh
npm install @natsuneko-laboratory/resona-browser
```

## Usage

Load this code only during development. Install the forwarder with a function that sends each entry through your existing connection:

```ts
import { installConsoleForwarder } from '@natsuneko-laboratory/resona-browser';

export function attachBrowserLogs(socket: WebSocket): () => void {
  return installConsoleForwarder({
    send(entry) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(entry));
      }
    },
  });
}
```

Call `attachBrowserLogs` with your development WebSocket. It returns a cleanup function to call when your runtime shuts down or its module is disposed during HMR. This example drops logs while the socket is not open; implement buffering and reconnection in your transport if needed.

On the receiving server, install `@natsuneko-laboratory/resona-core`, parse incoming JSON, validate it with `isLogEntry`, and pass valid entries to `createConsoleLogger()`.

## Options

`installConsoleForwarder(options: BrowserOptions): () => void`

| Option | Default | Description |
| --- | --- | --- |
| `send` | Required | `(entry: LogEntry) => void \| Promise<void>` |
| `levels` | `['debug', 'log', 'info', 'warn', 'error']` | Console methods to capture |
| `captureErrors` | `true` | Listen for window `error` and `unhandledrejection` events |
| `captureStack` | `false` | Capture an additional stack trace when forwarding |
| `serialize` | See below | Snapshot depth, entry, and string limits |
| `console` | Target window's console | Override the console to patch |
| `window` | Global browser window | Override the window used for events and page URL |

```ts
const dispose = installConsoleForwarder({
  send: entry => { /* Send the entry through your transport. */ },
  levels: ['warn', 'error'],
  captureErrors: true,
  captureStack: true,
  serialize: {
    maxDepth: 5,
    maxEntries: 100,
    maxStringLength: 4000,
  },
});

// During runtime shutdown or HMR disposal:
dispose();
```

`captureErrors` is independent of `levels`: window errors and unhandled rejections are forwarded at the `error` level even when console error capture is disabled. Set `captureErrors: false` to disable these listeners. Error objects retain their own stack in serialized arguments regardless of `captureStack`.

`BrowserOptions` is exported from this package. Shared types such as `LogEntry` and `LogLevel` are exported by `@natsuneko-laboratory/resona-core`.

## Lifecycle and transport behavior

Importing the package alone does not patch anything. Calling `installConsoleForwarder` installs capture and returns an idempotent cleanup function. Cleanup restores console methods still owned by that installation and removes its event listeners.

Within the same loaded package instance, reinstalling on the same console disposes the previous installation. Calling an old cleanup function does not remove a newer installation. Without a browser window or an explicit console target, installation is a no-op.

Synchronous exceptions and rejected promises from `send` are swallowed so transport failures do not break application logging. Synchronous recursive forwarding is suppressed. Keep the transport's own diagnostics outside the captured console to avoid feedback loops, especially in asynchronous callbacks.

The package does not establish connections, retry failed sends, or buffer entries. Those responsibilities belong to the transport.

## Snapshots and limitations

Arguments are captured at log time using the core serializer. It supports readable representations of BigInt, undefined, Error, Date, RegExp, Map, Set, and circular references. Large or deeply nested values are truncated. Ordinary property getters and `toJSON` are not invoked. Original object types and DOM structures are not fully reconstructed.

Only `console.debug/log/info/warn/error` and the two window error events are captured. Earlier logs and methods such as `console.table/group/trace/assert` are not captured. Stack traces are forwarded without source map resolution.

Entries include the page URL and serialized arguments. Enable capture only in development; this package does not automatically remove itself from production builds.

## Related packages

- `@natsuneko-laboratory/resona-core`: protocol, serialization, validation, and server console output.
- `@natsuneko-laboratory/resona-vite`: automatic runtime injection and Vite HMR transport.

## License

MIT
