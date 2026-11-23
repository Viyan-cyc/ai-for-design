import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { componentArchiveEntries } from './component-archive.mjs';
import { environment, npmEntry } from './environment.mjs';
import { rejectLinkedPath } from './plain-path.mjs';

const componentName = '@a3d/a3d-components';
const scenePeers = {
  gsap: '^3.15.0',
  'three-bvh-csg': '^0.0.18',
  'three-mesh-bvh': '^0.9.10',
  'maplibre-gl': '5.24.0',
  '@turf/turf': '7.2.0',
};

function readArchiveManifest(path) {
  const entry = componentArchiveEntries(readFileSync(path)).get('package/package.json');
  if (!entry) throw new Error('组件包缺少 package.json：' + path);
  return JSON.parse(entry.toString('utf8'));
}

function existingManifest(workspace, current) {
  if (!current.startsWith('file:')) {
    const lockPath = join(workspace, 'package-lock.json');
    if (existsSync(lockPath)) {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')).packages;
      const entry = lock?.['node_modules/' + componentName];
      if (lock?.['']?.dependencies?.[componentName] === current && entry?.peerDependencies) return entry;
    }
    throw new Error('无法从工程锁文件确认现有组件包的 peerDependencies：' + current);
  }
  const path = resolve(workspace, current.slice(5));
  const local = relative(workspace, path);
  if (!local || local === '..' || local.startsWith('..' + sep) || isAbsolute(local)) {
    throw new Error('本地组件包须位于工程内：' + current);
  }
  rejectLinkedPath(path);
  if (!statSync(path).isDirectory()) return readArchiveManifest(path);
  const manifestPath = join(path, 'package.json');
  rejectLinkedPath(manifestPath);
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

export function addSceneComponentPeers(dependencies = {}, manifest) {
  const { validRange, intersects, subset } = createRequire(npmEntry(environment().node))('semver');
  const result = { ...dependencies };
  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    const preferred = scenePeers[name];
    if (!preferred && name !== 'three') continue;
    const declared = result[name];
    if (declared) {
      if (!validRange(declared) || !intersects(declared, range)) {
        throw new Error('组件依赖版本冲突：' + name + ' 已声明 ' + declared + '，组件要求 ' + range);
      }
    } else if (preferred) {
      result[name] = subset(preferred, range) ? preferred : range;
    }
  }
  return result;
}

export function enableSceneComponents(workspace, archive, pkg) {
  const current = pkg.dependencies?.[componentName];
  const manifest = current ? existingManifest(workspace, current) : readArchiveManifest(archive);
  const dependencies = addSceneComponentPeers(pkg.dependencies, manifest);
  if (!current) {
    const filename = basename(archive);
    const destination = join(workspace, 'vendor', filename);
    rejectLinkedPath(destination);
    if (existsSync(destination)) {
      if (!readFileSync(destination).equals(readFileSync(archive))) {
        throw new Error('组件包与已有文件冲突：' + destination);
      }
    } else {
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(archive, destination, constants.COPYFILE_EXCL);
    }
    dependencies[componentName] = 'file:./vendor/' + filename;
  }
  pkg.dependencies = dependencies;
}

export function mapComponentDependencies(workspace, dependencies, archive) {
  const current = dependencies?.[componentName];
  const existing = current?.startsWith('file:') ? existingManifest(workspace, current) : null;
  if (existing?.exports?.['./map']) {
    return { dependencies: addSceneComponentPeers(dependencies, existing), reuseArchive: true };
  }
  return { dependencies: addSceneComponentPeers(dependencies, readArchiveManifest(archive)), reuseArchive: false };
}
