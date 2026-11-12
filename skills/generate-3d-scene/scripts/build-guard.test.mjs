import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { acquireBuildLock, inputDigest, runPreparation } from './lib/build-guard.mjs';
const root = mkdtempSync(join(tmpdir(), 'scene-build-guard-'));
try {
  writeFileSync(join(root, 'input.txt'), 'before');
  const release = acquireBuildLock(root);
  assert.throws(() => acquireBuildLock(root), /构建锁/);
  const before = inputDigest(root);
  writeFileSync(join(root, '.cache', 'test'), 'cache');
  assert.equal(inputDigest(root), before);
  writeFileSync(join(root, 'input.txt'), 'after');
  assert.notEqual(inputDigest(root), before);
  release();
  acquireBuildLock(root)();
  runPreparation(process.execPath, ['-e', 'process.exit(0)'], root, spawnSync);
  assert.throws(() => runPreparation(process.execPath, ['-e', 'process.exit(7)'], root, spawnSync), /PREPARE_FAILED/);
  assert.throws(() => runPreparation('missing-scene-executable', [], root, spawnSync), /PREPARE_FAILED/);
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'source'));
  writeFileSync(join(root, 'source', 'package.json'), '{}');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./build-offline.mjs', import.meta.url)), root, '--prepare', process.execPath, '-e', 'process.exit(7)'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PREPARE_FAILED/);
  assert.doesNotMatch(result.stdout, /static-check|ASSEMBLY|HTML_PATH/);
  acquireBuildLock(join(root, 'source'))();
  const stable = inputDigest(root, { ignoreLockfile: true });
  writeFileSync(join(root, 'package-lock.json'), '{}');
  assert.equal(inputDigest(root, { ignoreLockfile: true }), stable);
  assert.notEqual(inputDigest(root), stable);
  console.log('PASS: lock, release, digest, preparation success/failure, CLI fail-fast');
} finally { rmSync(root, { recursive: true, force: true }); }

