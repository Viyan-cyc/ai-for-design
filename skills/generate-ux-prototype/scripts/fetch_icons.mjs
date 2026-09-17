#!/usr/bin/env node
// fetch_icons.mjs
// Fetches icons from the Huawei IconPlus API and saves them as .svg files.
// Falls back to Lucide (fetched live from its public CDN) when the API is
// unreachable — no icon resources are bundled locally.
//
// IconPlus API flow (per references/icon-api.md):
//   0. Connectivity check  → if unreachable, switch to Lucide fallback
//   1. getConfig    → validate size/style/color against config (warn only)
//   2. getIconInfo  → search icons by keyword, collect URLs + name + category
//   3. getIcon      → fetch SVG content by URL (pass name/category from step 2)
//   4. Save .svg    → raw SVG file into src/assets/icons/
//
// Lucide fallback (extranet only — no local icon data shipped):
//   Keywords are Lucide icon names directly (the calling LLM does any
//   Chinese→English translation before invoking this script). The SVG is
//   downloaded straight from jsdelivr's lucide-static CDN.
//
// Usage:
//   node fetch_icons.mjs --dir "{artifact-folder}/{slug}" \
//     --keywords "download,file,search" \
//     [--base-url "https://octo.hdesign.huawei.com"] \
//     [--size 24] [--style "线性"] [--color "GTS_线性_Gray-10"] \
//     [--topK 1] [--source-id 6] [--category "basic"] [--group-id "132,333"] [--file-type svg] [--force] [--recheck]
//
// Output (agent-parseable):
//   RESULT: OK + ICONS: download.svg,search.svg,...
//   RESULT: FALLBACK | IconPlus API unreachable, used Lucide icons from network + ICONS: ...
//   RESULT: FAIL | <reason>

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync as fsSyncReaddir } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { installNodeSuspectGuard } from './compiler-paths.mjs';

installNodeSuspectGuard();

const __dirname = dirname(fileURLToPath(import.meta.url));

function fail(reason) {
  console.log(`RESULT: FAIL | ${reason}`);
  process.exit(1);
}

// ---------- args ----------
const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}
function argFlag(name) {
  return args.includes(name);
}

const dir = argValue('--dir');
const baseUrl = argValue('--base-url') || 'https://octo.hdesign.huawei.com';
const keywords = argValue('--keywords');
const size = argValue('--size') || '24';
const style = argValue('--style') || '线性';
const color = argValue('--color') || 'GTS_线性_Gray-10';
const topK = parseInt(argValue('--topK') || '1', 10);
const sourceId = parseInt(argValue('--source-id') || '6', 10);
const category = argValue('--category');
const groupId = argValue('--group-id');
const fileType = argValue('--file-type') || 'svg';
const force = argFlag('--force');

if (!dir) fail('Missing --dir <workspace>');
if (!keywords) fail('Missing --keywords "download,file,search"');

const workDir = resolve(dir);
const srcDir = join(workDir, 'src');
const iconsDir = join(srcDir, 'assets', 'icons');

if (!existsSync(srcDir)) fail(`src not found: ${srcDir} (run init.mjs first)`);
mkdirSync(iconsDir, { recursive: true });

// ---------- helpers ----------
const API_BASE = baseUrl.replace(/\/+$/, '');
const FETCH_TIMEOUT = 15000;
const PING_TIMEOUT = 3000;

async function fetchJson(url, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ic_public_download → public-download
function toKebabName(iconName) {
  let parts = iconName.split('_');
  if (parts[0] === 'ic') parts = parts.slice(1);
  return parts.filter(Boolean).join('-');
}

// public-download → publicDownload（barrel 导出键名）
function toCamelKey(kebabName) {
  return kebabName.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// strict mode 保留字不能作 import 绑定名（Lucide 图标 package/delete/void 等），
// 追加 Icon 后缀：package → packageIcon。
// 注意：build.mjs 的 ICONS.key 校验独立实现同一规则，两侧必须同步修改。
const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'yield', 'let', 'static', 'await', 'package', 'implements', 'interface',
  'private', 'protected', 'public',
]);

function safeKey(camelKey) {
  return RESERVED_WORDS.has(camelKey) ? `${camelKey}Icon` : camelKey;
}

// 全量扫描 src/assets/icons/*.svg，整体重生成 barrel（多次运行保持完整与幂等）。
// 两段式 import + 对象字面量（sfc-loader 0.9.5 对 re-export 编译有缺陷，勿改 re-export）。
function writeIconsBarrel() {
  let svgFiles;
  try {
    svgFiles = fsSyncReaddir(iconsDir).filter((f) => f.endsWith('.svg')).sort();
  } catch {
    return;
  }
  if (svgFiles.length === 0) return;

  const imports = [];
  const keys = [];
  for (const file of svgFiles) {
    const key = safeKey(toCamelKey(file.slice(0, -4)));
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) {
      console.warn(`WARN: barrel skip ${file} — kebab name "${key}" not camelCase-safe`);
      continue;
    }
    imports.push(`import ${key} from './${file}'`);
    keys.push(key);
  }
  if (keys.length === 0) return;

  const lines = [
    '// AUTO-GENERATED by fetch_icons.mjs — do not edit.',
    '// Key rule: kebab-case file name (minus .svg) → camelCase (public-download → publicDownload);',
    '//   JS reserved words get an Icon suffix (package → packageIcon).',
    '// Usage: import { ICONS } from \'<rel>/assets/icons/index.js\' then <img :src="ICONS.publicDownload" />.',
    ...imports,
    '',
    'export const ICONS = {',
    ...keys.map((k) => `  ${k},`),
    '}',
    '',
  ];
  const barrelPath = join(iconsDir, 'index.js');
  const content = lines.join('\n');
  try {
    if (existsSync(barrelPath) && readFileSync(barrelPath, 'utf8') === content) {
      console.log(`BARREL: ${barrelPath} (${keys.length} icons, unchanged)`);
      return;
    }
  } catch {}
  writeFileSync(barrelPath, content, 'utf8');
  console.log(`BARREL: ${barrelPath} (${keys.length} icons)`);
}

function processSvg(svgString) {
  let svg = String(svgString).replace(/^\uFEFF/, '').trim();
  const tagMatch = svg.match(/<svg\b[^>]*>/i);
  if (tagMatch) {
    const originalTag = tagMatch[0];
    const cleanedTag = originalTag
      .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '')
      .replace(/<svg\b/i, '<svg width="1em" height="1em"');
    svg = svg.replace(originalTag, cleanedTag);
  } else {
    svg = `<svg width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  }
  return svg;
}

// ---------- Lucide fallback (network, no local icon data) ----------
// 外网无法访问 IconPlus 时，从 Lucide 公开 CDN 在线拉取 SVG，本地不打包图标
// 资源。关键词即 Lucide 图标名，按名直接下载。
// ---------- 0. Connectivity check (cached, TTL 1h) ----------
// 探测结果写到 skill 根 conn-cache.json，1 小时内复用，避免每次运行都空等
// PING_TIMEOUT；传 --recheck 强制重新探测（内网↔外网切换后有用）。
const CONN_CACHE_PATH = join(__dirname, '..', 'conn-cache.json');
const CONN_CACHE_TTL = 60 * 60 * 1000;

function readConnCache() {
  try {
    const data = JSON.parse(readFileSync(CONN_CACHE_PATH, 'utf8'));
    if (typeof data.ok === 'boolean' && Date.now() - data.ts < CONN_CACHE_TTL) {
      return data;
    }
  } catch {}
  return null;
}

function writeConnCache(ok) {
  try {
    writeFileSync(CONN_CACHE_PATH, JSON.stringify({ ok, ts: Date.now() }), 'utf8');
  } catch {}
}

async function checkConnectivity() {
  if (!argFlag('--recheck')) {
    const cached = readConnCache();
    if (cached) {
      console.log(`Connectivity ${cached.ok ? 'reachable' : 'unreachable'} (cached — pass --recheck to re-probe)`);
      return { ok: cached.ok };
    }
  }
  console.log(`Checking connectivity to ${API_BASE}...`);
  let ok = false;
  try {
    const configUrl = `${API_BASE}/assetRepository/iconPlus/getConfig`;
    await fetchJson(configUrl, PING_TIMEOUT);
    ok = true;
  } catch {
    ok = false;
  }
  writeConnCache(ok);
  return { ok };
}

const LUCIDE_BASE = 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons';

async function lucideFallback(keywordList) {
  const savedIcons = [];
  const skipped = [];
  const failed = [];

  for (const kw of keywordList) {
    const fileName = `${kw}.svg`;
    const filePath = join(iconsDir, fileName);

    if (existsSync(filePath) && !force) {
      skipped.push(fileName);
      continue;
    }

    const svgRaw = await fetchText(`${LUCIDE_BASE}/${encodeURIComponent(kw)}.svg`);
    if (!svgRaw) {
      failed.push(fileName);
      continue;
    }

    writeFileSync(filePath, processSvg(svgRaw), 'utf8');
    savedIcons.push(fileName);
  }

  if (skipped.length > 0) {
    console.log(`SKIP: ${skipped.join(', ')} (already exist, use --force to overwrite)`);
  }
  if (failed.length > 0) {
    console.log(`WARN: Lucide has no icon for: ${failed.join(', ')} — pick icon names from https://lucide.dev/icons and re-run`);
  }

  writeIconsBarrel();
  console.log('RESULT: FALLBACK | IconPlus API unreachable, used Lucide icons from network');
  console.log(`ICONS: ${savedIcons.join(',')}`);
  console.log(`DIR: ${iconsDir}`);
  process.exit(0);
}

// ---------- Main: connectivity check ----------
const keywordList = keywords.split(',').map((s) => s.trim()).filter(Boolean);
const conn = await checkConnectivity();

if (!conn.ok) {
  console.log(`WARN: IconPlus API unreachable at ${API_BASE}, falling back to Lucide (network)`);
  await lucideFallback(keywordList);
}

// ---------- API reachable: normal IconPlus flow ----------

// ---------- 1. getConfig ----------
let config;
try {
  const configUrl = `${API_BASE}/assetRepository/iconPlus/getConfig`;
  console.log(`GET ${configUrl}`);
  config = await fetchJson(configUrl);
} catch (e) {
  fail(`getConfig failed: ${e.message}`);
}

// Validate params against config (warn only, do not modify)
const validSizes = (config.size || []).map((s) => s.key);
const validStyles = (config.style || []).map((s) => s.value);
const validColors = (config.colors || []).map((c) => c.id);

if (validSizes.length && !validSizes.includes(size)) {
  console.warn(`WARN: size "${size}" not in config sizes [${validSizes.join(', ')}]`);
}
if (validStyles.length && !validStyles.includes(style)) {
  console.warn(`WARN: style "${style}" not in config styles [${validStyles.join(', ')}]`);
}
if (validColors.length && !validColors.includes(color)) {
  console.warn(`WARN: color "${color}" not in config colors (proceeding anyway)`);
}

// ---------- 2. getIconInfo ----------
// API doc (icon-api.md) params: keyword(必填), topK(选填,默认5),
//   category(选填), source_id(选填), group_id(选填,逗号分隔), businessData(选填)
let iconInfo;
try {
  const params = new URLSearchParams({
    keyword: keywords,
    topK: String(topK),
    source_id: String(sourceId),
  });
  if (category) params.set('category', category);
  params.set('group_id', '74,77,93');
  const infoUrl = `${API_BASE}/assetRepository/iconPlus/getIconInfo?${params}`;
  console.log(`GET ${infoUrl}`);
  iconInfo = await fetchJson(infoUrl);
} catch (e) {
  fail(`getIconInfo failed: ${e.message}`);
}

// 每个关键词只取 score 最高的 1 个图标（按需下载，不囤积搜索结果）
const seen = new Set();
const uniqueIcons = [];
for (const group of (Array.isArray(iconInfo) ? iconInfo : [])) {
  const icons = (group.icons || []).filter((i) => i.url);
  if (icons.length === 0) continue;
  // 按 score 降序，取第一个
  icons.sort((a, b) => (b.score || 0) - (a.score || 0));
  const best = icons[0];
  if (seen.has(best.url)) continue;
  seen.add(best.url);
  uniqueIcons.push({ name: best.name, url: best.url, category: best.category || '' });
}

if (uniqueIcons.length === 0) {
  console.log(`WARN: no icons found for keywords: ${keywords}`);
  console.log('RESULT: OK');
  console.log('ICONS: ');
  process.exit(0);
}

console.log(`Found ${uniqueIcons.length} unique icon(s)`);

// ---------- 3. getIcon (batch) ----------
// API doc (icon-api.md) params: url(必填), size(必填), style(必填), color(必填),
//   name(选填,从getIconInfo获取), category(选填,从getIconInfo获取), fileType(选填,默认svg)
const urlsParam = uniqueIcons.map((i) => i.url).join(',');
const namesParam = uniqueIcons.map((i) => i.name).filter(Boolean).join(',');
const categoriesParam = [...new Set(uniqueIcons.map((i) => i.category).filter(Boolean))].join(',');
let iconData;
try {
  const params = new URLSearchParams({
    url: urlsParam,
    size: size,
    style: style,
    color: color,
    fileType: fileType,
  });
  if (namesParam) params.set('name', namesParam);
  if (categoriesParam) params.set('category', categoriesParam);
  const iconUrl = `${API_BASE}/assetRepository/iconPlus/getIcon?${params}`;
  console.log(`GET ${iconUrl}`);
  iconData = await fetchJson(iconUrl);
} catch (e) {
  fail(`getIcon failed: ${e.message}`);
}

const iconList = Array.isArray(iconData) ? iconData : [iconData];

// ---------- 4. Save .svg files ----------
const savedIcons = [];
const skipped = [];

for (const icon of iconList) {
  if (!icon || !icon.name || !icon.data) {
    console.warn(`WARN: skipping icon with missing name/data: ${JSON.stringify(icon?.name || '?')}`);
    continue;
  }

  const fileName = `${toKebabName(icon.name)}.svg`;
  const filePath = join(iconsDir, fileName);

  if (existsSync(filePath) && !force) {
    skipped.push(fileName);
    continue;
  }

  const svgContent = processSvg(icon.data);
  writeFileSync(filePath, svgContent, 'utf8');
  savedIcons.push(fileName);
}

if (skipped.length > 0) {
  console.log(`SKIP: ${skipped.join(', ')} (already exist, use --force to overwrite)`);
}

writeIconsBarrel();

// ---------- 5. Output ----------
console.log('RESULT: OK');
console.log(`ICONS: ${savedIcons.join(',')}`);
console.log(`DIR: ${iconsDir}`);
process.exit(0);