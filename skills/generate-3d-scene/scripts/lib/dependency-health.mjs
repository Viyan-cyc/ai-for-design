import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// Lightweight declared-entry check. Type checking/building validate actual imports.
export function checkDependencyHealth(modules, pkg) {
  const errors = [];
  for (const id of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (Object.hasOwn(pkg.optionalDependencies ?? {}, id)) continue;
    const file = join(modules, id, 'package.json');
    if (!existsSync(file)) { errors.push(`${id}/package.json`); continue; }
    try {
      const installed = JSON.parse(readFileSync(file, 'utf8'));
      if (typeof installed.main === 'string' && installed.main.trim()) {
        try { createRequire(file).resolve(join(modules, id, installed.main)); }
        catch { errors.push(`${id}/${installed.main}`); }
      }
      for (const field of ['types', 'typings']) {
        if (installed[field] && !existsSync(join(modules, id, installed[field]))) errors.push(`${id}/${installed[field]}`);
      }
    } catch { errors.push(`${id}/package.json invalid`); }
  }
  if (errors.length) throw Error('DEPENDENCY_INCOMPLETE: ' + errors.join(', '));
}
