import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, sep, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const baselinePath = 'preview/.scene3d-delivery-baseline.json';
const recovery = '请保留旧交付目录，选择新的交付目标，或使用交付 source 作为工作工程；不会自动覆盖或合并。';
const fail = message => { throw new Error(`交付保护：${message}。${recovery}`); };

// Include directories so empty additions/deletions are protected too. Never follow links.
function deliverySnapshot(root) {
  const entries = Object.create(null);
  const visit = (path, key) => {
    const stat = lstatSync(path);
    // The manifest cannot hash itself; validate its type and schema separately.
    if (key === baselinePath && stat.isFile() && !stat.isSymbolicLink()) return;
    if (stat.isSymbolicLink()) fail(`不支持链接 ${key}`);
    if (stat.isDirectory()) {
      if (key) entries[key] = 'directory';
      for (const name of readdirSync(path).sort()) visit(join(path, name), key ? `${key}/${name}` : name);
    } else if (stat.isFile() && key) {
      entries[key] = createHash('sha256').update(readFileSync(path)).digest('hex');
    } else fail(`不支持的文件类型 ${key}`);
  };
  if (!existsSync(root)) fail('交付目录缺失');
  if (!lstatSync(root).isDirectory()) fail('交付目录不是目录');
  visit(root, '');
  return entries;
}

function verifyDelivery(out) {
  let baseline;
  try {
    const file = join(out, baselinePath);
    if (lstatSync(file).isSymbolicLink()) fail('基线不能是链接');
    baseline = JSON.parse(readFileSync(file, 'utf8'));
  } catch { fail(`基线缺失或损坏：${baselinePath}`); }
  if (baseline?.version !== 2 || baseline?.scope !== 'delivery' || baseline?.algorithm !== 'sha256'
      || !baseline.entries || typeof baseline.entries !== 'object' || Array.isArray(baseline.entries)
      || !['index.3d.html', 'preview/.scene3d-delivery', 'source/package.json'].every(path => Object.hasOwn(baseline.entries, path))) fail('基线格式无效或版本不支持');
  for (const [path, hash] of Object.entries(baseline.entries)) {
    if (path === baselinePath || !path || path.includes('\\') || path.includes(':') || path.split('/').some(p => !p || p === '.' || p === '..')
        || typeof hash !== 'string' || (hash !== 'directory' && !/^[a-f0-9]{64}$/.test(hash))) fail('基线条目无效');
  }
  const current = deliverySnapshot(out);
  const conflicts = [...new Set([...Object.keys(baseline.entries), ...Object.keys(current)])]
    .filter(path => baseline.entries[path] !== current[path]).sort();
  if (conflicts.length) fail(`交付目录与上次成功交付不同：\n${conflicts.join('\n')}`);
}

// The previous successful delivery, not the workspace, is the overwrite baseline.
export function packageDelivery(root) {
  root = resolve(root);
  const config = join(root, '.scene3d-delivery.json');
  const out = existsSync(config) ? resolve(JSON.parse(readFileSync(config, 'utf8')).output) : join(root, 'delivery');
  if (out === root || root.startsWith(out + sep)) throw new Error('交付目录不能包含开发工作区');
  const marker = join('preview', '.scene3d-delivery');
  if (existsSync(out) && lstatSync(out).isSymbolicLink()) fail('交付目录不能是链接');
  if (existsSync(out) && readdirSync(out).length > 0 && !existsSync(join(out, marker))) throw new Error('delivery 不是本工具创建的目录，请先移走其中的文件');
  const verifyExisting = () => {
    if (existsSync(out) && readdirSync(out).length > 0) verifyDelivery(out);
  };
  verifyExisting();
  const parent = dirname(out);
  mkdirSync(parent, { recursive: true });
  const stage = join(parent, `.delivery-stage-${randomUUID()}`);
  const backup = join(parent, `.delivery-backup-${randomUUID()}`);
  const removeOwned = (path) => {
    if (resolve(path, '..') !== parent) throw new Error('交付清理路径越界');
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
    // Official layout regeneration needs its input, not demos or prior candidates.
    const stageInput = join(root, 'scenes/stage.json');
    if (existsSync(join(root, 'scripts/compose-scene.mjs'))) {
      for (const input of ['scenes/stage.json', 'src/layout-recipe.json', 'scripts/layout.mjs'])
        if (!existsSync(join(root, input))) throw new Error(`布局生成源码缺少 ${input}`);
    }
    if (existsSync(stageInput)) {
      mkdirSync(join(stage, 'source/scenes'), { recursive: true });
      cpSync(stageInput, join(stage, 'source/scenes/stage.json'));
    }
    // Local package dependencies must remain installable after moving source/.
    const pkg = JSON.parse(readFileSync(join(stage, 'source/package.json'), 'utf8'));
    for (const value of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (typeof value !== 'string' || !value.startsWith('file:')) continue;
      const local = resolve(stage, 'source', value.slice(5));
      if (!local.startsWith(join(stage, 'source') + sep) || !existsSync(local)) throw new Error(`源码交付缺少本地依赖：${value}`);
    }
    writeFileSync(join(stage, baselinePath), JSON.stringify({ version: 2, scope: 'delivery', algorithm: 'sha256', entries: deliverySnapshot(stage) }, null, 2));
    verifyExisting();
    if (existsSync(out)) renameSync(out, backup);
    try {
      // Recheck the renamed directory before committing; preserve late user changes.
      if (existsSync(backup) && readdirSync(backup).length > 0) verifyDelivery(backup);
      renameSync(stage, out);
    } catch (error) {
      if (existsSync(backup)) renameSync(backup, out);
      throw error;
    }
    if (existsSync(backup)) removeOwned(backup);
    return join(out, 'index.3d.html');
  } finally {
    if (existsSync(stage)) removeOwned(stage);
  }
}
