import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, build } from 'vite';
import WebSocket from 'ws';
import { resona } from '../packages/vite/dist/index.js';
import { LOG_EVENT } from '../packages/core/dist/index.js';

test('Vite injects the bundled runtime under base and receives real HMR messages', async () => {
  const received = [];
  const server = await createServer({ configFile: false, root: 'examples/vite', base: '/demo/',
    plugins: [resona({ onLog: entry => received.push(entry) })], server: { host: '127.0.0.1', port: 0 } });
  let socket;
  try {
    await server.listen();
    const address = server.httpServer.address();
    const origin = `http://127.0.0.1:${address.port}`;
    const html = await (await fetch(origin + '/demo/')).text();
    assert.ok(html.includes('/demo/@id/__x00__virtual:resona/client'));
    assert.ok(html.indexOf('virtual:resona/client') < html.indexOf('/src/main.ts'));
    const client = await (await fetch(origin + '/demo/@id/__x00__virtual:resona/client')).text();
    assert.ok(client.includes('import.meta.hot.send'));
    const runtime = await (await fetch(origin + '/demo/@id/__x00__virtual:resona/runtime')).text();
    assert.ok(runtime.includes('function installConsoleForwarder'));
    assert.ok(!runtime.includes('from "@resona/'));
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/demo/?token=${server.config.webSocketToken}`, 'vite-hmr');
    await once(socket, 'open');
    socket.send(JSON.stringify({ type: 'custom', event: LOG_EVENT, data: { level: 'invalid' } }));
    const entry = { version: 1, level: 'log', source: 'console', timestamp: Date.now(), args: ['integration'] };
    socket.send(JSON.stringify({ type: 'custom', event: LOG_EVENT, data: entry }));
    const deadline = Date.now() + 3000;
    while (received.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(received, [entry]);
  } finally {
    socket?.terminate();
    await server.close();
  }
});

test('disabled plugin injects nothing and production bundles contain no capture runtime', async () => {
  const server = await createServer({ configFile: false, plugins: [resona({ enabled: false })] });
  try {
    const html = await server.transformIndexHtml('/', '<html><head></head><body></body></html>');
    assert.ok(!html.includes('resona'));
  } finally { await server.close(); }
  const result = await build({ configFile: false, root: 'examples/vite', plugins: [resona()], logLevel: 'silent', build: { write: false } });
  for (const item of result.output) {
    const text = item.type === 'chunk' ? item.code : String(item.source);
    assert.ok(!/resona:log|installConsoleForwarder|virtual:resona/.test(text));
  }
});
