import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { checkProject } from './build.mjs';
import { checkAssembly } from './lib/assembly-check.mjs';
import { inputDigest } from './lib/build-guard.mjs';
import { generateProjectHeat } from './lib/heat-simulation.mjs';
import { prepareProjectEnvironment } from './lib/project-environment.mjs';
import { resolveWorkspace } from './lib/workspace.mjs';

const [target, ...args] = process.argv.slice(2);
let env;
try {
  if (!target || args.length % 2 !== 0) throw Error('用法：check-data.mjs <工程目录> [经度 纬度 ...]');
  const points = [];
  for (let i = 0; i < args.length; i += 2) {
    const lng = Number(args[i]), lat = Number(args[i + 1]);
    if (!args[i].trim() || !args[i + 1].trim() || !Number.isFinite(lng) || !Number.isFinite(lat)
        || Math.abs(lng) > 180 || Math.abs(lat) > 85) throw Error('经度范围为 ±180，纬度范围为 ±85');
    points.push([lng, lat]);
  }
  const root = resolveWorkspace(target);
  env = prepareProjectEnvironment(root);
  const digest = inputDigest(root);
  const result = checkProject(root, { modules: env.modules });
  result.warnings.forEach(warning => console.warn(warning));
  if (!result.ok) throw Error(result.errors.join('\n'));
  const scene = JSON.parse(readFileSync(join(root, 'public/data/scene.json'), 'utf8'));
  const locations = [];
  if (points.length) {
    if (!scene.map?.origin) throw Error('坐标转换需要 map.origin');
    const require = createRequire(join(env.modules, '../package.json'));
    const { localToMercator } = require('@a3d/a3d-components/map');
    const { MercatorCoordinate } = require('maplibre-gl');
    const { Vector3 } = require('three');
    const inverse = localToMercator(scene.map.origin).invert();
    for (const lngLat of points) {
      const { x, y, z } = MercatorCoordinate.fromLngLat(lngLat, 0);
      const local = new Vector3(x, y, z).applyMatrix4(inverse);
      locations.push({ lngLat, position: local.toArray() });
    }
  }
  const simulation = await generateProjectHeat(root, env.modules, digest, { preview: true });
  if (scene.map) {
    const assembly = await checkAssembly(root, { modules: env.modules, scene: simulation?.scene ?? scene, mapOnly: true });
    if (!assembly.ok) throw Error(assembly.errors.join('\n'));
  }
  if (inputDigest(root) !== digest) throw Error('检查期间场景输入变化，请重试');
  const heat = simulation && { records: simulation.records, bins: simulation.bins,
    alertCandidates: simulation.alertCandidates, alerts: simulation.alerts };
  console.log(JSON.stringify({ locations, heat }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  env?.dispose?.();
}
