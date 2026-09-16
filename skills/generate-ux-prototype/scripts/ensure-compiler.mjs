#!/usr/bin/env node
// ensure-compiler.mjs — 编译器依赖就绪校验
//
// 只读、只判断、不修复。目标 1 秒内出结果：init/build 开头跑，
// 修复动作全部收在 setup-compiler.mjs（下载/安装可能要几十秒，不能混进热路径）。
//
// 用法: node ensure-compiler.mjs [--env-dir=<路径>]
//
// Output (agent-parseable):
//   RESULT: OK | source=<pool|legacy|env> dir=<路径>
//   RESULT: FAIL | COMPILER_DEPS_MISSING ...（附 HINT 一条可执行修复命令）
//   RESULT: FAIL | SKILL_PKG_BROKEN ...

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCompilerModules, COMPILER_PKG_JSON, envDir } from './compiler-paths.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const i = a.indexOf('=');
    return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
  }),
);

// ① skill 包自身完整（依赖声明在）
if (!existsSync(COMPILER_PKG_JSON)) {
  console.log(`RESULT: FAIL | SKILL_PKG_BROKEN | 缺少 ${COMPILER_PKG_JSON}（skill 组装不完整，向 skill 维护者反馈）`);
  process.exit(1);
}

// ② 依赖树定位
const found = resolveCompilerModules(args['env-dir']);
if (found.ok) {
  console.log(`RESULT: OK | source=${found.source} dir=${found.dir}`);
  process.exit(0);
}

const hint = `node "${join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'setup-compiler.mjs')}"${args['env-dir'] ? ` --env-dir=${args['env-dir']}` : ''}`;
console.log(
  `RESULT: FAIL | COMPILER_DEPS_MISSING | @vue/compiler-sfc 依赖树未安装（已找过: ${found.candidates.join(' , ')}）`,
);
console.log(`HINT: ${hint}   # 首装约 10-30s（内网 npm 源），装完重跑 init/build 即可`);
console.log(`INFO: 共享池 = ${envDir(args['env-dir'])}（可用 OCTO_UX_ENV_DIR 覆盖）`);
process.exit(1);
