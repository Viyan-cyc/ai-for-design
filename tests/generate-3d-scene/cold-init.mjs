import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = mkdtempSync(join(tmpdir(), 'scene-cold-init-'));
const skill = resolve('skills/generate-3d-scene');
const env = { ...process.env, SCENE3D_ENV_DIR: join(root, 'environment'), npm_config_cache: join(root, 'cache') };
const run = (script, args) => spawnSync(process.execPath, [join(skill, 'scripts', script), ...args], { env, encoding: 'utf8', timeout: 30000 });
try {
  const checked = run('ensure-env.mjs', ['--json']);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.equal(JSON.parse(checked.stdout).dependencies, 'deferred');
  const project = join(root, 'scene');
  const init = run('init.mjs', [project, '--project-dir', '--name', 'cold-fixture', '--json']);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.equal(JSON.parse(init.stdout).gate.status, 'deferred');
  assert(!existsSync(env.SCENE3D_ENV_DIR));
  assert(!existsSync(env.npm_config_cache));
  assert(!existsSync(join(project, 'source/node_modules')));
  const scene = JSON.parse(readFileSync(join(project, 'source/public/data/scene.json')));
  scene.Box = [{ id: 'duplicate' }, { id: 'duplicate' }];
  const data = join(root, 'bad.json'); writeFileSync(data, JSON.stringify(scene));
  const bad = run('init.mjs', [join(root, 'bad'), '--project-dir', '--name', 'bad-fixture', '--scene', data, '--json']);
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /duplicate-id/);
  console.log('PASS empty environment/cache: runtime + init without install; malformed scene still rejected');
} finally { rmSync(root, { recursive: true, force: true }); }
