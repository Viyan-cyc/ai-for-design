/** Dependencies and disposable compiler inputs live outside delivered projects. */
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { checkEnvironment, npmEntry, skillRoot } from './environment.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const excluded = new Set(['node_modules', '.cache', '.git']);
const include = path => !excluded.has(basename(path)) && !basename(path).startsWith('.offline-');
function plain(path) {
  if (lstatSync(path).isSymbolicLink()) throw new Error(`构建输入不支持链接：${path}`);
}
function treeHash(path) {
  plain(path);
  return lstatSync(path).isDirectory()
    ? hash(JSON.stringify(readdirSync(path).sort().filter(name => include(name)).map(name => [name, treeHash(join(path, name))])))
    : hash(readFileSync(path));
}
function localPackages(root, pkg) {
  const files = new Map();
  for (const value of Object.values({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })) {
    if (typeof value !== 'string' || !value.startsWith('file:')) continue;
    const path = resolve(root, value.slice(5));
    const key = relative(root, path);
    if (!key || key.startsWith(`..${sep}`) || key === '..' || isAbsolute(key)) throw new Error(`本地依赖须位于 source 内：${value}`);
    for (let p = path; p !== root; p = dirname(p)) plain(p);
    files.set(key, treeHash(path));
  }
  return [...files].sort(([a], [b]) => a.localeCompare(b));
}
const keyFor = (pkg, lock, files, env) => hash(JSON.stringify([process.platform, process.arch, env.version, pkg, lock, files]));
function externalOnly(root, env) {
  const path = relative(dirname(root), resolve(env.dir));
  if (!path || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))) throw new Error('SCENE3D_ENV_DIR 必须位于交付项目之外');
}
function normalizedLock(text) {
  const lock = JSON.parse(text);
  delete lock.name;
  if (lock.packages?.['']) delete lock.packages[''].name;
  return JSON.stringify(lock);
}
function sameTemplate(pkg, lock) {
  if (!lock) return false;
  const template = JSON.parse(readFileSync(join(skillRoot, 'template/package.json'), 'utf8'));
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'overrides', 'peerDependencies', 'workspaces']) {
    if (JSON.stringify(pkg[field]) !== JSON.stringify(template[field])) return false;
  }
  return normalizedLock(lock) === normalizedLock(readFileSync(join(skillRoot, 'template/package-lock.json'), 'utf8'));
}

export function prepareProjectEnvironment(project, env = checkEnvironment()) {
  const root = resolve(project);
  externalOnly(root, env);
  const packageFile = join(root, 'package.json'), lockFile = join(root, 'package-lock.json');
  plain(packageFile);
  if (existsSync(lockFile)) plain(lockFile);
  const packageText = readFileSync(packageFile, 'utf8');
  const pkg = JSON.parse(packageText);
  const lockText = existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : '';
  const files = localPackages(root, pkg);
  if (!files.length && sameTemplate(pkg, lockText)) return { ...env, reused: true };
  const base = join(env.dir, 'projects');
  mkdirSync(base, { recursive: true });
  const key = keyFor(pkg, lockText, files, env);
  const cached = join(base, key);
  if (existsSync(join(cached, 'node_modules')) && existsSync(join(cached, '.ready')) && readFileSync(join(cached, '.ready'), 'utf8') === key) {
    return { ...env, compiler: cached, modules: join(cached, 'node_modules'), reused: true };
  }
  const stage = mkdtempSync(join(base, '.install-'));
  try {
    writeFileSync(join(stage, 'package.json'), packageText);
    if (lockText) {
      const lock = JSON.parse(lockText);
      // A file: archive can be replaced without changing its filename/version.
      // Resolve its current bytes rather than reuse the previous npm integrity.
      for (const [id, value] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })) {
        if (typeof value === 'string' && value.startsWith('file:') && lock.packages) delete lock.packages[`node_modules/${id}`];
      }
      writeFileSync(join(stage, 'package-lock.json'), JSON.stringify(lock, null, 2));
    }
    for (const [file] of files) {
      mkdirSync(dirname(join(stage, file)), { recursive: true });
      cpSync(join(root, file), join(stage, file), { recursive: true, filter: path => { plain(path); return include(path); } });
    }
    const result = spawnSync(env.node, [npmEntry(env.node), 'install', '--install-links', '--no-audit', '--no-fund', '--registry', env.registry], { cwd: stage, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error(`外部依赖安装失败：${result.error?.message ?? result.status}`);
    const nextLock = readFileSync(join(stage, 'package-lock.json'), 'utf8');
    // Never copy a stale build snapshot over a concurrent source edit.
    if (readFileSync(packageFile, 'utf8') !== packageText || (existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : '') !== lockText || JSON.stringify(localPackages(root, pkg)) !== JSON.stringify(files)) {
      throw new Error('准备依赖期间工程依赖配置发生变化，请重新构建');
    }
    const finalKey = keyFor(pkg, nextLock, files, env), compiler = join(base, finalKey);
    writeFileSync(join(stage, '.ready'), finalKey);
    if (!existsSync(compiler)) renameSync(stage, compiler);
    else if (!existsSync(join(compiler, '.ready')) || readFileSync(join(compiler, '.ready'), 'utf8') !== finalKey) throw new Error(`外部依赖缓存不完整：${compiler}`);
    if (nextLock !== lockText) writeFileSync(lockFile, nextLock);
    return { ...env, compiler, modules: join(compiler, 'node_modules'), reused: false };
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

export function createBuildInput(project, env) {
  const root = resolve(project), base = join(env.dir, 'builds');
  externalOnly(root, env);
  mkdirSync(base, { recursive: true });
  const temp = mkdtempSync(join(base, 'scene-'));
  const source = join(temp, 'source');
  try {
    cpSync(root, source, { recursive: true, filter: path => {
      if (path !== root && !include(path)) return false;
      const top = relative(root, path).split(sep)[0];
      if (top === 'offline' || top === 'dist' || top.startsWith('.offline-')) return false;
      plain(path); return true;
    } });
    symlinkSync(env.modules, join(source, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    return { source, dispose: () => rmSync(temp, { recursive: true, force: true }) };
  } catch (error) { rmSync(temp, { recursive: true, force: true }); throw error; }
}
