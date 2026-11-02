// Maintenance fixture only. Never called by production generation or data APIs.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const target = process.argv[2];
if (!target) throw new Error('Pass the maintenance scene-data.json path');
const sourceRoot = 'D:/cyc/project/octo/gts/map/map-traffic-heatmap-v1.26.0/assets';
const sample = JSON.parse(readFileSync(`${sourceRoot}/tencent-heat2d-static-sample.json`, 'utf8'));
const sandbox = { module: { exports: {} } };
vm.runInNewContext(readFileSync(`${sourceRoot}/maplibre-strong-halo-profile.js`, 'utf8'), sandbox);
const data = JSON.parse(readFileSync(target, 'utf8'));
const [lng, lat] = data.map.origin;
const bounds = [[lng - 0.004, lat - 0.003], [lng + 0.004, lat + 0.003]];
const heat = sandbox.module.exports.transformDemoRecords(sample.records, bounds);
if (heat.length !== 499 || heat.some((row, i) => row.value !== sample.records[i].value || row.id !== sample.records[i].id)) throw new Error('Source data drift');
let seed = 7391;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const scatter = [];
const add = (x, y) => scatter.push({ id: `demo_point_${scatter.length}`, lng: lng + x, lat: lat + y, properties: { status: '固定演示点，非实测' } });
for (const [x, y, rx, ry, count] of [[-.002,.001,.0004,.0002,45],[.0015,.001,.0007,.0003,30],[.0005,-.0018,.0003,.0006,25],[.002,-.0005,.0002,.00015,20]]) {
  for (let i = 0; i < count; i++) { const r = Math.sqrt(random()), angle = random() * Math.PI * 2; add(x + Math.cos(angle) * rx * r, y + Math.sin(angle) * ry * r); }
}
for (let i = 0; i < 60; i++) add((random() - .5) * .006, (random() - .5) * .004);
for (let i = 0; i < 20; i++) add((i % 2 ? 1 : -1) * (.003 + random() * .0008), (random() - .5) * .005);
data.map.overlays = [
  { id: 'devices', kind: 'scatter', name: '演示点位（非实测）', visible: false, options: { tone: 'blue', fontSize: 12, strokeWidth: 1 }, data: scatter, card: { type: 'demo_point' } },
  { id: 'traffic', kind: 'heat', name: '演示热力（非实测）', visible: true, options: { valueRange: [0, 104], displayMode: 'transparent' }, data: heat },
];
data.meta = { ...data.meta, data_mode: 'simulated', is_measured: false, heat_demo: {
  ...sample.metadata, source_kind: 'transformed_tencent_demo', target_bounds: bounds, transform: 'uniform Mercator scale/translate once; padding 0.9',
}, scatter_demo: { data_mode: 'simulated', is_measured: false, seed: 7391, record_count: 200, distribution: '60% unequal elliptical hotspots / 30% sparse background / 10% outliers' } };
writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
console.log('Updated maintenance demo: 499 original heat records, 200 independent scatter records; heat visible, scatter hidden.');
