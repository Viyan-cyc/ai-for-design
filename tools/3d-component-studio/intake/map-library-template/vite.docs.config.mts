import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchMapLibre } from './scripts/adapters/patch-maplibre.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const original = readFileSync(resolve(root, 'node_modules/maplibre-gl/dist/maplibre-gl-dev.js'), 'utf8');
const patched = patchMapLibre(original), cache = join(tmpdir(), 'a3d-restored-map-' + createHash('sha256').update(root + patched).digest('hex').slice(0, 16));
mkdirSync(cache, { recursive: true }); writeFileSync(join(cache, 'maplibre-heat.cjs'), patched);
export default defineConfig({
  root: resolve(root, 'docs'),
  plugins: [{ name: 'documentation-fragments', closeBundle() {
    // The router fetches HTML fragments at runtime; Vite cannot infer these string paths.
    for (const dir of ['components', 'pages', 'api']) if (existsSync(resolve(root, 'docs', dir))) cpSync(resolve(root, 'docs', dir), resolve(root, 'dist-docs', dir), { recursive: true, filter: path => !/\.tsx?$/.test(path) });
    for (const file of ['components.json', 'uv.jpg']) if (existsSync(resolve(root, 'docs', file))) cpSync(resolve(root, 'docs', file), resolve(root, 'dist-docs', file));
  } }],
  cacheDir: join(cache, 'vite'),
  resolve: { alias: [{ find: /^maplibre-gl$/, replacement: join(cache, 'maplibre-heat.cjs') }] },
  optimizeDeps: { include: ['maplibre-gl', 'three', '@turf/turf'] },
  server: { fs: { allow: [root, cache] } },
  build: { outDir: resolve(root, 'dist-docs'), emptyOutDir: false, commonjsOptions: { include: [/node_modules/, /maplibre-heat\.cjs$/] } }
});
