#!/usr/bin/env node
/**
 * sync-components.mjs — 3d-components → skill 组件资产同步（一条命令）
 *
 * 在 3d-components 源仓根目录执行：
 *   node <skill>/scripts/sync-components.mjs
 *
 * 做四步（每步失败即中止，非零退出）：
 *   1. npm run build            —— 源仓构建（ESM/CJS + d.ts）
 *   2. npm pack --json          —— 打标准 tgz（dist + docs/components.json）
 *   3. tgz + docs 拷入 skill vendor/
 *   4. typedoc 提取 → 生成两级 md 文档：
 *      references/component-catalog.md      （Tier-1：一行一组件，LLM 常驻）
 *      references/component-docs/<Name>.md  （Tier-2：每组件用法页，LLM 按需）
 *
 * 机器门禁：导出面组件（ barrels 导出的 class ）类文档或 @example 缺失 → 非零退出。
 * vendored 三方代码（camera 系 / InstancedMesh2 系 / PointerCaptureTarget）豁免。
 *
 * 定位：3d-components 保持开发主线；组件改完跑本脚本，skill 内组件资产即新。
 * 未来发 npm 仓后：产物工程改走 registry 依赖，skill 移除 vendor/ 即可，本脚本
 * 的 md 生成链保持不变（typedoc 源是源码 TSDoc，与分发形态无关）。
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '..');
const VENDOR_DIR = join(SKILL_ROOT, 'vendor');
const DOCS_DIR = join(SKILL_ROOT, 'references', 'component-docs');
const CATALOG_MD = join(SKILL_ROOT, 'references', 'component-catalog.md');

const fail = (msg) => {
  console.error(`[sync-components] ✗ ${msg}`);
  process.exit(1);
};

// ── 定位源仓（3d-components 与 ep-coder 同级或在任意 cwd） ──────────────────
// 优先级：--src 参数 > 环境变量 A3D_SRC > 相对约定（gts/test 下 octo/test/3d-components）
function findSourceRepo() {
  const argIdx = process.argv.indexOf('--src');
  if (argIdx !== -1 && process.argv[argIdx + 1]) return resolve(process.argv[argIdx + 1]);
  if (process.env.A3D_SRC) return resolve(process.env.A3D_SRC);
  // 相对 skill 的约定路径（跨仓同级开发布局）
  const guess = resolve(SKILL_ROOT, '../../../..', 'octo/test/3d-components');
  if (existsSync(join(guess, 'package.json'))) return guess;
  return fail(
    '找不到 3d-components 源仓。用法：node sync-components.mjs --src <3d-components 目录>'
    + '（或设环境变量 A3D_SRC）',
  );
}

const srcRoot = findSourceRepo();
console.log(`[sync-components] 源仓: ${srcRoot}`);
console.log(`[sync-components] skill: ${SKILL_ROOT}`);

const require_ = createRequire(join(srcRoot, 'package.json'));
const run = (label, cmd, args, cwd) => {
  console.log(`[${label}] ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error) fail(`${label} 启动失败: ${r.error.message}`);
  if (r.status !== 0) fail(`${label} 失败（退出码 ${r.status}）`);
};

// ── 步骤 1：源仓构建 ────────────────────────────────────────────────────────
run('build', 'npm', ['run', 'build'], srcRoot);

// ── 步骤 2：npm pack ───────────────────────────────────────────────────────
const packBuf = spawnSync('npm', ['pack', '--json'], { cwd: srcRoot, shell: process.platform === 'win32', encoding: 'utf8' });
if (packBuf.status !== 0) fail(`npm pack 失败: ${packBuf.stderr}`);
// npm pack --json 的 stdout 整体是 JSON 数组（Windows 下无前导噪音）；容忍个别环境的非 JSON 前缀
const raw = packBuf.stdout;
let packInfo;
try {
  const parsed = JSON.parse(raw);
  packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
} catch {
  const lines = raw.split(/\r?\n/);
  packInfo = null;
  for (let i = 0; i < lines.length && !packInfo; i++) {
    try {
      const parsed = JSON.parse(lines.slice(i).join('\n'));
      packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch { /* try next offset */ }
  }
}
if (!packInfo || !packInfo.filename) fail(`npm pack 输出无法解析:\n${raw.slice(0, 400)}`);
const tgzName = packInfo.filename;              // a3d-a3d-components-0.1.0.tgz
const tgzPath = join(srcRoot, tgzName);
const pkgVersion = packInfo.version;
console.log(`[pack] ${tgzName} (v${pkgVersion})`);

// ── 步骤 3：拷入 skill vendor/ ─────────────────────────────────────────────
mkdirSync(VENDOR_DIR, { recursive: true });
// 清理旧版本 tgz（同名不同版本不残留）
for (const f of existsSync(VENDOR_DIR) ? require_('fs').readdirSync(VENDOR_DIR) : []) {
  if (f.endsWith('.tgz')) rmSync(join(VENDOR_DIR, f));
}
const tgzDest = join(VENDOR_DIR, tgzName);
copyFileSync(tgzPath, tgzDest);
rmSync(tgzPath); // 源仓不留副本
console.log(`[vendor] ${relative(SKILL_ROOT, tgzDest)}`);

// ── 步骤 4：typedoc 提取 + 两级 md 生成 ────────────────────────────────────
console.log('[typedoc] 提取中…');
const tmpJson = join(srcRoot, '.tmp-sync-td.json');
run('typedoc', 'npx', ['typedoc', '--json', basename(tmpJson), '--logLevel', 'None', '--skipErrorChecking'], srcRoot);
const td = JSON.parse(readFileSync(tmpJson, 'utf8'));
rmSync(tmpJson);

// typedoc kind 常量（数字，跨版本稳定）
const KIND = { CLASS: 128, INTERFACE: 129, FUNCTION: 256, TYPE_ALIAS: 4194304, PROPERTY: 1024, METHOD: 2048, CONSTRUCTOR: 512, GETTER: 262144, SETTER: 1048576, VARIABLE: 32 };

function commentText(comment) {
  if (!comment) return '';
  const parts = (comment.summary || []).map((s) => s.text || '');
  return parts.join('').trim();
}
function defaultText(comment) {
  if (!comment) return null;
  const tag = (comment.blockTags || []).find((t) => t.tag === '@default');
  if (!tag) return null;
  const raw = (tag.content || []).map((c) => c.text || '').join('').trim();
  // 兜底剥围栏：@default 内容被写成 code block 时（typedoc content 自带 ```），表格单元格里是破版源
  const unfenced = raw
    .replace(/^```(?:ts|typescript)?\r?\n?/, '')
    .replace(/\r?\n?```\s*$/, '')
    .trim();
  // 多行值压成单行（表格单元格不能含换行；首行即值本体）
  const firstLine = unfenced.split(/\r?\n/)[0].trim();
  return firstLine || null;
}
function exampleText(comment) {
  if (!comment) return null;
  const tag = (comment.blockTags || []).find((t) => t.tag === '@example');
  if (!tag) return null;
  // typedoc 把 @example 内容解析为 {kind:'code'|'text', text} 片段；code 片段的 text 自带 ``` 围栏
  const codeParts = (tag.content || [])
    .filter((c) => c.kind === 'code')
    .map((c) => (c.text || '').replace(/^```(?:ts|typescript)?\r?\n?/, '').replace(/\r?\n?```\s*$/, ''));
  const textParts = (tag.content || []).filter((c) => c.kind === 'text').map((c) => (c.text || '').trim());
  return codeParts.join('\n') || textParts.join('\n') || null;
}

const top = td.children || [];
const classes = top.filter((c) => c.kind === KIND.CLASS);
const sources = classes.map((c) => {
  const ctor = (c.children || []).find((m) => m.kind === KIND.CONSTRUCTOR);
  const ctorSig = ctor && ctor.signatures && ctor.signatures[0];
  // options 接口名 = ctor 首参 type 里剥泛型后匹配的 interface
  const ctorParamType = ctorSig && ctorSig.parameters && ctorSig.parameters[0]
    && ctorSig.parameters[0].type;
  let options = null;
  if (ctorParamType) {
    const tname = ctorParamType.name || (ctorParamType.target && ctorParamType.target.name) || '';
    options = top.find((o) => o.name === tname && o.kind !== KIND.CLASS) || null;
  }
  return {
    name: c.name,
    summary: commentText(c.comment),
    example: exampleText(c.comment),
    hasClassDoc: !!c.comment,
    options,
  };
});

// ── 门禁：导出组件必须有类文档 + @example（vendored 豁免名单外） ─────────────
const VENDORED = new Set([
  'InstancedEntity', 'InstancedMesh2', 'InstancedMeshBVH', // InstancedMesh2 系
  'PickController',                                        // graph 内部
  'EventDispatcher',
]);
const missing = sources.filter(
  (s) => !VENDORED.has(s.name) && (!s.hasClassDoc || !s.example),
);
if (missing.length) {
  fail(
    `TSDoc 门禁不过（缺类文档或 @example）:\n  ${missing.map((m) => m.name).join('\n  ')}\n`
    + '  补齐源码 TSDoc 后重跑；vendored 三方组件请加入脚本头部 VENDORED 豁免名单。',
  );
}

// ── importPath 推断：barrel 分析（core/heat/material/... 哪个 index.ts 导出它）──
// 子域入口优先于根入口（tree-shaking 最优）；根 index 的 export * 链同样能命中，
// 但只作兜底——所以 BARRELS 把 index 排最后。
const BARRELS = ['core', 'heat', 'material', 'utils', 'helper', 'graph',
  'controls', 'camera', 'interactive', 'animation', 'loader', 'index'];

// 解析单个 barrel 文件：返回 { named:Set<string>, stars:string[]（相对目录） }
function parseBarrel(file) {
  const src = readFileSync(file, 'utf8');
  const named = new Set();
  const stars = [];
  let m;
  const namedRe = /export\s*(?:type\s*)?\{([^}]*)\}/gs;
  while ((m = namedRe.exec(src)) !== null) {
    for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const asMatch = n.match(/^(\w+)\s+as\s+(\w+)$/);
      named.add(asMatch ? asMatch[2] : n);
    }
  }
  const starRe = /export\s*\*\s*from\s*['"]([^'"]+)['"]/g;
  while ((m = starRe.exec(src)) !== null) stars.push(m[1]);
  return { named, stars };
}

// 命名导出直接命中；星号重导出递归一层子 barrel（src/controls/index.ts → export * from
// './PivotControls' → src/controls/PivotControls/index.ts 的命名导出）
function barrelExportsClass(barrelFile, className, depth = 0) {
  const { named, stars } = parseBarrel(barrelFile);
  if (named.has(className)) return true;
  if (depth >= 2) return false; // 防环/防深递归：两层（域 barrel → 子目录 barrel）足够
  for (const star of stars) {
    const sub = resolve(dirname(barrelFile), star, 'index.ts');
    if (existsSync(sub) && barrelExportsClass(sub, className, depth + 1)) return true;
    // 星号也可能指向文件（export * from './foo' 无 index）——只有目录+index 形态才递归
  }
  return false;
}

function findImportPath(className) {
  for (const b of BARRELS) {
    const p = b === 'index' ? join(srcRoot, 'src', 'index.ts') : join(srcRoot, 'src', b, 'index.ts');
    if (existsSync(p) && barrelExportsClass(p, className)) {
      return `@a3d/a3d-components${b === 'index' ? '' : `/${b}`}`;
    }
  }
  return '@a3d/a3d-components';
}

// ── Tier-2 生成：每组件用法页 ──────────────────────────────────────────────
mkdirSync(DOCS_DIR, { recursive: true });
const made = [];
for (const s of sources) {
  const lines = [];
  lines.push(`# ${s.name}`);
  lines.push('');
  lines.push(`\`import { ${s.name} } from '${findImportPath(s.name)}'\``);
  lines.push('');
  if (s.summary) {
    lines.push(s.summary);
    lines.push('');
  }
  // options 表
  if (s.options) {
    const fields = (s.options.children || []).filter((f) => f.kind === KIND.PROPERTY);
    if (fields.length) {
      lines.push(`## Options（${s.options.name}）`);
      lines.push('');
      lines.push('| 字段 | 类型 | 默认值 | 说明 |');
      lines.push('|---|---|---|---|');
      for (const f of fields) {
        const type = f.type ? typeToString(f.type) : '—';
        const def = defaultText(f.comment) ?? '—';
        const desc = commentText(f.comment) || '—';
        lines.push(`| ${f.name} | \`${type}\` | ${def === '—' ? '—' : `\`${def}\``} | ${desc.replace(/\|/g, '\\|')} |`);
      }
      lines.push('');
    }
  }
  // 示例
  const ex = s.example;
  if (ex) {
    lines.push('## Example');
    lines.push('');
    lines.push('```ts');
    lines.push(ex);
    lines.push('```');
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。');
  const file = join(DOCS_DIR, `${s.name}.md`);
  writeFileSync(file, lines.join('\n'), 'utf8');
  made.push(s.name);
}
console.log(`[docs] ${made.length} 个组件用法页 → ${relative(SKILL_ROOT, DOCS_DIR)}/`);

function typeToString(t) {
  if (!t) return '?';
  switch (t.type) {
    case 'intrinsic': return t.name;
    case 'reference': {
      const args = (t.typeArguments || []).map(typeToString);
      return t.name + (args.length ? `<${args.join(', ')}>` : '');
    }
    case 'array': return `${typeToString(t.elementType)}[]`;
    case 'union': return (t.types || []).map(typeToString).join(' \\| ');
    case 'literal': return JSON.stringify(t.value);
    case 'tuple': return `[${(t.elements || []).map(typeToString).join(', ')}]`;
    case 'reflection': return '{…}'; // 复杂内联结构，Tier-2 显示占位
    case 'intersection': return (t.types || []).map(typeToString).join(' & ');
    default: return t.name || t.type || '?';
  }
}

// ── Tier-1 生成：catalog 一行一组件 ────────────────────────────────────────
const catalogLines = [];
catalogLines.push('# 3D 组件目录（a3d-components）');
catalogLines.push('');
catalogLines.push(`> 版本：${pkgVersion} ｜ 生成：${new Date().toISOString().slice(0, 10)}（sync-components.mjs 自动生成，勿手改）`);
catalogLines.push('');
catalogLines.push('从场景需求出发查本表选组件；确定用哪个后，读 `component-docs/<Name>.md` 学 options，再 import 使用。');
catalogLines.push('');
catalogLines.push('| 组件 | 一句话 | import | 用法页 |');
catalogLines.push('|---|---|---|---|');
for (const s of sources) {
  const oneLiner = (s.summary || '').split(/[。.\n]/)[0].trim() || '—';
  const ip = findImportPath(s.name);
  catalogLines.push(`| **${s.name}** | ${oneLiner} | \`'${ip}'\` | [${s.name}.md](component-docs/${s.name}.md) |`);
}
catalogLines.push('');
catalogLines.push('## 使用纪律');
catalogLines.push('');
catalogLines.push('- 产物工程通过 `vendor/a3d-*.tgz`（file: 依赖）安装本库；未来发 npm 后改 registry 版本号。');
catalogLines.push('- options 全表见各组件用法页；类型细节可查产物工程 `node_modules/@a3d/a3d-components/dist/es/*.d.ts`（逃生口，默认不读）。');
catalogLines.push('- 组件持续更新由源仓维护；升级 = 源仓重跑 sync 脚本 + 交付工程换 tgz 版本。');
writeFileSync(CATALOG_MD, catalogLines.join('\n'), 'utf8');
console.log(`[catalog] ${relative(SKILL_ROOT, CATALOG_MD)}`);

console.log(`[sync-components] ✓ 完成：v${pkgVersion}，${made.length} 组件，catalog + docs 已更新`);
