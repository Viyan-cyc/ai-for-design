#!/usr/bin/env node
// build.mjs
// Build & verify a prototype page workspace ({slug}/ with src/ + index.html).
// AUTO-REFRESHES preview-data.js first (embedding src/ sources for the offline
// preview), then machine-checks everything:
//
//   1. Structure  — loader html, src/App.vue, main.js, styles, ≥1 page index.vue
//   2. SFC compile — every .vue parsed + compileScript + compileTemplate with the
//                   REAL @vue/compiler-sfc (catches syntax errors, unclosed tags,
//                   bad directives, bad expressions)
//   3. Tag check   — <el-*> tags against the official Element Plus whitelist;
//                   PascalCase tags must be imported components or valid icons
//   4. Import check — 'element-plus' names / '@element-plus/icons-vue' names against
//                   official export lists; relative imports must resolve to real
//                   files; bare imports restricted to the allowed dependency set
//   5. JS check    — src/**/*.js parsed as ESM (node --check)
//   6. Style check — SFC <style>: no :root/[data-theme]/asset-token definitions
//                   (custom skins live in src/assets/themes/); var(--g-*/--color-*)
//                   must be defined in src/assets/tokens/; hardcoded hex -> WARN
//   7. Mock isolation — src/ must not import mock/modules (pages consume src/api/*)
//
// Usage:
//   node build.mjs --dir "{artifact-folder}/{slug}"
//
// Output (agent-parseable):
//   OK index.html verified (N pages, M components)
//   RESULT: FAIL | <first error>     (+ WARN lines before it)
//   RESULT: OK

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'fs';
import { join, dirname, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { createRequire } from 'module';
import { refresh } from './build-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
function getOpt(long, short) {
  const idx = args.findIndex((a) => a === long || a === short);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  if (val === undefined || val.startsWith('-')) {
    console.log('RESULT: FAIL | Missing value for --dir');
    process.exit(1);
  }
  return val;
}

const dir = getOpt('--dir', '-d');
if (!dir) {
  console.log('RESULT: FAIL | Usage: node build.mjs --dir "<folder with src/ and index.html>"');
  process.exit(1);
}
const root = resolve(dir);

const warns = [];
function fail(msg) {
  console.log(`RESULT: FAIL | ${msg}`);
  process.exit(1);
}
function warn(msg) {
  warns.push(msg);
}

// ---------- 0. auto-refresh preview-data.js ----------
const refreshed = refresh(root);
if (!refreshed.ok) fail(refreshed.reason);

// ---------- whitelists ----------
const EP_COMPONENTS = new Set(
  JSON.parse(readFileSync(join(__dirname, 'verify', 'whitelists', 'element-plus', 'components.json'), 'utf8')),
);
const EP_EXPORTS = new Set(
  JSON.parse(readFileSync(join(__dirname, 'verify', 'whitelists', 'element-plus', 'exports.json'), 'utf8')),
);
const EP_ICONS = new Set(
  JSON.parse(readFileSync(join(__dirname, 'verify', 'whitelists', 'element-plus', 'icons.json'), 'utf8')),
);
const ALLOWED_BARE = new Set([
  'vue',
  'vue-router',
  'element-plus',
  '@element-plus/icons-vue',
  'dayjs',
  'less',
]);

// ---------- real compiler ----------
let sfc;
try {
  const req = createRequire(join(__dirname, 'verify', 'compiler', 'node_modules', '@vue', 'compiler-sfc', 'package.json'));
  sfc = req('@vue/compiler-sfc');
} catch (e) {
  fail(`@vue/compiler-sfc not vendored under scripts/verify/compiler: ${e.message}`);
}

// ---------- helpers ----------
function walkFiles(dirPath, exts, out = []) {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) walkFiles(full, exts, out);
    else if (exts.includes(extname(entry.name))) out.push(full);
  }
  return out;
}
const pascal = (s) => s.replace(/(^|-)(\w)/g, (m, a, b) => b.toUpperCase());

// ---------- 1. structure ----------
const htmlPath = join(root, 'index.html');
const srcDir = join(root, 'src');
const mockDir = join(root, 'mock');
if (!existsSync(htmlPath)) fail(`index.html not found: ${htmlPath}`);
if (!existsSync(srcDir)) fail(`src folder not found: ${srcDir}`);
const hasMock = existsSync(mockDir) && statSync(mockDir).isDirectory();

const html = readFileSync(htmlPath, 'utf8');
const REQUIRED_HTML = [
  '<script src="./public/library/element-plus/vue.global.prod.js"></script>',
  '<script src="./public/library/element-plus/element-plus.full.min.js"></script>',
  '<script src="./public/library/element-plus/vue3-sfc-loader.js"></script>',
  '<link rel="stylesheet" href="./src/assets/themes/base.css">',
  '<link rel="stylesheet" href="./src/assets/tokens/index.css">',
  '<script src="./preview-data.js"></script>',
];
for (const line of REQUIRED_HTML) {
  if (!html.includes(line)) fail(`preview loader integrity broken, missing: ${line}`);
}
if (!/<html[^>]*data-theme=/.test(html)) fail('preview loader broken: <html> has no data-theme attribute');

for (const p of ['App.vue', 'main.js', join('assets', 'themes', 'base.css')]) {
  if (!existsSync(join(srcDir, p))) fail(`deliverable incomplete, missing: src/${p}`);
}

const vueFiles = walkFiles(srcDir, ['.vue']);
let jsFiles = walkFiles(srcDir, ['.js']);
const cssFiles = walkFiles(srcDir, ['.css', '.less']);
if (hasMock) {
  jsFiles = [...jsFiles, ...walkFiles(mockDir, ['.js'])];
}
if (vueFiles.length === 0) fail('no .vue files under src/');
const pageIndexes = vueFiles.filter((f) => /[\\/]views[\\/][^\\/]+[\\/]index\.vue$/.test(f));
if (pageIndexes.length === 0) fail('no page entry found (expected src/views/{kebab}/index.vue)');

// file map for relative import resolution (posix keys from src root or mock root)
const fileMap = new Set();
for (const f of [...vueFiles, ...jsFiles, ...cssFiles, ...walkFiles(srcDir, ['.json'])]) {
  if (f.startsWith(srcDir)) {
    fileMap.add('/' + f.slice(srcDir.length).split('\\').join('/').replace(/^\/+/, ''));
  } else if (hasMock && f.startsWith(mockDir)) {
    fileMap.add('/mock/' + f.slice(mockDir.length).split('\\').join('/').replace(/^\/+/, ''));
  }
}
if (hasMock) {
  for (const f of walkFiles(mockDir, ['.json'])) {
    fileMap.add('/mock/' + f.slice(mockDir.length).split('\\').join('/').replace(/^\/+/, ''));
  }
}
const ASSET_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];

// ---------- 2-4. verify each .vue ----------
let elTagTotal = 0;
for (const file of vueFiles) {
  const rel = '/' + file.slice(srcDir.length).split('\\').join('/').replace(/^\/+/, '');

  // mock isolation (D16): pages/components must consume src/api/*, never mock/modules
  if (rel.startsWith('/views/') || rel.startsWith('/components/')) {
    const source0 = readFileSync(file, 'utf8');
    if (/from\s+['"][^'"]*mock\/modules/.test(source0)) {
      fail(`${rel}: imports mock/modules directly — pages must import from src/api/{slug}.js (adapter layer)`);
    }
  }

  const source = readFileSync(file, 'utf8');
  const { descriptor, errors } = sfc.parse(source, { filename: file });
  if (errors.length) fail(`${rel}: SFC parse error: ${errors.map((e) => e.message).join('; ')}`);
  if (!descriptor.template) fail(`${rel}: no <template> block`);

  // script compile + binding metadata
  let bindings = {};
  const script = descriptor.scriptSetup || descriptor.script;
  if (script) {
    try {
      const compiled = sfc.compileScript(descriptor, { id: 'data-v-verify', templateOptions: { id: 'data-v-verify' } });
      bindings = compiled.bindings || {};
    } catch (e) {
      fail(`${rel}: script compile error: ${e.message}`);
    }
  }

  // template compile
  const tpl = sfc.compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: 'data-v-verify',
    compilerOptions: { bindingMetadata: bindings },
  });
  if (tpl.errors.length) {
    fail(`${rel}: template compile error: ${tpl.errors.map((e) => String(e.message || e)).join('; ')}`);
  }

  // imports (from raw script text — covers default/named/side-effect)
  const scriptText = script ? script.content : '';
  const importedNames = new Set(); // local identifiers available to the template
  const importRe = /import\s+([\w$]+)\s*,?\s*(?:\{([^}]*)\})?\s*(?:\*+as\s+[\w$]+\s*)?from\s*['"]([^'"]+)['"]|import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  for (const m of scriptText.matchAll(importRe)) {
    const spec = m[3] || m[5] || m[6];
    const names = (m[2] || m[4] || '').split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean);
    if (m[1]) importedNames.add(m[1]);
    names.forEach((n) => importedNames.add(n));

    // bare import policy
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      const base = spec.split('/')[0] === '@element-plus' ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      const allowed = ALLOWED_BARE.has(spec) || (base === 'element-plus' && /^element-plus\//.test(spec));
      if (!allowed) {
        fail(`${rel}: bare import "${spec}" not allowed — deliverable deps are limited to: ${[...ALLOWED_BARE].join(', ')} (+ element-plus subpaths)`);
      }
      if (spec === 'element-plus') {
        for (const n of names) {
          if (!EP_EXPORTS.has(n)) fail(`${rel}: unknown Element Plus export "${n}" (imported from 'element-plus')`);
        }
      }
      if (spec === '@element-plus/icons-vue') {
        for (const n of names) {
          if (!EP_ICONS.has(n)) {
            const hints = [...EP_ICONS].filter((x) => x.toLowerCase().startsWith(n.toLowerCase().slice(0, 4))).slice(0, 4);
            fail(`${rel}: unknown icon "${n}"${hints.length ? ` : did you mean ${hints.join(', ')}?` : ''}`);
          }
        }
      }
    } else {
      // relative import resolution
      const baseDir = rel.slice(0, rel.lastIndexOf('/'));
      const parts = (baseDir + '/' + spec).split('/');
      const stack = [];
      for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') stack.pop();
        else stack.push(p);
      }
      let target = '/' + stack.join('/');
      if (fileMap.has(target)) continue;
      if (fileMap.has(target + '.vue')) continue;
      if (fileMap.has(target + '.js')) continue;
      if (fileMap.has(target + '/index.vue')) continue;
      if (fileMap.has(target + '/index.js')) continue;
      if (ASSET_EXT.includes(extname(target))) continue; // assets resolve at runtime
      fail(`${rel}: relative import "${spec}" does not resolve (looked for ${target}[.vue|.js|/index.vue])`);
    }
  }

  // tag checks
  const tplContent = descriptor.template.content;
  const usedEl = new Set([...tplContent.matchAll(/<(el-[a-z][a-z0-9-]*)/g)].map((m) => m[1]));
  for (const tag of usedEl) {
    if (!EP_COMPONENTS.has(tag)) {
      const candidates = [...EP_COMPONENTS].filter((c) => c.startsWith(tag.split('-').slice(0, 2).join('-'))).slice(0, 5);
      fail(`${rel}: unknown Element Plus tag <${tag}>${candidates.length ? ` : did you mean ${candidates.join(', ')}?` : ''}`);
    }
  }
  elTagTotal += usedEl.size;

  for (const m of tplContent.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) {
    const tag = m[1];
    // must be imported in this file (components AND icons alike — the preview
    // registers nothing globally, so unimported tags cannot render)
    if (importedNames.has(tag)) continue;
    const iconHint = EP_ICONS.has(tag) ? ' (it is a valid icon name — add `import { ' + tag + ' } from \'@element-plus/icons-vue\'`)' : '';
    fail(`${rel}: <${tag}> is not imported${iconHint}`);
  }
  // kebab-case usage of imported PascalCase components (e.g. <status-tag>)
  for (const m of tplContent.matchAll(/<((?!el-)[a-z][a-z0-9]*-[a-z0-9-]*)[\s/>]/g)) {
    const tag = m[1];
    if (importedNames.has(pascal(tag))) continue;
    fail(`${rel}: unknown component tag <${tag}> — no matching import found`);
  }

  // inline style check: warn on style="..." (not :style="..." which is dynamic binding)
  const inlineStyles = (tplContent.match(/\sstyle\s*=\s*"/g) || []).length;
  if (inlineStyles) {
    // Check if any are dynamic (:style) vs static (style="")
    const staticStyles = (tplContent.match(/\sstyle\s*=\s*"/g) || []).length;
    const dynamicStyles = (tplContent.match(/:\s*style\s*=\s*"/g) || []).length;
    const pureStatic = staticStyles - dynamicStyles;
    if (pureStatic > 0) warn(`${rel}: ${pureStatic} static inline style(s) — prefer <style> classes; only :style (dynamic binding) is allowed`);
  }

  // style blocks
  for (const [i, block] of descriptor.styles.entries()) {
    if (/:root\s*\{/.test(block.content)) fail(`${rel}: <style> #${i + 1} must not define :root (asset tokens live in src/assets/tokens/)`);
    if (/data-theme/.test(block.content)) fail(`${rel}: <style> #${i + 1} must not touch [data-theme] (custom skins live in src/assets/themes/)`);
    for (const dm of block.content.matchAll(/--[a-z][a-z0-9-]+\s*:/g)) {
      const tok = dm[0].replace(/\s*:/, '');
      if (!tok.startsWith('--page-')) fail(`${rel}: <style> #${i + 1} defines "${tok}" : page-local custom props must be prefixed --page- (asset tokens belong in src/assets/tokens/)`);
    }
  }
}

// ---------- 4b. mock isolation for .js files too (D16) ----------
for (const file of jsFiles) {
  if (!file.startsWith(srcDir)) continue; // mock/ itself legitimately references mock/modules
  const rel = '/' + file.slice(srcDir.length).split('\\').join('/').replace(/^\/+/, '');
  if (!rel.startsWith('/views/') && !rel.startsWith('/components/')) continue;
  const text0 = readFileSync(file, 'utf8');
  if (/from\s+['"][^'"]*mock\/modules/.test(text0)) {
    fail(`${rel}: imports mock/modules directly — pages must import from src/api/{slug}.js (adapter layer)`);
  }
}

// ---------- 5. verify js files (ESM syntax + import policy) ----------
const tmp = mkdtempSync(join(tmpdir(), 'prototype-verify-'));
try {
  for (const file of jsFiles) {
    let rel;
    if (file.startsWith(srcDir)) {
      rel = '/' + file.slice(srcDir.length).split('\\').join('/').replace(/^\/+/, '');
    } else if (hasMock && file.startsWith(mockDir)) {
      rel = '/mock/' + file.slice(mockDir.length).split('\\').join('/').replace(/^\/+/, '');
    } else {
      continue;
    }
    const text = readFileSync(file, 'utf8');
    // strip line comments before import scanning — commented example imports
    // (e.g. the rework snippet in src/api templates) must not be validated
    const codeText = text.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

    const tmpFile = join(tmp, rel.replace(/\//g, '_') + '.mjs');
    writeFileSync(tmpFile, text, 'utf8');
    const res = spawnSync(process.execPath, ['--check', tmpFile], { encoding: 'utf8' });
    if (res.status !== 0) fail(`${rel}: ESM syntax error: ${(res.stderr || '').split('\n').filter(Boolean).slice(-1)[0] || res.status}`);

    for (const m of codeText.matchAll(/(?:import\s+[^;]*?from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const baseDir = rel.slice(0, rel.lastIndexOf('/'));
        const stack = [];
        for (const p of (baseDir + '/' + spec).split('/')) {
          if (p === '' || p === '.') continue;
          if (p === '..') stack.pop();
          else stack.push(p);
        }
        const target = '/' + stack.join('/');
        if (![target, target + '.js', target + '.css', target + '/index.js'].some((t) => fileMap.has(t))) {
          if (!ASSET_EXT.includes(extname(target))) fail(`${rel}: relative import "${spec}" does not resolve`);
        }
      } else {
        const base = spec.split('/')[0] === '@element-plus' ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        const allowed = ALLOWED_BARE.has(spec) || (base === 'element-plus' && /^element-plus\//.test(spec));
        if (!allowed) fail(`${rel}: bare import "${spec}" not allowed — deliverable deps are limited to: ${[...ALLOWED_BARE].join(', ')} (+ element-plus subpaths)`);
      }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---------- 6. token usage across styles + templates ----------
// Defined tokens are extracted at runtime from the workspace's own copied
// token CSS (src/assets/tokens/**) — the skill ships no token cheat sheet,
// so designer asset updates flow through automatically (plan §4.6).
const definedTokens = new Set();
const cssHaystacks = [];
const tokenDefs = /--[a-z][a-z0-9-]*\s*:/g;
for (const f of cssFiles) {
  const text = readFileSync(f, 'utf8');
  if (!f.includes(join('assets', 'tokens'))) continue; // only token layer defines
  for (const m of text.matchAll(tokenDefs)) definedTokens.add(m[0].replace(/\s*:/, ''));
}
for (const f of cssFiles) {
  if (f.includes(join('assets', 'tokens'))) continue;
  cssHaystacks.push(readFileSync(f, 'utf8'));
}
for (const file of vueFiles) {
  const source = readFileSync(file, 'utf8');
  const rel = '/' + file.slice(srcDir.length).split('\\').join('/').replace(/^\/+/, '');
  const { descriptor } = sfc.parse(source, { filename: file });
  for (const block of descriptor.styles) {
    for (const m of block.content.matchAll(/--page-[a-z0-9-]+\s*:/g)) definedTokens.add(m[0].replace(/\s*:/, ''));
    cssHaystacks.push(block.content);
    const hexes = (block.content.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
    if (hexes) warn(`${rel}: ${hexes} hardcoded hex color(s) in <style> : prefer asset token vars (--g-*/--color-*)`);
  }
  if (descriptor.template) cssHaystacks.push(descriptor.template.content);
}
for (const text of cssHaystacks) {
  for (const m of text.matchAll(/var\(\s*(--[a-z][a-z0-9-]+)\s*\)/g)) {
    const tok = m[1];
    if (definedTokens.has(tok)) continue;
    if (tok.startsWith('--page-')) continue; // page-local, already collected above
    if (tok.startsWith('--el-')) continue; // EP internal vars are bridged by the asset token layer
    fail(`unknown token var(${tok}) : tokens are defined in src/assets/tokens/*.css (extracted from the asset library at init time)`);
  }
}

// ---------- done ----------
const pageCount = pageIndexes.length;
for (const w of warns) console.log(`WARN: ${w}`);
console.log('RESULT: OK');
console.log(`OK index.html verified (${pageCount} page${pageCount > 1 ? 's' : ''}, ${vueFiles.length - pageCount} components, ${elTagTotal} el-tag uses)`);
process.exit(0);
