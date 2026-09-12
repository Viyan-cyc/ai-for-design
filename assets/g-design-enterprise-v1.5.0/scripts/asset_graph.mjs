/**
 * Resolve local source dependencies without importing or executing component code.
 * 移植自 scripts/asset_graph.py（W3/D18），行为逐条对齐。
 */
import fs from 'node:fs';
import path from 'node:path';

export function safePath(root, relative) {
  const rootResolved = path.resolve(root);
  const resolved = path.resolve(root, relative);
  if (resolved === rootResolved || !resolved.startsWith(rootResolved + path.sep)) {
    throw new Error(`Path escapes asset root: ${relative}`);
  }
  return resolved;
}

export function dependencyFiles(root, starts, skip = []) {
  const seen = new Set();
  const queue = [...starts];
  const skipped = new Set(skip);
  const EXTENSIONS = ['.ts', '.js', '.vue', '.json', '.css', '.scss'];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel) || skipped.has(rel)) continue;
    const p = safePath(root, rel);
    if (!fs.statSync(p, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing dependency: ${rel}`);
    seen.add(rel);
    if (!['.ts', '.js', '.vue', '.css', '.scss'].includes(path.extname(p))) continue;
    const text = fs.readFileSync(p, 'utf8');
    const refs = [
      ...text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g),
      ...text.matchAll(/<style[^>]+src=['"]([^'"]+)['"]/g),
    ].map((m) => m[1]);
    for (const ref of refs) {
      if (!ref.startsWith('.')) continue;
      const candidate = path.join(path.dirname(p), ref);
      const choices = [candidate];
      for (const ext of EXTENSIONS) choices.push(candidate + ext);
      for (const ext of ['.ts', '.js']) choices.push(path.join(candidate, `index${ext}`));
      const target = choices.find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
      if (target === undefined) throw new Error(`Unresolved local import ${ref} in ${rel}`);
      const targetResolved = path.resolve(target);
      const rootResolved = path.resolve(root);
      if (!targetResolved.startsWith(rootResolved + path.sep)) throw new Error('Dependency escapes root');
      queue.push(path.relative(rootResolved, targetResolved).split(path.sep).join('/'));
    }
  }
  return [...seen].sort();
}
