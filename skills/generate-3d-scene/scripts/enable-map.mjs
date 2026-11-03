import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspace } from './lib/workspace.mjs';

// Optional feature installation, never run for an ordinary local 3D scene.
const target = process.argv[2];
if (!target) throw new Error('用法: node scripts/enable-map.mjs <交付目录或工作区>');
const workspace = resolveWorkspace(target);
// Reject links in every destination ancestry before reading or writing project files.
function rejectLinkedPath(destination) {
  let path = resolve(destination);
  for (;;) {
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error(`地图启用冲突，工程未修改：链接路径 ${path}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(path);
    if (parent === path) break;
    path = parent;
  }
}
for (const path of ['src/scene3d/create-scene.ts', 'package.json', 'vendor']) rejectLinkedPath(join(workspace, path));
const deps = join(workspace, 'node_modules');
if (existsSync(deps) && (lstatSync(deps).isSymbolicLink() || resolve(realpathSync(deps)).toLowerCase() !== resolve(deps).toLowerCase()))
  throw new Error('HINT: 地图工程需要独立依赖。请初始化时使用 --deps copy；不要向共享 node_modules 安装地图依赖。');
const skill = dirname(dirname(fileURLToPath(import.meta.url)));
// Map runtime is distributed through the same production component package.
const packages = readdirSync(join(skill, 'vendor')).filter(name => /^a3d-a3d-components-.*\.tgz$/.test(name));
if (packages.length !== 1) throw new Error('HINT: 需要唯一的组件库生产包，请维护者运行 sync-components.mjs。');
const sourcePackage = packages[0];
const digest = createHash('sha256').update(readFileSync(join(skill, 'vendor', sourcePackage))).digest('hex').slice(0, 16);
const componentPackage = sourcePackage.replace(/\.tgz$/, `-${digest}.tgz`);

const entry = join(workspace, 'src/scene3d/create-scene.ts');
let code = readFileSync(entry, 'utf8').replace(/^[ \t]*if \(data\.map\) throw new Error\('地图能力未启用，请先运行 enable-map\.mjs'\);\r?\n/gm, '');
if (!code.includes('createMapScene')) {
  const marker = "  const canvas = document.createElement('canvas');";
  if (!code.includes(marker)) throw new Error('create-scene.ts 已变更，请按 references/map.md 手动接入，未覆盖业务代码');
  code = "import { createMapScene } from './map/create-map-scene';\n" + code.replace(marker, `  if (data.map) {
    const handle = await createMapScene(host, structuredClone(data), options.cards ?? {}, {
      profile: registerBusinessFactories, cardContext: options.cardContext, assetBaseUrl, assetManifest: manifest,
    });
    try {
      applyCompiledAppearance(handle, data, { visuals: compiledVisuals, materialLib: compiledMaterialLib });
      if (offlineData()) void handle.whenReady({ timeoutMs: 60000 }).catch(showSceneError);
      return handle;
    } catch (error) { handle.dispose(); throw error; }
  }
` + marker);
}

const packagePath = join(workspace, 'package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.dependencies = { ...pkg.dependencies, '@a3d/a3d-components': `file:./vendor/${componentPackage}`, three: '0.185.1', 'maplibre-gl': '5.24.0', '@turf/turf': '7.2.0' };
// Preflight the entire copy set before changing dependencies, registration or files.
const pending = [], conflicts = [];
function inspect(source, destination) {
  rejectLinkedPath(destination);
  let stat;
  try { stat = lstatSync(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (stat?.isSymbolicLink()) { conflicts.push(destination); return; }
  if (lstatSync(source).isDirectory()) {
    if (stat && !stat.isDirectory()) { conflicts.push(destination); return; }
    for (const name of readdirSync(source)) inspect(join(source, name), join(destination, name));
  } else if (stat) {
    if (!stat.isFile() || !readFileSync(source).equals(readFileSync(destination))) conflicts.push(destination);
  } else pending.push([source, destination]);
}
inspect(join(skill, 'extensions/map/src'), join(workspace, 'src'));
const vendor = join(workspace, 'vendor');
if (existsSync(vendor) && (!lstatSync(vendor).isDirectory() || lstatSync(vendor).isSymbolicLink())) conflicts.push(vendor);
else inspect(join(skill, 'vendor', sourcePackage), join(vendor, componentPackage));
if (conflicts.length) throw new Error(`地图启用冲突，工程未修改：\n${conflicts.join('\n')}\n请保留用户修改并手动迁移；不会强制覆盖。`);
for (const [source, destination] of pending) {
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { force: false, errorOnExist: true });
}
if (readFileSync(entry, 'utf8') !== code) writeFileSync(entry, code);
const packageText = JSON.stringify(pkg, null, 2) + '\n';
if (readFileSync(packagePath, 'utf8') !== packageText) writeFileSync(packagePath, packageText);
console.log(`MAP_ENABLED: ${workspace}\nHINT: 在该工作区运行 npm install，然后按 references/map.md 设置 scene-data.json 的 map 字段。若升级时开发服务器正在运行，停止它并用 npm run dev -- --force 重启，清除旧组件预构建缓存。`);
