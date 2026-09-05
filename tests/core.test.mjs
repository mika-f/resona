import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeArgs, isLogEntry, createConsoleLogger } from '../packages/core/dist/index.js';

test('snapshots special values and cycles without executing getters', () => {
  const value = { bigint: 12n, error: new Error('oops'), missing: undefined };
  value.self = value;
  Object.defineProperty(value, 'getter', { enumerable: true, get() { throw new Error('must not run'); } });
  const [copy] = JSON.parse(JSON.stringify(serializeArgs([value])));
  assert.equal(copy.bigint, '12n');
  assert.equal(copy.error.message, 'oops');
  assert.equal(copy.missing, '[undefined]');
  assert.equal(copy.self, '[Circular]');
  assert.equal(copy.getter, '[Getter]');
  assert.deepEqual(serializeArgs([new Proxy({}, { ownKeys() { throw Error(); } })]), ['[Unserializable]']);
});

test('serialization bounds large values and preserves repeated non-cyclic objects', () => {
  const shared = { a: 1 };
  assert.deepEqual(JSON.parse(JSON.stringify(serializeArgs([shared, shared]))), [shared, shared]);
  const args = serializeArgs(Array.from({ length: 100 }, () => Array(100).fill('x'.repeat(16000))));
  assert.ok(JSON.stringify(args).length < 256000);
  assert.equal(serializeArgs([{ a: { b: 1 } }], { maxDepth: 1 })[0].a, '[MaxDepth]');
});

test('validates protocol and routes levels while preserving format strings', () => {
  const entry = { version: 1, level: 'warn', source: 'console', timestamp: Date.now(), args: ['hello %s', 'world'] };
  assert.equal(isLogEntry(entry), true);
  for (const extra of [{ level: 'constructor' }, { args: [12n] }, { args: [Infinity] }, { args: ['x'.repeat(256001)] }, { version: 2 }]) {
    assert.equal(isLogEntry({ ...entry, ...extra }), false);
  }
  const calls = [];
  createConsoleLogger({ console: { warn: (...args) => calls.push(args) } })(entry);
  assert.deepEqual(calls, [['[browser] hello %s', 'world']]);
});
