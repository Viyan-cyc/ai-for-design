#!/usr/bin/env node
// setup-compiler.mjs — 编译器依赖安装（修复动作唯一入口）
//
// 来源优先级：
//   ① --from <zip|目录>        离线逃生口（npm 不可用的机器，人工带上 compiler-deps.zip）
//   ② manifest 的 compilerDeps.bundle（内网托管 zip，未来启用）
//   ③ npm install（主路径：内网镜像 → 公网 npmjs 自动回落，内网外网零配置）
//
// 装完校验 @vue/compiler-sfc 可加载 + 写 env.lock.json（版本/来源/lockfileHash/平台/node 等诊断字段）。
// 哨兵（PLACEHOLDER.md）是纯文档不删——它说明的是共享池机制本身，不是「这台机器装没装」；
// 「装没装」由 env.lock.json 与 checkCompilerEnv() 判定（fastui：占位文件靠人维护，不自动动）。
//
// 用法: node setup-compiler.mjs [--env-dir=<路径>] [--from=<zip|目录>] [--registry=<url>]
//
// Output:
//   RESULT: OK | dir=<共享池依赖目录> source=<npm|from|bundle>
//   RESULT: FAIL | <CODE> ...（附 HINT）

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import {
  COMPILER_PKG_DIR, COMPILER_PKG_JSON, COMPILER_PKG_LOCK, envDir, poolModulesDir, sha256File,
} from './compiler-paths.mjs';
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
if (existsSync(COMPILER_PKG_LOCK)) copyFileSync(COMPILER_PKG_LOCK, join(depsDir, 'package-lock.json'));

// ---------- 信号行挑选（fastui errorTail 同款，§5.1.1 教训）----------
// npm 的末行永远是 boilerplate（"A complete log ... can be found in"），
// 真因（ECONNREFUSED / 404 那行）在中间——契约行要带的是真因，不是退出码。
// stdout 只准放契约行，子进程原文全部走 stderr（fastui §5.1.1）。
const TAIL_NOISE = [
  /^A complete log of this run can be found in/i,
  /^If you are behind a proxy/i,
  /^'proxy' config is set properly/i,
  /^npm (error|ERR!)\s*$/i,
  /^\s*at /,
  /^\d+\s*(error|warn)/i,
];
const TAIL_SIGNALS = [
  /\b\w*Error:\s/,
  /^error code [A-Z0-9_]+/i,
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|404|certificate|self-signed/i,
];
function pickSignalLine(text, max = 200) {
  const lines = String(text ?? '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^npm (error|ERR!)\s?/i, '').trim())
    .filter(Boolean);
  const window = lines.slice(-60);
  for (const sig of TAIL_SIGNALS) {
    for (let i = window.length - 1; i >= 0; i--) if (sig.test(window[i])) return window[i].slice(0, max);
  }
  for (let i = window.length - 1; i >= 0; i--) {
    if (!TAIL_NOISE.some((re) => re.test(window[i]))) return window[i].slice(0, max);
  }
  return window[window.length - 1]?.slice(0, max) || '';
}

/**
 * npm 执行器：`node <npm-cli.js> install ...` 直连，**不经 shell**。
 * fastui §4.1 教训：`shell:true` 时 Node 把 file 与 args 裸拼交给 shell 不加引号，
 * 路径含空格（macOS "Application Support"、Windows "C:\Users\John Smith"）命令必被劈断。
 * Node 18+ 也禁直接 spawn npm.cmd（CVE-2024-27980）——JS 入口是唯一两平台通吃的路。
 */
function resolveNpmJs() {
  const dir = dirname(process.execPath);
  for (const cand of [
    join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows 官方/portable 包
    join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Unix（homebrew/nvm）
  ]) {
    const p = resolve(cand);
    if (existsSync(p)) return p;
  }
  return null;
}

// 边跑边吐（防宿主「长时间无输出判挂起」kill），stderr 落共享池日志 + 原文转发 stderr
function runNpm(npmArgs, env, depsDir, logFile) {
  const npmJs = resolveNpmJs();
  const bin = npmJs ? process.execPath : 'npm';
  const argv = npmJs ? [npmJs, ...npmArgs] : npmArgs;
  appendFileSync(logFile, `\n--- ${basename(logFile)} npm ${npmArgs.join(' ')} ---\n`);
  return new Promise((done) => {
    const child = spawn(bin, argv, { cwd: depsDir, stdio: ['ignore', 'pipe', 'pipe'], env });
    const tails = { out: [], err: [] };
    const push = (k) => (b) => { tails[k].push(b); process.stderr.write(b); };
    child.stdout.on('data', push('out'));
    child.stderr.on('data', push('err'));
    child.on('error', (e) => done({ status: null, error: e, text: String(e.message) }));
    child.on('close', (code) => done({
      status: code,
      error: null,
      text: Buffer.concat([...tails.out, ...tails.err]).toString('utf8'),
    }));
  });
}

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
const logFile = join(pool, 'setup-compiler.log');

// 子进程的环境：摘代理（fastui 经验：代理变量是内网安装失败头号惯犯；
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
  // ⚠️ --prefix 指向 depsDir（npm 语义：prefix=项目根，在其下生成 node_modules/）
  // 有 lockfile 用 npm ci（按锁定版本精确装，不回写 lockfile——hash 才能跨边界对得上）；
  // npm ci 会先清空 node_modules，从旧树升级时全量重装，正确性优先。
  const hasLock = existsSync(join(depsDir, 'package-lock.json'));
  const npmSub = hasLock ? 'ci' : 'install';
  const r = await runNpm([npmSub, '--no-fund', '--no-audit', '--loglevel=error', `--prefix=${depsDir}`], env, depsDir, logFile);
  if (r.status === 0) {
    installed = true;
    break;
  }
  const signal = pickSignalLine(r.text);
  console.log(`INFO: npm install 失败（registry=${registry}）${signal ? ` | ${signal}` : ''}，切下一个源`);
}

if (!installed) {
  fail('NPM_INSTALL_FAILED',
    `npm 源均不可用（试过: ${candidates.join(' , ')}），详见 ${logFile}`,
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
  // 环境锁（fastui 同款诊断字段：跨边界 lockfileHash 是漂移检测主判据，
  // platform/arch/nodeVersion/keyPackages 供「同一台机器行为变了」排障）
  let spec = '';
  try { spec = JSON.parse(readFileSync(COMPILER_PKG_JSON, 'utf8')).dependencies['@vue/compiler-sfc'] || ''; } catch {}
  let compilerVersion = '';
  try { compilerVersion = JSON.parse(readFileSync(join(target, '@vue', 'compiler-sfc', 'package.json'), 'utf8')).version || ''; } catch {}
  const keyPackages = {};
  for (const name of ['@vue/compiler-sfc', '@babel/parser', 'postcss']) {
    try { keyPackages[name] = JSON.parse(readFileSync(join(target, ...name.split('/'), 'package.json'), 'utf8')).version || ''; } catch {}
  }
  const lockHash = existsSync(join(depsDir, 'package-lock.json')) ? sha256File(join(depsDir, 'package-lock.json')) : '';
  writeFileSync(
    join(pool, 'env.lock.json'),
    JSON.stringify({
      compilerDeps: {
        spec,
        compilerVersion,
        source,
        lockfileHash: lockHash,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        installedAt: new Date().toISOString(),
        keyPackages,
      },
    }, null, 2),
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
