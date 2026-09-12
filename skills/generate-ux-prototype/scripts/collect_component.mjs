#!/usr/bin/env node
// collect_component.mjs
// Copies a reusable G component (and its intra-library dependency closure)
// from the asset library into a prototype workspace — replaces the AI's
// manual multi-round read+write with one deterministic command (D12).
//
// Resolution: spec components/specs/{id}.json → source .vue → regex-scan
// relative imports → recursive closure → mirror-copy by in-library relative
// path into {target-dir}/{basic|business|complex}/GName/ (D17, same level
// directory names as the library). Only GName.vue files are copied (D20:
// index.ts / examples.vue never copied); a .vue that imports a sibling's
// types.ts is a migration gap → listed as missing, never silently skipped.
//
// Every copied file gets a provenance header:
//   <!-- 源: g-design {assetVersion} {componentId} ({in-library path}) — 禁止修改；升级走资产库 -->
//
// Usage:
//   node collect_component.mjs <assets-root> <component-id> <workspace-src> <target-dir>
//     <assets-root>   asset library root (contains asset-manifest.json)
//     <component-id>  spec id, e.g. g-monitor-panel
//     <workspace-src> workspace src dir (provenance/overlap checks run here)
//     <target-dir>    copy destination root — normally <workspace-src>/components
//
// Output (agent-parseable):
//   RESULT: OK
//   ENTRY: <component-id> → <target-relative dir>
//   FILES: <n>
//   COPIED: <path>            (one line per file, target-relative)
//   RESULT: FAIL | <reason>

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname, posix } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fail(reason) {
  console.log(`RESULT: FAIL | ${reason}`);
  process.exit(1);
}

// ---------- args ----------
const [assetsRootArg, componentId, workspaceSrcArg, targetDirArg] = process.argv.slice(2);
if (!assetsRootArg || !componentId || !workspaceSrcArg || !targetDirArg) {
  fail('Usage: node collect_component.mjs <assets-root> <component-id> <workspace-src> <target-dir>');
}
const assetsRoot = resolve(assetsRootArg);
const workspaceSrc = resolve(workspaceSrcArg);
const targetDir = resolve(targetDirArg);
if (!existsSync(join(assetsRoot, 'asset-manifest.json'))) {
  fail(`asset library not found (no asset-manifest.json): ${assetsRoot}`);
}
if (!existsSync(workspaceSrc)) {
  fail(`workspace src not found: ${workspaceSrc}`);
}

// ---------- spec ----------
const specPath = join(assetsRoot, 'components', 'specs', `${componentId}.json`);
if (!existsSync(specPath)) {
  fail(`component spec not found: ${componentId} (looked for ${specPath})`);
}
let spec;
try {
  spec = JSON.parse(readFileSync(specPath, 'utf8'));
} catch (e) {
  fail(`spec parse error: ${e.message}`);
}
if (!spec.source || !spec.source.endsWith('.vue')) {
  fail(`spec has no .vue source: ${componentId}`);
}
if (spec.id && spec.id !== componentId) {
  fail(`spec id mismatch: requested ${componentId}, spec says ${spec.id}`);
}
const level = spec.level; // basic | business | complex
if (!['basic', 'business', 'complex'].includes(level)) {
  fail(`spec level invalid: '${level}' (expected basic|business|complex)`);
}
let assetVersion = spec.assetVersion || 'unknown';

// ---------- closure walk ----------
// imports are always bare directory/file refs WITHOUT extension (true across
// the library: './types', '../GTopology', '../../business/GStatusTag')
const IMPORT_RE = /import\s*(?:type\s*)?[^'";]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|export\s*(?:\*|\{[^}]*\})\s*from\s*['"](\.[^'"]+)['"]/g;

function resolveLibFile(fromLibFile, spec) {
  // returns posix path of the referenced file inside the library, or null.
  // spec is resolved relative to the importing FILE's directory.
  // candidates: sibling .vue first (component-to-component by directory name),
  // then the directory's index.ts (re-export indirection), then a plain .ts
  // (types module).
  const parts = posix.normalize(posix.join(posix.dirname(fromLibFile), spec)).split('/');
  const stack = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  const base = stack.join('/');
  // import specifier may already carry an extension ('./GStatusTag.vue')
  if (/\.(vue|ts|js)$/.test(base)) {
    return existsSync(join(assetsRoot, base)) ? base : null;
  }
  for (const cand of [base + '.vue', base + '/index.ts', base + '.ts']) {
    if (existsSync(join(assetsRoot, cand))) return cand;
  }
  return null;
}

const entryLib = posix.normalize(spec.source);
if (!existsSync(join(assetsRoot, entryLib))) {
  fail(`spec source missing in library: ${entryLib}`);
}

const seen = new Map(); // libRelPath -> text
const queue = [entryLib];
const missing = new Set();
while (queue.length) {
  const libFile = queue.shift();
  if (seen.has(libFile)) continue;
  const text = readFileSync(join(assetsRoot, libFile), 'utf8');
  seen.set(libFile, text);
  for (const raw of text.matchAll(IMPORT_RE)) {
    const spec0 = raw[1] || raw[2] || raw[3];
    if (!spec0) continue;
    const resolved = resolveLibFile(libFile, spec0);
    if (resolved === null) {
      const dir = posix.dirname(libFile);
      const parts = posix.normalize(posix.join(dir, spec0)).split('/');
      const stack = [];
      for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') stack.pop();
        else stack.push(p);
      }
      missing.add(stack.join('/'));
      continue;
    }
    if (!seen.has(resolved)) queue.push(resolved);
  }
}

// ---------- closure policy (D20) ----------
// Copy only .vue files. index.ts is a re-export indirection — keep walking its
// imports (it forwards to GName.vue) but never copy it; examples.vue is never
// reached because nothing imports it. A remaining .ts (types.ts) means the
// component depends on a sibling's type module — under component-format v1
// those get inlined by the W2 migration, so today this is a gap to report,
// not to copy.
const vueFiles = [...seen.keys()].filter((f) => f.endsWith('.vue'));
const entryComponentName = posix.basename(entryLib).replace(/\.vue$/, '');
// index.ts in seen = re-export indirection we walked through — fine.
// Any OTHER .ts (types.ts) in the closure is a migration gap: component-format
// v1 inlines types into .vue, so a types dependency means the library is
// pre-migration (W2-M1 pending) or broken. Report, don't copy.
const tsGaps = [...seen.keys()].filter((f) => f.endsWith('.ts') && posix.basename(f) !== 'index.ts');
for (const ts of tsGaps) missing.add(ts);
if (missing.size > 0) {
  fail(
    `dependency closure incomplete — these library files are referenced but not copyable .vue ` +
    `(W2 migration inlines types/index into .vue; asset library may be pre-migration or broken):\n    ` +
    [...missing].sort().join('\n    ')
  );
}

// ---------- provenance + write ----------
function headerFor(ext, libPath) {
  const line = `源: g-design ${assetVersion} ${componentId} (${libPath}) — 禁止修改；升级走资产库`;
  if (ext === '.vue') return `<!-- ${line} -->\n`;
  return `/* ${line} */\n`;
}

const copied = [];
for (const libFile of vueFiles) {
  const name = posix.basename(libFile).replace(/\.vue$/, '');
  const compDir = posix.basename(posix.dirname(libFile));
  if (name !== compDir) {
    fail(`library layout unexpected: ${libFile} (file name must match its directory — component-format v1)`);
  }
  // target path: {target-dir}/{level}/{compDir}/{name}.vue — level derived
  // from EACH FILE's own library path (…/components/{level}/GName/), so
  // dependencies land under the same classification they have in the library
  // and the entry's relative imports stay resolvable after copy (D17: target
  // layout mirrors the library's components/{level}/ grouping). The entry's
  // own level additionally cross-checks against the spec's `level` field.
  const seg = libFile.split('/');
  const ci = seg.indexOf('components');
  if (ci === -1 || !seg[ci + 1] || !seg[ci + 2]) {
    fail(`library layout unexpected: ${libFile} (expected …/components/{level}/{GName}/…)`);
  }
  const fileLevel = seg[ci + 1];
  if (libFile === entryLib && fileLevel !== level) {
    fail(`spec level '${level}' does not match library path '${fileLevel}' for ${componentId} — fix the spec or the library layout`);
  }
  const destAbs = join(targetDir, fileLevel, compDir, `${name}.vue`);
  if (existsSync(destAbs)) {
    fail(`target already exists (delete or rename it first): ${destAbs}`);
  }
  const header = headerFor('.vue', libFile);
  const body = seen.get(libFile).replace(/^\uFEFF/, '');
  mkdirSync(dirname(destAbs), { recursive: true });
  writeFileSync(destAbs, header + body, 'utf8');
  copied.push(posix.join(fileLevel, compDir, `${name}.vue`).split('\\').join('/'));
  // interop shim: library components import siblings by directory name
  // (`import { GStatusTag } from '../…/GStatusTag'`), but a bare SFC has no
  // named exports. The shim (two-step export — sfc-loader 0.9.5 breaks on
  // `export … from`, see W1-T3) gives the directory a correct named出口.
  // Preview-only file; a real Vite build resolves the same import natively.
  const shimAbs = join(targetDir, fileLevel, compDir, 'index.js');
  const shimBody =
    `// interop shim — 由 collect_component.mjs 生成，勿手改\n` +
    `import GComponent from './${name}.vue'\n` +
    `export { GComponent as ${name} }\n` +
    `export default GComponent\n`;  if (existsSync(shimAbs)) {
    fail(`target already exists (delete or rename it first): ${shimAbs}`);
  }
  writeFileSync(shimAbs, shimBody, 'utf8');
  copied.push(posix.join(fileLevel, compDir, 'index.js').split('\\').join('/'));
}

// ---------- done ----------
console.log('RESULT: OK');
console.log(`ENTRY: ${componentId} → ${posix.join('components', level, entryComponentName)}`);
console.log(`ASSETS_VERSION: ${assetVersion}`);
console.log(`FILES: ${copied.length}`);
for (const c of copied.sort()) console.log(`COPIED: ${c}`);
process.exit(0);
