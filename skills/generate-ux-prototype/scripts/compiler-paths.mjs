// compiler-paths.mjs — 共享池路径解析 + 编译器依赖定位 + 就绪校验（fastui 式）
//
// 重资产（@vue/compiler-sfc 依赖树，~19MB / 800+ 文件）不住 skill 目录：
// 住用户机器的共享池，首次运行 setup-compiler.mjs 时由 npm install 现场生成。
// skill 目录里只留 package.json（依赖声明真源）+ package-lock.json（版本锁定真源）。
//
// 查找顺序（resolveCompilerModules）：
//   1. 环境变量 OCTO_UX_COMPILER_DIR 显式指定（逃生口）
//   2. 共享池 <pool>/compiler-deps/node_modules/（常规落点）
//   3. skill 内旧位置 verify/compiler/node_modules/（过渡兼容，未来可删）

import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export const SKILL_SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

// 共享池根（fastui 同款布局；OCTO_UX_ENV_DIR 可覆盖，本地验证必需）
export function envDir(override) {
  if (override) return resolve(override);
  const key = 'OCTO_UX_ENV_DIR';
  if (process.env[key]) return resolve(process.env[key]);
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    return join(base, 'OctoAgent', 'ux-prototype');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'OctoAgent', 'ux-prototype');
  }
  return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'OctoAgent', 'ux-prototype');
}

// 依赖声明真源：skill 包内只保留 package.json + package-lock.json（版本锁定），随分发走
export const COMPILER_PKG_DIR = join(SKILL_SCRIPTS_DIR, 'verify', 'compiler');
export const COMPILER_PKG_JSON = join(COMPILER_PKG_DIR, 'package.json');
export const COMPILER_PKG_LOCK = join(COMPILER_PKG_DIR, 'package-lock.json');
// 旧布局（vendored）——过渡兼容查找用
const LEGACY_MODULES = join(COMPILER_PKG_DIR, 'node_modules');

// 依赖树落点 = <pool>/compiler-deps/node_modules/
// ⚠️ 内层目录必须字面命名为 node_modules——Node 裸依赖解析要求祖先目录叫这个名字
// （旧 vendored 布局能跑正是蹭了这一点；compiler-node_modules 这种名字会断解析链）
export function poolModulesDir(override) {
  return join(envDir(override), 'compiler-deps', 'node_modules');
}

/**
 * 定位可用的 @vue/compiler-sfc 依赖树。
 * @returns {{ ok: true, dir: string, source: string } | { ok: false, candidates: string[] }}
 */
export function resolveCompilerModules(override) {
  const candidates = [];
  if (process.env.OCTO_UX_COMPILER_DIR) {
    const dir = resolve(process.env.OCTO_UX_COMPILER_DIR);
    candidates.push(dir);
    if (validModules(dir)) return { ok: true, dir, source: 'env' };
  }
  const pool = poolModulesDir(override);
  candidates.push(pool);
  if (validModules(pool)) return { ok: true, dir: pool, source: 'pool' };
  candidates.push(LEGACY_MODULES);
  if (validModules(LEGACY_MODULES)) return { ok: true, dir: LEGACY_MODULES, source: 'legacy' };
  return { ok: false, candidates };
}

function validModules(dir) {
  try {
    // 不只看目录在——能加载到 compiler-sfc 的 package.json 才算真可用
    const pkg = join(dir, '@vue', 'compiler-sfc', 'package.json');
    return requireCompat(pkg);
  } catch {
    return false;
  }
}

function requireCompat(pkgJsonPath) {
  return createRequire(pkgJsonPath)('./package.json') != null;
}

export function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

export function setupHint(extra = '') {
  return `node "${join(SKILL_SCRIPTS_DIR, 'setup-compiler.mjs')}"${extra}   # 首装/升级约 10-30s，装完重跑即可`;
}

/**
 * 就绪校验（fastui ensure-env 同款三段：包完整 → 依赖树在 → lockfile 漂移）。
 * ensure-compiler.mjs / init.mjs / build.mjs 三处共用，逻辑只写这一份。
 *
 * 漂移判据（fastui §5.2.1 同款——比的是「skill 现在要求的树」vs「装的时候那棵」，
 * 两端跨过 skill 与共享池边界，skill 升级才能被感知）：
 * skill 的 package-lock.json 哈希 vs 共享池 env.lock.json 里记录的 lockfileHash。
 * @returns {{ ok: true, source: string, dir: string }
 *   | { ok: false, code: string, message: string }}
 */
export function checkCompilerEnv() {
  if (!existsSync(COMPILER_PKG_JSON)) {
    return { ok: false, code: 'SKILL_PKG_BROKEN', message: `缺少 ${COMPILER_PKG_JSON}（skill 组装不完整，向维护者反馈）` };
  }
  const found = resolveCompilerModules();
  if (!found.ok) {
    return { ok: false, code: 'COMPILER_DEPS_MISSING', message: `@vue/compiler-sfc 依赖树未安装（已找过: ${found.candidates.join(' , ')}）` };
  }
  // 漂移检测只对共享池安装生效（legacy 目录与 env 显式路径不受 skill 版本约束）
  if (found.source === 'pool') {
    const lockPath = join(envDir(), 'env.lock.json');
    if (!existsSync(COMPILER_PKG_LOCK)) {
      // skill 包没有 lockfile（异常状态）——不拦，但不假装校验过
      return { ok: true, source: found.source, dir: found.dir, note: 'SKILL_NO_LOCKFILE' };
    }
    let lock = null;
    try { lock = JSON.parse(readFileSync(lockPath, 'utf8')); } catch {}
    const wantHash = sha256File(COMPILER_PKG_LOCK);
    if (!lock?.compilerDeps?.lockfileHash) {
      return { ok: false, code: 'COMPILER_ENV_OUTDATED', message: `共享池环境清单缺失或过旧（${lockPath} 无 lockfileHash），无法确认装的是哪棵依赖树` };
    }
    if (lock.compilerDeps.lockfileHash !== wantHash) {
      return { ok: false, code: 'COMPILER_ENV_OUTDATED', message: `共享池依赖树与当前 skill 要求的不一致（skill lockfile=${wantHash.slice(0, 12)}…，池内记录=${String(lock.compilerDeps.lockfileHash).slice(0, 12)}…）` };
    }
  }
  return { ok: true, source: found.source, dir: found.dir };
}
