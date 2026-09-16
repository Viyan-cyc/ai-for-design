#!/usr/bin/env node
// preflight.mjs — 写码前规划清单预检（SKILL.md Step 5「写码前先规划后落笔」的机器执行）
//
// 用途：生成页面时，AI 在落笔前列出「规划清单」（图标名 / token 变量 / element-plus 导出名 /
//       拟写文件的相对 import 目标），本脚本一条命令全部校验。全部通过才开写；
//       否则按输出修正清单，避免写完靠 build 返工（build 是编译级检查，本脚本是规划级检查）。
//
// 用法（--dir 为已 init 的工作区；其余参数可重复，值为逗号分隔清单）：
//   node preflight.mjs --dir "{slug}" \
//     --tokens "--color-brand,--space-size-16" \
//     --exports "ElMessage,ElMessageBox" \
//     --imports "views/{slug}/components/GlobalNav.vue=../../../locales/pages/{slug}.js|../../api/{slug}.js,..."
//
// 输出：RESULT: OK（全过）| RESULT: FAIL + 逐条问题清单（含相近项提示）。
// 设计约束：不内嵌任何 token 速查表 —— 导出读 skill 自带白名单 JSON，
// token 与 build.mjs 同源，从工作区 src/assets/tokens/ 实时提取。
// 图标不走本脚本的 --icons（EP 图标已禁用）；IconPlus/Lucide 的 .svg 走 --imports 校验文件存在。

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ---------- args ----------
const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}
const dirArg = argValue('--dir');
if (!dirArg) {
  console.error('Usage: node preflight.mjs --dir <workspace> [--tokens "--x,--y"] [--exports "A,B"] [--imports "file=rel1|rel2,..."]');
  process.exit(2);
}
const workDir = resolve(dirArg);
const srcDir = join(workDir, 'src');
if (!existsSync(srcDir)) {
  console.error(`RESULT: FAIL | workspace src not found: ${srcDir} (run init.mjs first)`);
  process.exit(1);
}

// ---------- whitelists (same files build.mjs uses) ----------
const EP_EXPORTS = new Set(
  JSON.parse(readFileSync(join(__dirname, 'verify', 'whitelists', 'element-plus', 'exports.json'), 'utf8')),
);

// ---------- defined tokens: extract from workspace tokens/ (same source as build) ----------
const definedTokens = new Set();
const tokenDefs = /--[a-z][a-z0-9-]*\s*:/g;
function collectTokenFiles(p, out) {
  for (const name of readdirSync(p)) {
    const full = join(p, name);
    if (statSync(full).isDirectory()) collectTokenFiles(full, out);
    else if (name.endsWith('.css')) out.push(full);
  }
}
const tokensDir = join(srcDir, 'assets', 'tokens');
if (existsSync(tokensDir)) {
  const tokenFiles = [];
  collectTokenFiles(tokensDir, tokenFiles);
  for (const f of tokenFiles) {
    for (const m of readFileSync(f, 'utf8').matchAll(tokenDefs)) definedTokens.add(m[0].replace(/\s*:/, ''));
  }
} else {
  console.error(`WARN: tokens dir missing (${tokensDir}) — token check skipped (init.mjs should have copied it)`);
}

// ---------- checks ----------
const problems = [];
function hints(name, pool) {
  const lower = String(name).toLowerCase();
  return [...pool].filter((x) => x.toLowerCase().startsWith(lower.slice(0, 4))).slice(0, 4);
}
function checkList(raw, kind, pool) {
  if (!raw) return;
  for (const item of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!pool.has(item)) {
      const near = hints(item, pool);
      problems.push(`unknown ${kind} "${item}" : did you mean ${near.length ? near.join(' / ') : '(no close match)'}?`);
    }
  }
}

checkList(argValue('--exports'), 'element-plus export', EP_EXPORTS);
checkList(argValue('--tokens'), 'token', definedTokens);

// ---------- relative-import resolution ----------
// --imports "views/{slug}/components/GlobalNav.vue=../../../locales/pages/{slug}.js|../../api/{slug}.js,..."
// 路径一律相对 src/（posix 风格）；import 目标须能在 src/ 下解析到 .js/.vue/index。
const importsArg = argValue('--imports');
if (importsArg) {
  for (const pair of importsArg.split(',').map((s) => s.trim()).filter(Boolean)) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      problems.push(`bad --imports entry "${pair}" (expected "fromFile=rel1|rel2")`);
      continue;
    }
    const fromFile = pair.slice(0, eq).split('\\').join('/');
    const fromDir = posix.dirname(fromFile);
    for (const rel of pair.slice(eq + 1).split('|').map((s) => s.trim()).filter(Boolean)) {
      const resolved = posix.normalize(posix.join(fromDir, rel));
      const base = join(srcDir, ...resolved.split('/'));
      const ext = resolved.slice(resolved.lastIndexOf('.'));
      // 素材 import（IconPlus/Lucide 图标等 .svg）只要文件存在即通过，不参与 .js/.vue/index 解析
      if (['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'].includes(ext)) {
        if (!existsSync(base)) problems.push(`unresolved asset import ${fromFile} <- "${rel}" (no file at src/${resolved})`);
        continue;
      }
      const candidates = [base, `${base}.js`, `${base}.vue`, join(base, 'index.vue'), join(base, 'index.js')];
      if (!candidates.some((c) => existsSync(c))) {
        problems.push(`unresolved import ${fromFile} <- "${rel}" (resolves to src/${resolved}, no .js/.vue/index found)`);
      }
    }
  }
}

// ---------- result ----------
if (problems.length) {
  for (const p of problems) console.log(`FAIL: ${p}`);
  console.log(`RESULT: FAIL | ${problems.length} problem(s) — fix the plan before writing code`);
  process.exit(1);
}
console.log('RESULT: OK | plan preflight passed (icons/tokens/exports/imports)');
process.exit(0);
