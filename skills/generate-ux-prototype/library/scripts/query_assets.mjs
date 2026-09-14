#!/usr/bin/env node
/**
 * Read only one token group; never scan all source code.
 * Pure 分支：只保留 tokens 子命令（icons/components/templates 随组件层移除）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function tokenRules(group) {
  if (group.startsWith('frost') || group.includes('glass')) {
    return ['design/rules.md', 'design/frosted-glass.md'];
  }
  if (group.startsWith('foundation') || group.startsWith('semantic') || group.startsWith('charts') || group.startsWith('code')) {
    return ['design/rules.md', 'design/color-rules.md'];
  }
  return ['design/rules.md'];
}

function queryTokens(key = null, search = null) {
  const doc = readJson('design/tokens.json');
  const entries = doc.groups;

  if (key in entries) return { group: key, ...entries[key], rules: tokenRules(key) };

  if (search) {
    const needle = search.toLowerCase();
    const matches = [];
    for (const [group, data] of Object.entries(entries)) {
      for (const [name, value] of Object.entries(data.tokens)) {
        const haystack = `${group} ${data.description} ${name} ${JSON.stringify(value)}`.toLowerCase();
        if (haystack.includes(needle)) matches.push({ group, name, ...value, rules: tokenRules(group) });
      }
    }
    return { matches: matches.slice(0, 20), total: matches.length, next: 'Query an exact token or group for complete values.' };
  }

  if (key) {
    const found = {};
    for (const [group, data] of Object.entries(entries)) {
      if (key in data.tokens) found[group] = { [key]: data.tokens[key] };
    }
    if (Object.keys(found).length === 0) {
      const needle = key.toLowerCase();
      const matchingGroups = {};
      for (const [group, data] of Object.entries(entries)) {
        if (`${group} ${data.description}`.toLowerCase().includes(needle)) {
          matchingGroups[group] = { description: data.description, count: Object.keys(data.tokens).length };
        }
      }
      if (Object.keys(matchingGroups).length > 0) {
        return { matchingGroups, next: 'Query one exact group name for token values.' };
      }
      throw new Error(`Unknown token or group: ${key}`);
    }
    return found;
  }

  const summary = {};
  for (const [group, data] of Object.entries(entries)) {
    if (!search || `${group} ${data.description}`.toLowerCase().includes(search.toLowerCase())) {
      summary[group] = { description: data.description, count: Object.keys(data.tokens).length };
    }
  }
  return summary;
}

function main() {
  const argv = process.argv.slice(2);
  const positional = [];
  let search = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--search') {
      if (i + 1 >= argv.length) {
        console.error('usage: query_assets.mjs [-h] [--search SEARCH] {tokens} [key]');
        process.exit(2);
      }
      search = argv[i + 1];
      i += 1;
    } else if (argv[i] === '-h' || argv[i] === '--help') {
      console.log('usage: query_assets.mjs [-h] [--search SEARCH] {tokens} [key]');
      process.exit(0);
    } else {
      positional.push(argv[i]);
    }
  }
  const [kind, key = null] = positional;
  if (kind !== 'tokens') {
    console.error(`argument kind: invalid choice: '${kind}' (pure 分支仅支持 'tokens')`);
    process.exit(2);
  }
  try {
    process.stdout.write(`${JSON.stringify(queryTokens(key, search), null, 2)}\n`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unknown ')) {
      console.log(`ERROR: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

// 通过真实路径判断直接执行（os.tmpdir() 返回 /var/... 而 import.meta.url 是 /private/var/...，
// 直接字符串比较会因 macOS 符号链接失配而静默跳过 main）。
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
