#!/usr/bin/env node
// Isolated reproducible regression for gen-tokens.mjs ().
// Usage: node verify-gen-tokens.mjs
//
// Builds a THROWAWAY fixture (temp dir): a full copy of the skill + design-language
// source tree, then drives gen-tokens.mjs against it with real exit codes.
// The real skill directory is never touched.
//
// Covered scenarios ():
//   M1  normal generate → OK; --check → OK; manifest/skins/cheatsheet consistent
//   M2  old positional command still works (compat)
//   P2-1 manifest chart accessible tokens carry -accessible suffix; no duplicate names;
//        manifest name set == theme CSS declaration set; injected duplicate → FAIL
//   P2-2 --check validates ALL controlled manifest fields:
//        schemaVersion/designVersion/rulesVersion forgery, generatedFiles cheatsheet
//        hash forgery, index version bump, deleted sourceFiles entry → all FAIL;
//        generatedAt policy: null or ISO only
//   P2-3 extraction baselines are PER-LINE over full dependency line sets:
//        only font-family-en changed → regen blocked WITHOUT --confirm-extraction
//        (and four outputs unchanged); frost blur line changed → same; anchor line
//        deleted → both --check and generate FAIL; --confirm-extraction refreshes
//        baseline while template values stay untouched; EOL round-trip (CRLF↔LF)
//        does not false-drift
//   P2-4 manifest types are semantic: shadow/transition/alpha/fontWeight/fontFamily/
//        borderStyle/color/dimension per token; type/value incompatibility fails
//        generation (synthetic bad-template fixture via env override)
import { spawnSync } from 'child_process';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL = join(__dirname, '..');            // skills/gts-ep-coder
const REPO_ROOT = join(SKILL, '..', '..');      // ep-coder/ (design-language lives here)
const DESIGN_DIR = join(REPO_ROOT, 'design-language');

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' | ' + detail : ''}`);
}

const fx = mkdtempSync(join(tmpdir(), 'gtok-'));
const fxSkill = join(fx, 'skill');
const fxDesign = join(fx, 'design-language');
cpSync(SKILL, fxSkill, { recursive: true });
cpSync(DESIGN_DIR, fxDesign, { recursive: true });

const GEN = join(fxSkill, 'scripts', 'gen-tokens.mjs');
const MANIFEST = join(fxSkill, 'references', 'design-manifest.json');
const LESS_DEFAULT = join(fxSkill, 'scripts', 'preview', 'src', 'assets', 'themes', 'default.less');
const LESS_DARK = join(fxSkill, 'scripts', 'preview', 'src', 'assets', 'themes', 'dark.less');
const REF = join(fxSkill, 'references', 'design-language.md');
const DOC = join(fxDesign, '样式Token', '设计系统.md');
const IDX = join(fxDesign, '00索引.md');

function run(args) {
  const r = spawnSync('node', [GEN, ...args], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function readDoc() { return readFileSync(DOC, 'utf8'); }
function writeDoc(s) { writeFileSync(DOC, s, 'utf8'); }
function readIdx() { return readFileSync(IDX, 'utf8'); }
function writeIdx(s) { writeFileSync(IDX, s, 'utf8'); }
function manifest() { return JSON.parse(readFileSync(MANIFEST, 'utf8')); }
function writeManifest(m) { writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n', 'utf8'); }
const snap = () => ({
  less: readFileSync(LESS_DEFAULT, 'utf8'),
  dark: readFileSync(LESS_DARK, 'utf8'),
  ref: readFileSync(REF, 'utf8'),
  man: readFileSync(MANIFEST, 'utf8'),
});
const fourOutputsIdentical = (a, b) => a.less === b.less && a.dark === b.dark && a.ref === b.ref && a.man === b.man;
const EN_OLD = '| `font-family-en` | 英文 | Huawei Sans、Manrope、Arial、San Francisco、Helvetica、Roboto |';
const EN_NEW = EN_OLD.replace('Huawei Sans', 'ChangedFont');
function docEditEn() { writeDoc(readDoc().replace(EN_OLD, EN_NEW)); }
function docRestoreEn() { writeDoc(readDoc().replace(EN_NEW, EN_OLD)); }

// ---------- M1: normal generate + check + consistency ----------
// If the shipped manifest still carries the legacy single-hash baseline, the first plain
// regen must be blocked (explicit --confirm-extraction migration required) — assert that.
// Once shipped manifests are per-line, the first plain regen goes through directly.
const first = run(['--source-dir', fxDesign]);
if (first.code === 1 && /legacy single-hash baseline/.test(first.out)) {
  check('M1 legacy baseline blocks plain regen (explicit migration required)', true);
  const upgrade = run(['--source-dir', fxDesign, '--confirm-extraction']);
  check('M1 baseline upgrade via --confirm-extraction OK', upgrade.code === 0 && /RESULT: OK/.test(upgrade.out), upgrade.out.split('\n')[0]);
} else {
  check('M1 baseline upgrade via --confirm-extraction OK (shipped manifest already per-line)', first.code === 0 && /RESULT: OK/.test(first.out), first.out.split('\n')[0]);
}
const plain = run(['--source-dir', fxDesign]);
check('M1 plain regen (no gate)', plain.code === 0 && /RESULT: OK/.test(plain.out), plain.out.split('\n')[0]);

const chk = run(['--source-dir', fxDesign, '--check']);
check('M1 --check after generate', chk.code === 0 && /RESULT: OK/.test(chk.out), chk.out.split('\n')[0]);

// P2-1 positive: accessible suffix present, no duplicates
{
  const m = manifest();
  const names = m.tokens.map((t) => t.name);
  const dups = names.filter((n, i) => names.indexOf(n) !== i);
  const accessible = names.filter((n) => n.includes('accessible'));
  check('P2-1 accessible tokens carry -accessible suffix (6)', accessible.length === 6 && accessible.every((n) => /^color-chart-\d+-accessible$/.test(n)), accessible.join(','));
  check('P2-1 no duplicate token names', dups.length === 0, dups.join(','));
  // manifest name set == CSS declaration set (minus --ux-mix-base plumbing)
  const css = readFileSync(LESS_DEFAULT, 'utf8') + '\n' + readFileSync(LESS_DARK, 'utf8');
  const cssDecls = new Set([...css.matchAll(/--[a-z][a-z0-9-]*(?=\s*:)/g)].map((x) => x[0]));
  const mset = new Set(names.map((n) => '--' + n));
  const inCssNotMan = [...cssDecls].filter((n) => !mset.has(n) && n !== '--ux-mix-base');
  const inManNotCss = [...mset].filter((n) => !cssDecls.has(n));
  check('P2-1 manifest name set == theme CSS declaration set', inCssNotMan.length === 0 && inManNotCss.length === 0, `css-only:${inCssNotMan.join(',')} man-only:${inManNotCss.join(',')}`);
  // accessible value correctness: manifest -accessible values match CSS per theme file
  const cssLight = readFileSync(LESS_DEFAULT, 'utf8');
  const cssDarkF = readFileSync(LESS_DARK, 'utf8');
  const cssVal = (css, name) => { const m2 = css.match(new RegExp(`--${name}:\\s*([^;]+);`)); return m2 ? m2[1].trim() : null; };
  const accOk = m.tokens.filter((t) => /^color-chart-\d+-accessible$/.test(t.name))
    .every((t) => t.valueByTheme.default === cssVal(cssLight, t.name) && t.valueByTheme.dark === cssVal(cssDarkF, t.name));
  check('P2-1 accessible manifest values match CSS (both themes)', accOk);
}

// P2-4 positive: semantic types
{
  const m = manifest();
  const t = (n) => m.tokens.find((x) => x.name === n)?.type;
  const expect = [
    ['frost-surface-card', 'color'], ['frost-shadow-card', 'shadow'], ['frost-transition', 'transition'],
    ['frost-hover-add', 'alpha'], ['frost-blur-card', 'dimension'], ['frost-border-color', 'color'],
    ['font-weight-normal', 'fontWeight'], ['font-family-zh', 'fontFamily'], ['border-style-solid', 'borderStyle'],
    ['shadow-1', 'shadow'], ['space-size-16', 'dimension'], ['color-brand', 'color'],
  ];
  const bad = expect.filter(([n, want]) => t(n) !== want);
  check('P2-4 semantic token types', bad.length === 0, bad.map(([n, want]) => `${n}=${t(n)}≠${want}`).join(','));
  const allTypes = [...new Set(m.tokens.map((x) => x.type))];
  const ALLOWED = ['color', 'dimension', 'number', 'fontWeight', 'fontFamily', 'shadow', 'transition', 'borderStyle', 'alpha'];
  check('P2-4 all manifest types in declared set', allTypes.every((x) => ALLOWED.includes(x)), allTypes.join(','));
}

// ---------- M2: old positional command compat ----------
{
  const r = run([DOC, '--check']);
  check('M2 old positional command --check OK', r.code === 0 && /RESULT: OK/.test(r.out), r.out.split('\n')[0]);
}

// ---------- full-field check validation ----------
const before = snap();
const restoreManifest = () => writeFileSync(MANIFEST, before.man, 'utf8');
// (a) schemaVersion forgery
{
  const m = manifest(); m.schemaVersion = 999; writeManifest(m);
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 schemaVersion forgery → --check FAIL', r.code === 1 && /schemaVersion 999/.test(r.out));
  restoreManifest();
}
// (b) designVersion forgery
{
  const m = manifest(); m.designVersion = 'WRONG'; writeManifest(m);
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 designVersion forgery → --check FAIL', r.code === 1 && /designVersion "WRONG"/.test(r.out));
  restoreManifest();
}
// (c) rulesVersion forgery
{
  const m = manifest(); m.rulesVersion = 'wrong'; writeManifest(m);
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 rulesVersion forgery → --check FAIL', r.code === 1 && /rulesVersion "wrong"/.test(r.out));
  restoreManifest();
}
// (d) cheatsheet generatedFiles hash forgery
{
  const m = manifest(); m.generatedFiles['references/design-language.md'].hash = 'bad'; writeManifest(m);
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 cheatsheet hash forgery → --check FAIL', r.code === 1 && /generatedFiles hash mismatch: references\/design-language\.md/.test(r.out));
  restoreManifest();
}
// (e) index version bump (source-side) — designVersion mismatch + sourceFiles hash mismatch
{
  writeIdx(readIdx().replace('版本：**v2.3.0**', '版本：**v9.9.9**'));
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 index version bump → --check FAIL (designVersion + sourceFiles)', r.code === 1 && /designVersion "v2\.3\.0" !== source index "v9\.9\.9"/.test(r.out) && /sourceFiles hash mismatch: 00索引\.md/.test(r.out));
  writeIdx(readIdx().replace('版本：**v9.9.9**', '版本：**v2.3.0**'));
}
// (f) deleted sourceFiles entry
{
  const m = manifest(); delete m.sourceFiles['00索引.md']; writeManifest(m);
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 deleted sourceFiles entry → --check FAIL', r.code === 1 && /sourceFiles missing entry: 00索引\.md/.test(r.out));
  restoreManifest();
}
// (g) generatedAt policy: null or ISO only (non-ISO garbage rejected)
{
  const m = manifest(); m.generatedAt = 'not-a-date'; writeManifest(m);
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 generatedAt garbage → --check FAIL', r.code === 1 && /generatedAt/.test(r.out));
  const m2 = manifest(); m2.generatedAt = '2026-10-15T12:00:00.000Z'; writeManifest(m2);
  const r2 = run(['--source-dir', fxDesign, '--check']);
  check('P2-2 generatedAt ISO stamp accepted (no false drift)', r2.code === 0);
  restoreManifest();
}
// restore clean manifest by regenerating
run(['--source-dir', fxDesign]);
check('P2-2 restore regen after forgery suite', existsSync(MANIFEST));

// ---------- per-line extraction baselines ----------
// (a) only font-family-en line changed → regen WITHOUT confirm must FAIL + four outputs unchanged
{
  const s0 = readDoc();
  const old = '| `font-family-en` | 英文 | Huawei Sans、Manrope、Arial、San Francisco、Helvetica、Roboto |';
  writeDoc(s0.replace(old, old.replace('Huawei Sans', 'ChangedFont'), 1));
  const pre = snap(); // snapshot AFTER doc edit (doc is not one of the four outputs)
  const r = run(['--source-dir', fxDesign]);
  const blocked = r.code === 1 && /extraction override baseline problem/.test(r.out) && /font-family-en/.test(r.out);
  const unchanged = fourOutputsIdentical(pre, snap());
  check('P2-3 font-family-en-only change blocks regen, four outputs unchanged', blocked && unchanged, `blocked=${blocked} unchanged=${unchanged}`);
  // (b) with --confirm-extraction → passes, baseline refreshed, template value NOT auto-changed
  const r2 = run(['--source-dir', fxDesign, '--confirm-extraction']);
  const m = manifest();
  const en = m.tokens.find((t) => t.name === 'font-family-en');
  const templateUntouched = en.valueByTheme.default.startsWith("'HarmonyOS Sans'");
  const baselineRefreshed = m.extractionOverrides[0].lines.some((l) => l.anchor.includes('font-family-en') && l.sourceSnippetHash === liveHashOf(l.anchor));
  check('P2-3 confirm-extraction passes; template values untouched; baseline refreshed', r2.code === 0 && templateUntouched && baselineRefreshed);
  writeDoc(s0); // restore
  run(['--source-dir', fxDesign, '--confirm-extraction']); // re-baseline on restored doc
}
// (c) frost blur line changed → blocked without confirm
{
  const s0 = readDoc();
  const old = '| `--frost-blur-*` | 各档位背景模糊 | `control` 12px、`card` 20px、`overlay` 28px';
  writeDoc(s0.replace(old, old.replace('12px', '14px').replace('20px', '22px').replace('28px', '30px'), 1));
  const before2 = snap();
  const r = run(['--source-dir', fxDesign]);
  const blocked = r.code === 1 && /frost/.test(r.out) && /frost-blur/.test(r.out);
  const unchanged = fourOutputsIdentical(before2, snap());
  check('P2-3 frost blur line change blocks regen, outputs unchanged', blocked && unchanged);
  const r2 = run(['--source-dir', fxDesign, '--confirm-extraction']);
  const m = manifest();
  const blurCard = m.tokens.find((t) => t.name === 'frost-blur-card');
  check('P2-3 frost confirm passes; template blur value not auto-changed', r2.code === 0 && blurCard.valueByTheme.default === '20px');
  writeDoc(s0);
  run(['--source-dir', fxDesign, '--confirm-extraction']);
}
// (d) anchor line DELETED → both --check and generate FAIL
{
  const s0 = readDoc();
  const line = s0.split('\n').find((l) => l.startsWith('| `--frost-border` | 辅助材质边界'));
  writeDoc(s0.replace(line + '\n', ''));
  const rc = run(['--source-dir', fxDesign, '--check']);
  const rg = run(['--source-dir', fxDesign, '--confirm-extraction']); // even confirm must not bypass a missing anchor
  check('P2-3 anchor deleted → --check FAIL', rc.code === 1 && /anchor line\(s\) not found/.test(rc.out) && /frost-border/.test(rc.out));
  check('P2-3 anchor deleted → generate FAIL even with --confirm-extraction', rg.code === 1 && /anchor line\(s\) not found/.test(rg.out));
  writeDoc(s0);
  const rr = run(['--source-dir', fxDesign, '--check']);
  check('P2-3 anchor restored → --check OK again', rr.code === 0);
}
// (e) EOL round-trip: CRLF → LF → check stays green (line-hash EOL independence)
{
  const s0 = readDoc();
  writeDoc(s0.replace(/\r\n/g, '\n'));
  const rLf = run(['--source-dir', fxDesign, '--check']);
  writeDoc(s0); // restore CRLF (or original EOL mix)
  const rBack = run(['--source-dir', fxDesign, '--check']);
  check('P2-3 EOL round-trip does not false-drift (LF check + restore check)', rLf.code === 0 && rBack.code === 0);
}

// ---------- baseline missing/damaged must NOT bypass the confirm gate ----------
// Precondition recipe per review: first change the source font-family-en line, then attempt
// a plain regen under each damaged-manifest variant. All three must FAIL with the outputs
// byte-identical; after --confirm-extraction the regen passes, rebuilds the baseline, and
// --check goes green (with the template value NOT auto-synced — still the old stack).

const variants = [
  {
    name: 'missing font-stacks override group',
    damage: (m) => { m.extractionOverrides = m.extractionOverrides.filter((e) => e.id !== 'font-stacks'); },
    expect: /font-stacks: baseline group missing/,
  },
  {
    name: 'missing extractionOverrides field entirely',
    damage: (m) => { delete m.extractionOverrides; },
    expect: /no extractionOverrides array/,
  },
  {
    name: 'manifest is invalid JSON',
    damage: () => { writeFileSync(MANIFEST, '{ not valid json !!!', 'utf8'); },
    rawDamage: true,
    expect: /not valid JSON/,
  },
];
for (const v of variants) {
  // clean state: regen on pristine doc, then apply the source-line change
  docRestoreEn();
  run(['--source-dir', fxDesign]); // ensure clean baseline
  docEditEn();
  if (v.rawDamage) v.damage();
  else { const m = manifest(); v.damage(m); writeManifest(m); }
  const afterDamage = readFileSync(MANIFEST, 'utf8');
  const beforeLess = readFileSync(LESS_DEFAULT, 'utf8');
  const beforeDark = readFileSync(LESS_DARK, 'utf8');
  const beforeRef = readFileSync(REF, 'utf8');
  const rg = run(['--source-dir', fxDesign]);
  const blockedGen = rg.code === 1 && v.expect.test(rg.out) && /--confirm-extraction/.test(rg.out);
  const unchanged = readFileSync(MANIFEST, 'utf8') === afterDamage
    && readFileSync(LESS_DEFAULT, 'utf8') === beforeLess
    && readFileSync(LESS_DARK, 'utf8') === beforeDark
    && readFileSync(REF, 'utf8') === beforeRef;
  const rc = run(['--source-dir', fxDesign, '--check']);
  const blockedCheck = rc.code === 1 && (v.name === 'manifest is invalid JSON' ? /not valid JSON/.test(rc.out) : true);
  check(`§28.2 ${v.name}: plain regen blocked, --check FAIL`, blockedGen && blockedCheck, rg.out.split('\n')[0]);
  check(`§28.2 ${v.name}: manifest content not rewritten by blocked run`, unchanged);
  // explicit confirm rebuilds the baseline; template values stay untouched
  const rf = run(['--source-dir', fxDesign, '--confirm-extraction']);
  const m2 = manifest();
  const en = m2.tokens.find((t) => t.name === 'font-family-en');
  const templateUntouched = en.valueByTheme.default.startsWith("'HarmonyOS Sans'");
  const rc2 = run(['--source-dir', fxDesign, '--check']);
  check(`§28.2 ${v.name}: --confirm-extraction rebuilds baseline, template untouched, --check green`,
    rf.code === 0 && templateUntouched && rc2.code === 0);
  docRestoreEn();
  run(['--source-dir', fxDesign, '--confirm-extraction']); // re-baseline on restored doc
}

// NO manifest = explicit initialization required (default DENY, confirm to establish)
// (a) true first publish: plain regen refused; manifest stays absent; confirm establishes baseline
{
  const backup = readFileSync(MANIFEST, 'utf8');
  rmSync(MANIFEST, { force: true });
  const beforeLess = readFileSync(LESS_DEFAULT, 'utf8');
  const beforeRef = readFileSync(REF, 'utf8');
  const r = run(['--source-dir', fxDesign]);
  const denied = r.code === 1 && /not found — no extraction baseline/.test(r.out) && /--confirm-extraction/.test(r.out);
  const stillAbsent = !existsSync(MANIFEST);
  const othersUntouched = readFileSync(LESS_DEFAULT, 'utf8') === beforeLess && readFileSync(REF, 'utf8') === beforeRef;
  check('§30.2 no manifest: plain regen denied, manifest stays absent, other outputs untouched', denied && stillAbsent && othersUntouched, r.out.split('\n')[0]);
  const rf = run(['--source-dir', fxDesign, '--confirm-extraction']);
  const established = rf.code === 0 && existsSync(MANIFEST) && manifest().extractionOverrides.length === 2;
  const rc = run(['--source-dir', fxDesign, '--check']);
  check('§30.2 first publish: --confirm-extraction establishes baseline, --check green', established && rc.code === 0, rf.out.split('\n')[0]);
  writeFileSync(MANIFEST, backup, 'utf8'); // restore pre-existing baseline for remaining tests
}
// (b) deleted manifest + MODIFIED source line (review repro: delete manifest to bypass protection)
{
  const backup = readFileSync(MANIFEST, 'utf8');
  rmSync(MANIFEST, { force: true });
  docEditEn(); // Huawei Sans → ChangedFont in source font-family-en line
  const beforeLess = readFileSync(LESS_DEFAULT, 'utf8');
  const beforeRef = readFileSync(REF, 'utf8');
  const r = run(['--source-dir', fxDesign]);
  const denied = r.code === 1 && /not found — no extraction baseline/.test(r.out);
  const stillAbsent = !existsSync(MANIFEST);
  const othersUntouched = readFileSync(LESS_DEFAULT, 'utf8') === beforeLess && readFileSync(REF, 'utf8') === beforeRef;
  check('§30.2 deleted manifest + modified source: plain regen denied, outputs untouched', denied && stillAbsent && othersUntouched, r.out.split('\n')[0]);
  // confirm establishes baseline against the MODIFIED doc; template value NOT auto-synced
  const rf = run(['--source-dir', fxDesign, '--confirm-extraction']);
  const m2 = manifest();
  const en = m2.tokens.find((t) => t.name === 'font-family-en');
  const templateUntouched = en.valueByTheme.default.startsWith("'HarmonyOS Sans'");
  const rc2 = run(['--source-dir', fxDesign, '--check']);
  check('§30.2 confirm after deletion+edit: baseline established, template untouched, --check green',
    rf.code === 0 && templateUntouched && rc2.code === 0);
  docRestoreEn();
  run(['--source-dir', fxDesign, '--confirm-extraction']); // re-baseline on restored doc
  writeFileSync(MANIFEST, backup, 'utf8');
}

// baseline line malformed (hash field stripped) — damaged, needs confirm
{
  docEditEn();
  const m = manifest();
  delete m.extractionOverrides[0].lines[1].sourceSnippetHash;
  writeManifest(m);
  const afterDamage = readFileSync(MANIFEST, 'utf8');
  const beforeLess = readFileSync(LESS_DEFAULT, 'utf8');
  const beforeRef = readFileSync(REF, 'utf8');
  const rg = run(['--source-dir', fxDesign]);
  const blocked = rg.code === 1 && /malformed/.test(rg.out) && /font-stacks/.test(rg.out);
  const unchanged = readFileSync(MANIFEST, 'utf8') === afterDamage
    && readFileSync(LESS_DEFAULT, 'utf8') === beforeLess
    && readFileSync(REF, 'utf8') === beforeRef;
  check('§28.2 malformed baseline line: plain regen blocked, outputs unchanged', blocked && unchanged, `blocked=${blocked} unchanged=${unchanged}`);
  docRestoreEn();
  run(['--source-dir', fxDesign, '--confirm-extraction']);
}
// anchor missing + --confirm-extraction still refused (regression guard for the new gate)
{
  const s0 = readDoc();
  const line = s0.split('\n').find((l) => l.startsWith('| `--frost-border` | 辅助材质边界'));
  writeDoc(s0.replace(line + '\n', ''));
  const rg = run(['--source-dir', fxDesign, '--confirm-extraction']);
  check('§28.2 anchor missing: --confirm-extraction still refused', rg.code === 1 && /anchor line\(s\) not found/.test(rg.out));
  writeDoc(s0);
  const rr = run(['--source-dir', fxDesign, '--check']);
  check('§28.2 anchor restored: --check green again', rr.code === 0);
}

// ---------- P2-1 negative: duplicate injection → must FAIL check ----------
{
  const m = manifest();
  for (const t of m.tokens) { if (t.name === 'color-chart-3-accessible') { t.name = 'color-chart-3'; break; } }
  writeManifest(m);
  const r = run(['--source-dir', fxDesign, '--check']);
  check('P2-1 injected duplicate chart name → --check FAIL', r.code === 1 && /tokens differ/.test(r.out));
}

// ---------- P2-4 negative: type/value incompatibility fails generation ----------
{
  // Synthesize a broken generator copy: force frost-blur-card template value to a non-dimension
  const brokenGen = GEN + '.broken.mjs';
  const src = readFileSync(GEN, 'utf8');
  const patched = src.replace("'  --frost-blur-card: 20px;'", "'  --frost-blur-card: not-a-length;'");
  if (patched === src) {
    check('P2-4 bad-value template fixture built', false, 'template patch anchor not found');
  } else {
    mkdirSync(dirname(brokenGen), { recursive: true });
    writeFileSync(brokenGen, patched, 'utf8');
    const r = spawnSync('node', [brokenGen, '--source-dir', fxDesign, '--confirm-extraction'], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
    const out = (r.stdout || '') + (r.stderr || '');
    check('P2-4 type/value mismatch fails generation', r.status === 1 && /incompatible with type dimension/.test(out) && /frost-blur-card/.test(out));
    rmSync(brokenGen, { force: true });
  }
}

// ---------- final: clean regen + check green, exit-code asserted ----------
{
  const r = run(['--source-dir', fxDesign]);
  const c = run(['--source-dir', fxDesign, '--check']);
  check('FINAL clean regen + --check green', r.code === 0 && c.code === 0, c.out.split('\n')[0]);
}

rmSync(fx, { recursive: true, force: true });
const fails = results.filter((r) => !r.ok).length;
console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : 'FAIL'} | ${results.length - fails}/${results.length}`);
process.exit(fails === 0 ? 0 : 1);

function liveHashOf(anchor) {
  const doc = readDoc();
  const idx = doc.indexOf(anchor);
  if (idx === -1) return null;
  let line = doc.slice(idx, doc.indexOf('\n', idx));
  if (line.endsWith('\r')) line = line.slice(0, -1);
  return crypto.createHash('sha256').update(line).digest('hex');
}
