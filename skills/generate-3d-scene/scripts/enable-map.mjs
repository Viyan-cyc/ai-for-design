import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspace } from './lib/workspace.mjs';

// Optional feature installation, never run for an ordinary local 3D scene.
const target = process.argv[2];
if (!target) throw new Error('用法: node scripts/enable-map.mjs <交付目录或工作区>');
const workspace = resolveWorkspace(target);
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
mkdirSync(join(workspace, 'vendor'), { recursive: true });
cpSync(join(skill, 'vendor', sourcePackage), join(workspace, 'vendor', componentPackage));
const entry = join(workspace, 'src/scene3d/create-scene.ts');
let code = readFileSync(entry, 'utf8').replace("  if (data.map) throw new Error('地图能力未启用，请先运行 enable-map.mjs');\n", '');
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
cpSync(join(skill, 'extensions/map/src'), join(workspace, 'src'), { recursive: true });
writeFileSync(entry, code);
const packagePath = join(workspace, 'package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.dependencies = { ...pkg.dependencies, '@a3d/a3d-components': `file:./vendor/${componentPackage}`, three: '0.185.1', 'maplibre-gl': '5.24.0', '@turf/turf': '7.2.0' };
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`MAP_ENABLED: ${workspace}\nHINT: 在该工作区运行 npm install，然后按 references/map.md 设置 scene-data.json 的 map 字段。若升级时开发服务器正在运行，停止它并用 npm run dev -- --force 重启，清除旧组件预构建缓存。`);
