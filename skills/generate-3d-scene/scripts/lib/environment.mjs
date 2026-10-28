/** EP-style external environment; template manifests remain the source of truth. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

export const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function environment(override) {
  const cfg = JSON.parse(readFileSync(join(skillRoot, 'references/env-config.json'), 'utf8'));
  const base = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || join(process.env.USERPROFILE, 'AppData/Local')
    : process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support')
      : process.env.XDG_DATA_HOME || join(process.env.HOME, '.local/share');
  const dir = resolve(override || process.env[cfg.envDirEnvVar] || join(base, cfg.envDirName));
  const compiler = join(dir, 'compiler');
  const portable = process.platform === 'win32' ? join(dir, 'node/node.exe') : join(dir, 'node/bin/node');
  return { dir, compiler, modules: join(compiler, 'node_modules'),
    node: existsSync(portable) ? portable : process.execPath, registry: process.env.SCENE3D_REGISTRY || cfg.fallbackNpmRegistry };
}
export const dependencyPath = (...parts) => join(environment().modules, ...parts);
export function checkEnvironment(override) {
  const env = environment(override);
  const hint = `node "${join(skillRoot, 'scripts/setup-env.mjs')}" --env-dir="${env.dir}"`;
  const fail = (code, message) => { throw Object.assign(new Error(message), { code, hint }); };
  let version;
  try { version = execFileSync(env.node, ['-v'], { encoding: 'utf8' }).trim(); }
  catch (e) { fail('ENV_NODE_BROKEN', e.message); }
  if (Number(version.slice(1).split('.')[0]) < 22) {
    const install = process.platform === 'win32'
      ? `powershell -ExecutionPolicy Bypass -File "${join(skillRoot, 'scripts/install/install.ps1')}" -EnvDir "${env.dir}" -ForcePortableNode`
      : `bash "${join(skillRoot, 'scripts/install/install.sh')}" --env-dir="${env.dir}" --force-portable-node`;
    throw Object.assign(new Error(`Node >=22 required, found ${version}`), { code: 'ENV_NODE_UNSUPPORTED', hint: install });
  }
  let lock;
  try { lock = JSON.parse(readFileSync(join(env.dir, 'env.lock.json'), 'utf8')); }
  catch { fail('ENV_LOCK_MISSING', `Environment is not installed: ${env.dir}`); }
  const expected = createHash('sha256').update(readFileSync(join(skillRoot, 'template/package-lock.json'))).digest('hex');
  if (lock.dependencyLockHash !== expected) fail('ENV_OUTDATED', 'Template dependency lock changed; run setup-env');
  const req = createRequire(join(env.compiler, 'package.json'));
  try {
    for (const id of ['three', 'vue', 'typescript', '@vue/compiler-sfc']) req(id);
    for (const id of ['vite', '@vitejs/plugin-vue', 'vue-tsc/bin/vue-tsc.js']) req.resolve(id);
  } catch (e) { fail('DEPENDENCY_LOAD_FAILED', e.message); }
  const declared = JSON.parse(readFileSync(join(skillRoot, 'template/package.json'), 'utf8')).dependencies.three;
  const installed = JSON.parse(readFileSync(join(env.modules, 'three/package.json'), 'utf8')).version;
  if (declared !== installed) fail('THREE_VERSION_MISMATCH', `Expected ${declared}, found ${installed}`);
  return { ...env, registry: process.env.SCENE3D_REGISTRY || lock.npmRegistry || env.registry, version, three: installed };
}

export function npmEntry(node) {
  const dir = dirname(node);
  for (const candidate of ['node_modules/npm/bin/npm-cli.js', '../lib/node_modules/npm/bin/npm-cli.js', '../node_modules/npm/bin/npm-cli.js']) {
    const entry = resolve(dir, candidate);
    if (existsSync(entry)) return entry;
  }
  throw new Error(`npm entry not found beside ${node}`);
}
