#!/usr/bin/env node
// ensure-compiler.mjs — 编译器依赖就绪校验
//
// 只读、只判断、不修复。目标 1 秒内出结果：init/build 开头跑，
// 修复动作全部收在 setup-compiler.mjs（下载/安装可能要几十秒，不能混进热路径）。
// 校验逻辑本体在 compiler-paths.mjs 的 checkCompilerEnv()——ensure/init/build 三处共用。
//
// 用法: node ensure-compiler.mjs [--env-dir=<路径>]
//
// Output (agent-parseable):
//   RESULT: OK | source=<pool|legacy|env> dir=<路径>
//   RESULT: FAIL | <CODE> ...（附 HINT 一条可执行修复命令）

import { join } from 'node:path';
import { checkCompilerEnv, setupHint, envDir } from './compiler-paths.mjs';

const arg = process.argv.find((a) => a.startsWith('--env-dir='));
const extra = arg ? ` --env-dir=${arg.slice('--env-dir='.length)}` : '';

const r = checkCompilerEnv();
if (r.ok) {
  if (r.note) console.log(`WARN: ${r.note}`);
  console.log(`RESULT: OK | source=${r.source} dir=${r.dir}`);
  process.exit(0);
}
console.log(`RESULT: FAIL | ${r.code} | ${r.message}`);
console.log(`HINT: ${setupHint(extra)}`);
if (r.code === 'COMPILER_DEPS_MISSING') {
  console.log(`INFO: 共享池 = ${envDir()}（可用 OCTO_UX_ENV_DIR 覆盖）`);
}
process.exit(1);
