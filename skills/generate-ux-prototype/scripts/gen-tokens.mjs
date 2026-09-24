#!/usr/bin/env node
// gen-tokens.mjs — 维护工具：从 design-language 真源（样式Token/设计系统.md）
// 重新生成 default.less 的规则表格段与 design-language.md §1 速查表。
//
// 范围：规则表格（约 90% token）按文档表格解析生成；散文定义的组
// （frost-*、字体栈）是本脚本内嵌的固定模板片段——文档更新这些时改片段。
// bridge.less 保持手写（工程映射，非文档可推导）。
//
// 文档结构漂移时：解析报错即停（REPORT 全部列出，不产出静默结果）。
//
// 用法：
//   node gen-tokens.mjs <设计系统.md 路径> [--check]
//   --check  校验生成结果与磁盘文件一致（CI 用）；有漂移退出码 1
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');

// ---------- args ----------
const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const docArg = args.find((a) => !a.startsWith('--'));
if (!docArg) {
  console.log('RESULT: FAIL | usage: node gen-tokens.mjs <设计系统.md 路径> [--check]');
  process.exit(1);
}
const docPath = resolve(docArg);
let doc;
try {
  doc = readFileSync(docPath, 'utf8');
} catch (e) {
  console.log(`RESULT: FAIL | cannot read doc: ${e.message}`);
  process.exit(1);
}

const problems = [];
function parseError(where, detail) {
  problems.push(`[parse] ${where}: ${detail}`);
}

// ---------- 表格解析 ----------
// 行拆单元格：去首尾 |、去反引号、trim
function cells(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
}
const isRow = (line) => /^\| `/i.test(line.trim());
const DASH_ONLY = /^[-—–]+$/;
const clean = (c) => (!c || DASH_ONLY.test(c.trim()) ? '' : c.trim());

// 取指定小节锚点后第一张表的行。先校验表头包含期望列名（结构漂移即报错）。
function tableAfter(sectionAnchor, expectedCols) {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => l.startsWith(sectionAnchor));
  if (start === -1) {
    parseError(sectionAnchor, 'section header not found');
    return [];
  }
  const hdr = lines.findIndex((l, i) => i > start && /^\|/.test(l.trim()));
  if (hdr === -1) {
    parseError(sectionAnchor, 'no table after section');
    return [];
  }
  const header = cells(lines[hdr]);
  for (const col of expectedCols) {
    if (!header.includes(col)) {
      parseError(sectionAnchor, `table header missing column "${col}" (got: ${header.join(' / ')})`);
      return [];
    }
  }
  const rows = [];
  for (let i = hdr + 2; i < lines.length && isRow(lines[i]); i++) {
    rows.push(cells(lines[i]));
  }
  if (rows.length === 0) parseError(sectionAnchor, 'table has no data rows');
  return rows;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
// "#191919 / 5%" → rgba(...)；纯 hex 原样（小写）。非法则报错并返回 null。
function colorValue(raw, where, name) {
  const v = clean(raw);
  const alpha = v.match(/^#([0-9A-Fa-f]{6})\s*\/\s*(\d+)%$/);
  if (alpha) {
    const r = parseInt(alpha[1].slice(0, 2), 16);
    const g = parseInt(alpha[1].slice(2, 4), 16);
    const b = parseInt(alpha[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${String(parseInt(alpha[2], 10) / 100)})`;
  }
  if (!HEX.test(v)) {
    parseError(where, `row ${name}: unexpected color value "${raw}"`);
    return null;
  }
  return v.toLowerCase();
}

// ---------- 1.2 UI 语义色（统一双主题表：Token｜用途｜Light｜Dark，一节多张子表，按 token 前缀分桶） ----------
const buckets = { brand: [], text: [], icon: [], border: [], bg: [], fill: [], functional: [] };
{
  const lines = doc.split('\n');
  const secStart = lines.findIndex((l) => l.startsWith('### 1.2'));
  if (secStart === -1) {
    parseError('### 1.2', 'section header not found');
  } else {
    const secEnd = lines.findIndex((l, i) => i > secStart && /^### /.test(l));
    const sec = lines.slice(secStart, secEnd > 0 ? secEnd : lines.length);
    for (const line of sec) {
      if (!isRow(line)) continue;
      const [name, use, lightRaw, darkRaw] = cells(line);
      const light = colorValue(lightRaw, '1.2', name);
      if (light === null) continue;
      const dark = colorValue(darkRaw, '1.2', name);
      if (dark === null) continue;
      let b = 'functional';
      if (name.startsWith('color-brand')) b = 'brand';
      else if (name.startsWith('color-text')) b = 'text';
      else if (name.startsWith('color-icon')) b = 'icon';
      else if (name.startsWith('color-border')) b = 'border';
      else if (name.startsWith('color-bg')) b = 'bg';
      else if (/^(color-hover|color-select|color-table|color-fill)/.test(name)) b = 'fill';
      buckets[b].push({ name, use: clean(use), light, dark });
    }
  }
}
const semanticAll = Object.values(buckets).flat();

// ---------- 1.3 基础色板（| 基础 Token | 色值 |） ----------
const palette = tableAfter('### 1.3', ['基础 Token', '色值']).map((r) => {
  const [name, value] = r;
  if (!HEX.test(clean(value))) parseError('1.3 palette', `row ${name}: not a hex value "${value}"`);
  return { name, value: clean(value).toLowerCase() };
});

// ---------- 1.4 公司辅助色（| 检索 Token | 类别／色名 | 色值 |） ----------
const company = tableAfter('### 1.4', ['检索 Token', '色值']).map((r) => {
  const [name, , value] = r;
  if (!HEX.test(clean(value))) parseError('1.4 company', `row ${name}: not a hex value "${value}"`);
  return { name, value: clean(value).toLowerCase() };
});

// ---------- 1.5 图表配色（统一双主题：default 11 色 + accessible 6 色，各表 Token｜用途｜Light｜Dark） ----------
// 两张表行首键均为 color-chart-*；以出现顺序区分 default / accessible。
const chartTables = (() => {
  const lines = doc.split('\n');
  const secStart = lines.findIndex((l) => l.startsWith('### 1.5'));
  if (secStart === -1) {
    parseError('### 1.5', 'section header not found');
    return [];
  }
  const secEnd = lines.findIndex((l, i) => i > secStart && /^### /.test(l));
  const sec = lines.slice(secStart, secEnd > 0 ? secEnd : lines.length);
  const tables = [];
  for (const line of sec) {
    if (!isRow(line)) continue;
    const [name, use, lightRaw, darkRaw] = cells(line);
    if (!/^color-chart-\d+$/.test(name)) continue; // 延展/同色相等散文段落无行首 token 行
    const light = colorValue(lightRaw, '1.5', name);
    if (light === null) continue;
    const dark = colorValue(darkRaw, '1.5', name);
    if (dark === null) continue;
    tables.push({ name, use: clean(use), light, dark });
  }
  if (tables.length !== 17) {
    parseError('1.5 chart', `expected 11 default + 6 accessible rows, got ${tables.length}`);
  }
  return tables;
})();
const chartDefault = chartTables.slice(0, 11);
const chartAccessible = chartTables.slice(11);

// ---------- 1.6 代码配色（| 检索 Token | 语义 | 浅色代码区 | 深色代码区 |） ----------
const code = tableAfter('### 1.6', ['检索 Token', '浅色代码区', '深色代码区']).map((r) => {
  const [name, , light, dark] = r;
  if (!HEX.test(clean(light))) parseError('1.6 code', `row ${name}: bad light value "${light}"`);
  if (!HEX.test(clean(dark))) parseError('1.6 code', `row ${name}: bad dark value "${dark}"`);
  return { name, light: clean(light).toLowerCase(), dark: clean(dark).toLowerCase() };
});

// ---------- 2.2 间距（| Token | 常规 | 紧凑 |，无单位 px 数字） ----------
const spacing = tableAfter('### 2.2', ['Token', '常规', '紧凑']).map((r) => {
  const [name, reg, compact] = r;
  if (!/^\d+$/.test(clean(reg))) parseError('2.2 spacing', `row ${name}: bad regular value "${reg}"`);
  if (!/^\d+$/.test(clean(compact))) parseError('2.2 spacing', `row ${name}: bad compact value "${compact}"`);
  return { name, reg: clean(reg), compact: clean(compact) };
});

// ---------- 3.1 圆角（| Token | 半径 | 适用场景 |） ----------
const radius = tableAfter('### 3.1', ['Token', '半径']).map((r) => {
  const [name, val, scene] = r;
  if (!/^\d+$/.test(clean(val))) parseError('3.1 radius', `row ${name}: bad value "${val}"`);
  return { name, val: `${clean(val)}px`, scene: clean(scene) };
});
// radius-size-infinity 是散文映射（§3.2：既有名称映射到同一 999px 值）
const fullRow = radius.find((t) => t.name === 'radius-size-full');
if (!fullRow) parseError('3.1 radius', 'radius-size-full missing');
const radiusExtra = fullRow ? [{ name: 'radius-size-infinity', val: fullRow.val, scene: '既有名称，映射到同一 999px 值' }] : [];

// ---------- 4.1 边框宽度（| Token | 用途 | 浅色主题 | 深色主题 |，取浅色档） ----------
const borderWidth = tableAfter('### 4.1', ['Token', '浅色主题']).map((r) => {
  const [name, use, light] = r;
  if (!/^\d+px$/.test(clean(light))) parseError('4.1 border-width', `row ${name}: bad light value "${light}"`);
  return { name, use: clean(use), val: clean(light) };
});

// ---------- 4.2 边框线型（| Token | CSS 值 | 形态 |） ----------
const borderStyle = tableAfter('### 4.2', ['Token', 'CSS 值']).map((r) => {
  const [name, val] = r;
  if (!/^(dotted|dashed|solid)$/.test(clean(val))) parseError('4.2 border-style', `row ${name}: bad value "${val}"`);
  return { name, val: clean(val) };
});

// ---------- 5.2 字号与行高（| 字号 Token | 字号 | 行高 Token | 行高 | 文字角色 |） ----------
const fontSizes = tableAfter('### 5.2', ['字号 Token', '行高 Token']).map((r) => {
  const [fs, size, lh, height, role] = r;
  if (!/^\d+$/.test(clean(size))) parseError('5.2 font-size', `row ${fs}: bad size "${size}"`);
  if (!/^\d+$/.test(clean(height))) parseError('5.2 font-size', `row ${fs}: bad line-height "${height}"`);
  return { fs, size: `${clean(size)}px`, lh, height: `${clean(height)}px`, role: clean(role) };
});

// ---------- 5.3 字重（| Token | 字重 | 用途 |） ----------
const fontWeight = tableAfter('### 5.3', ['Token', '字重']).map((r) => {
  const [name, weight, use] = r;
  if (!/^\d+$/.test(clean(weight))) parseError('5.3 font-weight', `row ${name}: bad weight "${weight}"`);
  return { name, weight: clean(weight), use: clean(use) };
});

// ---------- 6.2 阴影（| Token | 层级 | X | Y | 模糊 | 扩展 | Light alpha | Dark alpha |） ----------
// 0 → "0"（CSS 合法长度），其余 → "Npx"；几何两主题相同，仅 alpha 不同
const pxLen = (v) => (clean(v) === '0' ? '0' : `${clean(v)}px`);
const shadows = tableAfter('### 6.2', ['Token', 'X', 'Y', '模糊', '扩展', 'Light alpha', 'Dark alpha']).map((r) => {
  const [name, level, x, y, blur, spread, lightA, darkA] = r;
  for (const [k, v] of Object.entries({ X: x, Y: y, blur, spread })) {
    if (!/^-?\d+$/.test(clean(v))) parseError('6.2 shadow', `row ${name}: bad ${k} "${v}"`);
  }
  if (!/^\d+%$/.test(clean(lightA))) parseError('6.2 shadow', `row ${name}: bad light alpha "${lightA}"`);
  if (!/^\d+%$/.test(clean(darkA))) parseError('6.2 shadow', `row ${name}: bad dark alpha "${darkA}"`);
  const la = String(parseInt(clean(lightA), 10) / 100);
  const da = String(parseInt(clean(darkA), 10) / 100);
  return {
    name,
    level: clean(level),
    val: `${pxLen(x)} ${pxLen(y)} ${pxLen(blur)} ${pxLen(spread)} rgba(0, 0, 0, ${la})`,
    darkVal: `${pxLen(x)} ${pxLen(y)} ${pxLen(blur)} ${pxLen(spread)} rgba(0, 0, 0, ${da})`,
  };
});

// ---------- 解析问题即停（不产出静默结果） ----------
if (problems.length) {
  console.log(`RESULT: FAIL | ${problems.length} parse problem(s) — doc structure drifted?`);
  for (const p of problems) console.log(`  ${p}`);
  console.log('HINT: 设计系统.md 表格结构变化 —— 先适配本解析器再重跑；不要手改生成产物');
  process.exit(1);
}

// ---------- 内嵌模板片段（散文定义的组；文档更新时改这里） ----------
const FONT_STACKS = [
  "  --font-family-zh: 'Microsoft YaHei', 'PingFang SC', 'Source Han Sans CN', 'HarmonyOS Sans', sans-serif;",
  "  --font-family-en: 'HarmonyOS Sans', Arial, 'Helvetica Neue', Roboto, sans-serif;",
  "  --font-family-numeric: Roboto, 'HarmonyOS Sans', Arial, sans-serif;",
  "  --font-family: Arial, 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans', sans-serif;",
].join('\n');

// 毛玻璃材质（§7 正式参数；中性色=gray-90 通道，染色/氛围/边界取公司色板端点）
const FROST_LIGHT = [
  '  --frost-blur-control: 12px;',
  '  --frost-blur-card: 20px;',
  '  --frost-blur-overlay: 28px;',
  '  --frost-saturate-neutral: 100%;',
  '  --frost-saturate-muted: 95%;',
  '  --frost-surface-control: rgba(255, 255, 255, 0.68);',
  '  --frost-surface-card: rgba(255, 255, 255, 0.76);',
  '  --frost-surface-overlay: rgba(255, 255, 255, 0.84);',
  '  --frost-surface-solid: #ffffff;',
  '  --frost-hover-add: 0.04;   /* hover 填充增量 */',
  '  --frost-active-add: 0.08;  /* active 填充增量 */',
  '  --frost-transition: 120ms ease-out;',
  '  --frost-border-color: rgba(89, 89, 89, 0.14);',
  '  --frost-shadow-control: 0 2px 6px rgba(0, 0, 0, 0.04);',
  '  --frost-shadow-card: 0 6px 18px rgba(0, 0, 0, 0.06);',
  '  --frost-shadow-overlay: 0 10px 28px rgba(0, 0, 0, 0.10);',
  '  --frost-backdrop-base: #f3f3f3;',
  '  --frost-backdrop-blue: rgba(138, 190, 243, 0.28);',
  '  --frost-backdrop-lavender: rgba(191, 185, 250, 0.18);',
  '  --frost-backdrop-teal: rgba(143, 229, 194, 0.10);',
  '  --frost-tint-blue: rgba(92, 162, 233, 0.08);',
  '  --frost-tint-lavender: rgba(168, 159, 249, 0.06);',
  '  --frost-tint-teal: rgba(99, 213, 168, 0.05);',
].join('\n');
const FROST_DARK = [
  '  --frost-blur-control: 12px;',
  '  --frost-blur-card: 20px;',
  '  --frost-blur-overlay: 28px;',
  '  --frost-saturate-neutral: 100%;',
  '  --frost-saturate-muted: 95%;',
  '  --frost-surface-control: rgba(25, 25, 25, 0.64);',
  '  --frost-surface-card: rgba(25, 25, 25, 0.72);',
  '  --frost-surface-overlay: rgba(25, 25, 25, 0.80);',
  '  --frost-surface-solid: #2a2a2a;',
  '  --frost-hover-add: 0.04;   /* hover 填充增量 */',
  '  --frost-active-add: 0.08;  /* active 填充增量 */',
  '  --frost-transition: 120ms ease-out;',
  '  --frost-border-color: rgba(255, 255, 255, 0.14);',
  '  --frost-shadow-control: 0 2px 6px rgba(0, 0, 0, 0.12);',
  '  --frost-shadow-card: 0 6px 18px rgba(0, 0, 0, 0.18);',
  '  --frost-shadow-overlay: 0 10px 28px rgba(0, 0, 0, 0.24);',
  '  --frost-backdrop-base: #191919;',
  '  --frost-backdrop-blue: rgba(138, 190, 243, 0.16);',
  '  --frost-backdrop-lavender: rgba(191, 185, 250, 0.10);',
  '  --frost-backdrop-teal: rgba(143, 229, 194, 0.06);',
  '  --frost-tint-blue: rgba(92, 162, 233, 0.10);',
  '  --frost-tint-lavender: rgba(168, 159, 249, 0.08);',
  '  --frost-tint-teal: rgba(99, 213, 168, 0.07);',
].join('\n');

// ---------- 对齐辅助：声明列对齐，注释跟进 ----------
function emitEntries(entries) {
  const w = Math.max(...entries.map((e) => e.decl.length));
  return entries.map((e) => (e.comment ? `${e.decl.padEnd(w)}  /* ${e.comment} */` : e.decl));
}

// ---------- 组装 default.less ----------
const out = [];
out.push(`/* ============================================================
   皮肤：default（默认亮色皮肤）
   ============================================================
   本文件由 scripts/gen-tokens.mjs 从 design-language（样式Token/设计系统.md）
   生成；frost-* 与字体栈为脚本内嵌模板片段。手工修改会被下次生成覆盖——
   改值请改设计文档后重跑生成器，或改生成器内的模板片段。
   - 浅色真值：§1.2 统一表 Light 列。
   - 换肤协议见同目录 README.md：作用域 html[data-theme="<皮肤名>"]，
     运行时切换 document.documentElement.setAttribute("data-theme", ...)。
   ============================================================ */
`);
out.push('html[data-theme="default"] {');

// 语义色（文档顺序分桶，Light 列）
const semComment = {
  brand: '1.2 高亮色（品牌色）',
  text: '1.2 文本与链接',
  icon: '1.2 图标色',
  border: '1.2 边框色',
  bg: '1.2 背景色',
  fill: '1.2 填充与表格',
  functional: '1.2 功能色',
};
for (const b of ['brand', 'text', 'icon', 'border', 'bg', 'fill', 'functional']) {
  if (!buckets[b].length) continue;
  out.push('');
  out.push(`  /* ======== ${semComment[b]} ======== */`);
  out.push(...emitEntries(buckets[b].map((t) => ({
    decl: `  --${t.name}: ${t.light};`,
    comment: t.use,
  }))));
}

// 色板：每行 5 个
out.push('');
out.push('  /* ======== 1.3 基础色板（rose/red/orange/yellow/green/mint/cyan/blue/indigo/purple/pink/brand × 05–90 + gray） ======== */');
for (let i = 0; i < palette.length; i += 5) {
  out.push('  ' + palette.slice(i, i + 5).map((t) => `--${t.name}: ${t.value};`).join(' '));
}

// 公司辅助色：每行 3 个
out.push('');
out.push('  /* ======== 1.4 公司辅助色（仅公司视觉识别；数字 UI 优先用语义 Token） ======== */');
for (let i = 0; i < company.length; i += 3) {
  out.push('  ' + company.slice(i, i + 3).map((t) => `--${t.name}: ${t.value};`).join(' '));
}

// 图表色：default 11 色 + accessible 6 色（Light 列）
out.push('');
out.push('  /* ======== 1.5 图表配色（default 11 色序列 + accessible 6 色序列） ======== */');
out.push(...emitEntries(chartDefault.map((t) => ({
  decl: `  --${t.name}: ${t.light};`,
  comment: t.use,
}))));
out.push(...emitEntries(chartAccessible.map((t) => ({
  decl: `  --${t.name}-accessible: ${t.light};`,
  comment: t.use,
}))));

// 代码配色：浅色 + 深色变体，每行 3 个
out.push('');
out.push('  /* ======== 1.6 代码配色（浅色值为主，深色代码区变体单列） ======== */');
for (const arr of [code.map((t) => `--${t.name}: ${t.light};`), code.map((t) => `--${t.name}-dark: ${t.dark};`)]) {
  for (let i = 0; i < arr.length; i += 3) out.push('  ' + arr.slice(i, i + 3).join(' '));
}

// 间距：每行 4 个
out.push('');
out.push('  /* ======== 2.2 间距（常规档；紧凑档见文件末尾 [data-density="compact"] 覆盖块） ======== */');
for (let i = 0; i < spacing.length; i += 4) {
  out.push('  ' + spacing.slice(i, i + 4).map((t) => `--${t.name}: ${t.reg}px;`).join(' '));
}

// 圆角
out.push('');
out.push('  /* ======== 3.1 圆角 ======== */');
out.push(...emitEntries([...radius, ...radiusExtra].map((t) => ({
  decl: `  --${t.name}: ${t.val};`,
  comment: t.scene,
}))));

// 边框
out.push('');
out.push('  /* ======== 4. 边框 ======== */');
out.push(...emitEntries(borderWidth.map((t) => ({ decl: `  --${t.name}: ${t.val};`, comment: t.use }))));
for (const t of borderStyle) out.push(`  --${t.name}: ${t.val};`);

// 字体栈（模板片段）
out.push('');
out.push('  /* ======== 5.1 字体 ======== */');
out.push(FONT_STACKS);

// 字号/行高成对
out.push('');
out.push('  /* ======== 5.2 字号与行高（成对使用，px） ======== */');
out.push(...emitEntries(fontSizes.map((t) => ({
  decl: `  --${t.fs}: ${t.size};  --${t.lh}: ${t.height};`,
  comment: t.role,
}))));

// 字重
out.push('');
out.push('  /* ======== 5.3 字重（400/600；使用字体自身字重，不用仿粗体） ======== */');
out.push(...emitEntries(fontWeight.map((t) => ({ decl: `  --${t.name}: ${t.weight};`, comment: t.use }))));

// 阴影
out.push('');
out.push('  /* ======== 6.2 阴影（外阴影，颜色 gray-100；X Y 模糊 扩展 rgba） ======== */');
out.push(...emitEntries(shadows.map((t) => ({ decl: `  --${t.name}: ${t.val};`, comment: t.level }))));

// 毛玻璃（模板片段）
out.push('');
out.push('  /* ======== 7.2 毛玻璃材质（正式参数，仅材质扩展场景成套取用） ======== */');
out.push(FROST_LIGHT);

out.push('}');
out.push('');
out.push('/* ======== 2.2 间距紧凑档（同一 Token 统一控制，按映射表取值，不按比例缩放） ======== */');
out.push('html[data-theme="default"][data-density="compact"] {');
for (let i = 0; i < spacing.length; i += 4) {
  out.push('  ' + spacing.slice(i, i + 4).map((t) => `--${t.name}: ${t.compact}px;`).join(' '));
}
out.push('}');
out.push('');
const cssOut = out.join('\n');

// ---------- token 计数（按产出统计，报告用） ----------
const frostCount = (FROST_LIGHT.match(/--[\w-]+\s*:/g) || []).length;
const counts = {
  semanticLight: semanticAll.length,
  semanticDark: semanticAll.length,
  palette: palette.length,
  company: company.length,
  chartLight: chartDefault.length + chartAccessible.length,
  chartDark: chartDefault.length + chartAccessible.length,
  code: code.length * 2,
  spacing: spacing.length * 2,
  radius: radius.length + radiusExtra.length,
  border: borderWidth.length + borderStyle.length,
  fontStacks: (FONT_STACKS.match(/--[\w-]+\s*:/g) || []).length,
  fontSize: fontSizes.length * 2,
  fontWeight: fontWeight.length,
  shadowLight: shadows.length,
  shadowDark: shadows.length,
  frostLight: frostCount,
  frostDark: frostCount,
};
const totalTokens = counts.semanticLight + counts.palette + counts.company + counts.chartLight
  + counts.code + counts.spacing + counts.radius + counts.border + counts.fontStacks
  + counts.fontSize + counts.fontWeight + counts.shadowLight + counts.frostLight;

// ---------- design-language.md §1 速查表（GEN 标记之间整体重写） ----------
const GEN_START = '<!-- GEN:TOKEN-TABLE START (由 scripts/gen-tokens.mjs 生成，勿手改) -->';
const GEN_END = '<!-- GEN:TOKEN-TABLE END -->';
const pick = (arr, name, key = 'name') => arr.find((t) => t[key] === name);
// 324 口径随统一表演进：default.less 声明数 − 紧凑档覆盖（同名 token 二次赋值）
const uniqueTokens = totalTokens - spacing.length;
const genTable = [
  GEN_START,
  '',
  `token 全量定义在皮肤文件 \`src/assets/themes/default.less\`（${uniqueTokens} 个自定义属性，由 \`scripts/gen-tokens.mjs\` 从设计文档生成），命名即 design-language 规范名，无前缀：`,
  '',
  '| 类别 | token 形态 | 示例 |',
  '| --- | --- | --- |',
  `| 品牌色 | \`--color-brand(-hover/-active/...)\` | \`--color-brand: ${pick(buckets.brand, 'color-brand')?.light}\` |`,
  `| 文本色 | \`--color-text-*\`、\`--color-link-*\` | \`--color-text-primary: ${pick(buckets.text, 'color-text-primary')?.light}\` |`,
  '| 图标色 | `--color-icon-*` | `--color-icon-secondary: #777777` |',
  '| 边框色 | `--color-border(-hover/-focus/...)` | `--color-border: #c9c9c9`（gray-20） |',
  '| 背景色 | `--color-bg-1..6`、`--color-bg-mask` | `--color-bg-1: #f3f3f3`（页面背景） |',
  '| 填充色 | `--color-hover/-select/-fill*` | `--color-select: #e6f2fd`（brand-05） |',
  '| 功能色 | `--color-error/-alert/-warning/-success/-info*/-none(+*-subtle/-subtler)` | `--color-success: #09aa71` |',
  '| 基础色板 | `--{rose|red|orange|yellow|green|mint|cyan|blue|indigo|purple|pink|brand|gray}-{05..90}` | `--brand-50` |',
  '| 图表色 | `--color-chart-1..11(+accessible)` | `--color-chart-1: #2070f3` |',
  `| 间距 | \`--space-size-4..80\`（紧凑档 \`data-density="compact"\` 覆盖） | \`--space-size-16: ${pick(spacing, 'space-size-16')?.reg}px\` |`,
  '| 圆角 | `--radius-size-{small|normal|medium|big|big1|big2|full}` | `--radius-size-normal: 4px` |',
  '| 边框宽/线型 | `--border-width-{none|normal|medium|independent}`、`--border-style-*` | `--border-width-medium: 2px` |',
  "| 字体 | `--font-family(-zh/-en/-numeric)` | 'HarmonyOS Sans', 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif |",
  `| 字号/行高 | \`--font-size-*\` + \`--font-line-height-*\` 成对 | \`--font-size-normal: ${pick(fontSizes, 'font-size-normal', 'fs')?.size}\` + \`${pick(fontSizes, 'font-size-normal', 'fs')?.height}\` |`,
  `| 字重 | \`--font-weight-{light|normal|bold}\` = ${fontWeight.map((t) => t.weight).join('/')} | 标题 600 |`,
  `| 投影 | \`--shadow-1..6\`（含方向变体） | \`--shadow-1: ${pick(shadows, 'shadow-1')?.val}\` |`,
  '| 毛玻璃 | `--frost-*` | 材质扩展场景成套取用 |',
  '',
  GEN_END,
].join('\n');

// ---------- 组装 dark.less ----------
// 全量皮肤：data-theme="dark" 时 default.less 全部定义失效，深色皮肤必须提供
// default.less 的全部 token。非颜色组（间距/圆角/边框/字体/字号/字重）与 default
// 同值原样复制；颜色真值全部来自 §1.2 统一表 Dark 列（浅色变更与深色正式值同表维护）。
// 图表色：default 11 色 + accessible 6 色均取 Dark 列；阴影取 Dark alpha；frost 为深色材质。
const darkCss = [];
darkCss.push(`/* ============================================================
   皮肤：dark（深色皮肤）
   ============================================================
   本文件由 scripts/gen-tokens.mjs 从 design-language（样式Token/设计系统.md）
   生成；手工修改会被下次生成覆盖——改值请改设计文档后重跑生成器。
   - 颜色真值：§1.2 统一表 Dark 列（与 Light 列同表成对维护）。
   - 深色阴影取 §6.2 Dark alpha；frost 材质为 §7 深色正式参数。
   ============================================================ */
`);
darkCss.push('html[data-theme="dark"] {');
darkCss.push('');
darkCss.push('  /* ======== 1.2 深色语义色（统一表 Dark 列，按文档分组） ======== */');
for (const b of ['brand', 'text', 'icon', 'border', 'bg', 'fill', 'functional']) {
  if (!buckets[b].length) continue;
  darkCss.push(`  /* ======== ${semComment[b]} ======== */`);
  darkCss.push(...emitEntries(buckets[b].map((t) => ({
    decl: `  --${t.name}: ${t.dark};`,
    comment: t.use,
  }))));
}
darkCss.push('');
darkCss.push('  /* ======== 1.5 深色图表序列（default 11 色 + accessible 6 色，统一表 Dark 列） ======== */');
darkCss.push(...emitEntries(chartDefault.map((t) => ({
  decl: `  --${t.name}: ${t.dark};`,
  comment: t.use,
}))));
darkCss.push(...emitEntries(chartAccessible.map((t) => ({
  decl: `  --${t.name}-accessible: ${t.dark};`,
  comment: t.use,
}))));

// 非颜色组与 default 完全同值（data-theme 切换后 default.less 失效，深色皮肤必须全量提供；
// 深色阴影/frost 材质设计师未给，沿用浅色值并已在文件头声明）。
darkCss.push('');
darkCss.push('  /* ======== 1.3 基础色板 / 1.4 公司辅助色（主题无关，同 default） ======== */');
for (let i = 0; i < palette.length; i += 5) {
  darkCss.push('  ' + palette.slice(i, i + 5).map((t) => `--${t.name}: ${t.value};`).join(' '));
}
for (let i = 0; i < company.length; i += 3) {
  darkCss.push('  ' + company.slice(i, i + 3).map((t) => `--${t.name}: ${t.value};`).join(' '));
}
darkCss.push('');
darkCss.push('  /* ======== 1.6 代码配色（浅色为主 + 深色代码区变体，同 default） ======== */');
for (const arr of [code.map((t) => `--${t.name}: ${t.light};`), code.map((t) => `--${t.name}-dark: ${t.dark};`)]) {
  for (let i = 0; i < arr.length; i += 3) darkCss.push('  ' + arr.slice(i, i + 3).join(' '));
}
darkCss.push('');
darkCss.push('  /* ======== 2.2 间距（常规档；紧凑档见文件末尾覆盖块，同 default） ======== */');
for (let i = 0; i < spacing.length; i += 4) {
  darkCss.push('  ' + spacing.slice(i, i + 4).map((t) => `--${t.name}: ${t.reg}px;`).join(' '));
}
darkCss.push('');
darkCss.push('  /* ======== 3.1 圆角 / 4. 边框（同 default） ======== */');
darkCss.push(...emitEntries([...radius, ...radiusExtra].map((t) => ({
  decl: `  --${t.name}: ${t.val};`,
  comment: t.scene,
}))));
darkCss.push(...emitEntries(borderWidth.map((t) => ({ decl: `  --${t.name}: ${t.val};`, comment: t.use }))));
for (const t of borderStyle) darkCss.push(`  --${t.name}: ${t.val};`);
darkCss.push('');
darkCss.push('  /* ======== 5. 字体（同 default） ======== */');
darkCss.push(FONT_STACKS);
darkCss.push('');
darkCss.push('  /* ======== 5.2 字号与行高（同 default） ======== */');
darkCss.push(...emitEntries(fontSizes.map((t) => ({
  decl: `  --${t.fs}: ${t.size};  --${t.lh}: ${t.height};`,
  comment: t.role,
}))));
darkCss.push('');
darkCss.push('  /* ======== 5.3 字重（同 default） ======== */');
darkCss.push(...emitEntries(fontWeight.map((t) => ({ decl: `  --${t.name}: ${t.weight};`, comment: t.use }))));
darkCss.push('');
darkCss.push('  /* ======== 6.2 阴影（同几何，Dark alpha） ======== */');
darkCss.push(...emitEntries(shadows.map((t) => ({ decl: `  --${t.name}: ${t.darkVal};`, comment: t.level }))));
darkCss.push('');
darkCss.push('  /* ======== 7.2 毛玻璃材质（深色正式参数） ======== */');
darkCss.push(FROST_DARK);
darkCss.push('');
darkCss.push('  /* ======== 深色混色基底（桥接层 light-N 色阶 color-mix 派生底色；统一表 bg-2 Dark 容器表面色） ======== */');
darkCss.push('  --ux-mix-base: #191919;');
darkCss.push('}');
darkCss.push('');
darkCss.push('/* ======== 2.2 间距紧凑档（同 default） ======== */');
darkCss.push('html[data-theme="dark"][data-density="compact"] {');
for (let i = 0; i < spacing.length; i += 4) {
  darkCss.push('  ' + spacing.slice(i, i + 4).map((t) => `--${t.name}: ${t.compact}px;`).join(' '));
}
darkCss.push('}');
darkCss.push('');
const darkCssOut = darkCss.join('\n');

// 深色皮肤完整性：bridge/base 消费的关键键必须存在（缺即生成失败，fail-fast）；
// 统一表 Dark 列与 Light 列同集合来源（同一批行解析出 light/dark 两值），全量性天然成立
const darkDefined = new Set(semanticAll.map((r) => `--${r.name}`));
const DARK_REQUIRED = [
  '--color-brand', '--color-text-primary', '--color-bg-1', '--color-bg-4', '--color-bg-mask',
  '--color-border', '--color-border-hover', '--color-border-focus', '--color-border-separator',
  '--color-error', '--color-error-subtle', '--color-warning', '--color-warning-subtle',
  '--color-success', '--color-success-subtle', '--color-info', '--color-info-subtle',
  '--color-hover', '--color-select', '--color-table-header', '--color-table-zebra',
  '--color-fill', '--color-fill-subtle', '--color-fill-disabled', '--color-fill-disabled-subtle',
];
const darkMissing = DARK_REQUIRED.filter((k) => !darkDefined.has(k));
if (darkMissing.length) {
  console.log(`RESULT: FAIL | dark.less incomplete, missing required tokens: ${darkMissing.join(', ')}`);
  process.exit(1);
}

// ---------- 写盘 / 校验 ----------
const cssPath = join(SKILL_DIR, 'scripts', 'preview', 'src', 'assets', 'themes', 'default.less');
const darkPath = join(SKILL_DIR, 'scripts', 'preview', 'src', 'assets', 'themes', 'dark.less');
const refPath = join(SKILL_DIR, 'references', 'design-language.md');

function applyToRef(refCur) {
  const start = refCur.indexOf(GEN_START);
  const end = refCur.indexOf(GEN_END);
  if (start === -1 || end === -1 || end < start) return null;
  return refCur.slice(0, start) + genTable + refCur.slice(end + GEN_END.length);
}

if (checkMode) {
  const cssCur = readFileSync(cssPath, 'utf8');
  const refCur = readFileSync(refPath, 'utf8');
  const refNext = applyToRef(refCur);
  if (refNext === null) {
    console.log('RESULT: FAIL | design-language.md missing GEN:TOKEN-TABLE markers');
    process.exit(1);
  }
  const darkCur = readFileSync(darkPath, 'utf8');
  const cssOk = cssCur === cssOut;
  const refOk = refCur === refNext;
  const darkOk = darkCur === darkCssOut;
  if (cssOk && refOk && darkOk) {
    console.log('RESULT: OK | --check: generated output matches on-disk files');
    console.log(`TOKENS: ${totalTokens}`);
    process.exit(0);
  }
  console.log('RESULT: FAIL | --check drift detected:');
  if (!cssOk) console.log('  default.less differs from generated output');
  if (!refOk) console.log('  design-language.md §1 differs from generated output');
  if (!darkOk) console.log('  dark.less differs from generated output');
  console.log('HINT: 去掉 --check 重跑生成器，再审查 diff');
  process.exit(1);
}

writeFileSync(cssPath, cssOut, 'utf8');
writeFileSync(darkPath, darkCssOut, 'utf8');
const refCur = readFileSync(refPath, 'utf8');
const refNext = applyToRef(refCur);
if (refNext === null) {
  console.log('RESULT: FAIL | design-language.md missing GEN:TOKEN-TABLE markers');
  console.log('HINT: 在 §1 速查表两侧加上 GEN:TOKEN-TABLE START/END 标记后重跑');
  process.exit(1);
}
writeFileSync(refPath, refNext, 'utf8');

console.log('RESULT: OK');
console.log(`TOKENS: ${totalTokens} (semantic: ${semanticAll.length}, palette: ${palette.length}, company: ${company.length}, chart: ${chartDefault.length + chartAccessible.length}×2, code: ${code.length * 2}, shadow: ${shadows.length}×2, frost: ${frostCount}×2)`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
console.log(`OUT_CSS: ${cssPath}`);
console.log(`OUT_DARK: ${darkPath}`);
console.log(`OUT_REF: ${refPath}`);
