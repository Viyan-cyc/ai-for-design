import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

export function workspaceFor(target) {
  const path = resolve(target);
  const key = createHash('sha256').update(process.platform === 'win32' ? path.toLowerCase() : path).digest('hex').slice(0, 24);
  return join(homedir(), '.scene3d', 'workspaces', key);
}

export function resolveWorkspace(target) {
  const path = resolve(target);
  if (existsSync(join(path, 'package.json'))) return path;
  const workspace = workspaceFor(path);
  if (existsSync(join(workspace, 'package.json'))) return workspace;
  throw new Error('未找到开发工作区，请使用 init 返回的 WORKSPACE_PATH；跨电脑二开请使用交付目录的 source');
}
