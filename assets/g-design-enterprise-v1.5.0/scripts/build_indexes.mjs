#!/usr/bin/env node
/**
 * Generate AI indexes from component specifications and actual local imports.
 * 移植自 scripts/build_indexes.py（W3/D18），行为逐条对齐，diff 验证见 tests/migration_diff.mjs。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependencyFiles } from './asset_graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function outputs(root = ROOT) {
  const components = {};
  const templates = {};
  const specsDir = path.join(root, 'components/specs');
  for (const p of fs.readdirSync(specsDir).filter((f) => f.endsWith('.json')).sort()) {
    const item = JSON.parse(fs.readFileSync(path.join(specsDir, p), 'utf8'));
    item.spec = path.relative(root, path.join(specsDir, p)).split(path.sep).join('/');
    const parent = path.dirname(path.join(root, item.source));
    const starts = [item.source];
    for (const name of ['index.ts', 'types.ts', 'style.scss']) {
      const candidate = path.join(parent, name);
      if (fs.existsSync(candidate)) {
        starts.push(path.relative(root, candidate).split(path.sep).join('/'));
      }
    }
    item.files = dependencyFiles(root, starts);
    const text = item.files
      .filter((f) => ['.vue', '.css', '.scss'].includes(path.extname(f)))
      .map((f) => fs.readFileSync(path.join(root, f), 'utf8'))
      .join('\n');
    item.tokens = [...new Set([...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))].sort();
    components[item.id] = item;
  }
  for (const item of Object.values(components)) {
    item.dependencies = Object.values(components)
      .filter((c) => item.files.includes(c.source) && c.id !== item.id)
      .map((c) => c.id)
      .sort();
  }
  const templatesDir = path.join(root, 'components/templates');
  for (const p of fs.readdirSync(templatesDir).filter((f) => f.endsWith('.json')).sort()) {
    const item = JSON.parse(fs.readFileSync(path.join(templatesDir, p), 'utf8'));
    item.spec = path.relative(root, path.join(templatesDir, p)).split(path.sep).join('/');
    const parentDir = path.dirname(item.source);
    item.files = dependencyFiles(root, [
      item.source,
      path.posix.join(parentDir, 'index.ts'),
      item.appEntry,
      'frontend/element-plus/src/main.ts',
    ], [
      'frontend/element-plus/src/selected-template.ts',
      item.configFile,
    ]);
    item.components = Object.values(components)
      .filter((c) => item.files.includes(c.source))
      .map((c) => c.id)
      .sort();
    templates[item.id] = item;
  }
  const result = {
    'components/index.json': {
      schemaVersion: '1.4',
      generated: true,
      components,
    },
    'components/templates.json': {
      schemaVersion: '1.4',
      generated: true,
      templates,
    },
  };
  return Object.fromEntries(
    Object.entries(result).map(([p, v]) => [p, `${JSON.stringify(v, null, 2)}\n`]),
  );
}

function main() {
  const check = process.argv.includes('--check');
  const bad = [];
  for (const [rel, value] of Object.entries(outputs())) {
    const target = path.join(ROOT, rel);
    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== value) bad.push(rel);
    } else {
      fs.writeFileSync(target, value, 'utf8');
    }
  }
  if (bad.length) {
    console.log(`Indexes out of date: ${JSON.stringify(bad)}`);
    process.exit(1);
  }
  console.log(check ? 'Component and template indexes verified.' : 'Generated component and template indexes.');
}

// 通过真实路径判断直接执行（os.tmpdir() 返回 /var/... 而 import.meta.url 是 /private/var/...，
// 直接字符串比较会因 macOS 符号链接失配而静默跳过 main）。
if (process.argv[1] && import.meta.url === `file://${fs.realpathSync(process.argv[1])}`) main();
