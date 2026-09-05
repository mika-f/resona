# @natsuneko-laboratory/resona-core

Transport-independent log protocol, serialization, validation, and console output for Resona. Use this package to receive browser logs in your own development server or build a custom transport adapter.

This is an ESM package with TypeScript declarations and no Vite or Node.js dependencies. For automatic Vite integration, use `@natsuneko-laboratory/resona-vite`.

## Installation

```sh
npm install @natsuneko-laboratory/resona-core
```

## Receive and print logs

Parse incoming JSON, validate it, and pass valid entries to a logger:

```ts
import {
  createConsoleLogger,
  isLogEntry,
} from '@natsuneko-laboratory/resona-core';

const output = createConsoleLogger({ prefix: '[browser]' });

export function receiveMessage(text: string): void {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  if (isLogEntry(data)) output(data);
}
```

Connect `receiveMessage` to your development transport. The package does not create a server or manage connections.

## Create a log entry

```ts
import { serializeArgs } from '@natsuneko-laboratory/resona-core';
import type { LogEntry } from '@natsuneko-laboratory/resona-core';

const entry: LogEntry = {
  version: 1,
  source: 'console',
  level: 'info',
  timestamp: Date.now(),
  args: serializeArgs(['User loaded', { id: 123n }]),
};

const payload = JSON.stringify(entry);
```

For automatic browser capture, use `installConsoleForwarder` from `@natsuneko-laboratory/resona-browser`.

## API

### `LogEntry`

| Field | Type | Description |
| --- | --- | --- |
| `version` | `1` | Protocol version |
| `source` | `'console' \| 'error' \| 'unhandledrejection'` | Origin of the entry |
| `level` | `'debug' \| 'log' \| 'info' \| 'warn' \| 'error'` | Target console method |
| `timestamp` | `number` | Unix timestamp in milliseconds |
| `args` | `LogValue[]` | Serialized arguments |
| `url` | `string` (optional) | Browser page URL |
| `stack` | `string` (optional) | Stack trace |

`LogValue` is a JSON-compatible value: null, boolean, finite number, string, array, or string-keyed object.

### `serializeArgs(args, options?)`

Creates a snapshot of an argument array suitable for JSON transport.

| Option | Default | Maximum | Description |
| --- | --- | --- | --- |
| `maxDepth` | `5` | `20` | Object nesting depth |
| `maxEntries` | `100` | `1000` | Top-level arguments and entries per collection |
| `maxStringLength` | `4000` | `16000` | Length of each string |

Finite option values are rounded down and clamped to at least 1. Non-finite values use the defaults. Serialization also uses a shared budget of 1,000 visited values and 32,000 string characters; truncation markers may add to the final output size.

BigInt, undefined, non-finite numbers, functions, and symbols become strings. Errors retain their name, message, and stack. Dates become ISO strings, regular expressions become strings, and maps and sets become objects containing arrays under `[Map]` and `[Set]` keys.

Circular references, depth limits, and truncation use readable markers. Ordinary property getters and `toJSON` are not invoked. Values that cannot be inspected become `[Unserializable]`. This is a diagnostic snapshot, not lossless serialization or DOM reconstruction.

### `isLogEntry(value)`

A TypeScript type guard for incoming data. Checks the protocol fields, argument values, traversal limits, and serialized message length. Parse JSON before calling it. It returns `false` for malformed or oversized entries.

### `createConsoleLogger(options?)`

Returns `(entry: LogEntry) => void`. Validate external data before passing it to this function.

| Option | Default | Description |
| --- | --- | --- |
| `console` | Global `console` | Output target implementing the five supported methods |
| `prefix` | `'[browser]'` | Prefix added to each log |
| `showStack` | `false` | Print `entry.stack` as an additional call at the same level |

Entries are routed to their matching console methods. A leading string remains the format string, preserving placeholders such as `%s`, `%d`, and `%o`. Page URLs and timestamps are available on the entry but are not printed automatically. Browser CSS `%c` formatting and source map resolution are not implemented.

### Constants and types

- `LOG_EVENT`: `'resona:log'`, the event name used by the Vite adapter.
- `LOG_LEVELS`: the five supported console levels.
- `MAX_MESSAGE_LENGTH`: `256_000`, the maximum serialized string length accepted by `isLogEntry` (not a byte limit).
- Exported types: `LogEntry`, `LogLevel`, `LogValue`, `LogConsole`, `SerializeOptions`, and `LoggerOptions`.

## Related packages

- `@natsuneko-laboratory/resona-browser`: browser capture with a custom send function.
- `@natsuneko-laboratory/resona-vite`: automatic development integration through Vite HMR.

## License

MIT
