/** Maintenance regression for shared environment, clean scaffold and layout generation. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, cpSync, existsSync, realpathSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkEnvironment, environment } from '../lib/environment.mjs';
import { initProject } from '../init.mjs';
import { expandLayout } from '../layout-nodes.mjs';
import { assetMetadata, runtimeCompatibility } from '../lib/asset-metadata.mjs';
import { searchAssets, loadIndex } from '../search-assets.mjs';

const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const temp = mkdtempSync(join(tmpdir(), 'gts3d-generation-'));
const env = checkEnvironment();
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
assert.equal(existsSync(join(skill, 'template/node_modules')), false, 'skill must not contain dependency tree');
assert.throws(() => checkEnvironment(join(temp, 'missing-env')), /not installed/);
const invalid = join(temp, 'outdated-env'); mkdirSync(invalid);
save(join(invalid, 'env.lock.json'), { dependencyLockHash: 'old' });
assert.throws(() => checkEnvironment(invalid), /lock changed/);
assert.equal(environment(temp).dir, temp);
console.log('PASS ready/missing/outdated external environment');

const project = join(temp, '场景 空格');
const initialized = initProject(project, { deferBuild: true });
assert.equal(initialized.ok, true, JSON.stringify(initialized.errors));
assert.equal(realpathSync(join(project, 'node_modules')), realpathSync(env.modules));
assert.equal(existsSync(join(project, 'src/scene-core/cards/ExampleCard.vue')), false);
assert.equal(existsSync(join(project, 'src/scene-core/handlers/example')), false);
assert.equal(existsSync(join(project, 'public/assets/textures/example.jpg')), false);
assert.equal(existsSync(join(project, 'offline')), false);
console.log('PASS clean empty project links shared dependencies without initial build');

const groups = expandLayout([{ type: 'blocks', idPrefix: 'rack', counts: [3, 2, 4], spacing: [5, 3, 4], origin: [-5, 0, -6], node: { params: { label: 'rack' } } }]);
assert.equal(groups.blocks.length, 24);
assert.equal(new Set(groups.blocks.map((n) => n.id)).size, 24);
assert.deepEqual(groups.blocks.at(-1).position, [5, 3, 6]);
groups.blocks[0].params.label = 'changed';
assert.equal(groups.blocks[1].params.label, 'rack');
assert.throws(() => expandLayout([{ type: 'scene', idPrefix: 'bad' }]));
assert.throws(() => expandLayout([{ type: 'blocks', idPrefix: 'dup' }, { type: 'blocks', idPrefix: 'dup' }]), /Duplicate/);
assert.throws(() => expandLayout([{ type: 'blocks', idPrefix: 'bad', counts: [2, -1, 3] }]));
cpSync(join(skill, 'scripts/scaffolds/block-handler.ts'), join(project, 'src/scene-core/handlers/block.ts'));
const profile = join(project, 'src/scene-profile.ts');
writeFileSync(profile, "import { registerBlockHandler } from './scene-core/handlers/block';\n" + readFileSync(profile, 'utf8')
  .replace('=> void> = {};', '=> void> = { blocks: ({ sceneEngine }) => registerBlockHandler(sceneEngine) };'));
const scenePath = join(project, 'public/scene-data.json');
save(scenePath, { ...json(scenePath), ...groups });
console.log('PASS editable node layout with stable IDs and independent params');

const { index } = loadIndex(join(skill, 'assets'));
const results = searchAssets(index, '机柜', 3, true);
assert(results.some((r) => r.size && r.triangles > 0));
assert(results.every((r) => !('description' in r)));
assert.equal(runtimeCompatibility({ extensionsRequired: ['KHR_texture_basisu'] }).status, 'unsupported');
assert.equal(runtimeCompatibility({ extensionsUsed: ['EXT_meshopt_compression'] }).status, 'unsupported');
assert.equal(runtimeCompatibility({ extensionsRequired: ['KHR_draco_mesh_compression'] }).status, 'supported');
assert.equal(runtimeCompatibility({ extensionsRequired: ['UNKNOWN_extension'] }).status, 'unsupported');
assert.equal(assetMetadata({ modelPath: '../outside.glb' }, join(skill, 'assets')).compatibility.status, 'unknown');
console.log('PASS compact asset metadata and unsupported/missing extension handling');

const built = spawnSync(env.node, [join(skill, 'scripts/build-offline.mjs'), project], { cwd: skill, encoding: 'utf8' });
assert.equal(built.status, 0, built.stdout + built.stderr);
assert(existsSync(join(project, '.cache/tsconfig.app.tsbuildinfo')));
assert(existsSync(join(project, 'offline/index.3d.html')));
assert.match(built.stdout, /TIMING_MS:/);
console.log(built.stdout.trim());
console.log(`FIXTURE: ${project}`);
