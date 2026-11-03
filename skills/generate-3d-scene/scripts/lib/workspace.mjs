import { resolve, join, basename } from 'node:path';
import { existsSync } from 'node:fs';

export function resolveWorkspace(target) {
  const path = resolve(target);
  if (existsSync(join(path, 'source/package.json'))) return join(path, 'source');
  if (basename(path) === 'source' && existsSync(join(path, 'package.json'))) return path;
  throw new Error('未找到项目源码，请传入项目目录或其中的 source 目录');
}
