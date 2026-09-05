import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installConsoleForwarder } from '../packages/browser/dist/index.js';

function fixture() {
  const local = [];
  const target = Object.fromEntries(['debug', 'log', 'info', 'warn', 'error'].map(level => [level, (...args) => local.push([level, ...args])]));
  const window = new EventTarget();
  window.console = target;
  window.location = { href: 'http://localhost/' };
  return { target, local, window };
}

test('retains local output, handles recursion and transport failures, and restores console', async () => {
  const { target, local } = fixture();
  const original = target.log;
  const sent = [];
  const dispose = installConsoleForwarder({ console: target, send(entry) { sent.push(entry); target.log('transport'); throw Error('offline'); } });
  target.log('hello', 12n);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].args, ['hello', '12n']);
  assert.equal(local.length, 2);
  dispose();
  dispose();
  assert.equal(target.log, original);
  const stop = installConsoleForwarder({ console: target, send: async () => { throw Error('offline'); } });
  target.log('async');
  await new Promise(resolve => setImmediate(resolve));
  stop();
});

test('reinstall does not duplicate capture and old cleanup cannot remove new capture', () => {
  const { target } = fixture();
  const old = [];
  const current = [];
  const stopOld = installConsoleForwarder({ console: target, send: entry => { old.push(entry); } });
  const stop = installConsoleForwarder({ console: target, levels: ['warn'], send: entry => { current.push(entry); } });
  stopOld();
  target.log('ignored');
  target.warn('forwarded');
  assert.equal(old.length, 0);
  assert.equal(current.length, 1);
  stop();
});

test('captures unhandled errors and rejections and removes listeners on cleanup', () => {
  const { window } = fixture();
  const sent = [];
  const stop = installConsoleForwarder({ window, send: entry => { sent.push(entry); } });
  const error = new Event('error');
  error.error = new Error('boom');
  const rejection = new Event('unhandledrejection');
  rejection.reason = 'rejected';
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  assert.deepEqual(sent.map(entry => entry.source), ['error', 'unhandledrejection']);
  assert.equal(sent[0].args[0].message, 'boom');
  stop();
  window.dispatchEvent(error);
  assert.equal(sent.length, 2);
});
