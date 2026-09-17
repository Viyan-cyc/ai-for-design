#!/usr/bin/env node
// setup-compiler.mjs — 编译器依赖安装（修复动作唯一入口）
//
// 来源优先级：
//   ① --from <zip|目录>        离线逃生口（npm 不可用的机器，人工带上 compiler-deps.zip）
//   ② npm install（主路径：内网镜像 → 公网 npmjs 自动回落，内网外网零配置）
//
// 装完校验 @vue/compiler-sfc 可加载 + 写 env.lock.json（版本/来源/lockfileHash/平台/node 等诊断字段）。
// 哨兵（PLACEHOLDER.md）是纯文档不删——它说明的是共享池机制本身，不是「这台机器装没装」；
// 「装没装」由 env.lock.json 与 checkCompilerEnv() 判定（fastui：占位文件靠人维护，不自动动）。
//
// 由 install.ps1 / install.sh 在装好 node 之后 exec 调用 —— 引导脚本只负责"把 node 弄下来"，
// 跨平台的业务逻辑只在这里写一份,否则 PowerShell 和 bash 各写一遍必然漂移。
//
// 用法: node setup-compiler.mjs [--env-dir=<路径>] [--from=<zip|目录>] [--registry=<url>] [--upgrade] [--proxy=<地址>]
//
// Output:
//   RESULT: OK（多行契约,KEY: value）
//   RESULT: FAIL | <CODE>: ...（附 HINT/LOG）
//
// 机制依据:fastui-vue-creator setup-env.mjs(SPEC-DES-001 §4.1/§5.1.1),仅删 yarn 段。

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { setLogSink, ok, fail, log, logChild, tailBuffer, lastLine } from './lib/result.mjs';
import {
  COMPILER_PKG_JSON, COMPILER_PKG_LOCK, envDir, poolModulesDir, sha256File, resolveRuntime,
} from './compiler-paths.mjs';

// ---------- 参数解析（lib/result.mjs parseArgs：--key=value / --flag） ----------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq === -1) args[a.slice(2)] = true;
  else args[a.slice(2, eq)] = a.slice(eq + 1);
}

// ---------- 依赖真源校验（在算日志路径前先有的唯一前置） ----------
if (!existsSync(COMPILER_PKG_JSON)) {
  fail('SKILL_PKG_BROKEN', `缺少 ${COMPILER_PKG_JSON}`, { hint: 'skill 组装不完整，向维护者反馈' });
}

// 契约行同时落盘 —— 宿主 UI 未必把 stdout 展示给人看,失败了要能事后查。
// 这个脚本可能在还没有任何会话时跑(首装),所以落共享池(§5.1.1)。
// **与 install.sh/ps1 的 tee 写同一个文件** —— 那边交棒时注释承诺"之后的日志由它自己往同一个文件写"。
const pool = envDir(args['env-dir']);
setLogSink(join(pool, 'octo-ux-prototype.log'));
const target = poolModulesDir(args['env-dir']);
// fastui 同款布局：<deps>/ 放 package.json，npm install 在其下生成 node_modules/
// target = <deps>/node_modules，其父目录即 <deps>
const depsDir = dirname(target);
mkdirSync(depsDir, { recursive: true });

/**
 * 用哪个 node:**共享池里有 portable node 就用它,没有就是跑着本脚本的这个**(系统 node)——
 * install.sh / install.ps1 决定复用系统 node 时,正是用系统 node 来 exec 本脚本的(§4.1)。
 * 所以这里不要求共享池里有 node,只要求手上有一个能跑的。
 *
 * 注意执行性校验不在这里:existsSync 只判"文件在",解压损坏的 node 由 ensure 的
 * `node -v`(ENV_NODE_BROKEN)与 install 脚本自己的 POOL_NODE_OK 检查接住 —— 与 fastui 分工一致。
 */
const RT = resolveRuntime(args['env-dir']);
log(`[node] ${RT.source === 'pool' ? '共享池' : '系统'} node: ${RT.node}`);

// 依赖清单复制到 deps/ 再 install——skill 包内永不长 node_modules
copyFileSync(COMPILER_PKG_JSON, join(depsDir, 'package.json'));
if (existsSync(COMPILER_PKG_LOCK)) copyFileSync(COMPILER_PKG_LOCK, join(depsDir, 'package-lock.json'));

// ---------- 子进程环境:默认把代理变量摘掉(fastui childEnv 同款) ----------
//
// install 脚本那边已经强制直连了,但 npm 是 run() 拉起来的子进程,
// `env: process.env` 会把 agent 宿主注入的 HTTP_PROXY / HTTPS_PROXY 原样传下去 ——
// 于是同一个 504 会在装依赖这步原样复现,只是卡点从第 1 步挪到第 3 步。
//
// **为什么是删变量而不是设 NO_PROXY=***:NO_PROXY 的匹配实现被坑过,不该再把修复
// 建立在"npm 能正确解析 noproxy"这个假设上 —— 删变量是确定的。
//
// 前提:依赖源全在内网(四档回落)。若哪天必须经代理,用 --proxy 传回来。
const PROXY_ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];
function childEnv() {
  const e = { ...process.env };
  for (const k of PROXY_ENV_KEYS) delete e[k];
  // npm 还会读 .npmrc 里的 proxy=,而**那一层优先级高于环境变量**,光删变量堵不住。
  // 用 npm_config_* 顶掉它 —— 注意必须是字符串 "false",**空串 "" 顶不掉**(npm 10.9.4 实测)。
  e.npm_config_proxy = 'false';
  e.npm_config_https_proxy = 'false';
  const proxy = String(args.proxy || '');
  if (proxy) {
    // 显式要求经代理。**同样要堵满三层** —— 只设环境变量的话,npm 会回落到 .npmrc 的
    // `proxy=`(那一层压过环境变量),于是 --proxy 被静默忽略、走成机器上那个旧代理。
    // 触发时人正在排查代理,静默走错比报错更难查。
    // 同时清掉继承来的 NO_PROXY —— 否则刚指定的代理可能被静默旁路,
    // 与 install.sh 的 `--proxy … --noproxy ''` 保持一致。
    for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) e[k] = proxy;
    for (const k of ['NO_PROXY', 'no_proxy']) delete e[k];
    e.npm_config_proxy = proxy;
    e.npm_config_https_proxy = proxy;
  }
  return e;
}

// ---------- 信号行挑选(fastui errorTail 同款)----------
// npm 的末行永远是 boilerplate("A complete log ... can be found in"),
// 真因(ECONNREFUSED / 404 那行)在中间——契约行要带的是真因,不是退出码。
const TAIL_NOISE = [
  /^A complete log of this run can be found in/i,
  /^If you are behind a proxy/i,
  /^'proxy' config is set properly/i,
  /^info /i,
  /^\s*at /,
  /^[{}[\],]*$/,
  /^\w+:\s*'[^']*',?$/,
];
const TAIL_SIGNALS = [
  /\b\w*Error:\s/,
  /^error code [A-Z0-9_]+/i,
  /^error\s+\S/i,
];
const MAX_SCAN_LINES = 60;
function errorTail(buf, max = 200) {
  const lines = (buf?.toString('utf8') ?? '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[\x00-\x1f\x7f]/g, ' ').trim())
    .map((l) => l.replace(/^npm (error|ERR!)\s?/i, '').trim());
  const window = lines.slice(-MAX_SCAN_LINES).filter(Boolean);
  const clip = (l) => (l.length > max ? `${l.slice(0, max)}…` : l);
  for (const sig of TAIL_SIGNALS) {
    for (let i = window.length - 1; i >= 0; i--) if (sig.test(window[i])) return clip(window[i]);
  }
  for (let i = window.length - 1; i >= 0; i--) {
    if (!TAIL_NOISE.some((re) => re.test(window[i]))) return clip(window[i]);
  }
  return lastLine(buf, max);
}

const RUN_TAIL_KB = 64;
/**
 * 跑子进程:**原文实时转发到 stderr,同时把尾部落盘**(fastui run 同款)。
 *
 * 为什么是 spawn 流式,不是 spawnSync 一次性取:
 * npm install 要跑几十秒,一次性取意味着这几分钟**一个字节都不输出** ——
 * 宿主或工具层若有「长时间无输出即判挂起」的逻辑会直接把它 kill。所以必须边跑边吐。
 *
 * - **成功也写**。装成功但依赖树不对时,要能回头看 npm 当时说了什么。
 * - 收到的是 Buffer,**不解码**:Windows 上 npm 输出是 GBK 字节(日志留原始字节)。
 * - 内存有界:只留尾部 64KB(tailBuffer),不把整段攒在内存里。
 * - `label` 必须显式传:两段命令都跑在 node 上,path.basename 分不出是哪一步。
 */
const run = async (bin, argv, cwd, label) => {
  const tag = label || 'npm';
  log(`$ ${bin} ${argv.join(' ')}${cwd ? `   (cwd=${cwd})` : ''}`);
  const started = Date.now();
  const child = spawn(bin, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv() });
  const outTail = tailBuffer(RUN_TAIL_KB);
  const errTail = tailBuffer(RUN_TAIL_KB);
  // 两条都转发到 **stderr**:stdout 是契约流,不能混进子进程的话(§5.1.1)
  child.stdout.on('data', (b) => {
    outTail.push(b);
    process.stderr.write(b);
  });
  child.stderr.on('data', (b) => {
    errTail.push(b);
    process.stderr.write(b);
  });
  const r = await new Promise((done) => {
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      done(v);
    };
    // 用 close 而不是 exit:exit 可能早于 stdout/stderr 读完,那样会丢掉最后几行
    child.on('error', (e) => finish({ status: null, error: e }));
    child.on('close', (code) => finish({ status: code, error: null }));
  });
  // echo: false —— 上面已经边跑边转发过了,这里只补日志,不然人会看到两份
  logChild(`${tag} stdout`, outTail.buffer(), { tailKb: RUN_TAIL_KB, total: outTail.total, echo: false });
  logChild(`${tag} stderr`, errTail.buffer(), { tailKb: RUN_TAIL_KB, total: errTail.total, echo: false });
  log(`[exit] ${tag} status=${r.status ?? 'null'} ${Date.now() - started}ms`);
  // 把**最有用的那一行**(由 errorTail 挑,不是末行)带上,别让契约行只剩个退出码。
  if (r.error) {
    r.error.message = `${bin}: ${r.error.message}`;
    throw r.error;
  }
  if (r.status !== 0) {
    const tail = errorTail(errTail.buffer()) || errorTail(outTail.buffer());
    throw new Error(`${tag} 退出码 ${r.status}${tail ? ` | ${tail}` : ''}`);
  }
};

/**
 * npm 的 JS 入口 —— **不能直接 spawn `npm.cmd`**(Node 18 起禁止执行 .cmd/.bat,报 EINVAL),
 * 而系统 node 的 npm 布局又与池子里的不同。
 * 所以顺着 node 二进制往它自己的 npm 找,两种官方布局各试一次。
 *
 * @returns {string|null} 找不到返回 null,由调用方决定怎么办
 */
function resolveNpmJs(nodeBin) {
  const dir = dirname(nodeBin);
  for (const cand of [
    join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows 官方包 / portable 包
    join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Unix(含 homebrew / nvm)
  ]) {
    const p = resolve(cand);
    if (existsSync(p)) return p;
  }
  return null;
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
    fail('FROM_EXTRACT_FAILED', `解包 ${from} 失败: ${e.message}`, { hint: '确认 zip/目录完整且可读' });
  }
  returnOk('from');
}

// ---------- 来源 ②：npm install（主路径） ----------
// 四档回落：--registry → OCTO_NPM_REGISTRY → 内网镜像 → 公网 npmjs。
// 显式指定（参数/env）只试那一个；自动档逐个「探测→安装」，哪个通用哪个——
// 内网机器命中镜像，外网机器自动切公网，同一份 skill 零配置。
const INTRANET_REGISTRY = 'http://mirrors.tools.huawei.com/npm/';
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

const explicit = args.registry ? String(args.registry) : (process.env.OCTO_NPM_REGISTRY || '');
const candidates = explicit ? [explicit] : [INTRANET_REGISTRY, PUBLIC_REGISTRY];

let installed = false;
for (const registry of candidates) {
  if (!(await probeRegistry(registry))) {
    log(`[registry] 不可达，跳过 → ${registry}`);
    continue;
  }
  const hasLock = existsSync(join(depsDir, 'package-lock.json'));
  const npmSub = hasLock ? 'ci' : 'install';
  // npm 也不能直接 spawn npm.cmd(Node 18+ 禁执行 .cmd/.bat,报 EINVAL),
  // 顺着 node 二进制去找它自己的 npm。找不到就响亮失败(NPM_NOT_FOUND),
  // Windows 上没有 JS 入口就没有退路。
  const npmJs = resolveNpmJs(RT.node);
  if (!npmJs) {
    fail('NPM_NOT_FOUND', `找不到 ${RT.node} 对应的 npm`, {
      hint: '这个 node 没带 npm(精简发行版或被裁剪过)。装一个自带 npm 的 node,或让安装脚本下载 portable node:install.sh / install.ps1 不带 --skip-node 重跑',
    });
  }
  const argv = [npmJs, npmSub, '--no-fund', '--no-audit', '--loglevel=error', `--prefix=${depsDir}`, `--registry=${registry}`];
  log(`[npm] registry=${registry} → ${target}`);
  try {
    await run(RT.node, argv, depsDir, 'npm');
  } catch (e) {
    // 记录后切下一个源,不直接 fail —— 自动回落档里单个源的失败是预期路径
    log(`[npm] 失败:${e.message}`);
    continue;
  }
  installed = true;
  break;
}

if (!installed) {
  fail('NPM_INSTALL_FAILED', `npm 源均不可用（试过: ${candidates.join(' , ')}）`, {
    hint: `检查网络可达性;或换离线通道:node setup-compiler.mjs --from=<compiler-deps.zip 路径>`,
  });
}

returnOk('npm');

// ---------- 收尾 ----------
function returnOk(source) {
  // 校验真的能加载（target = node_modules 根）
  try {
    createRequire(join(target, '@vue', 'compiler-sfc', 'package.json'))('./package.json');
  } catch (e) {
    fail('VERIFY_FAILED', `安装后仍加载不到 @vue/compiler-sfc: ${e.message}`, { hint: '把本输出原样反馈维护者' });
  }
  // 环境锁(fastui 同款诊断字段:跨边界 lockfileHash 是漂移检测主判据,
  // platform/arch/node*/keyPackages 供「同一台机器行为变了」排障)
  let spec = '';
  try { spec = JSON.parse(readFileSync(COMPILER_PKG_JSON, 'utf8')).dependencies['@vue/compiler-sfc'] || ''; } catch {}
  let compilerVersion = '';
  try { compilerVersion = JSON.parse(readFileSync(join(target, '@vue', 'compiler-sfc', 'package.json'), 'utf8')).version || ''; } catch {}
  // keyPackages 从实际装好的包里读出来,不是抄清单 —— 这样它才有诊断价值
  const keyPackages = {};
  for (const name of ['@vue/compiler-sfc', '@babel/parser', 'postcss', 'puppeteer-core']) {
    try { keyPackages[name] = JSON.parse(readFileSync(join(target, ...name.split('/'), 'package.json'), 'utf8')).version || ''; } catch {}
  }
  const lockHash = existsSync(join(depsDir, 'package-lock.json')) ? sha256File(join(depsDir, 'package-lock.json')) : '';
  // 记的是**实际装依赖时用的那个 node**(fastui setup-env ⑤ 同款,精确到小版本)
  let nodeVersion = '';
  try { nodeVersion = execFileSync(RT.node, ['-v'], { encoding: 'utf8' }).trim(); } catch {}
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
        // 记的是**实际装依赖时用的那个 node**,精确到小版本 —— 诊断用:
        // "同一台机器行为变了"时,先看它是不是换了运行时。
        nodeVersion,
        nodeSource: RT.source,
        nodePath: RT.node,
        installedAt: new Date().toISOString(),
        keyPackages,
      },
      mode: args.upgrade ? 'upgrade' : 'install',
    }, null, 2),
  );
  ok({
    DIR: target,
    SOURCE: source,
    NODE_VERSION: nodeVersion,
    NODE_SOURCE: RT.source,
    LOCKFILE_HASH: lockHash,
    MODE: args.upgrade ? 'upgrade' : 'install',
  });
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
