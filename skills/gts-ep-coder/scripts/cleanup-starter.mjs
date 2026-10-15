#!/usr/bin/env node
// cleanup-starter.mjs
// 交付卫生：移除 starter 预置的 api/demo.js + api/mock/demo-data.js。
//
// 安全规则（硬约束 0 的唯一例外，全部收进脚本）：
//   - 只处理 <dir>/src/ 之下的两个既定文件，路径由 srcDir join 拼出，不接收其它路径输入；
//   - 仅当文件内容仍匹配 starter 原样特征（全部签名命中）才删除；
//   - 文件已被改造（函数名/数据已变）→ WARN 保留，绝不误删用户改过的文件；
//   - 文件不存在 → 幂等 OK。
//
// Usage:
//   node cleanup-starter.mjs --dir "<folder with src/>"
//
// Output (agent-parseable):
//   RESULT: OK
//   CLEANED: <n>, WARNED: <m>
//   WARNED_LIST: <comma-separated relative paths, omitted if empty>
//   RESULT: FAIL | <reason>
//   HINT: <next step>

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- CLI args ---
const args = process.argv.slice(2);
function getOpt(long, short) {
  const idx = args.findIndex((a) => a === long || a === short);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  if (val === undefined || val.startsWith('-')) return undefined;
  return val;
}

const dir = getOpt('--dir', '-d');
if (!dir) {
  console.log('RESULT: FAIL | Usage: node cleanup-starter.mjs --dir "<folder with src/>"');
  process.exit(1);
}

const root = resolve(dir);
const srcDir = join(root, 'src');
if (!existsSync(srcDir)) {
  console.log(`RESULT: FAIL | src folder not found: ${srcDir}`);
  console.log('HINT: 传入的是工程目录（含 index.html 与 src/），不是 src/ 本身');
  process.exit(1);
}

// 每个文件的多条 starter 原样特征（全部命中才视为「未改造」）
const TARGETS = [
  {
    rel: join('api', 'demo.js'),
    signatures: [
      "export async function getDeviceList({ keyword = '', page = 1, pageSize = 10 } = {})",
      'demoDevices.filter((it) => it.name.includes(keyword))',
    ],
  },
  {
    rel: join('api', 'mock', 'demo-data.js'),
    signatures: [
      'export const demoDevices = [',
      "'Ankara-Server-01'",
    ],
  },
];

const cleaned = [];
const warned = [];

for (const target of TARGETS) {
  const abs = join(srcDir, target.rel);
  if (!existsSync(abs)) continue; // 幂等：不存在即无事可做
  let content;
  try {
    content = readFileSync(abs, 'utf8');
  } catch (err) {
    warned.push(target.rel);
    continue;
  }
  const stillStarter = target.signatures.every((s) => content.includes(s));
  if (stillStarter) {
    try {
      unlinkSync(abs);
      cleaned.push(relative(root, abs));
    } catch (err) {
      warned.push(target.rel);
    }
  } else {
    warned.push(target.rel);
  }
}

if (cleaned.length === 0 && warned.length === 0) {
  console.log('RESULT: OK');
  console.log('CLEANED: 0, WARNED: 0');
  console.log('NOTE: starter 文件本就不存在，无需清理');
  process.exit(0);
}

console.log('RESULT: OK');
console.log(`CLEANED: ${cleaned.length}, WARNED: ${warned.length}`);
if (cleaned.length) {
  console.log(`CLEANED_LIST: ${cleaned.join(', ')}`);
}
if (warned.length) {
  console.log(`WARNED_LIST: ${warned.join(', ')}`);
  console.log('NOTE: 上述文件内容已非 starter 原样（可能已被改造为真实模块），未删除，保留处理');
}
process.exit(0);
