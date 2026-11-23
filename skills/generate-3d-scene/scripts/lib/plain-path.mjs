import { lstatSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function rejectLinkedPath(destination) {
  for (let path = resolve(destination); ; path = dirname(path)) {
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error('不支持链接路径：' + path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (dirname(path) === path) return;
  }
}
