#!/usr/bin/env node
// gen-whitelists.mjs — one-shot tool (Execute-phase, not part of the runtime skill)
// Generates verify/whitelists/sweetui-*.json from a locally unpacked
// @hw-seq/sweet-ui-base tgz (intranet only — the package is not reachable
// from the public network).
//
//   components/exports: walked from the UMD build (sweet-ui-base.umd.cjs,
//     Node-requireable CJS wrapper) — exports = all keys; components = keys
//     matching Sweet[A-Z] whose value looks like a component.
//   icons: font-icon semantic names scraped from theme-chalk CSS class
//     selectors (.sweetui-icon-{name}-l / -f), deduped across both variants.
//
// Usage:
//   node gen-whitelists.mjs <unpacked sweet-ui-base package dir> [outDir]
import { createRequire } from 'module';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const pkgDir = resolve(process.argv[2]);
if (!existsSync(join(pkgDir, 'dist', 'sweet-ui-base.umd.cjs'))) {
  console.log('RESULT: FAIL | usage: node gen-whitelists.mjs <unpacked @hw-seq/sweet-ui-base package dir> [outDir]');
  process.exit(1);
}
const require2 = createRequire(join(pkgDir, 'package.json'));
const SWT = require2(join(pkgDir, 'dist', 'sweet-ui-base.umd.cjs'));

// components: keys matching Sweet[A-Z] whose value looks like a component
// (has name/props/render/setup — same heuristic as the EP generator)
const compNames = new Set();
const exports = new Set();
for (const [k, v] of Object.entries(SWT)) {
  exports.add(k);
  if (v && typeof v === 'object' && (v.name || v.props || v.render || v.setup)) {
    const n = typeof v.name === 'string' ? v.name : k;
    if (/^Sweet[A-Z]/.test(n) || /^Sweet[A-Z]/.test(k)) compNames.add(n);
  }
}
// kebab-case conversion: SweetTableColumn -> sweet-table-column
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
const components = [...compNames].map(kebab).sort();
const exportNames = [...exports].sort();

// icons: font-icon semantic names from theme-chalk CSS class selectors
// (.sweetui-icon-search-l → "search"); strip the -l/-f variant suffix
const icons = new Set();
const themeChalkDir = join(pkgDir, 'theme-chalk');
if (existsSync(themeChalkDir)) {
  const cssFiles = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) cssFiles.push(full);
    }
  })(themeChalkDir);
  for (const f of cssFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\.sweetui-icon-([a-z0-9-]+?)-(l|f)\b/g)) {
      icons.add(m[1]);
    }
  }
} else {
  console.log('WARN: theme-chalk/ not found — sweetui-icons.json will be empty');
}
const iconNames = [...icons].sort();

const out = resolve(process.argv[3] || '.');
writeFileSync(join(out, 'sweetui-components.json'), JSON.stringify(components, null, 2) + '\n');
writeFileSync(join(out, 'sweetui-exports.json'), JSON.stringify(exportNames, null, 2) + '\n');
writeFileSync(join(out, 'sweetui-icons.json'), JSON.stringify(iconNames, null, 2) + '\n');
console.log('RESULT: OK');
console.log(`COMPONENTS: ${components.length}`);
console.log(`EXPORTS: ${exportNames.length}`);
console.log(`ICONS: ${iconNames.length}`);
console.log(`OUT: ${out}`);
