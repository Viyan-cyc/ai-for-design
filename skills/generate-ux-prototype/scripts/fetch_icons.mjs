#!/usr/bin/env node
// fetch_icons.mjs
// Fetches icons from IconPlus API and saves them as .svg files.
// Falls back to bundled Lucide icons when the API is unreachable.
//
// API flow (per icon-api.md):
//   0. Connectivity check  → if unreachable, switch to Lucide fallback
//   1. getConfig    → validate size/style/color against config (warn only)
//   2. getIconInfo  → search icons by keyword, collect URLs + name + category
//   3. getIcon      → fetch SVG content by URL (pass name/category from step 2)
//   4. Save .svg    → raw SVG file into src/assets/icons/
//
// Lucide fallback:
//   Reads bundled lucide-icons.json (~370 icons), matches keywords against
//   icon tags (Chinese→English map included), generates same .svg format.
//
// Usage:
//   node fetch_icons.mjs --dir "{artifact-folder}/{slug}" \
//     --keywords "下载,文件,搜索" \
//     [--base-url "https://octo.hdesign.huawei.com"] \
//     [--size 24] [--style "线性"] [--color "GTS_线性_Gray-10"] \
//     [--topK 25] [--source-id 6] [--category "basic"] [--group-id "132,333"] [--file-type svg] [--force]
//
// Output (agent-parseable):
//   RESULT: OK + ICONS: download.svg,search.svg,...
//   RESULT: FALLBACK | IconPlus API unreachable, using Lucide icons + ICONS: ...
//   RESULT: FAIL | <reason>

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
const topK = parseInt(argValue('--topK') || '25', 10);
const sourceId = parseInt(argValue('--source-id') || '6', 10);
const category = argValue('--category');
const groupId = argValue('--group-id');
const fileType = argValue('--file-type') || 'svg';
const force = argFlag('--force');

if (!dir) fail('Missing --dir <workspace>');
if (!keywords) fail('Missing --keywords "下载,文件,..."');

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

// ic_public_download → public-download
function toKebabName(iconName) {
  let parts = iconName.split('_');
  if (parts[0] === 'ic') parts = parts.slice(1);
  return parts.filter(Boolean).join('-');
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

// ---------- Chinese → English keyword map for Lucide fallback ----------
const ZH_EN_MAP = {
  '下载': 'download', '上传': 'upload', '搜索': 'search', '查找': 'search',
  '新增': 'plus', '添加': 'plus', '创建': 'plus',
  '编辑': 'pencil', '修改': 'pencil', '改': 'edit',
  '删除': 'trash', '移除': 'trash', '清除': 'trash',
  '刷新': 'refresh', '重载': 'refresh',
  '保存': 'save', '复制': 'copy', '粘贴': 'clipboard',
  '退出': 'log-out', '登录': 'log-in', '登出': 'log-out',
  '用户': 'user', '人员': 'users', '账号': 'user',
  '设置': 'settings', '配置': 'settings',
  '文件': 'file', '文件夹': 'folder', '文档': 'file-text',
  '首页': 'home', '主页': 'home',
  '菜单': 'menu', '导航': 'navigation',
  '关闭': 'x', '取消': 'x', '确认': 'check', '确定': 'check',
  '警告': 'alert', '提醒': 'bell', '通知': 'bell', '消息': 'message',
  '邮件': 'mail', '电话': 'phone',
  '日历': 'calendar', '时间': 'clock', '时钟': 'clock',
  '锁定': 'lock', '解锁': 'unlock', '密码': 'key',
  '图表': 'bar-chart', '统计': 'activity', '趋势': 'trending-up',
  '数据库': 'database', '表格': 'table', '列表': 'list',
  '筛选': 'filter', '排序': 'sort', '分类': 'grid',
  '眼睛': 'eye', '查看': 'eye', '可见': 'eye',
  '不可见': 'eye-off', '隐藏': 'eye-off',
  '链接': 'link', '外链': 'external-link',
  '更多': 'more-horizontal', '展开': 'expand', '折叠': 'shrink',
  '全屏': 'maximize', '最大化': 'maximize', '最小化': 'minimize',
  '标签': 'tag', '书签': 'bookmark',
  '星': 'star', '评分': 'star', '心': 'heart', '收藏': 'heart',
  '定位': 'map-pin', '位置': 'map-pin', '地图': 'map',
  '购物': 'shopping-cart', '支付': 'credit-card', '钱包': 'wallet',
  '日': 'sun', '月': 'moon', '云': 'cloud', '风': 'wind',
  '锁': 'lock', '钥匙': 'key', '盾': 'shield', '安全': 'shield-check',
  '电源': 'power', '开关': 'toggle-right',
  '加载': 'loader', '等待': 'loader',
  '左右': 'chevrons-left', '上下': 'chevrons-up',
  '左': 'chevron-left', '右': 'chevron-right', '上': 'chevron-up', '下': 'chevron-down',
  '返回': 'arrow-left', '前进': 'arrow-right',
  '打印': 'printer', '扫描': 'scan',
  '相机': 'camera', '图片': 'image', '照片': 'image',
  '视频': 'video', '音乐': 'music', '音量': 'volume-2',
  '代码': 'code', '终端': 'terminal', '分支': 'git-branch',
  '服务器': 'server', '硬盘': 'hard-drive', '网络': 'network',
  'CPU': 'cpu', '内存': 'memory-stick', '显示器': 'monitor',
  '手机': 'smartphone', '键盘': 'keyboard', '鼠标': 'mouse',
  '建筑': 'building', '工厂': 'factory', '仓库': 'warehouse',
  '卡车': 'truck', '汽车': 'car', '飞机': 'plane',
  '日历选择': 'calendar-check',
  '帮助': 'circle-help', '问题': 'circle-help', '信息': 'info',
  '成功': 'circle-check', '失败': 'circle-x', '错误': 'circle-alert',
  '播放': 'play', '暂停': 'pause', '停止': 'stop',
  '层级': 'layers', '组件': 'component', '拼图': 'puzzle',
  '工作流': 'workflow', '站点': 'sitemap',
  '引号': 'quote', '哈希': 'hash', '百分号': 'percent',
  '美元': 'dollar-sign', '收据': 'receipt', '礼物': 'gift',
  '编辑器': 'pencil', '笔': 'pencil', '画笔': 'paintbrush',
  '调色板': 'palette', '魔法': 'wand-sparkles', '火花': 'sparkles',
};

function translateKeyword(kw) {
  const lower = kw.toLowerCase();
  if (ZH_EN_MAP[kw]) return ZH_EN_MAP[kw];
  if (ZH_EN_MAP[lower]) return ZH_EN_MAP[lower];
  return lower;
}

// ---------- 0. Connectivity check ----------
async function checkConnectivity() {
  try {
    const configUrl = `${API_BASE}/assetRepository/iconPlus/getConfig`;
    await fetchJson(configUrl, PING_TIMEOUT);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ---------- Lucide fallback ----------
function lucideFallback(keywordList) {
  const lucidePath = join(__dirname, 'verify', 'whitelists', 'lucide-icons.json');
  if (!existsSync(lucidePath)) {
    fail(`Lucide fallback data not found: ${lucidePath}`);
  }
  const lucideData = JSON.parse(readFileSync(lucidePath, 'utf8'));
  const allNames = Object.keys(lucideData);

  const matched = new Map();
  for (const kw of keywordList) {
    const enKw = translateKeyword(kw);
    if (lucideData[enKw]) {
      matched.set(enKw, true);
      continue;
    }
    let nameHits = 0;
    for (const name of allNames) {
      if (name === enKw || name.startsWith(enKw + '-') || name.startsWith(enKw)) {
        matched.set(name, true);
        nameHits++;
        if (nameHits >= topK) break;
      }
    }
    if (nameHits > 0) continue;
    let tagHits = 0;
    for (const name of allNames) {
      const tags = lucideData[name].tags || [];
      if (tags.some((t) => t === enKw || t.includes(enKw) || enKw.includes(t))) {
        matched.set(name, true);
        tagHits++;
        if (tagHits >= topK) break;
      }
    }
  }

  const savedIcons = [];
  const skipped = [];

  for (const name of matched.keys()) {
    const fileName = `${name}.svg`;
    const filePath = join(iconsDir, fileName);

    if (existsSync(filePath) && !force) {
      skipped.push(fileName);
      continue;
    }

    const innerSvg = lucideData[name].svg;
    const fullSvg = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${innerSvg}</svg>`;
    writeFileSync(filePath, fullSvg, 'utf8');
    savedIcons.push(fileName);
  }

  if (skipped.length > 0) {
    console.log(`SKIP: ${skipped.join(', ')} (already exist, use --force to overwrite)`);
  }

  console.log('RESULT: FALLBACK | IconPlus API unreachable, using Lucide icons');
  console.log(`ICONS: ${savedIcons.join(',')}`);
  console.log(`DIR: ${iconsDir}`);
  process.exit(0);
}

// ---------- Main: connectivity check ----------
const keywordList = keywords.split(',').map((s) => s.trim()).filter(Boolean);
console.log(`Checking connectivity to ${API_BASE}...`);
const conn = await checkConnectivity();

if (!conn.ok) {
  console.log(`WARN: IconPlus API unreachable at ${API_BASE}, falling back to Lucide icons`);
  lucideFallback(keywordList);
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
  if (groupId) params.set('group_id', groupId);
  const infoUrl = `${API_BASE}/assetRepository/iconPlus/getIconInfo?${params}`;
  console.log(`GET ${infoUrl}`);
  iconInfo = await fetchJson(infoUrl);
} catch (e) {
  fail(`getIconInfo failed: ${e.message}`);
}

const seen = new Set();
const uniqueIcons = [];
for (const group of (Array.isArray(iconInfo) ? iconInfo : [])) {
  for (const icon of (group.icons || [])) {
    if (!icon.url || seen.has(icon.url)) continue;
    seen.add(icon.url);
    uniqueIcons.push({ name: icon.name, url: icon.url, category: icon.category || '' });
  }
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

// ---------- 5. Output ----------
console.log('RESULT: OK');
console.log(`ICONS: ${savedIcons.join(',')}`);
console.log(`DIR: ${iconsDir}`);
process.exit(0);
