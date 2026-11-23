/** Explicit simulation only; use the project's component implementation and defaults. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { inputDigest } from './build-guard.mjs';

export async function generateProjectHeat(root, modules, expectedDigest = inputDigest(root), { preview = false } = {}) {
  const script = join(root, 'scripts/heat-simulation.mjs');
  if (!existsSync(script)) return null; // Real business data, including missing cells, is untouched.
  const file = join(root, 'public/data/scene.json');
  const original = readFileSync(file, 'utf8'), scene = JSON.parse(original);
  const assertInputs = () => {
    if (inputDigest(root) !== expectedDigest) throw Error('BUILD_INPUT_CHANGED: simulation inputs changed');
  };
  assertInputs();
  const { default: simulation } = await import(pathToFileURL(script).href);
  if (simulation?.kind !== 'simulated' || typeof simulation.valueAt !== 'function'
      || Object.keys(simulation).some(k => !['kind','bounds','valueAt','alertCount'].includes(k)))
    throw Error('heat-simulation须声明kind: simulated、bounds及valueAt；不在此定义样式或格距');
  const count = simulation.alertCount;
  if (count !== undefined && (!Number.isInteger(count) || count < 0 || count > 1000)) throw Error('模拟告警数量须为0–1000整数');
  assertInputs();
  if (!scene.map?.heat) throw Error('模拟热力需要先配置map.heat');
  const api = createRequire(join(modules, '../package.json'))('@a3d/a3d-components/map');
  const options = scene.map.heat.options ?? {};
  const data = api.generateHeatRecords(simulation.bounds, simulation.valueAt, options);
  const field = new api.HeatField(options);
  try {
    field.setData(data);
    const snapshot = preview || count !== undefined ? field.getSnapshot() : null;
    const resolved = field.getOptions();
    // Records and cells have the same traversal order; never reconstruct coordinates.
    const candidates = snapshot ? snapshot.cells.flatMap((c, i) => c.style.index === resolved.bins - 1
      && snapshot.pixels[(c.y * snapshot.width + c.x) * 4 + 3] ? [data[i]] : []) : [];
    if (count !== undefined) {
      const n = Math.min(count, candidates.length);
      const alerts = Array.from({length:n}, (_,i) => {
        const r = candidates[Math.floor((i + .5) * candidates.length / n)];
        return {id:`sim-alert-${i+1}`,lng:r.lng,lat:r.lat,label:'模拟告警'};
      });
      scene.map.geographicScatter = {...scene.map.geographicScatter, data:alerts, heatLinked:true};
    }
    scene.map.heat.data = data;
    scene.meta = {...scene.meta, description: `${scene.meta?.description ?? ''}`.replace(/\s*\[热力及关联告警为模拟数据\]$/, '') + ' [热力及关联告警为模拟数据]'};
    const alerts = count === undefined ? 'unchanged' : scene.map.geographicScatter.data.length;
    if (preview) {
      const bins = Array(resolved.bins).fill(0);
      for (const cell of snapshot.cells) bins[cell.style.index]++;
      assertInputs();
      return { scene, records: data.length, bins, alertCandidates: candidates.length, alerts };
    }
    const output = JSON.stringify(scene, null, 2) + '\n';
    // Permit only the generated JSON change; never rebase other inputs.
    const digest = inputDigest(root, {replacements: new Map([['public/data/scene.json', output]])});
    assertInputs();
    writeFileSync(file, output);
    return {digest, records:data.length, alerts};
  } finally { field.dispose(); }
}
