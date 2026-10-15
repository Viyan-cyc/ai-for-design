#!/usr/bin/env node
// gen-whitelists.mjs — one-shot tool (Execute-phase, not part of the runtime skill)
// Generates verify/whitelists/*.json from a locally unpacked element-plus tgz.
//
// Usage: node gen-whitelists.mjs <path-to-unpacked-ep-package>
import { createRequire } from 'module';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const pkgDir = resolve(process.argv[2]);
if (!existsSync(join(pkgDir, 'dist', 'index.full.js'))) {
  console.log('RESULT: FAIL | usage: node gen-whitelists.mjs <unpacked element-plus package dir>');
  process.exit(1);
}
const require2 = createRequire(join(pkgDir, 'package.json'));
const EP = require2(join(pkgDir, 'dist', 'index.full.js'));

// components: keys whose value is a component (has .name starting with El... or render/props)
const compNames = new Set();
const exports = new Set();
for (const [k, v] of Object.entries(EP)) {
  exports.add(k);
  if (v && typeof v === 'object' && (v.name || v.props || v.render || v.setup)) {
    const n = typeof v.name === 'string' ? v.name : k;
    if (/^El[A-Z]/.test(n) || /^El[A-Z]/.test(k)) compNames.add(n);
  }
}
// kebab-case conversion: ElTableColumn -> el-table-column
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
const components = [...compNames].map(kebab).sort();
const exportNames = [...exports].sort();

// icons from the IIFE global
const ICONS_PATH = join(pkgDir, '..', 'icons-pkg', 'dist', 'index.iife.js');
const icons = [];
if (existsSync(ICONS_PATH)) {
  const src = readFileSync(ICONS_PATH, 'utf8');
  // iife builds export an object literal keyed by icon name: "AddLocation":(...)
  for (const m of src.matchAll(/([A-Z][A-Za-z0-9]+)\s*:\s*\(\)\s*=>/g)) icons.add?.(m[1]);
}
const iconSet = new Set(icons);
if (existsSync(ICONS_PATH)) {
  const src = readFileSync(ICONS_PATH, 'utf8');
  for (const m of src.matchAll(/([A-Z][A-Za-z0-9]+)\s*:\s*\(\)\s*=>/g)) iconSet.add(m[1]);
}
const iconNames = [...iconSet].sort();

const out = resolve(process.argv[3] || '.');
writeFileSync(join(out, 'element-plus-components.json'), JSON.stringify(components, null, 2) + '\n');
writeFileSync(join(out, 'element-plus-exports.json'), JSON.stringify(exportNames, null, 2) + '\n');
writeFileSync(join(out, 'element-plus-icons.json'), JSON.stringify(iconNames, null, 2) + '\n');
console.log('RESULT: OK');
console.log(`COMPONENTS: ${components.length}`);
console.log(`EXPORTS: ${exportNames.length}`);
console.log(`ICONS: ${iconNames.length}`);
console.log(`OUT: ${out}`);
