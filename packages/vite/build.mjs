import { build } from 'esbuild';
await build({
  entryPoints: ['../browser/src/index.ts'],
  outfile: 'dist/browser.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
});
