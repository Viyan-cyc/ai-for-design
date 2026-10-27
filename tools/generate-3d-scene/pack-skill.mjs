/** Publish a clean skill ZIP outside the skill directory. */
import { readFileSync, readdirSync, lstatSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname, join, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from '../../skills/generate-3d-scene/scripts/import-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
const dest = process.argv[2] && resolve(process.argv[2]);
const inside = (path) => { const rel = relative(root, path); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)); };
if (!dest || inside(dest)) throw new Error('Provide a ZIP output path outside the skill directory');
const excluded = new Set(['node_modules', 'dist', 'offline', '.cache', '.git', '__pycache__']);
const roots = ['SKILL.md', 'README.md', 'scripts', 'references', 'template', 'vendor'];
const files = [];
function walk(path, name) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    for (const child of readdirSync(path).sort()) {
      if (excluded.has(child) || /^(?:\.offline-|\.smoke|\.tmp)/.test(child)) continue;
      walk(join(path, child), `${name}/${child}`);
    }
  } else if (!/\.(?:zip|log|tsbuildinfo|pyc)$/.test(name)) files.push({ name: `generate-3d-scene/${name}`, data: readFileSync(path) });
}
for (const name of roots) {
  try { walk(join(root, name), name); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
mkdirSync(dirname(dest), { recursive: true });
writeZip(files, dest);
console.log(`RESULT: OK\nZIP_PATH: ${dest}\nFILES: ${files.length}`);
