import { mkdirSync, openSync, closeSync, unlinkSync, writeFileSync, readdirSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export function acquireBuildLock(root) {
  const dir = join(root, '.cache');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'scene3d-build.lock');
  let fd;
  try { fd = openSync(file, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`工程已有构建锁：${file}。确认记录的进程已退出后才可手动删除残留锁。`);
    throw error;
  }
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); }
  catch (error) { closeSync(fd); unlinkSync(file); throw error; }
  closeSync(fd);
  return () => unlinkSync(file);
}

// Match build-input exclusions; generated output and caches are not source inputs.
export function inputDigest(root, { ignoreLockfile = false } = {}) {
  const hash = createHash('sha256');
  function walk(dir, prefix = '') {
    for (const name of readdirSync(dir).sort()) {
      if (['node_modules', '.cache', '.git'].includes(name) || name.startsWith('.offline-')) continue;
      if (!prefix && (['offline', 'dist'].includes(name) || (ignoreLockfile && name === 'package-lock.json'))) continue;
      const path = join(dir, name), relative = prefix + name, stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`构建输入不支持链接：${path}`);
      hash.update(JSON.stringify([relative, stat.isDirectory() ? 'directory' : 'file']));
      if (stat.isDirectory()) walk(path, relative + '/');
      else hash.update(createHash('sha256').update(readFileSync(path)).digest());
    }
  }
  walk(root);
  return hash.digest('hex');
}

export function runPreparation(command, args, root, spawn) {
  const result = spawn(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`PREPARE_FAILED：${result.error?.message ?? result.signal ?? result.status}；未启动构建`);
  }
}
