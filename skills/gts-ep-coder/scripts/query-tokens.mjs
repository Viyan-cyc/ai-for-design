#!/usr/bin/env node
// Optional batched lookup of generated tokens; no network or compiler needed.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  console.log(JSON.stringify({ result: 'FAIL', error: message }));
  process.exit(1);
}
const args = process.argv.slice(2);
const queries = [];
let limit = 5;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') {
    const value = args[++i];
    if (!/^\d+$/.test(value || '') || +value < 1 || +value > 30) fail('--limit must be 1–30');
    limit = +value;
  } else if (args[i].startsWith('--') && !/^--[a-z][a-z0-9-]*$/.test(args[i])) {
    fail(`Invalid argument: ${args[i]}`);
  } else {
    const query = args[i].trim();
    if (!query) fail('Queries must not be empty');
    queries.push(query);
  }
}
if (!queries.length) fail('Usage: node scripts/query-tokens.mjs "次要文本" "frost" "--color-brand" --limit 5');
let text;
try {
  text = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../references/token-catalog.md'), 'utf8');
} catch (e) { fail(`Cannot read token-catalog.md: ${e.message}`); }
const tokens = [];
let category = '';
let headers = [];
for (const line of text.split(/\r?\n/)) {
  if (line.startsWith('## ')) { category = line.slice(3); headers = []; }
  if (!line.startsWith('|')) continue;
  const cells = line.replace(/^\|\s*|\s*\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
  if (cells[0] === '准确名称') { headers = cells; continue; }
  const match = cells[0].match(/^`(--[a-z][a-z0-9-]*)`$/);
  if (!match) continue;
  if (!category || headers.length !== cells.length) fail(`Invalid catalogue row: ${cells[0]}`);
  const fields = Object.fromEntries(headers.slice(1).map((header, i) => [header, cells[i + 1]]));
  tokens.push({ name: match[1], category, ...fields });
}
if (!tokens.length || new Set(tokens.map(token => token.name)).size !== tokens.length) fail('Catalogue is empty or has duplicate names');
// Small search vocabulary, not token aliases: names and values are never rewritten.
const synonyms = new Map(Object.entries({
  '品牌色': 'color-brand', '主题色': 'color-brand',
  '卡片背景': 'color-bg', '背景色': '背景',
  '链接色': 'color-link', '字体大小': 'font-size', '字号大小': 'font-size',
  '失败': '错误', '危险': '功能颜色', '告警色': '功能颜色',
  '红': 'red-', '红色': 'red-', '蓝色': 'blue-',
}));
const categories = [...new Set(tokens.map(token => token.category))];
function search(terms) {
  return tokens.filter(token => terms.every(term =>
    [token.name, token.category, token['用途'] || ''].join(' ').toLowerCase().includes(term)));
}
const results = [...new Set(queries)].map(query => {
  const exactName = query.startsWith('--');
  const bareName = tokens.find(token => token.name === `--${query}`);
  const terms = query.toLowerCase().split(/\s+/);
  let matches = exactName ? tokens.filter(token => token.name === query) : bareName ? [bareName] : search(terms);
  let normalizedTerms;
  if (!exactName && !bareName && !matches.length) {
    const normalized = terms.map(term => synonyms.get(term) || term);
    if (normalized.some((term, i) => term !== terms[i])) {
      normalizedTerms = normalized;
      matches = search(normalized);
    }
  }
  const result = { query, status: matches.length ? 'FOUND' : 'NOT_FOUND', total: matches.length,
    truncated: matches.length > limit, matches: matches.slice(0, limit) };
  if (normalizedTerms) result.normalizedTerms = normalizedTerms;
  if (!matches.length) {
    const prefix = exactName ? query.slice(0, query.lastIndexOf('-')) : '';
    const nameCategories = prefix.length > 2 ? [...new Set(tokens.filter(token => token.name.startsWith(prefix + '-')).map(token => token.category))] : [];
    const related = categories.filter(category => terms.some(term =>
      [...term].some(char => /[\u4e00-\u9fff]/.test(char) && category.includes(char))));
    result.categoryHints = (nameCategories.length ? nameCategories : related.length ? related : categories).slice(0, 5);
    result.hint = exactName ? '准确名称不存在；请按用途查询，不自动纠正名称。' :
      '可查上述分类；多个参数分别查询，同一参数内空格表示同时满足。';
  }
  return result;
});
console.log(JSON.stringify({ result: 'OK', results }, null, 2));
