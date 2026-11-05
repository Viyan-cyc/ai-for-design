import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkEnvironment, npmEntry } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
import { prepareProjectEnvironment, createBuildInput } from '../../skills/generate-3d-scene/scripts/lib/project-environment.mjs';
import { buildRuntimeSlotKeys } from '../../skills/generate-3d-scene/scripts/lib/runtime-slots.mjs';

const skill = resolve('skills/generate-3d-scene'), base = fs.mkdtempSync(join(tmpdir(), 'external-scene-'));
const env = checkEnvironment(), project = join(base, 'project'), source = join(project, 'source');
function run(script, args, ok = true, cwd) {
  const r = spawnSync(env.node, [script, ...args], { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(r.status === 0, ok, r.stdout + r.stderr + (r.error?.message ?? ''));
  return r;
}
function cleanSource(root) {
  for (const name of ['node_modules', '.cache', 'offline', 'dist', '.offline-build.lock']) assert(!fs.existsSync(join(root, name)), name);
}
const builds = () => fs.existsSync(join(env.dir, 'builds')) ? fs.readdirSync(join(env.dir, 'builds')).sort() : [];
try {
  run(join(skill, 'scripts/init.mjs'), [project, '--deps', 'external']);
  cleanSource(source);
  const before = builds();
  run(join(skill, 'scripts/build-offline.mjs'), [project]);
  cleanSource(source); assert.deepEqual(builds(), before);
  const preview = join(project, 'preview/scene.js'), old = fs.readFileSync(preview);
  const entry = join(source, 'src/offline-entry.ts'), entryText = fs.readFileSync(entry);
  fs.appendFileSync(entry, '\nconst bad: number = "INVALID";\n');
  run(join(skill, 'scripts/build-offline.mjs'), [project], false);
  assert.deepEqual(fs.readFileSync(preview), old); cleanSource(source); assert.deepEqual(builds(), before);
  fs.writeFileSync(entry, entryText);
  fs.appendFileSync(preview, '\nUSER_EDIT');
  const conflict = run(join(skill, 'scripts/build-offline.mjs'), [source], false);
  assert.match(conflict.stderr, /预览文件已修改/);
  assert(!conflict.stdout.includes('RESULT: OK'));
  assert(fs.readFileSync(preview, 'utf8').endsWith('USER_EDIT')); cleanSource(source); assert.deepEqual(builds(), before);
  fs.writeFileSync(preview, old);

  const slotInput = createBuildInput(source, prepareProjectEnvironment(source));
  try {
    const scene = JSON.parse(fs.readFileSync(join(source, 'public/scene3d/scene-data.json')));
    scene.Box = [{ id: 'runtime_probe', params: {} }];
    const keys = await buildRuntimeSlotKeys(slotInput.source, scene);
    assert(keys.has('runtime_probe'));
  } finally { slotInput.dispose(); }
  cleanSource(source); assert.deepEqual(builds(), before);

  // A developer can move source and use npm normally, with no skill runtime paths.
  const moved = join(base, 'developer/source'); fs.mkdirSync(join(base, 'developer'));
  fs.renameSync(source, moved);
  run(npmEntry(env.node), ['ci', '--offline', '--no-audit', '--no-fund'], true, moved);
  run(join(moved, 'scripts/build-offline.mjs'), [], true, moved);
  assert(fs.existsSync(join(base, 'developer/index.3d.html')));
  console.log('PASS clean generation, failure and preview conflict preservation, runtime slots, disposable input cleanup, moved source npm ci --offline and standalone build');

  // Real npm, local tarball only. Same path/version but changed bytes must invalidate cache.
  const local = join(base, 'local/source'), pkgDir = join(base, 'pkg/package');
  fs.mkdirSync(join(local, 'vendor'), { recursive: true }); fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(join(local, 'package.json'), JSON.stringify({ name: 'local-test', version: '1.0.0', dependencies: { 'fixture-dependency': 'file:./vendor/fixture.tgz' } }));
  fs.writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'fixture-dependency', version: '1.0.0', main: 'index.js' }));
  function pack(text) {
    fs.writeFileSync(join(pkgDir, 'index.js'), text);
    const r = spawnSync('tar', ['-czf', join(local, 'vendor/fixture.tgz'), '-C', join(base, 'pkg'), 'package'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  const localEnv = { ...env, dir: join(base, 'external'), registry: 'http://127.0.0.1:1' };
  pack('module.exports = 1;');
  const first = prepareProjectEnvironment(local, localEnv);
  const lock = fs.readFileSync(join(local, 'package-lock.json'));
  const repeat = prepareProjectEnvironment(local, localEnv);
  assert.equal(repeat.compiler, first.compiler); assert.equal(repeat.reused, true);
  assert.deepEqual(fs.readFileSync(join(local, 'package-lock.json')), lock);
  pack('module.exports = 2;');
  const changed = prepareProjectEnvironment(local, localEnv);
  assert.notEqual(changed.compiler, first.compiler);
  assert.equal(fs.readFileSync(join(changed.modules, 'fixture-dependency/index.js'), 'utf8'), 'module.exports = 2;');
  assert.equal(fs.readFileSync(join(first.modules, 'fixture-dependency/index.js'), 'utf8'), 'module.exports = 1;');
  assert(!fs.readFileSync(join(local, 'package-lock.json'), 'utf8').includes(base));
  cleanSource(local);
  const input = createBuildInput(local, changed); assert(fs.existsSync(join(input.source, 'node_modules/fixture-dependency'))); input.dispose();
  const stable = fs.readFileSync(join(local, 'package-lock.json'));
  fs.writeFileSync(join(local, 'vendor/fixture.tgz'), 'INVALID ARCHIVE');
  assert.throws(() => prepareProjectEnvironment(local, localEnv), /外部依赖安装失败/);
  assert.deepEqual(fs.readFileSync(join(local, 'package-lock.json')), stable);
  cleanSource(local);
  assert(!fs.readdirSync(join(localEnv.dir, 'projects')).some(name => name.startsWith('.install-')));
  assert.throws(() => prepareProjectEnvironment(local, { ...localEnv, dir: join(local, '.env') }), /交付项目之外/);
  console.log('PASS dependency reuse, same-name archive invalidation, portable lock, failed install leaves source/lock intact, external environment boundary');
} finally {
  assert(base.startsWith(join(tmpdir(), 'external-scene-')));
  fs.rmSync(base, { recursive: true, force: true });
}
