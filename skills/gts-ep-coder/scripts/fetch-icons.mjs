#!/usr/bin/env node
// fetch-icons.mjs — icon resolution for gts-ep-coder (Spec v2 §5)
//
// Resolves the Element Plus icon names actually used in src/ to company
// IconPlus assets when there is an *exact* (reviewed-alias or exact-name)
// match, and leaves everything else as the original Element Plus icon.
// Fallback to Element Plus is a normal design strategy, not a failure.
//
// What it does, in order:
//   1. AST-scan src/ (.vue/.js/...) for `@element-plus/icons-vue` imports and
//      for imports of the generated barrel — collecting the requested set.
//   2. Resolve each name: reviewed alias → else exact englishName match within
//      the configured source/group scope → else Element Plus. Fuzzy score is
//      never used to pick an asset.
//   3. Fetch paired light/dark SVG (unless shared), validate them, drop to
//      Element Plus on any single-theme miss / invalid SVG.
//   4. Write `<src>/assets/icons/<Name>.{light,dark}.svg` + a barrel
//      `<src>/assets/icons/index.js` that exports company components and
//      re-exports the Element Plus fallbacks from one entry.
//   5. AST-rewrite page imports to that barrel (source path only; alias kept).
//   6. Persist a metadata cache and write `icons-report.json`.
//
// Usage:
//   node fetch-icons.mjs --dir "<artifact-folder>/<slug>" [--base-url <url>]
//                        [--timeout <ms>] [--refresh]
//
// Output (agent-parseable):
//   RESULT: OK
//   STATUS: COMPLETE | FALLBACK
//   RESOLVED: <n>, MISSED: <m>, CACHED: <c>
//   ICONS_DIR: <absolute path>
//   REPORT: <absolute path>
//   RESULT: FAIL
//   STATUS: FAILED
//   ERROR: <reason>

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, rmSync } from 'fs';
import { join, resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ────────────────────────────────────────────────────────────
// CLI args
// ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getOpt(long, short) {
  const idx = args.findIndex((a) => a === long || a === short);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  if (val === undefined || val.startsWith('-')) return undefined;
  return val;
}
const hasFlag = (long) => args.includes(long);

const dir = getOpt('--dir', '-d');
if (!dir) {
  console.log('RESULT: FAIL | Usage: node fetch-icons.mjs --dir "<folder with src/>" [--base-url <url>] [--timeout <ms>] [--refresh]');
  process.exit(1);
}
const refresh = hasFlag('--refresh');
const timeoutMs = parseInt(getOpt('--timeout') || '10000', 10);
const root = resolve(dir);
const srcDir = join(root, 'src');
const iconsDir = join(srcDir, 'assets', 'icons');
const BARREL_POSIX = '/src/assets/icons/index.js';
const CACHE_PATH = join(iconsDir, '.icon-cache.json');
const REPORT_PATH = join(root, 'icons-report.json');

const OWNED_MARKER = '@gts-ep-coder-owned';
const BASENAME = 'fetch-icons.mjs';

function fail(reason) {
  console.log('RESULT: FAIL');
  console.log('STATUS: FAILED');
  console.log(`ERROR: ${reason}`);
  process.exit(1);
}
// atomic single-file write: temp + rename, so a crash never leaves a half file
function writeFileAtomic(path, content) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content, 'utf8');
  try {
    renameSync(tmp, path);
  } catch (e) {
    try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
    throw e;
  }
}
if (!existsSync(srcDir)) fail(`src folder not found: ${srcDir}`);

// ────────────────────────────────────────────────────────────
// Config: reviewed aliases + provider scope
// ────────────────────────────────────────────────────────────
const ALIASES_PATH = getOpt('--aliases')
  ? resolve(getOpt('--aliases'))
  : join(__dirname, '..', 'references', 'icon-aliases.json');
let aliasDoc = { config: {}, aliases: {} };
try {
  aliasDoc = JSON.parse(readFileSync(ALIASES_PATH, 'utf8'));
} catch (e) {
  fail(`cannot read references/icon-aliases.json: ${e.message}`);
}
const aliasConfig = aliasDoc.config || {};
const aliases = aliasDoc.aliases || {};
const provider = aliasConfig.provider || 'iconplus';
const baseUrl = (getOpt('--base-url') || aliasConfig.baseUrl || 'https://octo.hdesign.huawei.com').replace(/\/+$/, '');
const sourceId = aliasConfig.sourceId != null ? aliasConfig.sourceId : 6;
const groupId = aliasConfig.groupId || '74,77,93';
const matchingVersion = aliasDoc.mappingVersion != null ? String(aliasDoc.mappingVersion) : '1';
// mappingVersion is content-derived so editing an alias invalidates the cache.
const mappingVersion = `${matchingVersion}:${crypto.createHash('md5').update(JSON.stringify({ a: aliases, c: aliasConfig })).digest('hex').slice(0, 8)}`;
const NEGATIVE_TTL_MS = (aliasConfig.negativeCacheHours != null ? aliasConfig.negativeCacheHours : 24) * 3600 * 1000;

// ────────────────────────────────────────────────────────────
// Env: real @vue/compiler-sfc + @babel/parser + magic-string
// (installed under the shared env dir by setup-env.mjs)
// ────────────────────────────────────────────────────────────
function resolveEnvRequire() {
  const envCfg = JSON.parse(readFileSync(join(__dirname, '..', 'references', 'env-config.json'), 'utf8'));
  const envVar = process.env[envCfg.envDirEnvVar];
  const envDir = envVar
    ? resolve(envVar)
    : process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '~', 'AppData', 'Local'), envCfg.envDirName)
      : process.platform === 'darwin'
        ? join(process.env.HOME || '~', 'Library', 'Application Support', envCfg.envDirName)
        : join(process.env.XDG_DATA_HOME || join(process.env.HOME || '~', '.local', 'share'), envCfg.envDirName);
  return createRequire(join(envDir, 'compiler', 'node_modules', '@vue', 'compiler-sfc', 'package.json'));
}
let sfc, babelParser, MagicString, parseXml;
try {
  const req = resolveEnvRequire();
  sfc = req('@vue/compiler-sfc');
  babelParser = req('@babel/parser');
  MagicString = req('magic-string');
  // real XML well-formedness (R1): replaces the former regex tag-stack
  const xml = req('@rgrove/parse-xml');
  parseXml = xml.parseXml || xml.default;
} catch (e) {
  fail(`compiler toolchain not installed (expected under the shared env dir): ${e.message} — run: node scripts/ensure-env.mjs`);
}

const EP_ICONS = new Set(
  JSON.parse(readFileSync(join(__dirname, 'verify', 'whitelists', 'element-plus-icons.json'), 'utf8')),
);

// ────────────────────────────────────────────────────────────
// IconPlus HTTP client
// ────────────────────────────────────────────────────────────
async function fetchJson(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  timer.unref?.(); // never let an idle abort timer keep the loop alive / trip exit teardown
  try {
    // Connection: close keeps undici from pooling sockets; a pooled keep-alive
    // socket at process.exit(0) trips a libuv assert on Windows (Node 24)
    const res = await fetch(url, { signal: controller.signal, headers: { connection: 'close' } });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`);
      err.httpStatus = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
// Only transparent network faults (abort / socket) are retried once. Every
// attempt is counted (retries included) so the report reflects *physical*
// request counts, not logical call sites.
async function fetchJsonRetry(url, ms, retries = 1, counter) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    if (counter) counter.attempts++;
    try {
      return await fetchJson(url, ms);
    } catch (e) {
      lastErr = e;
      const transient = !e.httpStatus; // no HTTP status → timeout/abort/socket
      if (!transient || i === retries) break;
    }
  }
  throw lastErr;
}
function classifyNetError(e) {
  if (/abort/i.test(e && e.name) || /abort/i.test(String(e && e.message))) return 'TIMEOUT';
  const st = e && e.httpStatus;
  if (st === 408 || st === 429) return 'TIMEOUT';
  if (typeof st === 'number' && st >= 400 && st < 500) return 'BAD_RESPONSE';
  // 5xx, socket errors, malformed body while the transport itself failed
  return 'SERVICE_UNAVAILABLE';
}

async function apiGetConfig() {
  try {
    return await fetchJsonRetry(`${baseUrl}/assetRepository/iconPlus/getConfig`, Math.min(timeoutMs, 8000), 1, netLog.config);
  } catch (e) {
    // surface WHY the service was deemed offline (timeout vs HTTP vs socket)
    // in the report instead of swallowing the reason
    netLog.configError = classifyNetError(e);
    return null;
  }
}
async function apiSearch(keywords) {
  const params = new URLSearchParams({
    keyword: keywords,
    topK: '5',
    source_id: String(sourceId),
    group_id: groupId,
  });
  return fetchJsonRetry(`${baseUrl}/assetRepository/iconPlus/getIconInfo?${params}`, timeoutMs, 1, netLog.search);
}
// getIcon params per references facts (intranet-icon-fetch §2): url/size/style/
// color/theme/fileType only. Do NOT send name/category — they are not part of the
// documented contract; batched responses are correlated back by `url`.
async function apiGetIcon(urls, theme, color, size, style) {
  const params = new URLSearchParams({ url: urls, theme, color, size, style, fileType: 'svg' });
  return fetchJsonRetry(`${baseUrl}/assetRepository/iconPlus/getIcon?${params}`, timeoutMs, 1, theme === 'dark' ? netLog.iconDark : netLog.iconLight);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
// getConfig shapes vary: `size` may be a string/number array (e.g. [12,24,...])
// or an object array with `key`; `style` is {key,value}; `colors` is
// {id,key,value,domain,type,style}. Tolerate both so a real response is not
// mistaken for a malformed one.
function sizeKey(item) {
  if (item == null) return undefined;
  return typeof item === 'object' ? item.key : String(item);
}
function selectConfigDefaults(config) {
  const sizeList = Array.isArray(config.size) ? config.size : [];
  const size = sizeList.map(sizeKey).find((k) => k === '24') || sizeKey(sizeList[0]) || '24';
  const styleList = Array.isArray(config.style) ? config.style : [];
  const chosenStyle = styleList.find((s) => s && s.key === 'border') || styleList[0] || {};
  const style = chosenStyle.key || 'border';
  const styleValue = chosenStyle.value || '线性';
  const colors = Array.isArray(config.colors) ? config.colors : [];
  const lightColor = colors.find((c) => c && c.style === styleValue)?.id || colors[0]?.id || '';
  // real getConfig has no dark_colors → dark reuses the light color id + theme=dark
  const darkCols = Array.isArray(config.dark_colors) ? config.dark_colors : [];
  const darkColor = darkCols.find((c) => c && c.style === styleValue)?.id || darkCols[0]?.id || lightColor;
  return { size, style, lightColor, darkColor };
}

// ────────────────────────────────────────────────────────────
// Normalization + selection (Spec §5.2)
// ────────────────────────────────────────────────────────────
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
const identityOf = (c) => c.icon_id ?? c.assetId ?? c.asset_id ?? c.id ?? c.url;

// Filter candidates into the configured source/group scope when the API
// response carries those fields (tolerant: absent fields are accepted).
function inScope(c) {
  const s = c.source_id ?? c.sourceId;
  if (s != null && String(s) !== String(sourceId)) return false;
  const g = c.group_id ?? c.groupId;
  if (g != null && !String(groupId).split(',').map(norm).includes(norm(g))) return false;
  return true;
}

function decideFromCandidates(epName, candidates) {
  // Review §5.2: exact normalized englishName only; never pick by score.
  const exact = candidates.filter((c) => c.englishName && norm(c.englishName) === norm(epName));
  if (exact.length === 0) return { reason: 'NO_MATCH' };
  const byIdentity = new Map();
  for (const c of exact) byIdentity.set(String(identityOf(c)), c);
  if (byIdentity.size > 1) return { reason: 'AMBIGUOUS' };
  return { reason: 'EXACT', candidate: [...byIdentity.values()][0] };
}

// ────────────────────────────────────────────────────────────
// SVG validation (Spec §5.3) + normalization
// ────────────────────────────────────────────────────────────
// R1: well-formedness is delegated to the real XML parser (@rgrove/parse-xml,
// installed by setup-env into the shared env dir). On top of a *parsable*
// document we independently enforce the icon contract: svg root, namespace,
// viewBox shape, and no script/event/entity/external-reference content.
function parseXmlDoc(svg) {
  try {
    return { doc: parseXml(svg) };
  } catch (e) {
    return { err: `not well-formed XML: ${String((e && e.message) || e).split('\n')[0]}` };
  }
}
function validateSvg(svg) {
  const s = String(svg);
  if (!/<svg[\s>]/i.test(s)) return 'no <svg> root';
  if (/<script[\s>]/i.test(s)) return 'contains <script>';
  if (/\son[a-z]+\s*=/i.test(s)) return 'contains inline event handler';
  if (/<!ENTITY/i.test(s)) return 'contains entity declaration';
  if (/<!DOCTYPE/i.test(s)) return 'contains DOCTYPE';
  if (/<\?xml-stylesheet/i.test(s)) return 'contains xml-stylesheet PI';
  // external references: only same-document fragments (#id) or inline data:image
  // are allowed; anything with a scheme/host is rejected.
  for (const m of s.matchAll(/\b(?:xlink:href|href|src)\s*=\s*["']([^"']*)["']/gi)) {
    const v = m[1].trim();
    if (v === '' || v.startsWith('#') || /^data:image\//i.test(v)) continue;
    return `contains external reference: ${v.slice(0, 48)}`;
  }
  const { doc, err } = parseXmlDoc(s);
  if (err) return err;

  const elements = doc.children.filter((n) => n.type === 'element');
  if (elements.length !== 1) return `expected exactly one root element, found ${elements.length}`;
  const root = elements[0];
  if (root.name !== 'svg') return `root element is <${root.name}>, not <svg>`;
  const ns = root.attributes.xmlns;
  if (ns != null && ns !== 'http://www.w3.org/2000/svg') return `unexpected xmlns: ${String(ns).slice(0, 64)}`;
  const vb = root.attributes.viewBox ?? root.attributes.viewbox;
  if (vb == null) return 'missing viewBox';
  const parts = String(vb).trim().split(/[\s,]+/);
  if (parts.length !== 4 || parts.some((p) => !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(p))) {
    return `viewBox must be four finite numbers, got: ${String(vb).slice(0, 32)}`;
  }
  const [, , w, h] = parts.map(Number);
  if (!(w > 0) || !(h > 0)) return `viewBox width/height must be positive, got ${w}x${h}`;
  return null;
}
function normalizeSvg(svgString) {
  let svg = String(svgString).replace(/^﻿/, '').trim();
  const tagMatch = svg.match(/<svg\b[^>]*>/i);
  if (tagMatch) {
    const cleanedTag = tagMatch[0]
      .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '')
      .replace(/<svg\b/i, '<svg width="1em" height="1em"');
    // stamp ownership so a later run can tell our file from a user-authored one
    svg = svg.replace(tagMatch[0], `${cleanedTag}<!-- ${OWNED_MARKER} -->`);
  } else {
    svg = `<svg width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><!-- ${OWNED_MARKER} -->${svg}</svg>`;
  }
  return svg;
}

// ────────────────────────────────────────────────────────────
// 1. AST scan + rewrite planning
// ────────────────────────────────────────────────────────────
function walkFiles(dirPath, exts, out = []) {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dirPath, entry.name);
    // skip ONLY our own generated output dir (src/assets/icons); other files
    // under src/assets (e.g. a component that imports icons) must still be scanned
    if (full === iconsDir) continue;
    if (entry.isDirectory()) walkFiles(full, exts, out);
    else if (exts.includes(extname(entry.name))) out.push(full);
  }
  return out;
}

function toPosixRel(absFile) {
  // preview/SFC-loader path space: '/src/...' (matches BARREL_POSIX below)
  return '/src/' + absFile.slice(srcDir.length).split('\\').join('/').replace(/^\/+/, '');
}
function posixRel(fromFilePosix, toPosix) {
  const a = fromFilePosix.slice(0, fromFilePosix.lastIndexOf('/')).split('/').filter(Boolean);
  const b = toPosix.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const parts = [];
  for (let k = 0; k < a.length - i; k++) parts.push('..');
  parts.push(...b.slice(i));
  let rel = parts.join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}
function isGenerated(text) {
  const head = text.slice(0, 400);
  return head.includes(OWNED_MARKER) || head.includes(BASENAME);
}
function babelPlugins(lang) {
  const p = [];
  const l = String(lang || '').toLowerCase();
  if (l === 'ts' || l === 'tsx') p.push('typescript');
  if (l === 'tsx' || l === 'jsx') p.push('jsx');
  return p;
}
function scriptRegions(source, filename) {
  if (filename.endsWith('.vue')) {
    const { descriptor, errors } = sfc.parse(source, { filename });
    if (errors && errors.length) throw new Error(`SFC parse error: ${errors.map((e) => e.message).join('; ')}`);
    const regions = [];
    if (descriptor.script) regions.push({ code: descriptor.script.content, offset: descriptor.script.loc.start.offset, lang: descriptor.script.lang });
    if (descriptor.scriptSetup) regions.push({ code: descriptor.scriptSetup.content, offset: descriptor.scriptSetup.loc.start.offset, lang: descriptor.scriptSetup.lang });
    return regions;
  }
  // .js/.mjs/.ts/.tsx/.jsx — whole file
  return [{ code: source, offset: 0, lang: extname(filename).slice(1) }];
}

const requested = new Map(); // epName -> { name, files:Set<posixRel> }
const rewriteTargets = [];    // { file, absText, edits:[{start,end,repl}] }
const scanErrors = [];

function addRequested(epName, filePosix) {
  if (!requested.has(epName)) requested.set(epName, { name: epName, files: new Set() });
  requested.get(epName).files.add(filePosix);
}

const textExts = ['.vue', '.js', '.mjs', '.ts', '.tsx', '.jsx'];
const scanFiles = walkFiles(srcDir, textExts);

for (const file of scanFiles) {
  const filePosix = toPosixRel(file);
  const source = readFileSync(file, 'utf8');
  if (isGenerated(source)) continue;

  let regions;
  try {
    regions = scriptRegions(source, file);
  } catch (e) {
    scanErrors.push(`${filePosix}: ${e.message}`);
    continue;
  }

  const edits = [];
  for (const region of regions) {
    let ast;
    try {
      ast = babelParser.parse(region.code, {
        sourceType: 'module',
        plugins: babelPlugins(region.lang),
        allowAwaitOutsideFunction: true,
      });
    } catch (e) {
      scanErrors.push(`${filePosix}: cannot parse ${region.lang || 'js'} script — ${e.message}`);
      continue;
    }
    for (const node of ast.program.body) {
      if (node.type !== 'ImportDeclaration') continue;
      const spec = node.source.value;
      const named = [];
      let sawNonNamed = false;
      for (const s of node.specifiers) {
        if (s.type === 'ImportSpecifier') named.push({ imported: s.imported.name ?? s.imported.value, local: s.local.name });
        else sawNonNamed = true; // default / namespace
      }
      const isEpSource = spec === '@element-plus/icons-vue';
      const isBarrel = spec.startsWith('.') && normalizeResolved(filePosix, spec) === BARREL_POSIX;

      if (isEpSource) {
        if (sawNonNamed) {
          scanErrors.push(`${filePosix}: default/namespace import from '@element-plus/icons-vue' cannot be statically resolved — use named imports so icons can be migrated`);
          continue;
        }
        for (const n of named) addRequested(n.imported, filePosix);
        // rewrite the source literal to the barrel, preserving aliases
        edits.push({
          start: region.offset + node.source.start,
          end: region.offset + node.source.end,
          repl: JSON.stringify(posixRel(filePosix, BARREL_POSIX)),
        });
      } else if (isBarrel) {
        for (const n of named) addRequested(n.imported, filePosix);
      }
    }
  }
  if (edits.length) rewriteTargets.push({ file, source, edits });
}

// resolve a relative import specifier against the importing file's posix path
function normalizeResolved(fromFilePosix, spec) {
  const base = fromFilePosix.slice(0, fromFilePosix.lastIndexOf('/')).split('/').filter(Boolean);
  const stack = [...base];
  for (const p of spec.split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return '/' + stack.join('/');
}

if (scanErrors.length) {
  fail(`icon import scan failed:\n  ${scanErrors.join('\n  ')}`);
}

// unknown EP names → FAIL (§5.4)
const unknown = [...requested.keys()].filter((n) => !EP_ICONS.has(n));
if (unknown.length) {
  fail(`unknown Element Plus icon name(s): ${unknown.join(', ')} — check spelling against scripts/verify/whitelists/element-plus-icons.json`);
}

const requestedNames = [...requested.keys()].sort();

// ────────────────────────────────────────────────────────────
// 2. Cache load + validation
// ────────────────────────────────────────────────────────────
function md5File(p) {
  return crypto.createHash('md5').update(readFileSync(p)).digest('hex');
}
function readCache() {
  try {
    const doc = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    if (doc && doc.schemaVersion === 2 && doc.entries) return doc;
  } catch { /* no cache */ }
  return { schemaVersion: 2, provider, baseUrl, mappingVersion, entries: {} };
}
const cache = readCache();
const now = Date.now();

function cacheEntryValid(name) {
  const e = cache.entries[name];
  if (!e || e.provider !== provider) return false;
  if (e.baseUrl !== baseUrl) return false;
  if (String(e.sourceId) !== String(sourceId)) return false;
  if (String(e.groupId) !== String(groupId)) return false;
  if (e.mappingVersion !== mappingVersion) return false;
  if (e.reason !== 'EXACT' && e.reason !== 'ALIAS') return false;
  const lp = join(iconsDir, `${name}.light.svg`);
  const dp = join(iconsDir, `${name}.dark.svg`);
  if (!existsSync(lp) || !existsSync(dp)) return false;
  try {
    if (md5File(lp) !== e.lightHash) return false;
    // §5.3 the pair must be complete: for shared assets dark == light, so its
    // hash is validated against lightHash; otherwise against the stored darkHash
    const expectedDark = e.themeMode === 'shared' ? e.lightHash : e.darkHash;
    if (md5File(dp) !== expectedDark) return false;
  } catch { return false; }
  return true;
}
function negativeCacheHit(name) {
  const e = cache.entries[name];
  if (!e || e.reason !== 'NO_MATCH') return false;
  // service isolation: a NO_MATCH from one provider/base/scope must not apply to another
  if (e.provider !== provider) return false;
  if (e.baseUrl !== baseUrl) return false;
  if (String(e.sourceId) !== String(sourceId)) return false;
  if (String(e.groupId) !== String(groupId)) return false;
  if (e.mappingVersion !== mappingVersion) return false;
  if (!e.until || e.until < now) return false;
  return true;
}
function legacyUnverified(name) {
  const lp = join(iconsDir, `${name}.light.svg`);
  const dp = join(iconsDir, `${name}.dark.svg`);
  const e = cache.entries[name];
  return existsSync(lp) && existsSync(dp) && (!e || (e.reason !== 'EXACT' && e.reason !== 'ALIAS'));
}

// ────────────────────────────────────────────────────────────
// 3. Resolve decisions
// ────────────────────────────────────────────────────────────
// decision: { name, kind:'company'|'ep', reason, cacheStatus, identity, url,
//             themeMode, sourceRef, lightSvg, darkSvg, configUsed }
const decisions = new Map();
const toFetch = []; // names that still need network resolution

for (const name of requestedNames) {
  if (!refresh && cacheEntryValid(name)) {
    decisions.set(name, { name, kind: 'company', reason: cache.entries[name].reason, cacheStatus: 'HIT', themeMode: cache.entries[name].themeMode || 'paired', identity: cache.entries[name].identity, url: cache.entries[name].url, sourceRef: cache.entries[name].sourceRef, fromCache: true });
    continue;
  }
  if (!refresh && negativeCacheHit(name)) {
    decisions.set(name, { name, kind: 'ep', reason: 'NO_MATCH', cacheStatus: 'NEGATIVE_HIT' });
    continue;
  }
  if (aliases[name]) {
    decisions.set(name, {
      name, kind: 'company', reason: 'ALIAS',
      cacheStatus: legacyUnverified(name) ? 'LEGACY_UNVERIFIED' : 'MISS',
      themeMode: aliases[name].themeMode === 'shared' ? 'shared' : 'paired',
      identity: aliases[name].assetId || aliases[name].url,
      url: aliases[name].url, assetId: aliases[name].assetId,
      sourceRef: aliases[name].sourceRef || '',
      fromCache: false, isAlias: true,
    });
    toFetch.push(name);
    continue;
  }
  toFetch.push(name);
}

// ────────────────────────────────────────────────────────────
// 4. Network resolution for names not answered by the cache
// ────────────────────────────────────────────────────────────
const netLog = { config: { attempts: 0 }, search: { attempts: 0 }, iconLight: { attempts: 0 }, iconDark: { attempts: 0 } };
let config = null;
let online = false;
let netT0 = 0;
if (toFetch.length) {
  const t0 = Date.now();
  config = await apiGetConfig();
  netLog.configCalls = 1;
  netLog.configMs = Date.now() - t0;
  online = !!config;
  netT0 = t0;
}

if (toFetch.length && !online) {
  // Service unreachable: keep valid company cache (already decided), the rest → EP.
  for (const name of toFetch) {
    if (decisions.get(name)?.isAlias) {
      decisions.set(name, { name, kind: 'ep', reason: 'SERVICE_UNAVAILABLE', cacheStatus: 'MISS' });
    } else {
      decisions.set(name, { name, kind: 'ep', reason: 'SERVICE_UNAVAILABLE', cacheStatus: 'MISS' });
    }
  }
} else if (toFetch.length && online) {
  const def = selectConfigDefaults(config);
  const searchNames = toFetch.filter((n) => !decisions.get(n)?.isAlias);

  // getIconInfo (chunked) for non-alias names
  const nameToCandidate = new Map(); // epName -> candidate | {reason}
  for (const group of chunk(searchNames, 40)) {
    let resp;
    try {
      resp = await apiSearch(group.join(','));
      netLog.searchCalls = (netLog.searchCalls || 0) + 1;
    } catch (e) {
      const r = classifyNetError(e);
      for (const n of group) nameToCandidate.set(n, { reason: r });
      continue;
    }
    // A well-formed response is an array of {keyword, icons}. A 200 carrying an
    // error envelope / unexpected shape is a SERVICE anomaly, NOT "no match" —
    // recording it as NO_MATCH would pollute the negative cache and mask outages.
    const groups = Array.isArray(resp)
      ? resp
      : (resp && typeof resp === 'object' && resp.keyword != null ? [resp] : null);
    if (!groups) {
      const r = resp && typeof resp === 'object' ? 'BAD_RESPONSE' : 'SERVICE_UNAVAILABLE';
      netLog.badResponses = (netLog.badResponses || 0) + 1;
      for (const n of group) nameToCandidate.set(n, { reason: r });
      continue;
    }
    // Layer 2 (R2): each group must be an object with a keyword and an icons
    // ARRAY. A missing/null/non-array icons field is groundless — it must not
    // be treated as "empty result" (§15.1: 无依据的 null/缺字段不能等同空数组).
    // §17.2: per-KEYWORD validation outcome — a malformed group must poison its
    // own names as BAD_RESPONSE, never fall through to a default NO_MATCH.
    const byKeyword = new Map(); // normKeyword -> { cands } | { reason }
    let goodGroups = 0;
    let badGroups = 0;
    for (const g of groups) {
      if (g == null || typeof g !== 'object' || Array.isArray(g) || g.keyword == null) {
        badGroups++;
        continue; // no keyword to attribute — handled by the missing-keyword pass below
      }
      const key = norm(g.keyword);
      if (!Array.isArray(g.icons)) {
        badGroups++;
        byKeyword.set(key, { reason: 'BAD_RESPONSE' });
        continue;
      }
      // Layer 3 (R2 + §19.1): candidate minimum schema — a candidate must be a
      // non-array object with a non-empty string `url` (the fields selection
      // actually reads). A structurally invalid candidate (null, scalar, array,
      // object missing/typing `url` wrong) counts as INVALID — distinct from a
      // well-formed candidate that merely fails scope or name matching, which
      // is a legitimate "no match".
      const usable = [];
      let junk = 0;
      let scopedOut = 0;
      for (const i of g.icons) {
        if (i == null || typeof i !== 'object' || Array.isArray(i) || typeof i.url !== 'string' || i.url === '') {
          junk++;
          continue;
        }
        try {
          if (inScope(i)) usable.push(i);
          else scopedOut++;
        } catch { junk++; }
      }
      // all candidates structurally invalid → the group carries no usable data;
      // without a valid response we cannot claim a business miss for this keyword.
      // Well-formed candidates that are all out of scope DO prove a miss.
      if (usable.length === 0 && scopedOut === 0 && junk > 0) {
        badGroups++;
        byKeyword.set(key, { reason: 'BAD_RESPONSE' });
        continue;
      }
      byKeyword.set(key, { cands: usable });
      goodGroups++;
    }
    // An empty array is a genuine empty result → NO_MATCH below. Otherwise, if
    // no group survived validation (or every group was malformed), the payload
    // is an error envelope, not "no match" (R2).
    if (groups.length > 0 && goodGroups === 0) {
      netLog.badResponses = (netLog.badResponses || 0) + 1;
      for (const n of group) nameToCandidate.set(n, { reason: 'BAD_RESPONSE' });
      continue;
    }
    if (groups.length > 0 && badGroups > 0 && goodGroups > 0) {
      // mixed valid/invalid payload: usable groups resolve normally, but flag
      // the anomaly so a partial outage is visible in the report
      netLog.badResponses = (netLog.badResponses || 0) + 1;
    }
    for (const n of group) {
      const entry = byKeyword.get(norm(n));
      if (entry == null) {
        // A top-level empty array is a legitimate empty result (verified API
        // protocol): every requested name simply has no candidates. But a
        // NON-empty payload missing a requested keyword is incomplete data —
        // a service anomaly for that name, not a business miss.
        if (groups.length === 0) nameToCandidate.set(n, { reason: 'NO_MATCH' });
        else nameToCandidate.set(n, { reason: 'BAD_RESPONSE' });
        continue;
      }
      if (entry.reason) { nameToCandidate.set(n, { reason: entry.reason }); continue; }
      const cands = entry.cands;
      nameToCandidate.set(n, cands.length ? decideFromCandidates(n, cands) : { reason: 'NO_MATCH' });
    }
  }

  // Build the pending-company list (search hits + alias targets), then fetch SVGs
  const pending = []; // { name, url, identity, themeMode, reason, sourceRef, assetId }
  for (const n of toFetch) {
    const d = decisions.get(n);
    if (d?.isAlias) {
      pending.push({ name: n, url: d.url, identity: d.identity, themeMode: d.themeMode, reason: 'ALIAS', sourceRef: d.sourceRef, assetId: d.assetId });
      continue;
    }
    const res = nameToCandidate.get(n);
    if (res && res.reason === 'EXACT') {
      pending.push({ name: n, url: res.candidate.url, identity: String(identityOf(res.candidate)), themeMode: 'paired', reason: 'EXACT', sourceRef: 'iconplus-search' });
    } else if (res && res.reason === 'AMBIGUOUS') {
      decisions.set(n, { name: n, kind: 'ep', reason: 'AMBIGUOUS', cacheStatus: 'MISS' });
    } else if (res && res.reason === 'NO_MATCH') {
      decisions.set(n, { name: n, kind: 'ep', reason: 'NO_MATCH', cacheStatus: 'MISS' });
    } else {
      // SERVICE_UNAVAILABLE / TIMEOUT / BAD_RESPONSE — service-side, not a business miss
      const reason = res && res.reason ? res.reason : 'BAD_RESPONSE';
      decisions.set(n, { name: n, kind: 'ep', reason, cacheStatus: 'MISS' });
    }
  }

  // group by url for getIcon batching
  const urlToNames = new Map();
  const urlNeedsDark = new Map();
  for (const p of pending) {
    if (!urlToNames.has(p.url)) urlToNames.set(p.url, []);
    urlToNames.get(p.url).push(p);
    if (p.themeMode !== 'shared') urlNeedsDark.set(p.url, true);
  }
  const urls = [...urlToNames.keys()];
  const urlToLight = new Map();
  const urlToDark = new Map();
  const urlFetchErr = new Map(); // url -> reason

  for (const group of chunk(urls, 30)) {
    const darkGroup = group.filter((u) => urlNeedsDark.get(u));
    try {
      const [lRes, dRes] = await Promise.allSettled([
        apiGetIcon(group.join(','), 'light', def.lightColor, def.size, def.style),
        darkGroup.length
          ? apiGetIcon(darkGroup.join(','), 'dark', def.darkColor, def.size, def.style)
          : Promise.resolve([]),
      ]);
      netLog.iconCalls += darkGroup.length ? 2 : 1;
      if (lRes.status === 'fulfilled') {
        const val = lRes.value;
        // Layer-2 validation (R2): the getIcon response must be an array of
        // {url, data} objects. Anything else (object envelope, null items,
        // missing data) is a service anomaly — never silently a miss.
        const arr = Array.isArray(val) ? val.filter((it) => it && typeof it === 'object') : null;
        if (arr === null) {
          netLog.badResponses = (netLog.badResponses || 0) + 1;
          for (const u of group) if (!urlFetchErr.has(u)) urlFetchErr.set(u, 'BAD_RESPONSE');
        } else {
          for (const it of arr) {
            if (typeof it.url !== 'string' || typeof it.data !== 'string') continue;
            urlToLight.set(it.url, it.data);
          }
          if (!arr.length) {
            netLog.badResponses = (netLog.badResponses || 0) + 1;
            for (const u of group) if (!urlFetchErr.has(u)) urlFetchErr.set(u, 'BAD_RESPONSE');
          }
        }
      } else {
        const r = classifyNetError(lRes.reason);
        for (const u of group) urlFetchErr.set(u, r);
      }
      if (dRes.status === 'fulfilled') {
        const val = dRes.value;
        const arr = Array.isArray(val) ? val.filter((it) => it && typeof it === 'object') : null;
        if (arr !== null) {
          for (const it of arr) {
            if (typeof it.url !== 'string' || typeof it.data !== 'string') continue;
            urlToDark.set(it.url, it.data);
          }
        }
      } else {
        for (const u of darkGroup) if (!urlFetchErr.has(u)) urlFetchErr.set(u, 'INCOMPLETE_THEME');
      }
    } catch (e) {
      const r = classifyNetError(e);
      for (const u of group) urlFetchErr.set(u, r);
    }
  }

  for (const p of pending) {
    const light = urlToLight.get(p.url);
    const dark = p.themeMode === 'shared' ? light : urlToDark.get(p.url);
    if (urlFetchErr.has(p.url) && !light) {
      decisions.set(p.name, { name: p.name, kind: 'ep', reason: urlFetchErr.get(p.url), cacheStatus: 'MISS' });
      continue;
    }
    if (!light) {
      decisions.set(p.name, { name: p.name, kind: 'ep', reason: 'SERVICE_UNAVAILABLE', cacheStatus: 'MISS' });
      continue;
    }
    if (p.themeMode !== 'shared' && !dark) {
      // §5.3 paired completeness: single-theme miss → whole item EP
      decisions.set(p.name, { name: p.name, kind: 'ep', reason: 'INCOMPLETE_THEME', cacheStatus: 'MISS' });
      continue;
    }
    const lErr = validateSvg(light);
    const dErr = p.themeMode === 'shared' ? null : validateSvg(dark);
    if (lErr || dErr) {
      decisions.set(p.name, { name: p.name, kind: 'ep', reason: 'INVALID_SVG', cacheStatus: 'MISS', detail: lErr || dErr });
      continue;
    }
    decisions.set(p.name, {
      name: p.name, kind: 'company', reason: p.reason,
      cacheStatus: refresh ? 'REFRESHED' : (legacyUnverified(p.name) ? 'LEGACY_UNVERIFIED' : 'MISS'),
      themeMode: p.themeMode, identity: p.identity, url: p.url, assetId: p.assetId, sourceRef: p.sourceRef,
      lightSvg: normalizeSvg(light), darkSvg: p.themeMode === 'shared' ? normalizeSvg(light) : normalizeSvg(dark),
      configUsed: { size: def.size, style: def.style, lightColor: def.lightColor, darkColor: def.darkColor },
    });
  }
}

// ────────────────────────────────────────────────────────────
// 5. Materialize SVG files + barrel
// ────────────────────────────────────────────────────────────
mkdirSync(iconsDir, { recursive: true });
const barrelPath = join(iconsDir, 'index.js');
const companyNames = requestedNames.filter((n) => decisions.get(n)?.kind === 'company');

function camel(s) {
  return s.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}
function buildBarrel() {
  const imports = [];
  const epFallbacks = [];
  const exports = [];
  let hasCompany = false;

  for (const name of requestedNames) {
    const d = decisions.get(name);
    if (d && d.kind === 'company') {
      const key = camel(name);
      imports.push(`import ${key}Light from './${name}.light.svg'`);
      imports.push(`import ${key}Dark from './${name}.dark.svg'`);
      exports.push(
        `export const ${name} = {\n  name: ${JSON.stringify(name)},\n  render() {\n    return h('span', { class: 'ux-icon-pair' }, [\n      h('img', { class: 'ux-icon-light', src: ${key}Light, style: 'width:1em;height:1em' }),\n      h('img', { class: 'ux-icon-dark', src: ${key}Dark, style: 'width:1em;height:1em' })\n    ])\n  }\n}`,
      );
      hasCompany = true;
    } else {
      epFallbacks.push(name);
    }
  }
  if (epFallbacks.length) imports.push(`export { ${epFallbacks.join(', ')} } from '@element-plus/icons-vue'`);

  // 'h' and the pair CSS are only needed when at least one company icon exists
  const body = [];
  if (hasCompany) {
    body.push(`// Dual-theme CSS switch for company icon pairs (light/dark SVG files)
if (typeof document !== 'undefined' && !document.getElementById('ux-icon-pair-style')) {
  var style = document.createElement('style')
  style.id = 'ux-icon-pair-style'
  style.textContent = [
    '.ux-icon-pair .ux-icon-dark { display: none }',
    '[data-theme="dark"] .ux-icon-pair .ux-icon-light { display: none }',
    '[data-theme="dark"] .ux-icon-pair .ux-icon-dark { display: block }'
  ].join('\\n')
  document.head.appendChild(style)
}`);
  }
  if (exports.length) body.push(exports.join('\n\n'));

  const head = hasCompany
    ? `// AUTO-GENERATED by fetch-icons.mjs — do not edit
// ${OWNED_MARKER}
// Unified icon entry: company IconPlus icons (dual-theme) + Element Plus
// fallbacks, exported together so pages import from one module.
import { h } from 'vue'`
    : `// AUTO-GENERATED by fetch-icons.mjs — do not edit
// ${OWNED_MARKER}
// Unified icon entry: all icons fall back to Element Plus (no company match
// this run); exported so pages import from one module regardless of outcome.`;

  return `${head}
${imports.join('\n')}
${body.length ? '\n' + body.join('\n\n') + '\n' : ''}`;
}
// Plan every owned output, verify ownership up front, then stage → commit so a
// failure never leaves a half-written set of assets (Spec §4.1 atomicity).
const outputs = []; // { path, content, label }
for (const name of companyNames) {
  const d = decisions.get(name);
  if (!d.lightSvg) continue; // cached — files already on disk, leave untouched
  outputs.push({ path: join(iconsDir, `${name}.light.svg`), content: d.lightSvg, label: `${name}.light.svg` });
  outputs.push({ path: join(iconsDir, `${name}.dark.svg`), content: d.themeMode === 'shared' ? d.lightSvg : d.darkSvg, label: `${name}.dark.svg` });
}
outputs.push({ path: barrelPath, content: buildBarrel(), label: 'index.js' });

for (const o of outputs) {
  if (!existsSync(o.path)) continue;
  if (!isGenerated(readFileSync(o.path, 'utf8'))) {
    fail(`refusing to overwrite non-generated file src/assets/icons/${o.label} — a user-authored file is in the way; move/rename it first`);
  }
}

const staged = [];
let committed = 0;
try {
  for (const o of outputs) {
    const tmp = `${o.path}.tmp-${process.pid}`;
    writeFileSync(tmp, o.content, 'utf8');
    // remember the pre-commit content so a mid-commit failure can restore it
    let hadContent = null;
    try { hadContent = readFileSync(o.path, 'utf8'); } catch { /* did not exist */ }
    staged.push({ tmp, path: o.path, hadContent });
  }
  for (const s of staged) {
    renameSync(s.tmp, s.path);
    committed++;
  }
} catch (e) {
  // commit rollback: a rename that fails mid-way must not leave a mixed set of
  // new and old files. Restore the pre-commit state: files that were already
  // committed are reverted to their staged backup (or removed if they did not
  // exist before), so the output set is all-old or all-new, never half.
  for (let i = committed - 1; i >= 0; i--) {
    const s = staged[i];
    try {
      if (s.hadContent) writeFileSync(s.path, s.hadContent, 'utf8');
      else rmSync(s.path, { force: true });
    } catch { /* best-effort rollback; remaining temp files cleaned below */ }
  }
  for (const s of staged) { try { rmSync(s.tmp, { force: true }); } catch { /* ignore */ } }
  fail(`failed to write icon assets atomically: ${e.message}`);
}

// ────────────────────────────────────────────────────────────
// 6. AST-rewrite page imports → barrel
// ────────────────────────────────────────────────────────────
let rewritten = 0;
for (const t of rewriteTargets) {
  try {
    const s = new MagicString(t.source);
    for (const e of t.edits) s.overwrite(e.start, e.end, e.repl);
    writeFileAtomic(t.file, s.toString());
    rewritten++;
  } catch (e) {
    fail(`failed to rewrite icon import in ${toPosixRel(t.file)}: ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────
// 7. Persist cache + report
// ────────────────────────────────────────────────────────────
const nextEntries = {};
for (const name of requestedNames) {
  const d = decisions.get(name);
  if (d.kind === 'company') {
    const lightHash = md5File(join(iconsDir, `${name}.light.svg`));
    nextEntries[name] = {
      provider, baseUrl, sourceId, groupId, mappingVersion,
      identity: d.identity, url: d.url, assetId: d.assetId, themeMode: d.themeMode,
      reason: d.reason, sourceRef: d.sourceRef,
      lightHash,
      // shared assets reuse the light file for dark; store the SAME hash so
      // cacheEntryValid can still validate the dark file on disk (R5)
      darkHash: d.themeMode === 'shared' ? lightHash : md5File(join(iconsDir, `${name}.dark.svg`)),
    };
  } else if (d.reason === 'NO_MATCH') {
    // service-scoped negative cache; NOT renewed on a hit — carry the original
    // expiry forward so a stale NO_MATCH still eventually expires (R3)
    const prev = cache.entries[name];
    const until = d.cacheStatus === 'NEGATIVE_HIT' && prev && prev.until ? prev.until : now + NEGATIVE_TTL_MS;
    nextEntries[name] = { provider, baseUrl, sourceId, groupId, mappingVersion, reason: 'NO_MATCH', until };
  } else {
    // AMBIGUOUS / INCOMPLETE_THEME / INVALID_SVG / SERVICE_UNAVAILABLE / TIMEOUT / BAD_RESPONSE — not a business miss
    nextEntries[name] = { provider, baseUrl, sourceId, groupId, mappingVersion, reason: d.reason, transient: true };
  }
}
try {
  writeFileAtomic(CACHE_PATH, JSON.stringify({ schemaVersion: 2, provider, baseUrl, mappingVersion, entries: nextEntries }, null, 2));
} catch (e) {
  fail(`failed to write icon cache: ${e.message}`);
}

const items = requestedNames.map((name) => {
  const d = decisions.get(name);
  return {
    epName: name,
    provider: d.kind === 'company' ? provider : 'element-plus',
    companyIdentity: d.kind === 'company' ? d.identity : null,
    reason: d.reason,
    cacheStatus: d.cacheStatus || 'NONE',
  };
});
const companyCount = items.filter((i) => i.provider === provider).length;
const fallbackCount = items.length - companyCount;
const status = fallbackCount === 0 ? 'COMPLETE' : 'FALLBACK';
if (online) netLog.networkMs = Date.now() - netT0;
const report = {
  schemaVersion: 2, baseUrl, mappingVersion, provider,
  summary: { requested: items.length, company: companyCount, fallback: fallbackCount, network: netLog, rewritten },
  items,
};
let reportWarn = null;
try {
  writeFileAtomic(REPORT_PATH, JSON.stringify(report, null, 2));
} catch (e) {
  // no longer silently ignored: the run result stands, but the failure is
  // visible both on stdout and in the protocol tail
  reportWarn = `icons-report.json write failed: ${e.message}`;
}

// ────────────────────────────────────────────────────────────
// 8. Output protocol (§5.4)
// ────────────────────────────────────────────────────────────
const cachedCount = items.filter((i) => i.cacheStatus === 'HIT' || i.cacheStatus === 'NEGATIVE_HIT').length;
const missed = items.filter((i) => i.provider !== provider).map((i) => i.epName);
console.log('RESULT: OK');
console.log(`STATUS: ${status}`);
console.log(`RESOLVED: ${companyCount}, MISSED: ${fallbackCount}, CACHED: ${cachedCount}`);
if (missed.length) console.log(`MISSED_LIST: ${missed.join(', ')}`);
if (reportWarn) console.log(`WARN: ${reportWarn}`);
console.log(`ICONS_DIR: ${resolve(iconsDir)}`);
console.log(`REPORT: ${resolve(REPORT_PATH)}`);
// Defer exit until stdout has flushed AND pending handles had a macrotask to
// settle; an immediate process.exit can trip a libuv assert on Windows (Node
// 24) when stdout pipes or undici handles are mid-teardown.
process.stdout.write('', () => {
  // wait for idle: keep yielding macrotasks until only the timer remains, so
  // undici/socket handles finish closing before exit (Windows Node 24 libuv
  // teardown assert otherwise fires ~1 in 7 runs)
  const waitIdle = (depth) => {
    const active = process.getActiveResourcesInfo().filter((r) => r !== 'Timeout');
    if (active.length === 0 || depth > 20) { process.exit(0); return; }
    setTimeout(() => waitIdle(depth + 1), 25);
  };
  setTimeout(() => waitIdle(0), 25);
});
