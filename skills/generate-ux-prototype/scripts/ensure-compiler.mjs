#!/usr/bin/env node
// ensure-compiler.mjs — node + 编译器依赖就绪校验（fastui ensure-env 同款定位）
//
// 只读、只判断、不修复。目标 1 秒内出结果：init/build 开头跑，
// 修复动作全收在 install（node）与 setup-compiler.mjs（依赖）里——下载/安装可能要几十秒，
// 不能混进热路径。
//
// 依赖树三段校验（包完整 → 依赖树在 → lockfile 漂移）**不在这里重写** —— init/build 的
// 开头跑的是同一份 checkCompilerEnv()（compiler-paths.mjs），平行实现必然漂移。
// 本脚本在它之上补两件 init/build 没有的：node 执行性校验（ENV_NODE_BROKEN）与
// keyPackages 抽查（诊断,不阻塞,§5.2.3）。
//
// 用法: node ensure-compiler.mjs [--env-dir=<路径>]
//
// Output (agent-parseable，多行契约 KEY: value):
//   RESULT: OK / RESULT: FAIL | <CODE>: ...
//
// 机制依据:fastui-vue-creator ensure-env.mjs(SPEC-DES-001 §5.2)。不移植的两段:
// SKILL_NOT_ASSEMBLED(本 skill 无内网组装步骤)、node 大版本比对(本地依赖树纯 JS,
// 无原生模块的 ABI 后果——树一致性由 lockfileHash 管)。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setLogSink, ok, fail, warn } from './lib/result.mjs';
import {
  COMPILER_PKG_LOCK, envDir, resolveRuntime, checkCompilerEnv,
  nodeInstallHint, setupHint, sha256File,
} from './compiler-paths.mjs';

// ---------- 参数解析（lib/result.mjs parseArgs 语义：--key=value / --flag） ----------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq === -1) args[a.slice(2)] = true;
  else args[a.slice(2, eq)] = a.slice(eq + 1);
}
const envOverride = args['env-dir'];

// 契约行同时落盘 —— 宿主 UI 未必把 stdout 展示给人看,失败了要能事后查。
// 与 install / setup-compiler 写同一个文件(§5.1.1:失败信息自包含)。
setLogSink(join(envDir(envOverride), 'octo-ux-prototype.log'));

// 修复 hint 两档分叉:NODE_SUSPECT 语境才带 force——不带会复用回同一个老 node,等于没修;
// 池内 node 损坏(ENV_NODE_BROKEN)不带 force——install 自己的 `node -v` 检查会发现池子坏了、
// 自动落到重下,force 反而多此一举。
const installHint = (force) => nodeInstallHint({ force });

// ── node 段（fastui ensure-env §4 同款:执行性校验,不比大版本）───────
// resolveRuntime 永远有返回(.mjs 能运行就证明 node 存在,池子没有就是当前进程这个),
// 所以这里没有 NODE_MISSING —— 唯一可失败的是"文件在但执行不了"(解压损坏等)。
const RT = resolveRuntime(envOverride);
let nodeVersion = '';
try {
  nodeVersion = execFileSync(RT.node, ['-v'], { encoding: 'utf8' }).trim();
} catch (e) {
  fail('ENV_NODE_BROKEN', `node 无法执行(${RT.node}):${e.message}`, { hint: installHint(false) });
}

// ── 依赖树三段(与 init/build 共用同一份实现)────────────────────────
const r = checkCompilerEnv(envOverride);
if (!r.ok) {
  const hint = r.code === 'SKILL_PKG_BROKEN'
    ? 'skill 组装不完整，向维护者反馈'
    : setupHint(envOverride ? ` --env-dir=${envDir(envOverride)}` : '');
  fail(r.code, r.message, { hint });
}
if (r.note) warn(r.note);

// ── keyPackages 抽查(诊断,不阻塞,§5.2.3)──────────────────────────
// 只对共享池安装有意义(legacy/env 显式路径不受清单约束);清单缺失时上面已 FAIL 或 WARN。
if (r.source === 'pool') {
  const lockPath = join(envDir(envOverride), 'env.lock.json');
  let lock = null;
  try { lock = JSON.parse(readFileSync(lockPath, 'utf8')); } catch {}
  for (const [name, want] of Object.entries(lock?.compilerDeps?.keyPackages ?? {})) {
    let pkg = null;
    try { pkg = JSON.parse(readFileSync(join(r.dir, ...name.split('/'), 'package.json'), 'utf8')); } catch {}
    if (!pkg) warn(`${name} 在共享池里找不到(清单记录 ${want})`);
    else if (pkg.version !== want) warn(`${name} 实际 ${pkg.version},清单记录 ${want}`);
  }
}

ok({
  ENV_DIR: envDir(envOverride),
  NODE_VERSION: nodeVersion,
  NODE_BIN: RT.node,
  NODE_SOURCE: RT.source,
  DEPS_DIR: r.dir,
  LOCKFILE_HASH: sha256File(COMPILER_PKG_LOCK),
});
