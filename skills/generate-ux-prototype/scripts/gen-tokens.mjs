#!/usr/bin/env node
// gen-tokens.mjs — 维护工具：从 design-language 真源（样式Token/设计系统.md）
// 重新生成 default.css 的规则表格段与 design-language.md §1 速查表。
//
// 范围：规则表格（约 90% token）按文档表格解析生成；散文定义的组
// （frost-*、字体栈）是本脚本内嵌的固定模板片段——文档更新这些时改片段。
// bridge.css 保持手写（工程映射，非文档可推导）。
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

// ---------- 1.2 UI 语义色（一节多张子表，按 token 前缀分桶） ----------
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
      const [name, use, base, value] = cells(line);
      // 待确认行（如 color-bg-6）先摘出，不进颜色校验
      if (/待确认/.test(base) || /待确认/.test(value)) {
        buckets.bg.push({ name, use: clean(use), base: clean(base), value: 'PENDING' });
        continue;
      }
      const v = colorValue(value, '1.2', name);
      if (v === null) continue;
      let b = 'functional';
      if (name.startsWith('color-brand')) b = 'brand';
      else if (name.startsWith('color-text')) b = 'text';
      else if (name.startsWith('color-icon')) b = 'icon';
      else if (name.startsWith('color-border')) b = 'border';
      else if (name.startsWith('color-bg')) b = 'bg';
      else if (/^(color-hover|color-select|color-table|color-fill)/.test(name)) b = 'fill';
      buckets[b].push({ name, use: clean(use), base: clean(base), value: v });
    }
  }
}
// color-bg-6 文档标注待确认 —— 不产出（引用即构建失败），有注释说明
const pending = [...buckets.bg].filter((t) => /待确认/.test(t.value) || /待确认/.test(t.base));
if (pending.length) {
  console.log(`NOTE: skipped pending tokens (doc says 待确认, correct to omit): ${pending.map((t) => t.name).join(', ')}`);
}
for (const b of Object.keys(buckets)) {
  buckets[b] = buckets[b].filter((t) => !/待确认/.test(t.value) && !/待确认/.test(t.base));
}

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

// ---------- 1.5 图表配色（| Token | 默认基础色 | 默认值 | 无障碍基础色 | 无障碍值 |） ----------
const chart = tableAfter('### 1.5', ['Token', '默认值', '无障碍值']).map((r) => {
  const [name, b1, v1, b2, v2] = r;
  if (!HEX.test(clean(v1))) parseError('1.5 chart', `row ${name}: bad default value "${v1}"`);
  if (!HEX.test(clean(v2))) parseError('1.5 chart', `row ${name}: bad accessible value "${v2}"`);
  return { name, base1: clean(b1), v1: clean(v1).toLowerCase(), base2: clean(b2), v2: clean(v2).toLowerCase() };
});

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

// ---------- 6.2 阴影（| Token | 层级 | X | Y | 模糊 | 扩展 | 默认不透明度 |） ----------
// 0 → "0"（CSS 合法长度），其余 → "Npx"；与旧手写版格式一致，diff 为零
const pxLen = (v) => (clean(v) === '0' ? '0' : `${clean(v)}px`);
const shadows = tableAfter('### 6.2', ['Token', 'X', 'Y', '模糊', '扩展', '默认不透明度']).map((r) => {
  const [name, level, x, y, blur, spread, alpha] = r;
  for (const [k, v] of Object.entries({ X: x, Y: y, blur, spread })) {
    if (!/^-?\d+$/.test(clean(v))) parseError('6.2 shadow', `row ${name}: bad ${k} "${v}"`);
  }
  if (!/^\d+%$/.test(clean(alpha))) parseError('6.2 shadow', `row ${name}: bad alpha "${alpha}"`);
  const a = String(parseInt(clean(alpha), 10) / 100);
  return { name, level: clean(level), val: `${pxLen(x)} ${pxLen(y)} ${pxLen(blur)} ${pxLen(spread)} rgba(0, 0, 0, ${a})` };
});

// ---------- 1.2D 深色参数（五列表：设计参数 | 描述 | Light现行 | Light参考 | Dark现行） ----------
// 只取 Dark 列；Light 两列仅供对照，不替换浅色真值（§1.2）。Dark 缺值的行跳过并记录。
const DARK_SECTION_ANCHOR = '<a id="dark-colors"></a>';
function parseDarkSection() {
  const lines = doc.split('\n');
  const anchor = lines.findIndex((l) => l.includes(DARK_SECTION_ANCHOR));
  if (anchor === -1) {
    parseError('1.2D dark', 'section anchor not found');
    return [];
  }
  // 节起点 = 紧随锚点的 "### 1.2D" 标题；节结束 = 其后的下一个 "### "（§1.3）
  let start = -1;
  for (let i = anchor; i < lines.length; i++) {
    if (/^### /.test(lines[i])) { start = i; break; }
  }
  if (start === -1) {
    parseError('1.2D dark', 'section heading not found after anchor');
    return [];
  }
  let secEnd = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^### /.test(lines[i])) { secEnd = i; break; }
  }
  const rows = [];
  let skipped = [];
  let currentGroup = '';
  for (let i = start; i < secEnd; i++) {
    const line = lines[i];
    if (/^#### /.test(line)) currentGroup = line.replace(/^#### /, '').trim();
    if (!isRow(line)) continue;
    const c = cells(line);
    if (c.length < 5) continue; // 字段定义表等非数据表
    const [name, use, , , darkRaw] = c;
    if (!name.startsWith('color-')) continue;
    if (currentGroup.includes('原图命名异常')) continue; // 异常记录行不生成正式 token
    // Dark 列形态：`#HEX`（`色阶标注`）或 `#HEX / N%`（…）。文档规定以 HEX+alpha 为准，
    // 色阶标注仅作来源记录 —— 提取行首 HEX/alpha，忽略标注；无 HEX 即缺值行，跳过。
    const m = darkRaw.match(/^(#[0-9A-Fa-f]{6}(?:\s*\/\s*\d+%)?)/);
    if (!m) {
      skipped.push(`${name} (${currentGroup}): "${darkRaw}"`);
      continue;
    }
    const v = colorValue(m[1], '1.2D', name);
    if (v === null) continue;
    rows.push({ name: name.trim(), use: clean(use), group: currentGroup, value: v });
  }
  return rows.map((r) => ({ ...r, skipped }));
}
const darkRows = parseDarkSection();
const darkSkippedList = [...new Set(darkRows.flatMap((r) => r.skipped))];
const darkSkippedCount = darkSkippedList.length;

// 深色下 §1.2D 未覆盖、但桥接层/页面无兜底消费的键 —— 工程回填（出处注释标明取值理由；
// 设计师在真值源正式补齐后从本表删除）。色板与 §1.2D 已给键不得出现在这里。
const DARK_BACKFILL = [
  { name: 'color-info', value: '#2070f3', why: '§1.2D 信息色组改用 color-info-primary 命名；浅色既有键 color-info 无同名 Dark 行，按浅色 blue-50 保持（信息强调色双主题同值）' },
  { name: 'color-info-subtle', value: '#1f55b5', why: '浅色既有键无同名 Dark 行；取 §1.2D color-info-primary-subtle Dark（blue-60）为深色弱背景' },
  { name: 'color-hover', value: 'rgba(255, 255, 255, 0.06)', why: '浅色 gray-90/5% 的深色镜像（白 6%）' },
  { name: 'color-select', value: 'rgba(46, 134, 222, 0.20)', why: '选中填充；取 brand-hover(#2E86DE) 20% 透明叠加' },
  { name: 'color-table-header', value: 'rgba(255, 255, 255, 0.06)', why: '表头背景，与 color-hover 同基' },
  { name: 'color-table-zebra', value: 'rgba(255, 255, 255, 0.03)', why: '斑马纹，浅色 gray-40/5% 的深色镜像' },
  { name: 'color-fill', value: 'rgba(255, 255, 255, 0.06)', why: '默认填充，与 color-hover 同基' },
  { name: 'color-fill-subtle', value: '#2a2a2a', why: '输入框底色；取 bg-3 dark（#2A2A2A）' },
  { name: 'color-fill-disabled', value: '#393939', why: '禁用填充；取 bg-4 dark（#393939）' },
  { name: 'color-fill-disabled-subtle', value: 'rgba(255, 255, 255, 0.06)', why: '含描边禁用填充，与 color-hover 同基' },
];

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

const FROST = [
  '  --frost-blur-control: 12px;',
  '  --frost-blur-card: 20px;',
  '  --frost-blur-overlay: 28px;',
  '  --frost-saturate-neutral: 100%;',
  '  --frost-saturate-muted: 95%;',
  '  --frost-surface-control: rgba(255, 255, 255, 0.68); /* light；dark α=.64 */',
  '  --frost-surface-card: rgba(255, 255, 255, 0.76);    /* light；dark α=.72 */',
  '  --frost-surface-overlay: rgba(255, 255, 255, 0.84); /* light；dark α=.80 */',
  '  --frost-surface-solid: #f7f9fc;                     /* 回退不透明表面（dark #202631） */',
  '  --frost-hover-add: 0.04;   /* hover 填充增量 */',
  '  --frost-active-add: 0.08;  /* active 填充增量 */',
  '  --frost-transition: 120ms ease-out;',
  '  --frost-border-color: rgba(88, 108, 138, 0.14);',
  '  --frost-shadow-control: 0 2px 6px rgba(35, 48, 72, 0.04);',
  '  --frost-shadow-card: 0 6px 18px rgba(35, 48, 72, 0.06);',
  '  --frost-shadow-overlay: 0 10px 28px rgba(35, 48, 72, 0.10);',
  '  --frost-backdrop-base: #f4f6fa;',
  '  --frost-backdrop-blue: rgba(152, 177, 211, 0.28);',
  '  --frost-backdrop-lavender: rgba(177, 167, 206, 0.18);',
  '  --frost-backdrop-teal: rgba(155, 189, 185, 0.10);',
  '  --frost-tint-blue: rgba(111, 142, 184, 0.08);',
  '  --frost-tint-lavender: rgba(147, 134, 175, 0.06);',
  '  --frost-tint-teal: rgba(111, 153, 145, 0.05);',
].join('\n');

// ---------- 对齐辅助：声明列对齐，注释跟进 ----------
function emitEntries(entries) {
  const w = Math.max(...entries.map((e) => e.decl.length));
  return entries.map((e) => (e.comment ? `${e.decl.padEnd(w)}  /* ${e.comment} */` : e.decl));
}

// ---------- 组装 default.css ----------
const out = [];
out.push(`/* ============================================================
   皮肤：default（默认亮色皮肤）
   ============================================================
   本文件由 scripts/gen-tokens.mjs 从 design-language（样式Token/设计系统.md）
   生成；frost-* 与字体栈为脚本内嵌模板片段。手工修改会被下次生成覆盖——
   改值请改设计文档后重跑生成器，或改生成器内的模板片段。
   - 未定义/待确认的值（如 color-bg-6）不在此定义，引用即构建失败。
   - 换肤协议见同目录 README.md：作用域 html[data-theme="<皮肤名>"]，
     运行时切换 document.documentElement.setAttribute("data-theme", ...)。
   ============================================================ */
`);
out.push('html[data-theme="default"] {');

// 语义色（文档顺序分桶）
const semComment = {
  brand: '1.2 高亮色（品牌色）',
  text: '1.2 文本色',
  icon: '1.2 图标色',
  border: '1.2 边框色',
  bg: '1.2 背景色',
  fill: '1.2 填充色',
  functional: '1.2 功能色',
};
for (const b of ['brand', 'text', 'icon', 'border', 'bg', 'fill', 'functional']) {
  if (!buckets[b].length) continue;
  out.push('');
  out.push(`  /* ======== ${semComment[b]} ======== */`);
  if (b === 'bg') out.push('  /* color-bg-6（带背景色卡片）规范中待确认，未定义前不得用于页面 */');
  out.push(...emitEntries(buckets[b].map((t) => ({
    decl: `  --${t.name}: ${t.value};`,
    comment: [t.use, t.base].filter(Boolean).join(' '),
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

// 图表色：默认 + 无障碍
out.push('');
out.push('  /* ======== 1.5 图表配色（默认基础方案 + 无障碍方案） ======== */');
out.push(...emitEntries(chart.map((t) => ({
  decl: `  --${t.name}: ${t.v1};`,
  comment: t.base1,
}))));
out.push(...emitEntries(chart.map((t) => ({
  decl: `  --${t.name}-accessible: ${t.v2};`,
  comment: t.base2,
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
out.push('  /* ======== 7.2 毛玻璃材质（过渡基线，仅材质扩展场景成套取用） ======== */');
out.push(FROST);

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
const counts = {
  semantic: Object.values(buckets).flat().length,
  palette: palette.length,
  company: company.length,
  chart: chart.length * 2,
  code: code.length * 2,
  spacing: spacing.length * 2,
  radius: radius.length + radiusExtra.length,
  border: borderWidth.length + borderStyle.length,
  fontStacks: (FONT_STACKS.match(/--[\w-]+\s*:/g) || []).length,
  fontSize: fontSizes.length * 2,
  fontWeight: fontWeight.length,
  shadow: shadows.length,
  frost: (FROST.match(/--[\w-]+\s*:/g) || []).length,
};
const totalTokens = Object.values(counts).reduce((a, b) => a + b, 0);

// ---------- design-language.md §1 速查表（GEN 标记之间整体重写） ----------
const GEN_START = '<!-- GEN:TOKEN-TABLE START (由 scripts/gen-tokens.mjs 生成，勿手改) -->';
const GEN_END = '<!-- GEN:TOKEN-TABLE END -->';
const pick = (arr, name, key = 'name') => arr.find((t) => t[key] === name);
// 324 = 337 声明 − 13 个紧凑档覆盖（同名 token 二次赋值）；与旧手写版口径一致
const uniqueTokens = totalTokens - spacing.length;
const genTable = [
  GEN_START,
  '',
  `token 全量定义在皮肤文件 \`src/assets/themes/default.css\`（${uniqueTokens} 个自定义属性，由 \`scripts/gen-tokens.mjs\` 从设计文档生成），命名即 design-language 规范名，无前缀：`,
  '',
  '| 类别 | token 形态 | 示例 |',
  '| --- | --- | --- |',
  `| 品牌色 | \`--color-brand(-hover/-active/...)\` | \`--color-brand: ${pick(buckets.brand, 'color-brand')?.value}\` |`,
  `| 文本色 | \`--color-text-*\` | \`--color-text-primary: ${pick(buckets.text, 'color-text-primary')?.value}\` |`,
  '| 图标色 | `--color-icon-*` | `--color-icon-secondary: #777777` |',
  '| 边框色 | `--color-border(-hover/-focus/...)` | `--color-border: #c9c9c9`（gray-20） |',
  '| 背景色 | `--color-bg-1..5`、`--color-bg-mask` | `--color-bg-1: #f3f3f3`（页面背景） |',
  '| 填充色 | `--color-hover/-select/-fill*` | `--color-select: #e6f2fd`（brand-05） |',
  '| 功能色 | `--color-error/-alert/-warning/-success/-info/-none(+*-subtle)` | `--color-success: #09aa71` |',
  '| 基础色板 | `--{rose|red|orange|yellow|green|mint|cyan|blue|indigo|purple|pink|brand|gray}-{05..90}` | `--brand-50` |',
  '| 图表色 | `--color-chart-1..6(+accessible)` | `--color-chart-1: #2070f3` |',
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

// ---------- 组装 dark.css ----------
// 全量皮肤：data-theme="dark" 时 default.css 全部定义失效，深色皮肤必须提供
// default.css 的全部 token。非颜色组（间距/圆角/边框/字体/字号/字重/frost）与
// default 同值原样复制；颜色组取 §1.2D Dark 列 + 工程回填。
// 图表色：深色 11 色序列（§1.2D 图表序列组；浅色 accessible 不跨主题套用）。
const darkBackfillNames = new Set(DARK_BACKFILL.map((t) => t.name));
const darkDuplicate = darkRows.filter((r) => darkBackfillNames.has(r.name));
if (darkDuplicate.length) {
  problems.push(`[dark] backfill conflicts with §1.2D values: ${darkDuplicate.map((r) => r.name).join(', ')}`);
}
const darkCss = [];
darkCss.push(`/* ============================================================
   皮肤：dark（深色皮肤）
   ============================================================
   本文件由 scripts/gen-tokens.mjs 从 design-language（样式Token/设计系统.md §1.2D）
   生成；手工修改会被下次生成覆盖——改值请改设计文档后重跑生成器。
   - 颜色真值：§1.2D Dark 列。
   - 以下键为工程回填（§1.2D 未覆盖，设计师补齐后从生成器 DARK_BACKFILL 删除）：
     ${DARK_BACKFILL.map((t) => t.name).join(', ')}
   - 深色阴影 / frost 材质参数 / 深色 accessible 图表序列：设计师尚未提供，
     沿用浅色值过渡（见 dark-theme-intake.md 缺口清单），非深色最终值。
   ============================================================ */
`);
darkCss.push('html[data-theme="dark"] {');
darkCss.push('');
darkCss.push('  /* ======== 1.2D 深色语义色（§1.2D Dark 列，按文档分组；图表序列见下） ======== */');
darkCss.push(...emitEntries(darkRows
  .filter((t) => !/^color-chart-\d+$/.test(t.name))
  .map((t) => ({
    decl: `  --${t.name}: ${t.value};`,
    comment: [t.use, t.group].filter(Boolean).join(' · '),
  }))));
darkCss.push('');
darkCss.push('  /* ======== 工程回填（§1.2D 未覆盖，桥接层无兜底消费） ======== */');
darkCss.push(...emitEntries(DARK_BACKFILL.map((t) => ({
  decl: `  --${t.name}: ${t.value};`,
  comment: t.why,
}))));
darkCss.push('');
darkCss.push('  /* ======== 1.2D 深色图表序列（11 色；浅色 accessible 不跨主题） ======== */');
const darkChart = darkRows.filter((t) => /^color-chart-\d+$/.test(t.name));
darkCss.push('  ' + darkChart.map((t) => `--${t.name}: ${t.value};`).join(' '));

// 深色图表 accessible 变体未提供（§1.2D 明确声明），沿用浅色值过渡并标注；
// 浅色值从本脚本已解析的 chart 集合取（v2 = accessible 值）。
darkCss.push('');
darkCss.push('  /* ======== 图表 accessible 序列（深色未提供，沿用浅色值过渡） ======== */');
darkCss.push('  ' + chart.map((t) => `--${t.name}-accessible: ${t.v2};`).join(' '));

// 非颜色组与 default 完全同值（data-theme 切换后 default.css 失效，深色皮肤必须全量提供；
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
darkCss.push('  /* ======== 6.2 阴影（深色未提供，沿用浅色值过渡） ======== */');
darkCss.push(...emitEntries(shadows.map((t) => ({ decl: `  --${t.name}: ${t.val};`, comment: t.level }))));
darkCss.push('');
darkCss.push('  /* ======== 7.2 毛玻璃材质（深色材质未提供，沿用浅色基线过渡） ======== */');
darkCss.push(FROST);
darkCss.push('');
darkCss.push('  /* ======== 深色混色基底（桥接层 light-N 色阶 color-mix 派生底色；取 §1.2D bg-2 dark 容器表面色） ======== */');
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

// 深色皮肤完整性：bridge/base 消费的关键键必须存在（缺即生成失败，fail-fast）
const darkDefined = new Set([...darkRows.map((r) => `--${r.name}`), ...DARK_BACKFILL.map((t) => `--${t.name}`)]);
const DARK_REQUIRED = [
  '--color-brand', '--color-text-primary', '--color-bg-1', '--color-bg-4', '--color-bg-mask',
  '--color-border', '--color-border-hover', '--color-border-focus', '--color-border-separator',
  '--color-error', '--color-error-subtle', '--color-warning', '--color-warning-subtle',
  '--color-success', '--color-success-subtle', '--color-info', '--color-info-subtle',
  ...DARK_BACKFILL.map((t) => `--${t.name}`),
];
const darkMissing = DARK_REQUIRED.filter((k) => !darkDefined.has(k));
if (darkMissing.length) {
  console.log(`RESULT: FAIL | dark.css incomplete, missing required tokens: ${darkMissing.join(', ')}`);
  process.exit(1);
}

// ---------- 写盘 / 校验 ----------
const cssPath = join(SKILL_DIR, 'scripts', 'preview', 'src', 'assets', 'themes', 'default.css');
const darkPath = join(SKILL_DIR, 'scripts', 'preview', 'src', 'assets', 'themes', 'dark.css');
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
  if (!cssOk) console.log('  default.css differs from generated output');
  if (!refOk) console.log('  design-language.md §1 differs from generated output');
  if (!darkOk) console.log('  dark.css differs from generated output');
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
console.log(`TOKENS: ${totalTokens}`);
console.log(`DARK_TOKENS: ${darkRows.length + DARK_BACKFILL.length} (1.2D dark values: ${darkRows.length}, backfill: ${DARK_BACKFILL.length}, skipped: ${darkSkippedCount})`);
if (darkSkippedCount) console.log(`DARK_SKIPPED: ${darkSkippedList.join(' | ')}`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
console.log(`OUT_CSS: ${cssPath}`);
console.log(`OUT_DARK: ${darkPath}`);
console.log(`OUT_REF: ${refPath}`);
