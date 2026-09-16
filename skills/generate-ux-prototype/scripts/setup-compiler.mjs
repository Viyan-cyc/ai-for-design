#!/usr/bin/env node
// setup-compiler.mjs — 编译器依赖安装（修复动作唯一入口）
//
// 来源优先级：
//   ① --from <zip|目录>        离线逃生口（npm 不可用的机器，人工带上 compiler-deps.zip）
//   ② manifest 的 compilerDeps.bundle（内网托管 zip，未来启用）
//   ③ npm install（主路径：内网镜像 → 公网 npmjs 自动回落，内网外网零配置）
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
import http from 'node:http';
import https from 'node:https';
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
      // 目录：整体复制。robocopy exit code 1 = 复制成功（≥8 才是错），
      // execFileSync 对非零码一律 throw——故吞掉异常后按产物存在性判定成败
      if (process.platform === 'win32') {
        try {
          execFileSync('robocopy', [from, target, '/E', '/NFL', '/NDL', '/NJH', '/NJS'], { stdio: 'ignore' });
        } catch {}
        if (!existsSync(join(target, '@vue', 'compiler-sfc', 'package.json'))) {
          throw new Error('robocopy 完成但目标缺 @vue/compiler-sfc');
        }
      } else {
        execFileSync('cp', ['-r', `${from}/.`, target], { stdio: 'ignore' });
      }
    }
  } catch (e) {
    fail('FROM_EXTRACT_FAILED', `解包 ${from} 失败: ${e.message}`, '确认 zip/目录完整且可读');
  }
  returnOk('from');
}

// ---------- 来源 ③：npm install（主路径） ----------
// 四档回落：--registry → OCTO_NPM_REGISTRY → 内网镜像 → 公网 npmjs。
// 显式指定（参数/env）只试那一个；自动档逐个「探测→安装」，哪个通用哪个——
// 内网机器命中镜像，外网机器自动切公网，同一份 skill 零配置。
const INTRANET_REGISTRY = 'http://mirrors.tools.huawei.com/npm/';
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

const explicit = args.registry ? String(args.registry) : (process.env.OCTO_NPM_REGISTRY || '');
const candidates = explicit ? [explicit] : [INTRANET_REGISTRY, PUBLIC_REGISTRY];

// 子进程摘代理（fastui 经验：代理变量是内网安装失败头号惯犯；
// npm_config_* 顶掉 .npmrc 里的 proxy=，必须设字符串 "false" 空串顶不掉）
const env = { ...process.env };
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete env[k];
env.npm_config_proxy = 'false';
env.npm_config_https_proxy = 'false';

let installed = false;
for (const registry of candidates) {
  if (!(await probeRegistry(registry))) {
    console.log(`INFO: registry 不可达，跳过 → ${registry}`);
    continue;
  }
  env.npm_config_registry = registry;
  console.log(`INFO: npm install --registry=${registry} → ${target}`);
  try {
    // ⚠️ --prefix 指向 target 的**父目录**（npm 语义：prefix=项目根，在其下生成 node_modules/）
    execFileSync('npm', ['install', '--no-fund', '--no-audit', '--loglevel=error', `--prefix=${depsDir}`], {
      env,
      stdio: 'inherit',
      timeout: 5 * 60_000,
      shell: process.platform === 'win32',
    });
    installed = true;
    break;
  } catch (e) {
    console.log(`INFO: npm install 失败（registry=${registry}）: ${e.message}，切下一个源`);
  }
}

if (!installed) {
  fail('NPM_INSTALL_FAILED', `npm 源均不可用（试过: ${candidates.join(' , ')}）`,
    `检查网络可达性；或换离线通道：node setup-compiler.mjs --from=<compiler-deps.zip 路径>`);
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
  // 哨兵使命结束——仅当装进默认池（无 env-dir 覆盖）才删：哨兵表达的是
  // 「默认池未安装」，装到自定义目录不改变这个事实（bug 教训：--env-dir 验证
  // 时误删了 skill 目录哨兵，导致全新机器误判已装）
  if (!args['env-dir'] && !process.env.OCTO_UX_ENV_DIR) {
    try { rmSync(COMPILER_PLACEHOLDER, { force: true }); } catch {}
  }
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

// registry 可达性探测：任何 HTTP 响应（含 404/302）= 可达；超时/网络错误 = 不可达。
// node 原生 http 不读代理环境变量——探的是真实直连，与安装时的摘代理一致。
function probeRegistry(url, timeoutMs = 6000) {
  return new Promise((done) => {
    try { new URL(url); } catch { return done(false); }
    const mod = url.startsWith('https:') ? https : http;
    let settled = false;
    const finish = (ok) => { if (settled) return; settled = true; clearTimeout(timer); done(ok); };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const req = mod.get(url, (res) => { res.resume(); finish(true); });
    req.on('timeout', () => req.destroy());
    req.on('error', () => finish(false));
  });
}
