import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-directory-'));
let cases = 0;
function snapshot(root) {
  const entries = {};
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      entries[path.relative(root, full)] = item.isDirectory() ? 'directory' : fs.readFileSync(full).toString('base64');
      if (item.isDirectory()) walk(full);
    }
  }
  walk(root);
  return entries;
}
for (const skill of ['gts-ep-coder', 'gts-charts-coder', 'sweetui-vue-creator', 'gts-sweetui-coder']) {
  const script = path.join(repo, 'skills', skill, 'scripts/init.mjs');
  for (const explicit of [true, false]) {
    const parent = fs.mkdtempSync(path.join(scratch, 'parent-'));
    const args = [...(explicit ? [parent] : []), 'test-page'];
    const run = (values) => spawnSync(process.execPath, [script, ...values], {cwd:parent,encoding:'utf8'});
    const first = run(args); assert.equal(first.status, 0, first.stdout + first.stderr);
    const project = path.join(parent, 'test-page');
    assert(fs.existsSync(path.join(project, 'src/pages/TestPage/index.vue')));
    fs.writeFileSync(path.join(project, 'user.txt'), 'USER_CONTENT');
    const before = snapshot(project);
    assert.equal(run(args).status, 0);
    assert(fs.existsSync(path.join(parent, 'test-page-2/src')));
    assert.deepEqual(snapshot(project), before);
    assert.equal(run(args).status, 0);
    assert(fs.existsSync(path.join(parent, 'test-page-3/src')));
    const all = snapshot(parent);
    assert.notEqual(run([project, 'test-page', '--project-dir']).status, 0);
    assert.deepEqual(snapshot(parent), all);
    const exact = path.join(parent, 'explicit-location');
    assert.equal(run([exact, 'test-page', '--project-dir']).status, 0);
    assert(fs.existsSync(path.join(exact, 'src')));
    assert(!fs.existsSync(path.join(exact, 'test-page')));
    const numeric = run([parent, '3d-dashboard']);
    assert.equal(numeric.status, 0, numeric.stdout + numeric.stderr);
    assert(fs.existsSync(path.join(parent, '3d-dashboard/src')));
    cases++;
  }
}
console.log(`PASS: ${cases} directory scenarios (new, numbered collision, unchanged original, exact path); fixtures: ${scratch}`);
