import { mkdirSync, lstatSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

// Reserve a new project atomically. Existing projects are edited without init.
export function reserveProject(parent, name, exact = false) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw Error('Project name must be lowercase kebab-case: ' + name);
  }
  const base = resolve(parent);
  for (let cursor = base; ; cursor = dirname(cursor)) {
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('Invalid project parent: ' + cursor);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (dirname(cursor) === cursor) break;
  }
  mkdirSync(exact ? dirname(base) : base, { recursive: true });
  for (let suffix = 1; ; suffix++) {
    const target = exact ? base : join(base, name + (suffix === 1 ? '' : '-' + suffix));
    try { mkdirSync(target); return target; }
    catch (error) {
      if (error.code !== 'EEXIST' || exact) throw error;
    }
  }
}
