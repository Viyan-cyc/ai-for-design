#!/usr/bin/env node
/**
 * query_tokens.mjs — 按名/搜索查询 tokens.json（extract 产物，gts-flat-dtcg schema）。
 * 只返回必要内容，避免模型整读 tokens.json。
 *
 * Usage:
 *   node query_tokens.mjs --name color-brand     # 查单个 token（含别名解析与深色/紧凑值）
 *   node query_tokens.mjs --search frost         # 子串搜索（名+描述+值，上限 20 条）
 *   node query_tokens.mjs --list                 # 分组摘要（按名前缀统计）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8'));
}

// {alias} → 解析后的最终值（一层即可：色板都是字面值）
function resolve(tokens, value) {
  if (typeof value !== 'string') return value;
  const m = value.match(/^\{(.+)\}$/);
  if (!m) return value;
  const target = tokens[m[1]];
  return target ? target.$value : `(unresolved:${m[1]})`;
}

function entry(tokens, name) {
  const t = tokens[name];
  if (!t) return null;
  const g = t.$extensions?.gts || {};
  const out = { name, type: t.$type, value: resolve(tokens, t.$value) };
  if (g.resolvedHex && t.$value !== g.resolvedHex) out.resolvedHex = g.resolvedHex;
  if (g.dark) out.dark = g.dark;
  if (g.compact) out.compact = g.compact;
  if (g.accessible) out.accessible = resolve(tokens, g.accessible);
  if (t.$description) out.description = t.$description;
  if (g.description) out.description = g.description;
  if (g.source === 'backfill-g1.5.1') out.note = '过渡基线（G 1.5.1 回填，待设计师复核）';
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  let name = null, search = null, list = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name') name = argv[++i];
    else if (argv[i] === '--search') search = argv[++i];
    else if (argv[i] === '--list') list = true;
    else if (argv[i] === '-h' || argv[i] === '--help') {
      console.log('usage: query_tokens.mjs --name <token> | --search <sub> | --list');
      process.exit(0);
    }
  }

  const doc = load();
  const tokens = doc.tokens;

  if (name) {
    const out = entry(tokens, name.replace(/^--/, ''));
    if (!out) {
      // 相近项提示（preflight 同款体验）
      const needle = name.replace(/^--/, '').toLowerCase();
      const near = Object.keys(tokens).filter((n) => n.includes(needle) || needle.includes(n.split('-')[0])).slice(0, 8);
      console.log(`ERROR: unknown token: ${name}${near.length ? `\nnear: ${near.join(', ')}` : ''}`);
      process.exit(1);
    }
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }

  if (search) {
    const needle = search.toLowerCase();
    const matches = [];
    for (const [n, t] of Object.entries(tokens)) {
      const hay = `${n} ${t.$description || ''} ${t.$extensions?.gts?.description || ''} ${JSON.stringify(t.$value)}`.toLowerCase();
      if (hay.includes(needle)) matches.push(entry(tokens, n));
      if (matches.length >= 20) break;
    }
    process.stdout.write(JSON.stringify({ matches, total: matches.length }, null, 2) + '\n');
    return;
  }

  if (list) {
    const groups = {};
    for (const n of Object.keys(tokens)) {
      const key = n.split('-')[0];
      groups[key] = (groups[key] || 0) + 1;
    }
    process.stdout.write(JSON.stringify({ source: doc.meta.sourceVersion, total: Object.keys(tokens).length, groups }, null, 2) + '\n');
    return;
  }

  console.error('usage: query_tokens.mjs --name <token> | --search <sub> | --list');
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
