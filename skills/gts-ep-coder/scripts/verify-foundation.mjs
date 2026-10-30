#!/usr/bin/env node
// Maintainer-only behavioral contract tests. Creates a unique scratch directory; does not delete files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'copy-foundation.mjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'gts-foundation-'));
const tests = [];
function fixture(name) {
  const project = path.join(scratch, name);
  fs.mkdirSync(path.join(project, 'src/pages/TestPage'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src/pages/TestPage/index.vue'), '<template><div /></template>');
  return project;
}
function run(project, assets, extra = [], page = 'TestPage') {
  const result = spawnSync(process.execPath, [script, '--dir', project, '--page', page, '--assets', assets, ...extra], { encoding: 'utf8', timeout: 15000 });
  return { code: result.status, output: result.stdout + result.stderr };
}
function target(project, id) { return path.join(project, `src/pages/TestPage/components/foundation/${id}.vue`); }
function test(name, fn) { fn(); tests.push(name); console.log('PASS: ' + name); }

try {
  const project = fixture('normal');
  test('check performs no project writes', () => {
    const result = run(project, 'workbench-shell', ['--check']);
    assert.equal(result.code, 0, result.output);
    assert(!fs.existsSync(path.join(project, 'src/pages/TestPage/components')));
    assert(!fs.existsSync(path.join(project, '.gts-assets.json')));
  });
  test('only selected asset copied as a regular file', () => {
    const result = run(project, 'conversation-composer');
    assert.equal(result.code, 0, result.output);
    assert(fs.lstatSync(target(project, 'conversation-composer')).isFile());
    assert(!fs.existsSync(target(project, 'workbench-shell')));
    assert.equal(fs.readFileSync(path.join(project, 'src/pages/TestPage/index.vue'), 'utf8'), '<template><div /></template>');
  });
  test('repeat preserves source timestamp without creating a receipt', () => {
    const file = target(project, 'conversation-composer');
    const receipt = path.join(project, '.gts-assets.json');
    const before = fs.statSync(file).mtimeMs;
    const result = run(project, 'conversation-composer');
    assert.equal(result.code, 0, result.output);
    assert(result.output.includes('REUSED:'));
    assert.equal(fs.statSync(file).mtimeMs, before);
    assert(!fs.existsSync(receipt));
  });
  test('standard icon wiring remains reusable', () => {
    const file = target(project, 'conversation-composer');
    const wired = fs.readFileSync(file, 'utf8').replace("'@element-plus/icons-vue'", '"../../../../assets/icons/entry.js"');
    fs.writeFileSync(file, wired);
    const result = run(project, 'conversation-composer');
    assert.equal(result.code, 0, result.output);
    assert.equal(fs.readFileSync(file, 'utf8'), wired);
  });
  test('local edits block whole selection without overwriting or partial additions', () => {
    const file = target(project, 'conversation-composer');
    fs.appendFileSync(file, '\n<!-- project-specific change -->\n');
    const saved = fs.readFileSync(file, 'utf8');
    const result = run(project, 'workbench-shell,conversation-composer');
    assert.equal(result.code, 1, result.output);
    assert(result.output.includes('CONFLICT'));
    assert.equal(fs.readFileSync(file, 'utf8'), saved);
    assert(!fs.existsSync(path.join(project, '.gts-assets.json')));
    assert(!fs.existsSync(target(project, 'workbench-shell')));
  });
  test('unknown asset rejects before any source addition', () => {
    const fresh = fixture('unknown');
    assert.equal(run(fresh, 'workbench-shell,unknown').code, 1);
    assert(!fs.existsSync(path.join(fresh, 'src/pages/TestPage/components')));
  });
  test('traversal and duplicate IDs rejected', () => {
    assert.equal(run(project, 'workbench-shell', [], '../Escape').code, 1);
    assert.equal(run(project, 'workbench-shell,workbench-shell').code, 1);
  });
  test('legacy receipt is ignored and preserved', () => {
    const fresh = fixture('legacy-receipt');
    const file = path.join(fresh, '.gts-assets.json');
    fs.writeFileSync(file, 'not-json');
    const result = run(fresh, 'workbench-shell');
    assert.equal(result.code, 0, result.output);
    assert.equal(fs.readFileSync(file, 'utf8'), 'not-json');
    assert(fs.existsSync(target(fresh, 'workbench-shell')));
  });
  test('linked destination cannot write outside project', () => {
    const fresh = fixture('linked');
    const outside = path.join(scratch, 'outside');
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(fresh, 'src/pages/TestPage/components'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = run(fresh, 'workbench-shell');
    assert.equal(result.code, 1, result.output);
    assert(result.output.includes('PATH'));
    assert.deepEqual(fs.readdirSync(outside), []);
  });
  console.log('RESULT: OK\nCHECKS: ' + tests.length + '\nSCRATCH: ' + scratch);
} catch (error) {
  console.error('RESULT: FAIL | ' + error.stack + '\nPASSED: ' + tests.length + '\nSCRATCH: ' + scratch);
  process.exitCode = 1;
}
