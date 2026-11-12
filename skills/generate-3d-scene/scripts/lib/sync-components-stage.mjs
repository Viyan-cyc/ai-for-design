// Internal disposable-stage worker. Use ../sync-components.mjs.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(process.env.A3D_SYNC_STAGE || '.');
if (!process.env.A3D_SYNC_STAGE || !existsSync(join(SKILL_ROOT, '.component-sync-stage.json'))) throw Error('Only run through sync-components preparation');
const VENDOR_DIR = join(SKILL_ROOT, 'vendor');
const DOCS_DIR = join(SKILL_ROOT, 'references', 'component-docs');
const CATALOG_MD = join(SKILL_ROOT, 'references', 'component-catalog.md');

const fail = (msg) => {
  console.error(`[sync-components] ✗ ${msg}`);
  process.exit(1);
};

// Explicit disposable source copy supplied by the preparation orchestrator.
function findSourceRepo() { const i=process.argv.indexOf('--src'); if(i<0||!process.argv[i+1])throw Error('Explicit --src required'); return resolve(process.argv[i+1]); }

const srcRoot = findSourceRepo();
if(JSON.parse(readFileSync(join(SKILL_ROOT,'.component-sync-stage.json'),'utf8')).source !== srcRoot)throw Error('Stage source mismatch');
console.log(`[sync-components] 源仓: ${srcRoot}`);
console.log(`[sync-components] skill: ${SKILL_ROOT}`);

const require_ = createRequire(join(srcRoot, 'package.json'));
const run = (label, cmd, args, cwd) => {
  console.log(`[${label}] ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: cmd !== process.execPath && process.platform === 'win32' });
  if (r.error) fail(`${label} 启动失败: ${r.error.message}`);
  if (r.status !== 0) fail(`${label} 失败（退出码 ${r.status}）`);
};

// ── 步骤 1：源仓构建 ────────────────────────────────────────────────────────
let tgzName;
let pkgVersion;
run('types', process.execPath, ['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.app.json'], srcRoot);
run('docs-index', process.execPath, ['scripts/gen-component-docs.mjs'], srcRoot);
run('build', process.execPath, ['node_modules/vite/bin/vite.js','build'], srcRoot);

// ── 步骤 2：npm pack ───────────────────────────────────────────────────────
const packBuf = spawnSync('npm', ['pack', '--json', '--ignore-scripts'], { cwd: srcRoot, shell: process.platform === 'win32', encoding: 'utf8' });
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
  tgzName = packInfo.filename;              // a3d-a3d-components-0.1.0.tgz
  const tgzPath = join(srcRoot, tgzName);
  pkgVersion = packInfo.version;
console.log(`[pack] ${tgzName} (v${pkgVersion})`);

// ── 步骤 3：拷入 skill vendor/ ─────────────────────────────────────────────
mkdirSync(VENDOR_DIR, { recursive: true });
// 清理旧版本 tgz（同名不同版本不残留）
for (const f of existsSync(VENDOR_DIR) ? require_('fs').readdirSync(VENDOR_DIR) : []) {
  if (f.endsWith('.tgz') && f !== tgzName) rmSync(join(VENDOR_DIR, f));
}
const tgzDest = join(VENDOR_DIR, tgzName);
copyFileSync(tgzPath, tgzDest);
rmSync(tgzPath); // 源仓不留副本
console.log(`[vendor] ${relative(SKILL_ROOT, tgzDest)}`);

// ── 步骤 4：typedoc 提取 + 两级 md 生成 ────────────────────────────────────
console.log('[typedoc] 提取中…');
const tmpJson = join(srcRoot, '.tmp-sync-td.json');
run('typedoc', process.execPath, ['node_modules/typedoc/bin/typedoc', '--json', basename(tmpJson), '--logLevel', 'None', '--skipErrorChecking'], srcRoot);
const td = JSON.parse(readFileSync(tmpJson, 'utf8'));
rmSync(tmpJson);

// typedoc kind 常量（数字，跨版本稳定）
const reflection = (await import(pathToFileURL(require_.resolve('typedoc')).href)).ReflectionKind;
const KIND = { CLASS: reflection.Class, INTERFACE: reflection.Interface, FUNCTION: reflection.Function, PROPERTY: reflection.Property, CONSTRUCTOR: reflection.Constructor };

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

// Multiple entry points are emitted as modules; flatten only module containers.
const top = (td.children || []).flatMap(c => c.kind === 2 ? (c.children || []) : [c]);
const classes = top.filter((c) => c.kind === KIND.CLASS);
const nativeNames=new Set();const intakeDir=join(srcRoot,'docs/intake');
if(existsSync(intakeDir))for(const f of require_('fs').readdirSync(intakeDir).filter(f=>f.endsWith('.json'))){const r=JSON.parse(readFileSync(join(intakeDir,f),'utf8'));r.names.forEach(n=>nativeNames.add(n));}
const factoryComment=c=>c.comment??c.signatures?.[0]?.comment;
const factories = top.filter(c=>c.kind===KIND.FUNCTION && (nativeNames.has(c.name) || /^create[A-Z]/.test(c.name)) && exampleText(factoryComment(c)) && commentText(factoryComment(c)));
const sources = [...classes,...factories].map((c) => {
  const docComment=c.kind===KIND.FUNCTION?factoryComment(c):c.comment;
  const ctor = (c.children || []).find((m) => m.kind === KIND.CONSTRUCTOR);
  const create = (c.children || []).find(m => m.name === 'create' && m.flags?.isStatic);
  const ctorSig = ctor?.signatures?.[0] ?? create?.signatures?.[0] ?? c.signatures?.[0];
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
    summary: commentText(docComment),
    example: exampleText(docComment),
    hasClassDoc: !!docComment,
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
const packageInfo=JSON.parse(readFileSync(join(srcRoot,'package.json'),'utf8'));
const BARRELS=Object.keys(packageInfo.exports).filter(k=>/^\.\/[a-z][a-z0-9-]*$/.test(k)).map(k=>k.slice(2)).concat('index');
const ts=require_('typescript');
const entries=BARRELS.map(b=>join(srcRoot,'src',b==='index'?'index.ts':b+'/index.ts')).filter(existsSync);
const program=ts.createProgram(entries,{module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true});
const checker=program.getTypeChecker(),imports=new Map();
for(const entry of entries){const sf=program.getSourceFile(entry);const b=entry===join(srcRoot,'src/index.ts')?'':basename(dirname(entry));for(const sym of checker.getExportsOfModule(checker.getSymbolAtLocation(sf)))if(!imports.has(sym.name))imports.set(sym.name,'@a3d/a3d-components'+(b?'/'+b:''));}
function findImportPath(name){const path=imports.get(name);if(!path)throw Error('Public import unavailable: '+name);return path;}
const indexedDocs=JSON.parse(readFileSync(join(srcRoot,'docs/components.json'),'utf8'));

for(const name of nativeNames)if(!sources.some(s=>s.name===name))throw Error('Admitted export missing TSDoc/example: '+name);
const cell=v=>String(v??'—').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');

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
  // Native defaults come from the verified intake-generated documentation.
  const nativeDoc=nativeNames.has(s.name)?indexedDocs.find(d=>d.name===s.name):null;
  if(nativeNames.has(s.name)&&!nativeDoc)throw Error('Missing native component documentation: '+s.name);
  if(nativeDoc){lines.push('## 参数','', '| 参数 | 类型 | 默认值 | 说明 |','|---|---|---|---|');for(const f of nativeDoc.options)lines.push('| '+[f.name,f.type,f.default,f.description].map(cell).join(' | ')+' |');lines.push('');}
  if (!nativeDoc && s.options) {
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
  lines.push('<!-- Generated by sync-components.mjs -->');
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
catalogLines.push('<!-- Generated by sync-components.mjs -->');
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
catalogLines.push('- options 全表见各组件用法页；类型细节可查外部依赖环境中的 `node_modules/@a3d/a3d-components/dist/es/*.d.ts`（逃生口，默认不读）。');
catalogLines.push('- 组件升级按 component-sync.md 的维护流程处理；已有工程不会自动改版。');
writeFileSync(CATALOG_MD, catalogLines.join('\n'), 'utf8');
console.log(`[catalog] ${relative(SKILL_ROOT, CATALOG_MD)}`);

console.log(`[sync-components] ✓ 完成：v${pkgVersion}，${made.length} 组件，catalog + docs 已更新`);
