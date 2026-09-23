#!/usr/bin/env node
// fetch-icons.mjs
// Scans src/ for @element-plus/icons-vue imports, fetches company icons
// from IconPlus API (getConfig → getIconInfo → getIcon×2), generates
// dual-theme (light/dark) SVG component files + barrel index.js.
//
// Miss flow: icons not found in the API are simply absent from the barrel —
// the moduleCache Proxy in index.gts.html falls back to ElementPlusIconsVue.
//
// Usage:
//   node fetch-icons.mjs --dir "<artifact-folder>/<slug>" [--base-url <url>] [--timeout <ms>]
//
// Output (agent-parseable):
//   RESULT: OK
//   RESOLVED: <n>, MISSED: <m>
//   MISSED_LIST: <comma-separated, omitted if empty>
//   ICONS_DIR: <absolute path>
//   RESULT: FAIL | <reason>

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
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
  console.log('RESULT: FAIL | Usage: node fetch-icons.mjs --dir "<folder with src/>" [--base-url <url>] [--timeout <ms>]');
  process.exit(1);
}

const baseUrl = (getOpt('--base-url') || 'https://octo.hdesign.huawei.com').replace(/\/+$/, '');
const timeoutMs = parseInt(getOpt('--timeout') || '10000', 10);

const root = resolve(dir);
const srcDir = join(root, 'src');
if (!existsSync(srcDir)) {
  console.log(`RESULT: FAIL | src folder not found: ${srcDir}`);
  process.exit(1);
}

// ============================================================
// 1. Import scanning + dedup
// ============================================================

function walkFiles(dirPath, exts, out = []) {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    if (entry.name === 'assets' && dirPath === srcDir) {
      // skip assets/icons (our own output) to avoid self-reference
      const iconsDir = join(dirPath, 'assets', 'icons');
      if (existsSync(iconsDir)) continue;
    }
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) walkFiles(full, exts, out);
    else if (exts.includes(entry.name.slice(entry.name.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

const vueAndJsFiles = walkFiles(srcDir, ['.vue', '.js']);
const iconNames = new Set();
const importRe = /import\s+(?:\{([^}]*)\}\s*from\s*)?['"]@element-plus\/icons-vue['"]/g;
for (const file of vueAndJsFiles) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(importRe)) {
    const names = (m[1] || '')
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/).pop())
      .filter(Boolean);
    names.forEach((n) => iconNames.add(n));
  }
}

const iconList = [...iconNames].sort();

if (iconList.length === 0) {
  console.log('RESULT: OK');
  console.log('RESOLVED: 0, MISSED: 0');
  console.log(`ICONS_DIR: ${resolve(join(srcDir, 'assets', 'icons'))}`);
  process.exit(0);
}

// ============================================================
// 2. Three-step API
// ============================================================

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function apiGetConfig() {
  return fetchWithTimeout(`${baseUrl}/assetRepository/iconPlus/getConfig`, timeoutMs);
}

async function apiGetIconInfo(keywords, topK = 5, sourceId = 6, groupId = '74,77,93') {
  const params = new URLSearchParams({
    keyword: keywords,
    topK: String(topK),
    source_id: String(sourceId),
    group_id: groupId,
  });
  return fetchWithTimeout(`${baseUrl}/assetRepository/iconPlus/getIconInfo?${params}`, timeoutMs);
}

async function apiGetIcon(urls, theme, color, size, style, names, categories, fileType = 'svg') {
  const params = new URLSearchParams({ url: urls, theme, color, size, style, fileType });
  if (names) params.set('name', names);
  if (categories) params.set('category', categories);
  return fetchWithTimeout(`${baseUrl}/assetRepository/iconPlus/getIcon?${params}`, timeoutMs);
}

function selectConfigDefaults(config) {
  const size = config.size?.find((s) => s.key === '24')?.key || config.size?.[0]?.key || '24';
  const styleValue = config.style?.find((s) => s.key === 'border')?.value || config.style?.[0]?.value || '线性';
  const lightColor =
    config.colors?.find((c) => c.style === styleValue)?.id || config.colors?.[0]?.id || '';
  const darkColor =
    config.dark_colors?.find((c) => c.style === styleValue)?.id || config.dark_colors?.[0]?.id || lightColor;
  return { size, style: styleValue, lightColor, darkColor };
}

// ============================================================
// 3. Main flow
// ============================================================

try {
  // Step 1: getConfig
  const config = await apiGetConfig();
  const { size, style, lightColor, darkColor } = selectConfigDefaults(config);

  // Step 2: getIconInfo (batch search all icon names)
  const searchResults = await apiGetIconInfo(iconList.join(','), 5);

  // Match by englishName (case-insensitive), fall back to highest score
  const nameToUrl = new Map(); // EP icon name → company icon url
  const urlToMeta = new Map(); // company icon url → { name, category }

  const resultsArray = Array.isArray(searchResults) ? searchResults : [searchResults];
  for (const group of resultsArray) {
    const keyword = group.keyword;
    const candidates = (group.icons || []).filter((i) => i.url);
    if (candidates.length === 0) continue;
    const exact = candidates.find(
      (i) => i.englishName && i.englishName.toLowerCase() === keyword.toLowerCase(),
    );
    const best =
      exact || [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    if (best && best.url) {
      nameToUrl.set(keyword, best.url);
      if (!urlToMeta.has(best.url)) {
        urlToMeta.set(best.url, { name: best.name || '', category: best.category || '' });
      }
    }
  }

  const hitNames = [...nameToUrl.keys()];
  const missedNames = iconList.filter((n) => !nameToUrl.has(n));

  if (hitNames.length === 0) {
    console.log('RESULT: OK');
    console.log(`RESOLVED: 0, MISSED: ${missedNames.length}`);
    if (missedNames.length) console.log(`MISSED_LIST: ${missedNames.join(', ')}`);
    console.log(`ICONS_DIR: ${resolve(join(srcDir, 'assets', 'icons'))}`);
    process.exit(0);
  }

  // Step 3: getIcon × 2 (light + dark)
  const allUrls = [...urlToMeta.keys()].join(',');
  const allNames = [...urlToMeta.values()].map((m) => m.name).filter(Boolean).join(',');
  const allCategories = [...new Set([...urlToMeta.values()].map((m) => m.category).filter(Boolean))].join(',');
  const urlToLightSvg = new Map();
  const urlToDarkSvg = new Map();

  try {
    const lightRes = await apiGetIcon(allUrls, 'light', lightColor, size, style, allNames, allCategories);
    const lightArr = Array.isArray(lightRes) ? lightRes : [lightRes];
    for (const item of lightArr) {
      if (item.url && item.data) urlToLightSvg.set(item.url, item.data);
    }
  } catch (e) {
    // Light failed — all icons miss
  }

  try {
    const darkRes = await apiGetIcon(allUrls, 'dark', darkColor, size, style, allNames, allCategories);
    const darkArr = Array.isArray(darkRes) ? darkRes : [darkRes];
    for (const item of darkArr) {
      if (item.url && item.data) urlToDarkSvg.set(item.url, item.data);
    }
  } catch (e) {
    // Dark failed — R-5: fall back to light
  }

  // ============================================================
  // 4. Generate component files + barrel
  // ============================================================

  const iconsDir = join(srcDir, 'assets', 'icons');
  mkdirSync(iconsDir, { recursive: true });

  const resolvedNames = [];
  const barrelImports = [];
  const barrelExports = [];

  for (const epName of hitNames) {
    const url = nameToUrl.get(epName);
    const lightSvg = urlToLightSvg.get(url);
    const darkSvg = urlToDarkSvg.get(url) || lightSvg; // R-5: dark miss → reuse light

    if (!lightSvg) continue; // total miss (light failed too) → skip, EP fallback

    resolvedNames.push(epName);

    // Write .light.js
    writeFileSync(
      join(iconsDir, `${epName}.light.js`),
      `import { h } from 'vue'\n\nconst svg = ${JSON.stringify(lightSvg)}\n\nexport default {\n  name: ${JSON.stringify(epName + 'Light')},\n  render() {\n    return h('span', { class: 'ux-icon-light', innerHTML: svg })\n  }\n}\n`,
      'utf8',
    );

    // Write .dark.js
    writeFileSync(
      join(iconsDir, `${epName}.dark.js`),
      `import { h } from 'vue'\n\nconst svg = ${JSON.stringify(darkSvg)}\n\nexport default {\n  name: ${JSON.stringify(epName + 'Dark')},\n  render() {\n    return h('span', { class: 'ux-icon-dark', innerHTML: svg })\n  }\n}\n`,
      'utf8',
    );

    barrelImports.push(`import ${epName}Light from './${epName}.light.js'`);
    barrelImports.push(`import ${epName}Dark from './${epName}.dark.js'`);
    barrelExports.push(
      `export const ${epName} = {\n  name: ${JSON.stringify(epName)},\n  render() {\n    return h('span', { class: 'ux-icon-pair' }, [h(${epName}Light), h(${epName}Dark)])\n  }\n}`,
    );
  }

  // Generate barrel
  const barrelContent = `// AUTO-GENERATED by fetch-icons.mjs — do not edit
// Company icon barrel: exports dual-theme (light/dark) combined components.
// moduleCache Proxy in index.gts.html merges this with ElementPlusIconsVue
// (hit → company SVG, miss → EP original).
import { h } from 'vue'
${barrelImports.join('\n')}

// CSS: light visible by default, dark visible when [data-theme="dark"]
if (typeof document !== 'undefined' && !document.getElementById('ux-icon-pair-style')) {
  var style = document.createElement('style')
  style.id = 'ux-icon-pair-style'
  style.textContent = [
    '.ux-icon-pair .ux-icon-dark { display: none }',
    '[data-theme="dark"] .ux-icon-pair .ux-icon-light { display: none }',
    '[data-theme="dark"] .ux-icon-pair .ux-icon-dark { display: block }'
  ].join('\\n')
  document.head.appendChild(style)
}

${barrelExports.join('\n\n')}
`;

  writeFileSync(join(iconsDir, 'index.js'), barrelContent, 'utf8');

  // Output
  const finalMissed = iconList.filter((n) => !resolvedNames.includes(n));
  console.log('RESULT: OK');
  console.log(`RESOLVED: ${resolvedNames.length}, MISSED: ${finalMissed.length}`);
  if (finalMissed.length) console.log(`MISSED_LIST: ${finalMissed.join(', ')}`);
  console.log(`ICONS_DIR: ${resolve(iconsDir)}`);
  process.exit(0);
} catch (e) {
  console.log(`RESULT: FAIL | ${e.message}`);
  process.exit(1);
}
