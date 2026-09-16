#!/usr/bin/env node
// setup-compiler.mjs — 编译器依赖安装（修复动作唯一入口）
//
// 来源优先级：
//   ① --from <zip|目录>        离线逃生口（npm 不可用的机器，人工带上 compiler-deps.zip）
//   ② manifest 的 compilerDeps.bundle（内网托管 zip，未来启用）
//   ③ npm install（主路径：内网镜像，写死常量兜底，三档回落）
//
// 装完校验 @vue/compiler-sfc 可加载 + 写 env.lock.json（版本/来源/时间），并删哨兵。
//
// 用法: node setup-compiler.mjs [--env-dir=<路径>] [--from=<zip|目录>] [--registry=<url>]
//
// Output:
//   RESULT: OK | dir=<共享池依赖目录> source=<npm|from|bundle>
//   RESULT: FAIL | <CODE> ...（附 HINT）

import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { COMPILER_PKG_DIR, COMPILER_PKG_JSON, COMPILER_PLACEHOLDER, envDir, poolModulesDir } from './compiler-paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 兼容 --key=value 与 --key value 两种写法（fastui parseArgs 同款语义）
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq !== -1) args[a.slice(2, eq)] = a.slice(eq + 1);
  else if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--')) args[a.slice(2)] = process.argv[++i];
  else args[a.slice(2)] = true;
}

function fail(code, msg, hint) {
  console.log(`RESULT: FAIL | ${code} | ${msg}`);
  if (hint) console.log(`HINT: ${hint}`);
  process.exit(1);
}

if (!existsSync(COMPILER_PKG_JSON)) {
  fail('SKILL_PKG_BROKEN', `缺少 ${COMPILER_PKG_JSON}`, 'skill 组装不完整，向维护者反馈');
}

const pool = envDir(args['env-dir']);
const target = poolModulesDir(args['env-dir']);
// fastui 同款布局：<deps>/ 放 package.json，npm install 在其下生成 node_modules/
// target = <deps>/node_modules，其父目录即 <deps>
const depsDir = dirname(target);
mkdirSync(depsDir, { recursive: true });

// 依赖清单复制到 deps/ 再 install——skill 包内永不长 node_modules
copyFileSync(COMPILER_PKG_JSON, join(depsDir, 'package.json'));

// ---------- 来源 ①：本地 zip / 目录 ----------
if (args.from) {
  const from = resolve(String(args.from));
  try {
    if (/\.zip$/i.test(from)) {
      // Windows 内置 Expand-Archive；类 unix 用 unzip
      if (process.platform === 'win32') {
        execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath "${from}" -DestinationPath "${target}" -Force`], { stdio: 'inherit' });
      } else {
        execFileSync('unzip', ['-o', from, '-d', target], { stdio: 'inherit' });
      }
    } else {
      // 目录：整体复制
      execFileSync(process.platform === 'win32' ? 'robocopy' : 'cp', process.platform === 'win32' ? [from, target, '/E', '/NFL', '/NDL', '/NJH', '/NJS'] : ['-r', `${from}/.`, target], { stdio: 'ignore' });
    }
  } catch (e) {
    fail('FROM_EXTRACT_FAILED', `解包 ${from} 失败: ${e.message}`, '确认 zip/目录完整且可读');
  }
  returnOk('from');
}

// ---------- 来源 ③：npm install（主路径） ----------
// 三档回落：--registry → OCTO_NPM_REGISTRY → 内网镜像常量。恒有源。
const FALLBACK_REGISTRY = 'http://mirrors.tools.huawei.com/npm/';
const registry = String(args.registry || process.env.OCTO_NPM_REGISTRY || FALLBACK_REGISTRY);

// 子进程摘代理（fastui 经验：代理变量是内网安装失败头号惯犯；
// npm_config_* 顶掉 .npmrc 里的 proxy=，必须设字符串 "false" 空串顶不掉）
const env = { ...process.env };
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete env[k];
env.npm_config_proxy = 'false';
env.npm_config_https_proxy = 'false';
env.npm_config_registry = registry;

console.log(`INFO: npm install --registry=${registry} → ${target}`);
try {
  // ⚠️ --prefix 指向 target 的**父目录**（npm 语义：prefix=项目根，在其下生成 node_modules/）
  execFileSync('npm', ['install', '--no-fund', '--no-audit', '--loglevel=error', `--prefix=${dirname(target)}`], {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} catch (e) {
  fail('NPM_INSTALL_FAILED', `npm install 失败（registry=${registry}）: ${e.message}`,
    `检查内网源可达性；或换离线通道：node setup-compiler.mjs --from=<compiler-deps.zip 路径>`);
}

returnOk('npm');

// ---------- 收尾 ----------
function returnOk(source) {
  // 校验真的能加载（target = node_modules 根）
  try {
    createRequire(join(target, '@vue', 'compiler-sfc', 'package.json'))('./package.json');
  } catch (e) {
    fail('VERIFY_FAILED', `安装后仍加载不到 @vue/compiler-sfc: ${e.message}`, '把本输出原样反馈维护者');
  }
  // 哨兵使命结束
  try { rmSync(COMPILER_PLACEHOLDER, { force: true }); } catch {}
  // 环境锁（版本/来源/时间，供 ensure 与排障）
  let version = '';
  try { version = JSON.parse(readFileSync(join(COMPILER_PKG_JSON), 'utf8')).dependencies['@vue/compiler-sfc'] || ''; } catch {}
  writeFileSync(
    join(pool, 'env.lock.json'),
    JSON.stringify({ compilerDeps: { spec: version, source, installedAt: new Date().toISOString() } }, null, 2),
  );
  console.log(`RESULT: OK | dir=${target} source=${source}`);
  process.exit(0);
}
