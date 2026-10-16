#!/usr/bin/env node
// gen-tokens.mjs — 维护工具：从 design-language 真源重新生成皮肤与消费包。
//
// 同源生成四件产物（，任何一件失败全部不落盘）：
//   1. scripts/preview/src/assets/themes/default.less
//   2. scripts/preview/src/assets/themes/dark.less
//   3. references/design-language.md §1 速查表（GEN 标记之间）
//   4. references/design-manifest.json（来源/hash/token 数据契约）
//
// 范围：规则表格（约 90% token）按文档表格解析生成；散文定义的组
// （frost-*、字体栈）是显式 extraction override——每组绑定源文档锚行
// 的内容 hash，源片段变化时 --check 失败并提示维护，不静默沿用旧值。
// bridge.less 保持手写（工程映射，非文档可推导）。
//
// 文档结构漂移时：解析报错即停（REPORT 全部列出，不产出静默结果）。
//
// 用法（两种入口，同时给出报错）：
//   node gen-tokens.mjs <设计系统.md 路径> [--check]      # 旧命令，保持兼容
//   node gen-tokens.mjs --source-dir <design-language 目录> [--check]
//   --check  校验生成结果与磁盘文件一致（EOL 无关）；有漂移退出码 1
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');

// ---------- args ----------
const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const sourceDirIdx = args.indexOf('--source-dir');
const hasSourceDir = sourceDirIdx !== -1;
const sourceDirArg = hasSourceDir ? args[sourceDirIdx + 1] : undefined;
const sourceValueIdx = hasSourceDir ? sourceDirIdx + 1 : -1;
const positional = args.filter((a, i) => !a.startsWith('--') && i !== sourceValueIdx);

if (hasSourceDir && positional.length > 0) {
  console.log('RESULT: FAIL | --source-dir and a positional doc path are mutually exclusive; pick one');
  process.exit(1);
}
if (hasSourceDir && (!sourceDirArg || sourceDirArg.startsWith('--'))) {
  console.log('RESULT: FAIL | usage: node gen-tokens.mjs --source-dir <design-language 目录> [--check]');
  process.exit(1);
}

let docPath;
let sourceDir = null;
if (hasSourceDir) {
  sourceDir = resolve(sourceDirArg);
  docPath = join(sourceDir, '样式Token', '设计系统.md');
  if (!existsSync(docPath)) {
    console.log(`RESULT: FAIL | --source-dir: 样式Token/设计系统.md not found under ${sourceDir}`);
    process.exit(1);
  }
} else {
  const docArg = positional[0];
  if (!docArg) {
    console.log('RESULT: FAIL | usage: node gen-tokens.mjs <设计系统.md 路径 | --source-dir <目录>> [--check]');
    process.exit(1);
  }
  docPath = resolve(docArg);
  // 推断 source dir（00索引.md 在 doc 上两级），仅用于读设计版本；不存在则版本记 unknown
  const guessed = resolve(docPath, '..', '..');
  if (existsSync(join(guessed, '00索引.md'))) sourceDir = guessed;
}
if (positional.length > 1) {
  console.log('RESULT: FAIL | too many positional arguments (expected exactly one doc path)');
  process.exit(1);
}

let doc;
try {
  doc = readFileSync(docPath, 'utf8');
} catch (e) {
  console.log(`RESULT: FAIL | cannot read doc: ${e.message}`);
  process.exit(1);
}

// ---------- 工具：hash（EOL 归一，跨平台稳定） ----------
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const normEol = (s) => s.replace(/\r\n/g, '\n');
const fileHash = (path) => {
  try { return sha256(normEol(readFileSync(path, 'utf8'))); } catch { return null; }
};

// ---------- 设计版本（00索引.md；维护期可选，运行期不依赖） ----------
let designVersion = 'unknown';
let indexHash = null;
if (sourceDir) {
  const idxPath = join(sourceDir, '00索引.md');
  if (existsSync(idxPath)) {
    const idx = readFileSync(idxPath, 'utf8');
    indexHash = sha256(normEol(idx));
    const m = idx.match(/版本：\*\*(v[\d.]+)\*\*/);
    if (m) designVersion = m[1];
  }
}

// ---------- extraction override 声明 ----------
// 散文定义组：值来自脚本内嵌模板（文档散文无法逐 token 解析），但每组绑定
// **完整源依赖行集合**的内容 hash 基线（单行锚点会漏掉组内其余参数行，
// 改 font-family-en 或 frost-surface 行曾可静默通过）。任一依赖行变化 →
// --check 失败 + 生成闸拒绝，要求人工核对模板片段。
// anchors 覆盖该组模板实际消费的全部源参数行；sectionRange 额外覆盖整段
// （用于检测行删除/结构调整导致锚点整体消失）。
const EXTRACTIONS = [
  {
    id: 'font-stacks',
    sourceRef: '样式Token/设计系统.md#§5.1 字体参数表',
    sectionStart: '#### 字体参数',
    sectionEnd: '### 5.2',
    anchors: [
      '| `font-family-zh` | 中文',
      '| `font-family-en` | 英文',
      '| `font-family-numeric` | 数字',
    ],
    note: '字体栈：文档只给字体名候选表，最终 CSS 栈（含引号、回退顺序）由工程侧整理。',
  },
  {
    id: 'frost',
    sourceRef: '样式Token/设计系统.md#§7.2 材质档位与 Token（含 §7.5 交互增量）',
    sectionStart: '### 7.2 材质档位与 Token',
    sectionEnd: '### 7.3',
    anchors: [
      '| `--frost-blur-*` | 各档位背景模糊',
      '| `--frost-surface-*` | 各档位中性磨砂表面',
      '| `--frost-shadow-*` | 各档位阴影',
      '| `--frost-backdrop-*` | 独立父级柔和渐变背景',
      '| `--frost-tint-blue`、`--frost-tint-lavender`、`--frost-tint-teal`',
      '| `--frost-border` | 辅助材质边界',
      '| `--frost-surface-solid` | 减少透明度及不支持模糊时的不透明表面',
      '| `frost-common`、`frost-light`、`frost-dark`',
    ],
    extraAnchors: [
      // hover/active 增量与过渡来自 §7.5/§7.2 公共参数行，在另一节
      { sectionStart: '### 7.5', sectionEnd: '<a id="frost-decoration">', anchor: '| Hover／Active |' },
    ],
    note: 'frost 材质：文档为散文+参数描述，逐 token 值由工程侧从参数描述整理（blur/saturate/surface/shadow/backdrop/tint/border/solid/hover-active 增量/transition）。',
  },
];
// 单行内容 hash（按 marker 定位该行；EOL 无关——行尾 \r 剥离，CRLF/LF 源文件 hash 一致）
function lineHashAt(marker) {
  const idx = doc.indexOf(marker);
  if (idx === -1) return null;
  const lineEnd = doc.indexOf('\n', idx);
  let line = doc.slice(idx, lineEnd === -1 ? undefined : lineEnd);
  if (line.endsWith('\r')) line = line.slice(0, -1);
  return sha256(line);
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
const radiusExtra = fullRow ? [{ name: 'radius-size-infinity', val: fullRow.val, scene: '既有名称，映射到同一 999px 值', sourceRef: '§3.2 使用规则（散文映射）' }] : [];

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

// ---------- 内嵌模板片段（extraction override；锚行 hash 变化 → --check 失败） ----------
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

// 解析 extraction override 模板片段中的 token 声明（供 manifest 收录）
function parseDeclarations(block) {
  const out = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) out.push({ name: m[1].slice(2), value: m[2].replace(/\/\*.*\*\//, '').trim() });
  }
  return out;
}
const fontDecls = parseDeclarations(FONT_STACKS);
const frostLightDecls = parseDeclarations(FROST_LIGHT);
const frostDarkDecls = parseDeclarations(FROST_DARK);

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

// ---------- references/design-manifest.json（数据契约） ----------
// 所有输出从同一解析结果生成；manifest 记录来源 hash 与 token 数据，
// 运行期消费只读 skill 内包，不回查外部 design-language 目录。
// token 类型集合（按真实语义分类，值与类型做兼容性校验，不冒充 DTCG）：
const TOKEN_TYPES = ['color', 'dimension', 'number', 'fontWeight', 'fontFamily', 'shadow', 'transition', 'borderStyle', 'alpha'];
// type → value 兼容性校验器（value 必须匹配该类型的 CSS 语法形态）
const TYPE_VALIDATORS = {
  color: (v) => /^#[0-9a-fA-F]{6}$/.test(v) || /^rgba?\(\s*\d+,\s*\d+,\s*\d+(?:,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(v),
  dimension: (v) => /^-?\d+(\.\d+)?(px|%)$/.test(v) || /^0$/.test(v),
  number: (v) => /^-?\d+(\.\d+)?$/.test(v),
  fontWeight: (v) => /^\d{3}$/.test(v),
  fontFamily: (v) => v.includes(',') || /^[A-Za-z][\w-]*$/.test(v),
  shadow: (v) => /^-?\d+(\.\d+)?(px)?(\s+-?\d+(\.\d+)?(px)?){2,3}\s+rgba\(/.test(v),
  transition: (v) => /^\d+m?s\b/.test(v) && /(ease|linear|step|cubic-bezier)/.test(v),
  borderStyle: (v) => /^(dotted|dashed|solid)$/.test(v),
  alpha: (v) => /^(0|1|0?\.\d+)$/.test(v),
};
function tokenEntry(name, type, valueByTheme, density, sourceRef) {
  if (!TOKEN_TYPES.includes(type)) {
    console.log(`RESULT: FAIL | manifest type "${type}" not in internal type set (token ${name})`);
    process.exit(1);
  }
  const vals = Object.values(valueByTheme || {});
  if (vals.length && !vals.every((v) => TYPE_VALIDATORS[type](v))) {
    console.log(`RESULT: FAIL | manifest token ${name}: value(s) [${vals.join(' | ')}] incompatible with type ${type}`);
    process.exit(1);
  }
  const e = { name, type, sourceRef };
  if (valueByTheme) e.valueByTheme = valueByTheme;
  if (density) e.density = density;
  return e;
}

const manifestTokens = [];
for (const t of semanticAll) {
  manifestTokens.push(tokenEntry(t.name, 'color', { default: t.light, dark: t.dark }, null, '设计系统.md#1.2'));
}
for (const t of palette) {
  manifestTokens.push(tokenEntry(t.name, 'color', { default: t.value, dark: t.value }, null, '设计系统.md#1.3'));
}
for (const t of company) {
  manifestTokens.push(tokenEntry(t.name, 'color', { default: t.value, dark: t.value }, null, '设计系统.md#1.4'));
}
for (const t of chartDefault) {
  manifestTokens.push(tokenEntry(t.name, 'color', { default: t.light, dark: t.dark }, null, '设计系统.md#1.5(default)'));
}
for (const t of chartAccessible) {
  // CSS 实际发布 `--color-chart-N-accessible`；manifest 必须与最终 CSS 名称一致，
  // 否则同名覆盖 default 序列且 accessible 序列在 manifest 中不存在
  manifestTokens.push(tokenEntry(`${t.name}-accessible`, 'color', { default: t.light, dark: t.dark }, null, '设计系统.md#1.5(accessible)'));
}
for (const t of code) {
  manifestTokens.push(tokenEntry(t.name, 'color', { default: t.light, dark: t.light }, null, '设计系统.md#1.6'));
  manifestTokens.push(tokenEntry(`${t.name}-dark`, 'color', { default: t.dark, dark: t.dark }, null, '设计系统.md#1.6(深色代码区)'));
}
for (const t of spacing) {
  manifestTokens.push(tokenEntry(t.name, 'dimension', { default: `${t.reg}px`, dark: `${t.reg}px` }, { default: `${t.reg}px`, compact: `${t.compact}px` }, '设计系统.md#2.2'));
}
for (const t of [...radius, ...radiusExtra]) {
  manifestTokens.push(tokenEntry(t.name, 'dimension', { default: t.val, dark: t.val }, null, t.sourceRef || '设计系统.md#3.1'));
}
for (const t of borderWidth) {
  manifestTokens.push(tokenEntry(t.name, 'dimension', { default: t.val, dark: t.val }, null, '设计系统.md#4.1'));
}
for (const t of borderStyle) {
  manifestTokens.push(tokenEntry(t.name, 'borderStyle', { default: t.val, dark: t.val }, null, '设计系统.md#4.2'));
}
for (const d of fontDecls) {
  manifestTokens.push(tokenEntry(d.name, 'fontFamily', { default: d.value, dark: d.value }, null, EXTRACTIONS[0].sourceRef));
}
for (const t of fontSizes) {
  manifestTokens.push(tokenEntry(t.fs, 'dimension', { default: t.size, dark: t.size }, null, '设计系统.md#5.2'));
  manifestTokens.push(tokenEntry(t.lh, 'dimension', { default: t.height, dark: t.height }, null, '设计系统.md#5.2'));
}
for (const t of fontWeight) {
  manifestTokens.push(tokenEntry(t.name, 'fontWeight', { default: t.weight, dark: t.weight }, null, '设计系统.md#5.3'));
}
for (const t of shadows) {
  manifestTokens.push(tokenEntry(t.name, 'shadow', { default: t.val, dark: t.darkVal }, null, '设计系统.md#6.2'));
}
const frostDarkByName = new Map(frostDarkDecls.map((d) => [d.name, d.value]));
// frost token 按真实语义分类，不再一律 dimension
function frostTypeOf(name, value) {
  if (/^frost-shadow-/.test(name)) return 'shadow';
  if (name === 'frost-transition') return 'transition';
  if (/-add$/.test(name)) return 'alpha';
  if (/^frost-saturate-/.test(name)) return 'dimension'; // 百分比长度语义档
  if (/^frost-blur-/.test(name)) return 'dimension';
  if (/^frost-(surface|backdrop|tint)-/.test(name) || name === 'frost-border-color') return 'color';
  // 兜底：值形态倒推（rgba/hex → color；数值 → number；其余 → dimension）
  if (TYPE_VALIDATORS.color(value)) return 'color';
  if (TYPE_VALIDATORS.number(value)) return 'number';
  return 'dimension';
}
for (const d of frostLightDecls) {
  const darkVal = frostDarkByName.get(d.name) ?? d.value;
  manifestTokens.push(tokenEntry(d.name, frostTypeOf(d.name, d.value), { default: d.value, dark: darkVal }, null, EXTRACTIONS[1].sourceRef));
}

// ---------- token 名称唯一性 + manifest 键集合与 CSS 声明集合一致性校验 ----------
{
  const names = manifestTokens.map((t) => `--${t.name}`);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) {
    console.log(`RESULT: FAIL | manifest token names not unique: ${[...new Set(dup)].join(', ')}`);
    process.exit(1);
  }
  // CSS 侧实际声明的自定义属性集合（default.less + dark.less 并集），扣除：
  //  - 紧凑档覆盖块（同名 token 二次赋值，非新 token）
  //  - 基础层内部变量（--ux-mix-base：bridge 派生基底，非设计 token，显式豁免登记）
  const cssDecls = new Set();
  for (const m of (cssOut + '\n' + darkCssOut).matchAll(/--[a-z][a-z0-9-]*(?=\s*:)/g)) cssDecls.add(m[0]);
  const manifestSet = new Set(names);
  const BRIDGE_PLUMBING = new Set(['--ux-mix-base']);
  const missingInManifest = [...cssDecls].filter((n) => !manifestSet.has(n) && !BRIDGE_PLUMBING.has(n));
  const missingInCss = [...manifestSet].filter((n) => !cssDecls.has(n));
  if (missingInManifest.length || missingInCss.length) {
    console.log('RESULT: FAIL | manifest ↔ theme CSS token set mismatch:');
    if (missingInManifest.length) console.log(`  in CSS but not manifest: ${missingInManifest.join(', ')}`);
    if (missingInCss.length) console.log(`  in manifest but not CSS: ${missingInCss.join(', ')}`);
    process.exit(1);
  }
}

// extraction override 校验数据（逐锚行基线，覆盖组内全部源依赖行）
const extractionChecks = EXTRACTIONS.map((ex) => {
  const lines = ex.anchors.map((a, i) => ({
    anchor: a,
    sourceSnippetHash: lineHashAt(a),
  }));
  for (const ea of ex.extraAnchors || []) {
    lines.push({ anchor: ea.anchor, sourceSnippetHash: lineHashAt(ea.anchor), optional: true, note: `节 ${ea.sectionStart}` });
  }
  return {
    id: ex.id,
    sourceRef: ex.sourceRef,
    lines,
    note: ex.note,
  };
});
// 生成侧防漏：任一**非 optional** 锚行缺失（文档删行/改结构）→ 立即 FAIL，不得静默放行
{
  const missing = [];
  for (const c of extractionChecks) {
    for (const l of c.lines) {
      if (l.sourceSnippetHash === null && !l.optional) missing.push(`${c.id}: ${l.anchor.slice(0, 50)}`);
    }
  }
  if (missing.length) {
    console.log('RESULT: FAIL | extraction override anchor line(s) not found in source doc:');
    for (const m of missing) console.log(`  ${m}`);
    console.log('HINT: 设计文档删改了字体/frost 参数行 —— 先核对 gen-tokens.mjs 模板片段与 anchors 声明，再重跑');
    process.exit(1);
  }
}

const manifest = {
  schemaVersion: 1,
  designVersion,
  generatedAt: null, // 由写盘时填充（避免非确定性 → 由调用方/CI 盖章；生成器本身不读时钟，保证 --check 可重现）
  sourceFiles: {},
  tokens: manifestTokens,
  generatedFiles: {},
  rulesVersion: 'gts-ep-coder-token-rules@1',
  unresolvedGaps: [
    '图表选型规范：设计师确认后补（design-language/00索引.md 已知待确认项）',
    'frost-* 与字体栈为 extraction override：文档散文参数由工程侧整理为模板片段，锚行变化须人工核对',
  ],
  extractionOverrides: extractionChecks,
};
if (sourceDir) {
  manifest.sourceFiles = {
    '样式Token/设计系统.md': { hash: sha256(normEol(doc)) },
  };
  if (indexHash) manifest.sourceFiles['00索引.md'] = { hash: indexHash };
  manifest.sourceDirNote = 'sourceFiles 相对 design-language 源目录；运行期消费不回查该目录，仅维护期（gen-tokens / --check）读取';
} else {
  manifest.sourceFiles = {
    '样式Token/设计系统.md': { hash: sha256(normEol(doc)), path: docPath, note: '仅传入文档路径，未定位 source dir；designVersion 为 unknown' },
  };
}

// ---------- 输出路径 ----------
const cssPath = join(SKILL_DIR, 'scripts', 'preview', 'src', 'assets', 'themes', 'default.less');
const darkPath = join(SKILL_DIR, 'scripts', 'preview', 'src', 'assets', 'themes', 'dark.less');
const refPath = join(SKILL_DIR, 'references', 'design-language.md');
const manifestPath = join(SKILL_DIR, 'references', 'design-manifest.json');

function applyToRef(refCur) {
  const start = refCur.indexOf(GEN_START);
  const end = refCur.indexOf(GEN_END);
  if (start === -1 || end === -1 || end < start) return null;
  return refCur.slice(0, start) + genTable + refCur.slice(end + GEN_END.length);
}

// generatedFiles hash 在最终内容定稿后统一填充（不含自身，避免递归）
function fillGeneratedHashes() {
  manifest.generatedFiles = {
    'scripts/preview/src/assets/themes/default.less': { hash: sha256(normEol(cssOut)) },
    'scripts/preview/src/assets/themes/dark.less': { hash: sha256(normEol(darkCssOut)) },
    'references/design-language.md': { hash: sha256(normEol(applyToRef(readFileSync(refPath, 'utf8')) ?? '')), note: 'GEN:TOKEN-TABLE 区段' },
  };
}

// ---------- EOL 无关比较（吸取 autocrlf 伪漂移教训：跨平台 checkout 后 --check 仍须稳定） ----------
const sameContent = (disk, generated) => {
  if (disk === null || disk === undefined) return false;
  return normEol(disk) === normEol(generated);
};

// ---------- --check 模式 ----------
if (checkMode) {
  const readOr = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
  const cssCur = readOr(cssPath);
  const darkCur = readOr(darkPath);
  const refCur = readOr(refPath);
  const manifestCur = readOr(manifestPath);

  const drifts = [];
  if (!sameContent(cssCur, cssOut)) drifts.push('default.less differs from generated output');
  if (!sameContent(darkCur, darkCssOut)) drifts.push('dark.less differs from generated output');

  const refNext = refCur === null ? null : applyToRef(refCur);
  if (refCur === null) drifts.push('design-language.md not found');
  else if (refNext === null) drifts.push('design-language.md missing GEN:TOKEN-TABLE markers');
  else if (!sameContent(refCur, refNext)) drifts.push('design-language.md §1 differs from generated output');

  // manifest 校验（完整校验受控字段，不能只查部分导致版本/速查 hash 伪造可假通过）
  fillGeneratedHashes();
  if (manifestCur === null) {
    drifts.push('design-manifest.json not found (run generator without --check to create)');
  } else {
    let parsed = null;
    try { parsed = JSON.parse(manifestCur); } catch { drifts.push('design-manifest.json is not valid JSON'); }
    if (parsed) {
      // 受控标量字段：schema/design/rulesVersion 必须与本次解析结果一致
      if (parsed.schemaVersion !== manifest.schemaVersion) drifts.push(`design-manifest.json schemaVersion ${JSON.stringify(parsed.schemaVersion)} !== expected ${manifest.schemaVersion}`);
      if (parsed.designVersion !== designVersion) drifts.push(`design-manifest.json designVersion ${JSON.stringify(parsed.designVersion)} !== source index ${JSON.stringify(designVersion)}`);
      if (parsed.rulesVersion !== manifest.rulesVersion) drifts.push(`design-manifest.json rulesVersion ${JSON.stringify(parsed.rulesVersion)} !== expected ${manifest.rulesVersion}`);
      // generatedAt 是调用方盖章字段：只要求为 null 或 ISO 时间字符串（null=未盖章），值本身不比对
      if (!('generatedAt' in parsed) || (parsed.generatedAt !== null && !/^\d{4}-\d{2}-\d{2}T/.test(String(parsed.generatedAt)))) {
        drifts.push('design-manifest.json generatedAt must be null or an ISO timestamp');
      }
      // sourceFiles 全量：键集合 + 每个键的 hash 与当前源一致（索引改版/删来源记录都会失败）
      const expectedSources = manifest.sourceFiles;
      const diskSources = parsed.sourceFiles || {};
      for (const k of Object.keys(expectedSources)) {
        if (!(k in diskSources)) drifts.push(`design-manifest.json sourceFiles missing entry: ${k}`);
        else if (diskSources[k].hash !== expectedSources[k].hash) drifts.push(`design-manifest.json sourceFiles hash mismatch: ${k}`);
      }
      for (const k of Object.keys(diskSources)) {
        if (!(k in expectedSources)) drifts.push(`design-manifest.json sourceFiles has unexpected entry: ${k}`);
      }
      // generatedFiles 全量：键集合 + 每键 hash 与磁盘产物一致（含速查表；伪造 hash 失败）
      const expectedGen = manifest.generatedFiles;
      const gf = parsed.generatedFiles || {};
      for (const k of Object.keys(expectedGen)) {
        if (!(k in gf)) drifts.push(`design-manifest.json generatedFiles missing entry: ${k}`);
        else if (gf[k].hash !== expectedGen[k].hash) drifts.push(`design-manifest.json generatedFiles hash mismatch: ${k}`);
      }
      for (const k of Object.keys(gf)) {
        if (!(k in expectedGen)) drifts.push(`design-manifest.json generatedFiles has unexpected entry: ${k}`);
      }
      // 速查表 hash 口径澄清：expected 的 design-language.md hash 覆盖 GEN 块替换后的整文件；
      // 磁盘侧直接以「磁盘文件 + 本次 GEN 块」重算，两者天然同口径
      const expected = JSON.parse(JSON.stringify(manifest, null, 2));
      // 逐 token 比对（磁盘 manifest 与本次生成，含 name/type/valueByTheme/density/sourceRef）
      if (JSON.stringify(parsed.tokens) !== JSON.stringify(expected.tokens)) {
        drifts.push('design-manifest.json tokens differ from parsed source doc (token values/types drifted)');
      }
      // extractionOverrides 内容级比对（数量检查不足以发现伪造/篡改）
      if (JSON.stringify(parsed.extractionOverrides || null) !== JSON.stringify(expected.extractionOverrides || null)) {
        drifts.push('design-manifest.json extractionOverrides differ from current source doc lines');
      }
    }
  }

  // extraction override 锚行校验（逐行基线比对，覆盖组内全部源依赖行）。
  // 磁盘 manifest 里每行的 sourceSnippetHash 是上次生成时「已核对」的基线；当前源
  // 文档任一依赖行与之不符 = 设计师改了该行而模板片段未同步核对——不能仅重跑
  // 生成器冲掉基线（模板值不随锚行自动变化），必须人工核对模板后重跑。
  // ：基线缺失/损坏在 --check 同样是 FAIL（不能静默当首次）。
  const anchorDrifts = [];
  let diskOverrides = [];
  try {
    const p = JSON.parse(manifestCur || '{}');
    diskOverrides = Array.isArray(p.extractionOverrides) ? p.extractionOverrides : null;
    if (diskOverrides === null) {
      anchorDrifts.push('disk manifest has no extractionOverrides array — damaged/incomplete baseline');
    }
  } catch {
    anchorDrifts.push('disk manifest is not valid JSON — damaged baseline, cannot verify extraction lines');
  }
  const diskOverrideById = new Map((diskOverrides || []).map((e) => [e.id, e]));
  for (const ex of EXTRACTIONS) {
    const disk = diskOverrideById.get(ex.id);
    if (!disk) {
      anchorDrifts.push(`${ex.id}: baseline group missing from disk manifest — damaged/incomplete baseline`);
      continue;
    }
    const diskLines = Array.isArray(disk.lines) ? disk.lines : null;
    const liveLines = extractionChecks.find((c) => c.id === ex.id).lines;
    if (!diskLines) {
      anchorDrifts.push(`${ex.id}: disk manifest baseline is legacy single-hash format — regenerate to upgrade to per-line baselines`);
      continue;
    }
    if (diskLines.length !== liveLines.length) {
      anchorDrifts.push(`${ex.id}: baseline line count ${diskLines.length} !== current anchors ${liveLines.length} (extraction declaration changed)`);
      continue;
    }
    for (let i = 0; i < liveLines.length; i++) {
      const live = liveLines[i];
      const base = diskLines[i];
      if (base.anchor !== live.anchor) {
        anchorDrifts.push(`${ex.id}: baseline anchor #${i + 1} changed (declaration edited)`);
        continue;
      }
      if (live.sourceSnippetHash === null) {
        anchorDrifts.push(`${ex.id}: anchor line not found in source doc — doc restructured? (${live.anchor.slice(0, 40)}...)`);
        continue;
      }
      if (base.sourceSnippetHash !== live.sourceSnippetHash) {
        anchorDrifts.push(`${ex.id}: source snippet changed since last generation (${live.anchor.slice(0, 40)}...) — template values in gen-tokens.mjs must be re-verified against the new doc line, not auto-carried over`);
      }
    }
  }

  if (drifts.length === 0 && anchorDrifts.length === 0) {
    console.log('RESULT: OK | --check: generated output matches on-disk files');
    console.log(`TOKENS: ${totalTokens}`);
    console.log(`DESIGN_VERSION: ${designVersion}`);
    process.exit(0);
  }
  console.log('RESULT: FAIL | --check drift detected:');
  for (const d of drifts) console.log(`  ${d}`);
  for (const d of anchorDrifts) console.log(`  [extraction] ${d}`);
  if (anchorDrifts.length) {
    console.log('HINT: extraction override 源片段变化 —— 设计师更新了 frost/字体栈参数行；');
    console.log('      逐项核对 gen-tokens.mjs 内对应模板片段（模板值不随锚行自动变化），');
    console.log('      需要改值就改模板并同步 manifest 基线（去掉 --check 重跑）；确认无影响的同样重跑刷新基线');
  } else if (drifts.length) {
    console.log('HINT: 去掉 --check 重跑生成器，再审查 diff');
  }
  process.exit(1);
}

// ---------- 生成模式：临时输出 → 全部成功 → 原子替换 ----------
fillGeneratedHashes();
const manifestOut = JSON.stringify(manifest, null, 2) + '\n';

// extraction override 防盲跑闸（「源片段变化时…提示维护」同样约束生成模式；
// 逐行基线比对，单行变化（如仅 font-family-en）也会被拦；
// ：manifest 存在但基线缺失/损坏 ≠ 首次生成——JSON 损坏、缺
// extractionOverrides、缺任一必需组、lines 结构坏，都按「基线不可信」处理，
// 普通重跑拒绝（否则旧模板值会被打上『已同步新源』标记）。
// ：manifest 不存在同样拒绝普通生成——「文件不存在」无法区分真首次
// 安装、误删基线或已改源后的重建；基线建立（含首次）一律需要显式
// --confirm-extraction 确认（确认=人工核对过模板与源，只建立基线记录，
// 不自动改模板参数）。缺源锚点任何情况不放行。
let extractionGate = [];
let gateNeedsConfirm = false; // true = 基线缺失/损坏/未建立，需显式确认重建（区别于普通漂移）
if (!existsSync(manifestPath)) {
  extractionGate.push('design-manifest.json not found — no extraction baseline exists (first publish or deleted baseline); plain regen cannot self-certify');
  gateNeedsConfirm = true;
} else {
  let diskM = null;
  let parseErr = null;
  try { diskM = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (e) { parseErr = e; }
  if (parseErr || typeof diskM !== 'object' || diskM === null) {
    extractionGate.push(`manifest on disk is not valid JSON (${parseErr ? parseErr.message : 'not an object'}) — damaged baseline, not a first publish`);
    gateNeedsConfirm = true;
  } else if (!Array.isArray(diskM.extractionOverrides)) {
    extractionGate.push('manifest on disk has no extractionOverrides array — damaged/incomplete baseline, not a first publish');
    gateNeedsConfirm = true;
  } else {
    const byId = new Map(diskM.extractionOverrides.map((e) => [e.id, e]));
    for (const c of extractionChecks) {
      const disk = byId.get(c.id);
      if (!disk) {
        extractionGate.push(`${c.id}: baseline group missing from disk manifest — damaged/incomplete baseline, not a first publish`);
        gateNeedsConfirm = true;
        continue;
      }
      const diskLines = Array.isArray(disk.lines) ? disk.lines : null;
      if (!diskLines) {
        extractionGate.push(`${c.id}: legacy single-hash baseline on disk — explicit migration to per-line baseline required`);
        gateNeedsConfirm = true;
        continue;
      }
      if (diskLines.length !== c.lines.length) {
        extractionGate.push(`${c.id}: baseline has ${diskLines.length} lines, current declaration has ${c.lines.length} (declaration or manifest edited)`);
        continue;
      }
      let groupDamaged = false;
      for (let i = 0; i < c.lines.length; i++) {
        const live = c.lines[i];
        const base = diskLines[i];
        if (!base || typeof base.sourceSnippetHash !== 'string') {
          extractionGate.push(`${c.id}: baseline line #${i + 1} malformed — damaged baseline, not a first publish`);
          groupDamaged = true;
          continue;
        }
        if (live.sourceSnippetHash === null) {
          extractionGate.push(`${c.id}: anchor line not found in source doc (${live.anchor.slice(0, 40)}...)`);
          continue; // 缺源锚点：确认开关也不放行（下方 hasAnchorMissing 统一拦截）
        }
        if (base.anchor !== live.anchor || base.sourceSnippetHash !== live.sourceSnippetHash) {
          extractionGate.push(`${c.id}: source snippet changed since last run (${live.anchor.slice(0, 40)}...)`);
        }
      }
      if (groupDamaged) gateNeedsConfirm = true;
    }
  }
}
// 缺源锚点：结构性问题，--confirm-extraction 不放行（模板值无从核对）
const anchorMissing = extractionGate.some((g) => g.includes('anchor line not found'));
if (anchorMissing) {
  console.log('RESULT: FAIL | extraction override anchor line(s) not found in source doc:');
  for (const g of extractionGate) console.log(`  ${g}`);
  console.log('HINT: 设计文档删改了字体/frost 参数行 —— 先核对 gen-tokens.mjs 模板与 anchors 声明；');
  console.log('      缺锚点不能用 --confirm-extraction 放行。');
  process.exit(1);
}
if (extractionGate.length && !args.includes('--confirm-extraction')) {
  console.log('RESULT: FAIL | extraction override baseline problem:');
  for (const g of extractionGate) console.log(`  ${g}`);
  if (gateNeedsConfirm) {
    console.log('HINT: 磁盘 manifest 基线缺失/损坏/为旧格式/未建立 —— 普通重跑不能自动标记『已核对』。');
    console.log('      逐项核对 gen-tokens.mjs 模板片段与设计文档后，加 --confirm-extraction 建立基线；');
    console.log('      确认只建立/重置基线记录，不自动更新模板参数。');
  } else {
    console.log('HINT: 设计师改动了 frost/字体栈参数行。逐项核对 gen-tokens.mjs 内模板片段：');
    console.log('      需要改值 → 改模板后重跑（本次重跑即刷新基线）；');
    console.log('      确认无影响 → 加 --confirm-extraction 重跑，仅刷新锚行基线。');
    console.log('      不允许不看 diff 直接重跑把旧模板值打进新产物。');
  }
  process.exit(1);
}

const stagingDir = join(SKILL_DIR, 'scripts', '.gen-tokens-staging');
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

const staged = [];
function stage(name, content) {
  const p = join(stagingDir, name);
  writeFileSync(p, content, 'utf8');
  staged.push({ name, content });
}

try {
  stage('default.less', cssOut);
  stage('dark.less', darkCssOut);

  const refCur = readFileSync(refPath, 'utf8');
  const refNext = applyToRef(refCur);
  if (refNext === null) {
    console.log('RESULT: FAIL | design-language.md missing GEN:TOKEN-TABLE markers');
    console.log('HINT: 在 §1 速查表两侧加上 GEN:TOKEN-TABLE START/END 标记后重跑');
    process.exit(1);
  }
  stage('design-language.md', refNext);
  stage('design-manifest.json', manifestOut);
} catch (e) {
  rmSync(stagingDir, { recursive: true, force: true });
  console.log(`RESULT: FAIL | staging failed: ${e.message}`);
  process.exit(1);
}

// 原子提交：逐文件 rename；任一失败即回滚已替换文件（旧内容恢复），不留半套产物
const targets = [
  { name: 'default.less', path: cssPath },
  { name: 'dark.less', path: darkPath },
  { name: 'design-language.md', path: refPath },
  { name: 'design-manifest.json', path: manifestPath },
];
const committed = [];
try {
  for (const t of targets) {
    const backup = existsSync(t.path) ? readFileSync(t.path, 'utf8') : null;
    renameSync(join(stagingDir, t.name), t.path);
    committed.push({ path: t.path, prev: backup });
  }
} catch (e) {
  // 回滚：逆序恢复已 commit 的文件
  let rollbackErr = null;
  for (const c of committed.reverse()) {
    try {
      if (c.prev === null) rmSync(c.path, { force: true });
      else writeFileSync(c.path, c.prev, 'utf8');
    } catch (re) {
      rollbackErr = re.message;
    }
  }
  rmSync(stagingDir, { recursive: true, force: true });
  console.log(`RESULT: FAIL | commit interrupted: ${e.message}${rollbackErr ? ` (rollback warning: ${rollbackErr})` : ''}`);
  console.log('HINT: 磁盘产物已回滚到生成前状态；排查写入权限后重跑');
  process.exit(1);
}
rmSync(stagingDir, { recursive: true, force: true });

console.log('RESULT: OK');
console.log(`TOKENS: ${totalTokens} (semantic: ${semanticAll.length}, palette: ${palette.length}, company: ${company.length}, chart: ${chartDefault.length + chartAccessible.length}×2, code: ${code.length * 2}, shadow: ${shadows.length}×2, frost: ${frostCount}×2)`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
console.log(`DESIGN_VERSION: ${designVersion}`);
console.log(`OUT_CSS: ${cssPath}`);
console.log(`OUT_DARK: ${darkPath}`);
console.log(`OUT_REF: ${refPath}`);
console.log(`OUT_MANIFEST: ${manifestPath}`);
