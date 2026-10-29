import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageDelivery } from '../../skills/generate-3d-scene/template/scripts/package-delivery.mjs';

const root = mkdtempSync(join(tmpdir(), 'scene-delivery-test-'));
const put = (path, data = '') => {
  const file = join(root, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, data);
};
try {
  put('offline/index.3d.html', '<link href="./scene.css"><script src="./scene-data.js"></script><script src="./scene.js"></script>');
  for (const name of ['scene.css', 'scene-data.js', 'scene.js', '.scene3d-offline']) put(`offline/${name}`);
  put('package.json', JSON.stringify({ dependencies: { sample: 'file:./vendor/sample.tgz' } }));
  put('vendor/sample.tgz'); put('src/main.ts'); put('public/scene3d/scene-data.json', '{}');
  put('scripts/build-offline.mjs'); put('tsconfig.app.json'); put('vite.config.ts'); put('package-lock.json');
  put('node_modules/junk'); put('.cache/junk'); put('asset-queries.txt'); put('scenes/demo.json');
  const html = packageDelivery(root);
  assert.deepEqual(readdirSync(join(root, 'delivery')).sort(), ['index.3d.html', 'preview', 'source']);
  for (const match of readFileSync(html, 'utf8').matchAll(/(?:href|src)="\.\/([^"]+)"/g)) assert.ok(existsSync(join(root, 'delivery', match[1])));
  assert.ok(existsSync(join(root, 'delivery/source/vendor/sample.tgz')));
  assert.ok(existsSync(join(root, 'delivery/source/tsconfig.app.json')));
  for (const path of ['node_modules', '.cache', 'asset-queries.txt', 'scenes', 'offline', 'delivery']) assert.ok(!existsSync(join(root, 'delivery/source', path)));
  put('src/main.ts', 'updated'); packageDelivery(root);
  assert.equal(readFileSync(join(root, 'delivery/source/src/main.ts'), 'utf8'), 'updated');
  put('package.json', JSON.stringify({ dependencies: { broken: 'file:../outside.tgz' } }));
  assert.throws(() => packageDelivery(root), /本地依赖/);
  assert.ok(existsSync(html), 'failed export preserves last delivery');
  rmSync(join(root, 'delivery/preview/.scene3d-delivery'));
  assert.throws(() => packageDelivery(root), /不是本工具创建/);
  assert.ok(existsSync(html), 'unowned output is preserved');
  console.log('PASS delivery layout, references, local dependencies, repeat build and failure preservation');
} finally {
  rmSync(root, { recursive: true, force: true });
}
