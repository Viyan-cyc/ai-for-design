import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { initProject } from '../../skills/generate-3d-scene/scripts/init.mjs';
import { workspaceFor } from '../../skills/generate-3d-scene/scripts/lib/workspace.mjs';
import { checkEnvironment } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';

const temp = mkdtempSync(join(tmpdir(), 'delivery-entrypoints-'));
const delivery = join(temp, 'output'), workspace = workspaceFor(delivery);
assert(!existsSync(workspace), 'never modify an existing workspace');
const cli = resolve('skills/generate-3d-scene/scripts/build-offline.mjs');
const node = checkEnvironment().node;
const snapshot = path => Object.fromEntries(readdirSync(path, { recursive: true, withFileTypes: true })
  .filter(e => e.isFile()).map(e => {
    const file = join(e.parentPath ?? e.path, e.name);
    return [file, readFileSync(file).toString('base64')];
  }));
function run(args, ok) {
  const result = spawnSync(node, args, { cwd: workspace, encoding: 'utf8', timeout: 120000 });
  assert(!result.error, String(result.error));
  const output = result.stdout + result.stderr;
  if (ok) assert.equal(result.status, 0, output);
  else {
    assert.equal(result.status, 1, output);
    assert.match(output, /交付保护/);
    assert.match(output, /source\/src\/main.ts/);
    assert.match(output, /user-original.txt/);
    assert.doesNotMatch(output, /RESULT: OK/);
  }
}
try {
  const result = initProject(workspace, { profile: 'empty', assets: 'referenced', deps: 'shared', deferBuild: true });
  assert(result.ok, JSON.stringify(result));
  writeFileSync(join(workspace, '.scene3d-delivery.json'), JSON.stringify({output: delivery}));
  run([cli, delivery], true);
  const initial = snapshot(delivery);
  const invalid = join(workspace, 'src/build-failure.ts');
  writeFileSync(invalid, 'export const value: number = "invalid";');
  const failed = spawnSync(node, [join(workspace, 'scripts/build-offline.mjs')], {cwd: workspace, encoding: 'utf8', timeout: 120000});
  assert(!failed.error, String(failed.error));
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout + failed.stderr, /类型检查未通过/);
  assert.deepEqual(snapshot(delivery), initial, 'typecheck failure preserves old delivery and baseline');
  rmSync(invalid);
  const source = join(delivery, 'source/src/main.ts');
  writeFileSync(source, readFileSync(source, 'utf8') + '\n// USER EDIT\n');
  writeFileSync(join(delivery, 'user-original.txt'), 'USER ASSET');
  const before = snapshot(delivery);
  for (const args of [[cli, delivery], [cli, workspace], [join(workspace, 'scripts/build-offline.mjs')]]) {
    run(args, false);
    assert.deepEqual(snapshot(delivery), before, 'entrypoint preserves all delivery bytes');
  }
  console.log('PASS real unified CLI delivery/workspace paths and project offline CLI: exit 1, no success, old source/baseline preserved');
} finally {
  assert(resolve(workspace).startsWith(resolve(homedir(), '.scene3d/workspaces') + sep));
  assert(resolve(temp).startsWith(resolve(tmpdir(), 'delivery-entrypoints-')));
  rmSync(workspace, {recursive: true, force: true});
  rmSync(temp, {recursive: true, force: true});
}
