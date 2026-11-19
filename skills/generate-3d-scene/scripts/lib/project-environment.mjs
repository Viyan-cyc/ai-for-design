import { isDeepStrictEqual } from 'node:util';
/** Dependencies and disposable compiler inputs live outside delivered projects. */
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { installDependencies } from './npm-install.mjs';
import { checkRuntime, npmEntry, skillRoot } from './environment.mjs';
import { checkDependencyHealth } from './dependency-health.mjs';

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
export const dependencyKey = (pkg, lock, files, env) => {
  const manifest = { ...pkg }; delete manifest.name;
  return hash(JSON.stringify([process.platform, process.arch, env.version, manifest, lock ? normalizedLock(lock) : '', files]));
};
const keyFor = dependencyKey;
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

export function prepareProjectEnvironment(project, env = checkRuntime()) {
  const root = resolve(project);
  externalOnly(root, env);
  const packageFile = join(root, 'package.json'), lockFile = join(root, 'package-lock.json');
  plain(packageFile);
  if (existsSync(lockFile)) plain(lockFile);
  const packageText = readFileSync(packageFile, 'utf8');
  const pkg = JSON.parse(packageText);
  const lockText = existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : '';
  const files = localPackages(root, pkg);
  if (!files.length && sameTemplate(pkg, lockText)) {
    try { checkDependencyHealth(env.modules, pkg); return { ...env, reused: true }; }
    catch { /* No healthy template compiler: prepare this project's full manifest once. */ }
  }
  const base = join(env.dir, 'projects');
  mkdirSync(base, { recursive: true });
  const key = keyFor(pkg, lockText, files, env);
  const cached = join(base, key);
  if (existsSync(join(cached, 'node_modules')) && existsSync(join(cached, '.ready')) && readFileSync(join(cached, '.ready'), 'utf8') === key) {
    try { checkDependencyHealth(join(cached, 'node_modules'), pkg); return { ...env, compiler: cached, modules: join(cached, 'node_modules'), reused: true }; }
    catch (error) { console.warn(error.message + '；重新准备独立依赖缓存'); }
  }
  // Reuse the resolved lock of an identical initial dependency request for one day.
  const alias = join(base, key + '.resolved.json');
  if (existsSync(alias)) try {
    const entry = JSON.parse(readFileSync(alias, 'utf8'));
    if (Date.now() - entry.time < 86400000 && Date.now() >= entry.time && /^[a-f0-9]{64}$/.test(entry.key)) {
      const compiler = join(base, entry.key), nextLock = readFileSync(join(compiler, 'package-lock.json'), 'utf8');
      if (keyFor(pkg, nextLock, files, env) === entry.key && readFileSync(join(compiler, '.ready'), 'utf8') === entry.key) {
        checkDependencyHealth(join(compiler, 'node_modules'), pkg);
        writeFileSync(lockFile, nextLock);
        return { ...env, compiler, modules: join(compiler, 'node_modules'), reused: true };
      }
    }
  } catch { /* An expired or broken hint never bypasses installation. */ }
  const stage = mkdtempSync(join(base, '.install-'));
  const rootLock = lockText ? JSON.parse(lockText).packages?.[''] : null;
  const fields = ['dependencies', 'devDependencies', 'optionalDependencies'];
  const changed = !rootLock || fields.some(field => !isDeepStrictEqual(pkg[field] || {}, rootLock[field] || {}));
  // Local archives can change bytes without changing their declared version.
  const localChanged = files.some(([file]) => {
    const entry = Object.values(lockText ? JSON.parse(lockText).packages || {} : {}).find(value => value.resolved === 'file:' + file.replaceAll('\\', '/'));
    const integrity = entry?.integrity?.split(' ')[0];
    if (!integrity || lstatSync(join(root, file)).isDirectory()) return true;
    const dash = integrity.indexOf('-');
    try { return createHash(integrity.slice(0, dash)).update(readFileSync(join(root, file))).digest('base64') !== integrity.slice(dash + 1); }
    catch { return true; }
  });
  const command = changed || localChanged ? 'install' : 'ci';
  try {
    writeFileSync(join(stage, 'package.json'), packageText);
    if (lockText) {
      const lock = JSON.parse(lockText);
      // A file: archive can be replaced without changing its filename/version.
      // Resolve its current bytes rather than reuse the previous npm integrity.
      for (const [id, value] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })) {
        if (command === 'install' && typeof value === 'string' && value.startsWith('file:') && lock.packages) delete lock.packages[`node_modules/${id}`];
      }
      writeFileSync(join(stage, 'package-lock.json'), JSON.stringify(lock, null, 2));
    }
    for (const [file] of files) {
      mkdirSync(dirname(join(stage, file)), { recursive: true });
      cpSync(join(root, file), join(stage, file), { recursive: true, filter: path => { plain(path); return include(path); } });
    }
    installDependencies({ node: env.node, npm: npmEntry(env.node), cwd: stage, args: [command, '--install-links'], stateFile: join(env.dir, 'registry-health.json'),
      beforeRetry: () => {
        // This directory was created above for this install only. Never clear a shared cache.
        const partial = resolve(stage, 'node_modules');
        if (dirname(partial) !== resolve(stage) || dirname(resolve(stage)) !== resolve(base)) throw Error('安装临时目录边界错误');
        if (existsSync(partial)) { plain(partial); rmSync(partial, { recursive: true, force: true }); }
      },
    });
    checkDependencyHealth(join(stage, 'node_modules'), pkg);
    const nextLock = readFileSync(join(stage, 'package-lock.json'), 'utf8');
    // Never copy a stale build snapshot over a concurrent source edit.
    if (readFileSync(packageFile, 'utf8') !== packageText || (existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : '') !== lockText || JSON.stringify(localPackages(root, pkg)) !== JSON.stringify(files)) {
      throw new Error('准备依赖期间工程依赖配置发生变化，请重新构建');
    }
    const finalKey = keyFor(pkg, nextLock, files, env), compiler = join(base, finalKey);
    writeFileSync(join(stage, '.ready'), finalKey);
    if (existsSync(compiler)) {
      let healthy = false;
      try { checkDependencyHealth(join(compiler, 'node_modules'), pkg); healthy = readFileSync(join(compiler, '.ready'), 'utf8') === finalKey; } catch {}
      if (!healthy) renameSync(compiler, compiler + '.incomplete-' + Date.now());
    }
    if (!existsSync(compiler)) renameSync(stage, compiler);
    writeFileSync(alias, JSON.stringify({ key: finalKey, time: Date.now() }));
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
