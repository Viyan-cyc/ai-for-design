#!/usr/bin/env node
// extract-tokens.mjs — 设计系统.md token 表 → tokens.json（gts-flat-dtcg schema）
//
// 管线第一步：docs/design-language/样式Token/设计系统.md（唯一来源，设计师迭代处）
//   → 本脚本 → library/tokens.json（入库，diff 可审）
//   → generate-css.mjs（第二步）→ frontend/element-plus/tokens/*.css
//
// schema（meta.schema = "gts-flat-dtcg/1"）：
//   - token 名不加 `--` 前缀（与 md 表格一致；generate 阶段补 `--`）
//   - $value 按 W3C DTCG：字面值或别名 "{token-name}"；$type 用 DTCG 官方类型
//   - 审计/双主题/双密度等扩展信息放 $extensions.gts.*（resolvedHex、dark、compact、accessible、alpha）
//   - 语义色纯色用别名（CSS 输出保持 var() 链，设计师改色阶 → 语义层自动跟随）；
//     含透明度时无法用 var() 合成，$value 落 rgba 字面值 + $extensions.gts.ref/alpha 记录来源
//   - frost：md 当前为通配符行（--frost-blur-* 等），不可逐 token 解析；
//     过渡期用 --seed 从 library/backfill-seed.json 回填（G 1.5.1 已验证值），
//     设计师补齐正式行后由本脚本解析取代
//   - semantic-dark：GTS 2.2 语义表只有浅色；深色 54 值按设计师答复（2026-09-16"用旧版值"）
//     从同一种子回填到同名浅色 token 的 gts.dark（generate 据此出 [data-theme="dark"] 块）。
//   - 不进 schema：g-* 兼容层、el-* 桥（generate 派生产物）、spec-*（工程尺寸，归 patterns/）
//
// Usage:
//   node extract-tokens.mjs --source <设计系统.md> --out <tokens.json>
//        [--seed <旧 tokens.json>] [--source-version v2.2.1] [--report <diff.txt>]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) args[k.slice(2)] = argv[i + 1], i++;
  }
  return args;
}

const clean = (s) => s.replace(/`/g, '').replace(/\\→/g, '→').trim();

function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '')
    .replace(/\\\|/g, '')
    .split('|')
    .map((c) => clean(c.replace(//g, '|')));
}

const isSep = (cells) => cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));

// "#191919 / 30%" → { hex, alphaPct }；纯 hex → { hex }
function parseValueCell(cell) {
  const m = cell.match(/^#([0-9A-Fa-f]{6})\s*\/\s*(\d+(?:\.\d+)?)%$/);
  if (m) return { hex: `#${m[1].toUpperCase()}`, alphaPct: parseFloat(m[2]) };
  if (/^#[0-9A-Fa-f]{6}$/.test(cell)) return { hex: cell.toUpperCase() };
  return null;
}

function rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${parseFloat(alpha.toFixed(2))})`;
}

// 表头签名 → 解析器。签名 = 归一化表头（去空格）。
const PARSERS = {
  'Token|用途／状态|GTS基础色|色值': 'semantic4',
  'Token|用途|基础色|色值': 'semantic4',
  'Token|用途／状态|基础色|色值': 'semantic4',
  'Token|关注度／用途|基础色|色值': 'semantic4',
  '基础Token|色值': 'palette2',
  '检索Token|类别／色名|色值': 'paletteCompany3',
  'Token|默认基础色|默认值|无障碍基础色|无障碍值': 'charts5',
  '检索Token|语义／Highlight.js类名|浅色代码区|深色代码区': 'code4',
  'Token|常规|紧凑': 'spacing3',
  'Token|半径|适用场景': 'radius3',
  'Token|用途|浅色主题|深色主题': 'border4',
  'Token|CSS值|形态': 'borderStyle3',
  'Token|适用内容|字体': 'fontFamily3',
  '字号Token|字号|行高Token|行高|文字角色': 'typeSize5',
  'Token|字重|用途': 'weight3',
  'Token|层级|X|Y|模糊|扩展|默认不透明度': 'shadow7',
  'Token|适用场景': 'shadowUsage2',
};

const DIM = 'dimension';

const HANDLERS = {
  semantic4(ctx, c) {
    const [name, desc, refCell, valCell] = c;
    if (valCell.startsWith('待确认')) {
      ctx.pending.push({ name, section: ctx.anchor, reason: valCell });
      return;
    }
    const parsed = parseValueCell(valCell);
    const refM = refCell.match(/^([a-z0-9-]+)\s*\/\s*(\d+(?:\.\d+)?)%$/);
    const t = { $type: 'color' };
    if (refM && parsed?.alphaPct) {
      t.$value = rgba(parsed.hex, refM[2] / 100);
      t.$extensions = { gts: { ref: refM[1], alpha: refM[2] / 100, description: desc } };
    } else if (parsed && !parsed.alphaPct) {
      t.$value = refCell ? `{${refCell}}` : parsed.hex;
      t.$extensions = { gts: { resolvedHex: parsed.hex, description: desc } };
    } else { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '色值无法解析' }); return; }
    ctx.tokens[name] = t;
  },
  palette2(ctx, c) {
    const [name, valCell] = c;
    const parsed = parseValueCell(valCell);
    if (!parsed || parsed.alphaPct) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '色板值异常' }); return; }
    ctx.tokens[name] = { $type: 'color', $value: parsed.hex };
  },
  paletteCompany3(ctx, c) {
    const [name, cat, valCell] = c;
    const parsed = parseValueCell(valCell);
    if (!parsed) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '辅助色值异常' }); return; }
    ctx.tokens[name] = { $type: 'color', $value: parsed.hex, $extensions: { gts: { category: cat } } };
  },
  charts5(ctx, c) {
    const [name, dRef, dVal, aRef, aVal] = c;
    const d = parseValueCell(dVal), a = parseValueCell(aVal);
    if (!d || !a) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '图表色值异常' }); return; }
    ctx.tokens[name] = {
      $type: 'color',
      $value: `{${dRef}}`,
      $extensions: { gts: { resolvedHex: d.hex, accessible: `{${aRef}}`, accessibleHex: a.hex } },
    };
  },
  code4(ctx, c) {
    const [name, sem, light, dark] = c;
    const l = parseValueCell(light), d = parseValueCell(dark);
    if (!l || !d) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '代码配色异常' }); return; }
    ctx.tokens[name] = { $type: 'color', $value: l.hex, $extensions: { gts: { dark: d.hex, hljs: sem } } };
  },
  spacing3(ctx, c) {
    const [name, norm, comp] = c;
    if (!/^\d+$/.test(norm) || !/^\d+$/.test(comp)) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '间距值非数字' }); return; }
    ctx.tokens[name] = { $type: DIM, $value: `${norm}px`, $extensions: { gts: { compact: `${comp}px` } } };
  },
  radius3(ctx, c) {
    const [name, val, scene] = c;
    if (!/^\d+$/.test(val)) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '圆角值非数字' }); return; }
    ctx.tokens[name] = { $type: DIM, $value: `${val}px`, $description: scene };
  },
  border4(ctx, c) {
    const [name, desc, light, dark] = c;
    const l = light.match(/^(\d+)px$/), d = dark.match(/^(\d+)px$/);
    if (!l) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '边框宽度异常' }); return; }
    const t = { $type: DIM, $value: `${l[1]}px`, $description: desc };
    if (d && d[1] !== l[1]) t.$extensions = { gts: { dark: `${d[1]}px` } };
    ctx.tokens[name] = t;
  },
  borderStyle3(ctx, c) {
    const [name, val, form] = c;
    ctx.tokens[name] = { $type: 'strokeStyle', $value: val, $description: form };
  },
  fontFamily3(ctx, c) {
    const [name, use, fonts] = c;
    const stack = fonts.replace(/（[^）]*）/g, '').split('、').map((s) => s.trim()).filter(Boolean);
    ctx.tokens[name] = { $type: 'fontFamily', $value: stack, $description: use };
  },
  typeSize5(ctx, c) {
    const [fsName, fs, lhName, lh, role] = c;
    if (!/^\d+$/.test(fs) || !/^\d+$/.test(lh)) { ctx.unparsed.push({ anchor: ctx.anchor, row: c.join(' | '), reason: '字号行高非数字' }); return; }
    ctx.tokens[fsName] = { $type: DIM, $value: `${fs}px`, $description: role === '—' ? undefined : role };
    ctx.tokens[lhName] = { $type: DIM, $value: `${lh}px` };
  },
  weight3(ctx, c) {
    const [name, w, use] = c;
    ctx.tokens[name] = { $type: 'fontWeight', $value: Number(w), $description: use };
  },
  shadow7(ctx, c) {
    const [name, level, x, y, blur, spread, alphaPct] = c;
    const n = (s) => `${s}px`;
    ctx.tokens[name] = {
      $type: 'shadow',
      $value: {
        offsetX: n(x), offsetY: n(y), blur: n(blur), spread: n(spread),
        color: rgba('#000000', parseFloat(alphaPct) / 100),
      },
      $extensions: { gts: { level, altAlpha: 0.8 } },
    };
  },
  shadowUsage2(ctx, c) {
    const [name, scene] = c;
    if (ctx.tokens[name]) {
      ctx.tokens[name].$extensions = ctx.tokens[name].$extensions || { gts: {} };
      ctx.tokens[name].$extensions.gts.usage = scene;
    }
  },
};

function extract(source, opts) {
  const lines = readFileSync(source, 'utf8').split(/\r?\n/);
  const ctx = { anchor: 'overview', tokens: {}, pending: [], unparsed: [] };
  const knownSections = new Set();
  let tableRows = null;

  const flushTable = () => {
    if (!tableRows) return;
    const headerSig = tableRows[0].map((c) => c.replace(/\s+/g, '')).join('|');
    const kind = PARSERS[headerSig];
    const handler = kind ? HANDLERS[kind] : null;
    if (!handler) {
      if (tableRows.length > 2) ctx.unparsed.push({ anchor: ctx.anchor, header: tableRows[0].join(' | '), reason: '签名未登记（非 token 表或新增表）' });
    } else {
      knownSections.add(ctx.anchor);
      for (const cells of tableRows.slice(2)) if (cells.length >= 2) handler(ctx, cells);
    }
    tableRows = null;
  };

  for (const line of lines) {
    const anchor = line.match(/<a id="([^"]+)"><\/a>/);
    if (anchor) { flushTable(); ctx.anchor = anchor[1]; continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = splitRow(line);
      if (!tableRows) tableRows = [cells];
      else tableRows.push(cells);
    } else flushTable();
  }
  flushTable();

  if (opts.seed) {
    const groups = JSON.parse(readFileSync(opts.seed, 'utf8')).groups || {};
    if (groups['frost-common']) seedFrost(ctx, groups);
    if (groups['semantic-light-backfill']) seedSemanticLight(ctx, groups['semantic-light-backfill'].tokens || {});
    if (groups['semantic-dark']) seedSemanticDark(ctx, groups['semantic-dark'].tokens || {});
  }

  return finalize(ctx, source, opts, knownSections);
}

function seedFrost(ctx, groups) {
  const old = { groups };
  // 旧库引用名 → v2.2.1 基线新名（A 档改名后的色板/尺寸层）
  const RENAME = {
    'gray-0White': 'gray-0',
    'gray-100Black': 'gray-100',
    'radius-xx-large': 'radius-size-big2',
    'radius-large': 'radius-size-medium',
  };
  const wanted = ['frost-common', 'frost-light', 'frost-dark', 'frost-decoration'];
  const lightTokens = groups['frost-light']?.tokens || {};
  const darkTokens = groups['frost-dark']?.tokens || {};
  for (const g of wanted) {
    for (const [k, v] of Object.entries(groups[g]?.tokens || {})) {
      const name = k.replace(/^--/, '');
      const value = typeof v.value === 'string'
        ? v.value.replace(/var\(--([A-Za-z0-9-]+)\)/g, (m, n) => RENAME[n] ? `var(--${RENAME[n]})` : m)
        : v.value;
      const type = v.type === 'reference' ? 'color' : v.type || 'color';
      const t = { $type: type, $value: value };
      if (v.usage) t.$description = v.usage;
      const ext = { gts: { source: 'backfill-g1.5.1', group: g } };
      // 浅/深同名对：扁平 schema 下只留一条（$value=浅色），差异值进 gts.dark。
      // 完全同值的 4 个（surface-*/gradient 等引用链）已由 light 覆盖，dark 跳过。
      if (g === 'frost-dark' && lightTokens[k]) {
        if (lightTokens[k].value === v.value) continue; // 同值，light 已录
        continue; // 不同值：不在此处处理（下方合并逻辑做）
      }
      ctx.tokens[name] = Object.assign(t, { $extensions: ext });
    }
  }
  // 浅/深差异合并：同名 token，$value=浅色，gts.dark=深色
  for (const [k, dv] of Object.entries(darkTokens)) {
    const lv = lightTokens[k];
    if (!lv || lv.value === dv.value) continue;
    const name = k.replace(/^--/, '');
    if (ctx.tokens[name]) {
      ctx.tokens[name].$extensions.gts.dark = dv.value;
    } else {
      const value = typeof dv.value === 'string'
        ? dv.value.replace(/var\(--([A-Za-z0-9-]+)\)/g, (m, n) => RENAME[n] ? `var(--${RENAME[n]})` : m)
        : dv.value;
      ctx.tokens[name] = {
        $type: dv.type === 'reference' ? 'color' : dv.type || 'color',
        $value: value,
        $extensions: { gts: { source: 'backfill-g1.5.1', group: 'frost-light', dark: dv.value } },
      };
    }
  }
}

// 旧 semantic-light 组的"待确认"token（如 color-bg-6）按设计师答复用旧版值回填。
// 直接覆盖浅色 $value 并清除 pending；深色走 seedSemanticDark 的同名行。
function seedSemanticLight(ctx, lightGroup) {
  let applied = 0, skipped = [];
  for (const [k, v] of Object.entries(lightGroup)) {
    const name = k.replace(/^--/, '');
    const t = ctx.tokens[name];
    if (!t) {
      // md 表中为"待确认"未入 tokens 的，直接创建
      if (v.type === 'color') {
        ctx.tokens[name] = {
          $type: 'color',
          $value: v.value,
          $extensions: { gts: { description: v.usage, lightSource: 'backfill-g1.5.1' } },
        };
        applied++;
      } else skipped.push(name + '(type)');
      continue;
    }
    if (t.$type !== 'color') { skipped.push(name + '(type)'); continue; }
    t.$value = v.value;
    t.$extensions = { ...t.$extensions, gts: { ...t.$extensions.gts, lightSource: 'backfill-g1.5.1' } };
    applied++;
  }
  ctx.pending = ctx.pending.filter((p) => !Object.keys(lightGroup).includes(`--${p.name}`));
  ctx.semanticLightBackfill = { applied, skipped };
}

// 旧 semantic-dark 组 → 同名浅色语义 token 的 gts.dark 回填。
// 仅处理 md 语义表里实际存在的 token（bg-6/portal-highlight/g-shadow 等退役名跳过）；
// 新 token 有 gts.dark 已是设计真源（code-*）时不覆盖。
function seedSemanticDark(ctx, darkGroup) {
  const RENAME = {
    'gray-0White': 'gray-0',
    'gray-100Black': 'gray-100',
  };
  const deref = (val) => typeof val === 'string'
    ? val.replace(/var\(--([A-Za-z0-9-]+)\)/g, (m, n) => RENAME[n] ? `var(--${RENAME[n]})` : m)
    : val;
  let applied = 0, skipped = [];
  for (const [k, v] of Object.entries(darkGroup)) {
    const name = k.replace(/^--/, '');
    const t = ctx.tokens[name];
    if (!t) { skipped.push(name); continue; }               // 新基线无此 token（退役名）
    if (t.$extensions?.gts?.dark) { continue; }              // 已有设计真源深色，不覆盖
    if (t.$type !== 'color') { skipped.push(name + '(type)'); continue; }
    t.$extensions = { ...t.$extensions, gts: { ...t.$extensions.gts, dark: deref(v.value), darkSource: 'backfill-g1.5.1' } };
    applied++;
  }
  ctx.semanticDarkBackfill = { applied, skipped };
}

function finalize(ctx, source, opts, knownSections) {
  // 校验：别名必须命中色板、resolvedHex 必须与色板一致（extract 级"禁造未定义值"门）
  const palette = {};
  for (const [name, t] of Object.entries(ctx.tokens)) {
    if (t.$type === 'color' && /^#[0-9A-Fa-f]{6}$/.test(t.$value)) palette[name] = t.$value.toUpperCase();
  }
  const aliasErrors = [];
  for (const [name, t] of Object.entries(ctx.tokens)) {
    const ref = t.$extensions?.gts?.ref;
    const resolved = t.$extensions?.gts?.resolvedHex;
    if (typeof t.$value === 'string' && t.$value.startsWith('{')) {
      const target = t.$value.slice(1, -1);
      if (!palette[target]) aliasErrors.push(`${name}: 别名 ${t.$value} 未命中色板`);
    }
    if (ref && resolved && palette[ref] && palette[ref] !== resolved) {
      aliasErrors.push(`${name}: resolvedHex ${resolved} ≠ 色板 ${ref} ${palette[ref]}`);
    }
  }

  const counts = {};
  for (const [name, t] of Object.entries(ctx.tokens)) {
    const s = t.$extensions?.gts?.source === 'backfill-g1.5.1' ? 'frost(seed)' : name.split('-')[0];
    counts[s] = (counts[s] || 0) + 1;
  }

  return {
    meta: {
      schema: 'gts-flat-dtcg/1',
      source,
      sourceVersion: opts.sourceVersion || 'unversioned',
      extractedAt: new Date().toISOString(),
      counts,
      pending: ctx.pending,
      unparsed: ctx.unparsed,
      aliasErrors,
      semanticDarkBackfill: ctx.semanticDarkBackfill || null,
      semanticLightBackfill: ctx.semanticLightBackfill || null,
      sectionsParsed: [...knownSections],
    },
    tokens: ctx.tokens,
  };
}

  const args = parseArgs(process.argv);
if (!args.source || !args.out) {
  console.error('Usage: node extract-tokens.mjs --source <md> --out <json> [--seed <old.json>] [--sourceVersion v] [--report <txt>]');
  process.exit(1);
}

const result = extract(args.source, args);
mkdirSync(path.dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n', 'utf8');

const { counts, pending, unparsed, aliasErrors } = result.meta;
console.log(`tokens: ${Object.keys(result.tokens).length}`);
console.log('counts by prefix:', JSON.stringify(counts));
console.log(`pending: ${pending.length}, unparsed tables: ${unparsed.length}, aliasErrors: ${aliasErrors.length}`);
for (const p of pending) console.log(`  PENDING ${p.name} — ${p.reason.slice(0, 60)}`);
for (const u of unparsed) console.log(`  UNPARSED [${u.anchor}] ${u.header || u.row} — ${u.reason}`);
for (const e of aliasErrors) console.log(`  ALIAS-ERROR ${e}`);
if (result.meta.semanticDarkBackfill) {
  const b = result.meta.semanticDarkBackfill;
  console.log(`semantic-dark backfill: ${b.applied} applied${b.skipped.length ? `, skipped: ${b.skipped.join(', ')}` : ''}`);
}
if (result.meta.semanticLightBackfill) {
  const b = result.meta.semanticLightBackfill;
  console.log(`semantic-light backfill: ${b.applied} applied${b.skipped.length ? `, skipped: ${b.skipped.join(', ')}` : ''}`);
}
if (args.report) {
  mkdirSync(path.dirname(args.report), { recursive: true });
  writeFileSync(args.report, JSON.stringify(result.meta, null, 2) + '\n', 'utf8');
}
