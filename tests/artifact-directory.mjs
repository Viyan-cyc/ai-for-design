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
  const html = skill.includes('sweetui') ? 'index.gts.html' : 'index.gts-ep.html';
  const run = (root, explicit = true) => spawnSync(process.execPath,
    [script, ...(explicit ? [root] : []), 'test-page'], { cwd: root, encoding: 'utf8' });
  for (const explicit of [true, false]) {
    const root = fs.mkdtempSync(path.join(scratch, 'success-'));
    const result = run(root, explicit);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert(fs.existsSync(path.join(root, 'src/pages/TestPage/index.vue')));
    assert(fs.existsSync(path.join(root, html)));
    assert(!fs.existsSync(path.join(root, 'test-page')));
    const before = snapshot(root);
    assert.notEqual(run(root, explicit).status, 0);
    assert.deepEqual(snapshot(root), before);
    cases++;
  }
  for (const relative of [html, 'preview-data.js', 'src/user.txt', 'public/library/user.txt', 'public']) {
    const root = fs.mkdtempSync(path.join(scratch, 'conflict-'));
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'USER_CONTENT');
    const before = snapshot(root);
    const result = run(root);
    assert.notEqual(result.status, 0, `${skill}: accepted ${relative}`);
    assert(!result.stdout.includes('RESULT: OK'));
    assert.deepEqual(snapshot(root), before, `${skill}: changed files on conflict`);
    cases++;
  }
  // Non-conflicting attachments may coexist with generated files in these three scaffolds.
  if (skill !== 'gts-sweetui-coder') {
    const root = fs.mkdtempSync(path.join(scratch, 'attachment-'));
    fs.mkdirSync(path.join(root, 'public'));
    fs.writeFileSync(path.join(root, 'public/user.txt'), 'ATTACHMENT');
    assert.equal(run(root).status, 0);
    assert.equal(fs.readFileSync(path.join(root, 'public/user.txt'), 'utf8'), 'ATTACHMENT');
    cases++;
  }
}
console.log(`PASS: ${cases} artifact directory cases; fixtures: ${scratch}`);
