import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

// Generated delivery is replaceable; the editable workspace remains authoritative.
export function packageDelivery(root) {
  root = resolve(root);
  const out = join(root, 'delivery');
  const marker = join('preview', '.scene3d-delivery');
  if (existsSync(out) && !existsSync(join(out, marker))) throw new Error('delivery 不是本工具创建的目录，请先移走其中的文件');
  const stage = join(root, `.delivery-stage-${randomUUID()}`);
  const backup = join(root, `.delivery-backup-${randomUUID()}`);
  const removeOwned = (path) => {
    if (resolve(path, '..') !== root) throw new Error('交付清理路径越界');
    rmSync(path, { recursive: true, force: true });
  };
  try {
    mkdirSync(join(stage, 'source'), { recursive: true });
    cpSync(join(root, 'offline'), join(stage, 'preview'), { recursive: true });
    const html = readFileSync(join(stage, 'preview/index.3d.html'), 'utf8')
      .replace(/((?:src|href)=["'])\.\//g, '$1./preview/');
    writeFileSync(join(stage, 'index.3d.html'), html);
    rmSync(join(stage, 'preview/index.3d.html'));
    rmSync(join(stage, 'preview/.scene3d-offline'), { force: true });
    writeFileSync(join(stage, marker), '1\n');
    const dirs = new Set(['src', 'public', 'scripts', 'docs', 'vendor']);
    const files = /^(package(?:-lock)?\.json|index\.html|(?:vite|tsconfig|eslint|prettier)[\w.-]*\.(?:json|ts|js|mjs|cjs)|README(?:\.[\w-]+)?\.md|\.gitignore|\.prettierignore)$/;
    const excluded = new Set(['node_modules', '.cache', '.git', 'dist', 'offline', 'delivery']);
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!(entry.isDirectory() ? dirs.has(entry.name) : entry.isFile() && files.test(entry.name))) continue;
      cpSync(join(root, entry.name), join(stage, 'source', entry.name), {
        recursive: true,
        filter: path => !relative(root, path).split(sep).some(part => excluded.has(part)),
      });
    }
    // Local package dependencies must remain installable after moving source/.
    const pkg = JSON.parse(readFileSync(join(stage, 'source/package.json'), 'utf8'));
    for (const value of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (typeof value !== 'string' || !value.startsWith('file:')) continue;
      const local = resolve(stage, 'source', value.slice(5));
      if (!local.startsWith(join(stage, 'source') + sep) || !existsSync(local)) throw new Error(`源码交付缺少本地依赖：${value}`);
    }
    if (existsSync(out)) renameSync(out, backup);
    try { renameSync(stage, out); } catch (error) {
      if (existsSync(backup)) renameSync(backup, out);
      throw error;
    }
    if (existsSync(backup)) removeOwned(backup);
    return join(out, 'index.3d.html');
  } finally {
    if (existsSync(stage)) removeOwned(stage);
  }
}
