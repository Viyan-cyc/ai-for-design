#!/usr/bin/env node
/**
 * Export Lucide SVGs offline from canonical nodes, retaining upstream attribution.
 * 移植自 scripts/export_icons.py（W3/D18），行为逐条对齐，diff 验证见 tests/migration_diff.mjs。
 * SVG 序列化复刻 Python ElementTree 输出格式（属性插入序、自闭合 `<tag ... />`、无缩进）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'frontend/element-plus');

let cachedRegistry = null;
function registry() {
  if (!cachedRegistry) {
    cachedRegistry = [
      JSON.parse(fs.readFileSync(path.join(BASE, 'src/icons/icon-nodes.json'), 'utf8')),
      JSON.parse(fs.readFileSync(path.join(BASE, 'src/icons/icon-aliases.json'), 'utf8')),
    ];
  }
  return cachedRegistry;
}

/** Python xml.etree 输出的属性转义：仅 & < >，引号不转义（值内无引号场景）。 */
function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serialize(tag, attrs, selfClosing) {
  const pairs = Object.entries(attrs).map(([k, v]) => `${k}="${escapeAttr(v)}"`);
  return selfClosing ? `<${tag} ${pairs.join(' ')} />` : `<${tag} ${pairs.join(' ')}>`;
}

export function svg(name) {
  const [nodes, aliases] = registry();
  const key = name in aliases ? aliases[name] : name;
  if (!(key in nodes)) throw new Error(`Unknown icon: ${name}`);
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
  ];
  for (const [tag, attrs] of nodes[key]) {
    parts.push(serialize(tag, attrs, true));
  }
  parts.push('</svg>');
  return `<!-- @license lucide-static v1.43.0 - ISC -->\n${parts.join('')}\n`;
}

function main() {
  const argv = process.argv.slice(2);
  let all = false;
  const positional = [];
  for (const arg of argv) {
    if (arg === '--all') all = true;
    else positional.push(arg);
  }
  const output = positional[positional.length - 1];
  const name = positional.length > 1 ? positional[0] : null;
  if (all) {
    if (!output) {
      console.error('usage: export_icons.mjs [-h] [--all] [name] output');
      process.exit(2);
    }
    const [nodes, aliases] = registry();
    const names = [...new Set([...Object.keys(nodes), ...Object.keys(aliases).filter((n) => /^[\x20-\x7E]*$/.test(n))])].sort();
    fs.mkdirSync(output, { recursive: true });
    for (const iconName of names) {
      fs.writeFileSync(path.join(output, `${iconName}.svg`), svg(iconName), 'utf8');
    }
  } else {
    if (!name || !output) {
      console.error('Provide NAME OUTPUT.svg, or --all OUTPUT_DIR');
      process.exit(2);
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, svg(name), 'utf8');
  }
}

// 通过真实路径判断直接执行（os.tmpdir() 返回 /var/... 而 import.meta.url 是 /private/var/...，
// 直接字符串比较会因 macOS 符号链接失配而静默跳过 main）。
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
