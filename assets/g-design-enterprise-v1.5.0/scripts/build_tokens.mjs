#!/usr/bin/env node
/**
 * Generate CSS/SCSS and readable token indexes from design/tokens.json (stdlib only).
 * 移植自 scripts/build_tokens.py（W3/D18），行为逐条对齐，diff 验证见 tests/migration_diff.mjs。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER = /\{\{(resolve:)?([^|{}]+)\|([^{}]+)\}\}/g;

function readText(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

export function outputs(root = ROOT) {
  const doc = JSON.parse(fs.readFileSync(path.join(root, 'design/tokens.json'), 'utf8'));
  const groups = doc.groups;
  const allNames = new Set();
  for (const record of Object.values(groups)) {
    for (const name of Object.keys(record.tokens)) allNames.add(name);
  }
  if (doc.schemaVersion !== '1.4') throw new Error('Unsupported token schemaVersion');

  function resolveToken(group, name, trail = []) {
    const key = [group, name];
    if (trail.some((entry) => entry[0] === group && entry[1] === name)) {
      throw new Error(`Cyclic token reference: ${JSON.stringify([...trail, key])}`);
    }
    const value = groups[group].tokens[name].value;

    function ref(_match, target) {
      const theme = ['light', 'dark'].find((t) => group.endsWith(`-${t}`)) ?? null;
      const candidates = [group];
      if (theme) {
        for (const g of Object.keys(groups)) {
          if (g !== group && g.endsWith(`-${theme}`)) candidates.push(g);
        }
      }
      for (const g of Object.keys(groups)) {
        if (g !== group && (!theme || !g.endsWith(`-${theme}`))) candidates.push(g);
      }
      const owner = candidates.find((g) => target in groups[g].tokens);
      if (owner === undefined) throw new Error(`Undefined token ${target}`);
      return resolveToken(owner, target, [...trail, key]);
    }

    return value.replace(/var\((--[\w-]+)\)/g, (match, target) => ref(match, target));
  }

  for (const [group, record] of Object.entries(groups)) {
    if (typeof record.tokens !== 'object' || record.tokens === null || Array.isArray(record.tokens)) {
      throw new Error(`Invalid group ${group}`);
    }
    for (const [name, item] of Object.entries(record.tokens)) {
      const value = item.value;
      if (!name.startsWith('--') || typeof value !== 'string') throw new Error(`Invalid token ${name}`);
      for (const ch of ['{', '}', ';']) {
        if (value.includes(ch)) throw new Error(`Token must be a CSS value: ${name}`);
      }
      if (value.includes('</')) throw new Error(`Token must be a CSS value: ${name}`);
      for (const ref of value.matchAll(/var\((--[\w-]+)/g)) {
        if (!allNames.has(ref[1])) throw new Error(`Undefined reference ${ref[1]}`);
      }
      resolveToken(group, name);
      for (const color of value.matchAll(/#[\w]+/g)) {
        if (!/^(?:#[a-fA-F0-9]{3,4}|#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8})$/.test(color[0])) {
          throw new Error(`Invalid color ${color[0]}`);
        }
      }
      for (const args of [...resolveToken(group, name).matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1])) {
        const numbers = args.split(',').map((n) => Number.parseFloat(n.trim()));
        if (numbers.some((n) => Number.isNaN(n))) throw new Error(`Invalid rgb value ${value}`);
        if (![3, 4].includes(numbers.length)) throw new Error(`Invalid rgb value ${value}`);
        if (numbers.slice(0, 3).some((n) => n < 0 || n > 255)) throw new Error(`Invalid rgb value ${value}`);
        if (numbers.length === 4 && !(numbers[3] >= 0 && numbers[3] <= 1)) throw new Error(`Invalid rgb value ${value}`);
      }
    }
  }

  const result = {};
  const bindingsDir = path.join(root, 'frontend/element-plus/bindings');
  const templateFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith('.tpl')) templateFiles.push(child);
    }
  };
  walk(bindingsDir);
  templateFiles.sort((a, b) => a.localeCompare(b));

  for (const templateFile of templateFiles) {
    const relative = path.relative(bindingsDir, templateFile).split(path.sep).join('/').slice(0, -4);
    function replace(match, expanded, group, name) {
      return expanded ? resolveToken(group, name) : groups[group].tokens[name].value;
    }
    const value = readText(path.relative(ROOT, templateFile)).replace(
      PLACEHOLDER,
      (m, expanded, group, name) => replace(m, expanded, group, name),
    );
    if (value.includes('{{')) throw new Error(`Unresolved placeholder ${relative}`);
    const prefix = relative.endsWith('.scss')
      ? '// GENERATED from design/tokens.json; edit the source, then run scripts/build_tokens.mjs.\n'
      : '/* GENERATED from design/tokens.json. Do not edit generated values. */\n';
    result[`frontend/element-plus/tokens/${relative}`] = prefix + value;
  }

  const index = {
    schemaVersion: '1.4',
    source: 'tokens.json',
    generated: true,
    groups: Object.fromEntries(
      Object.entries(groups).map(([g, v]) => [
        g,
        { description: v.description, count: Object.keys(v.tokens).length, tokens: Object.keys(v.tokens) },
      ]),
    ),
  };
  result['design/index.json'] = `${JSON.stringify(index, null, 2)}\n`;

  const lines = [
    '# Token 数值表（自动生成）',
    '',
    '数值唯一来源为 `tokens.json`；此表不能作为第二个编辑入口。运行 `node scripts/build_tokens.mjs` 更新。',
    '',
  ];
  for (const [group, data] of Object.entries(groups)) {
    lines.push(`## ${group}`, '', data.description, '', '| Token | 值 | 用途/来源 |', '| --- | --- | --- |');
    for (const [name, item] of Object.entries(data.tokens)) {
      const usage = item.usage ?? item.source ?? '';
      lines.push(`| \`${name}\` | \`${item.value.replace(/\|/g, '\\|')}\` | ${usage.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }
  result['design/tokens.md'] = `${lines.join('\n')}\n`;

  const colorGroups = [
    'foundation',
    'semantic-light',
    'semantic-dark',
    'charts-default',
    'charts-accessible',
    'charts-extension-1',
    'charts-extension-2',
    'charts-extension-3',
    'code-light',
    'code-dark',
  ];
  const colorLines = [
    '# H Design 颜色 Token 表（自动生成）',
    '',
    '唯一维护源为 [tokens.json](tokens.json)，颜色用法见 [color-rules.md](color-rules.md)。value/usage/codeMapping 变更后运行 scripts/build_tokens.mjs；不要手改此表。',
    '',
    '包含基础与辅助色、UI 明暗语义、图表方案、代码浅深色及其用途。深色 UI 为项目兼容方案；代码明暗值来自 H Design 语义明细表。',
    '',
  ];
  const cell = (value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  for (const group of colorGroups) {
    const data = groups[group];
    colorLines.push(
      `## ${group}`,
      '',
      data.description,
      '',
      '| Token | 引用或定义 | 解析色值 | 使用说明 |',
      '| --- | --- | --- | --- |',
    );
    for (const [name, item] of Object.entries(data.tokens)) {
      if (group === 'foundation' && !['color', 'reference'].includes(item.type)) continue;
      colorLines.push(
        `| \`${name}\` | \`${cell(item.value)}\` | \`${cell(resolveToken(group, name))}\` | ${cell(item.usage ?? item.source ?? '')} |`,
      );
    }
    colorLines.push('');
  }
  colorLines.push(
    '## StarCode 语义与平台映射',
    '',
    'IDE 项目名是 DevEco 示例，其他 IDE 按实际名称对应；example 为便于使用整理的语法示例。映射元数据只维护于 code-light 各项 codeMapping。',
    '',
    '| Token | 大类 / 子类 | Highlight.js | IDE 设置项 | 频率 | 用途示例 | 选色理由 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const [name, item] of Object.entries(groups['code-light'].tokens)) {
    const m = item.codeMapping;
    if (m) {
      colorLines.push(
        `| \`${name}\` | ${cell(`${m.group} / ${m.subcategory}`)} | ${cell(m.hljsClass)} | ${cell(m.ideSetting)} | ${cell(m.frequency)} | ${cell(m.example)} | ${cell(m.rationale)} |`,
      );
    }
  }
  result['design/color-tokens.md'] = `${colorLines.join('\n')}\n`;
  return result;
}

function main() {
  const check = process.argv.includes('--check');
  let generated;
  try {
    generated = outputs();
  } catch (error) {
    console.log(`ERROR: ${error.message}`);
    process.exit(1);
  }
  const bad = [];
  for (const [relative, text] of Object.entries(generated)) {
    const target = path.join(ROOT, relative);
    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) bad.push(relative);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text, 'utf8');
    }
  }
  if (bad.length) {
    console.log(`Generated files out of date:\n${bad.join('\n')}`);
    process.exit(1);
  }
  console.log(`${check ? 'Verified' : 'Generated'} ${Object.keys(generated).length} token outputs.`);
}

// 通过真实路径判断直接执行（os.tmpdir() 返回 /var/... 而 import.meta.url 是 /private/var/...，
// 直接字符串比较会因 macOS 符号链接失配而静默跳过 main）。
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
