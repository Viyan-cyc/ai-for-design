// compiler-paths.mjs — 共享池路径解析 + 编译器依赖定位（fastui 式）
//
// 重资产（@vue/compiler-sfc 依赖树，~19MB / 800+ 文件）不住 skill 目录：
// 住用户机器的共享池，首次运行 setup-compiler.mjs 时由 npm install 现场生成。
// skill 目录里只留 package.json（依赖声明真源）+ PLACEHOLDER.md（哨兵）。
//
// 查找顺序（resolveCompilerModules）：
//   1. 环境变量 OCTO_UX_COMPILER_DIR 显式指定（逃生口）
//   2. 共享池 <pool>/compiler-node_modules/（常规落点）
//   3. skill 内旧位置 verify/compiler/node_modules/（过渡兼容，未来可删）

import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// 依赖声明真源：skill 包内只保留 package.json，随分发走
export const COMPILER_PKG_DIR = join(SKILL_SCRIPTS_DIR, 'verify', 'compiler');
export const COMPILER_PKG_JSON = join(COMPILER_PKG_DIR, 'package.json');
export const COMPILER_PLACEHOLDER = join(COMPILER_PKG_DIR, 'PLACEHOLDER.md');
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

import { createRequire } from 'node:module';
function requireCompat(pkgJsonPath) {
  return createRequire(pkgJsonPath)('./package.json') != null;
}
