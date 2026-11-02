// Maintenance-only: algorithm parity and lifecycle contracts; not browser/visual evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
const root = process.argv[2] ?? 'D:/cyc/project/octo/test/3d-components';
const { MapHeatLayer, MapScatterLayer, heatFeatures, clusterScatter, resolveHeatProfile } = await import(pathToFileURL(`${root}/dist/es/map.js`));
const profile = await import(pathToFileURL(`${root}/src/map/heat-profile.js`));
const original = { module: { exports: {} } };
vm.runInNewContext(readFileSync('D:/cyc/project/octo/gts/map/map-traffic-heatmap-v1.26.0/assets/maplibre-strong-halo-profile.js', 'utf8'), original);
for (const options of [{}, { thresholds: [0.2, 0.4, 0.7, 0.9], blurMultipliers: [1, 0.8, 0.7, 0.5, 0.3] }]) {
  assert.equal(JSON.stringify(profile.buildColorExpression(options)), JSON.stringify(original.module.exports.buildColorExpression(options)));
}
const expression = profile.buildColorExpression();
assert.equal((expression.length - 3) / 2, 26);
const base = { id: 'test', valueRange: [0, 100] };
const transparent = profile.buildColorExpression(resolveHeatProfile(base));
assert.equal(transparent[3], 0); assert.equal(transparent[4], 'rgba(141,210,91,0)');
const stops = []; for (let i = 3; i < transparent.length; i += 2) stops.push(transparent[i]);
assert.ok(stops.every((stop, i) => !i || stop > stops[i - 1]));
assert.deepEqual(profile.buildColorExpression(resolveHeatProfile({ ...base, displayMode: 'reference' })), expression);
assert.deepEqual(profile.buildColorExpression(resolveHeatProfile({ ...base, blankThreshold: 0 })), expression);
assert.throws(() => resolveHeatProfile({ ...base, displayMode: 'transparent', blankThreshold: 0 }), /Transparent/);
assert.throws(() => resolveHeatProfile({ ...base, displayMode: 'transparent', blankThreshold: 0.00005 }), /Transparent/);
assert.throws(() => resolveHeatProfile({ ...base, displayMode: 'transparent', blankThreshold: NaN }), /Invalid/);
assert.equal(profile.influenceRadiusCssPx(1, { surfaceCssWidth: 642, surfaceCssHeight: 698 }), 70.8);
assert.equal(profile.surfaceAreaScale({ surfaceCssWidth: 1284, surfaceCssHeight: 1396 }), 2);
const rows = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, lng: 114.0601 + i * 0.0000001, lat: 22.5401 }));
const markers = clusterScatter(rows, 12);
assert.equal(markers.length, 1); assert.equal(markers[0].ids.length, 12);
assert.deepEqual(clusterScatter(rows, 12.9, { theme: 'dark' }), markers);
assert.deepEqual(clusterScatter([...rows].reverse(), 12)[0].ids, markers[0].ids);
assert.equal(clusterScatter(rows, 17).length, rows.length);
// Two dense groups straddle an old grid boundary: no split/duplicate membership.
const boundary = Array.from({ length: 18 }, (_, i) => ({ id: `b${i}`, lng: i < 9 ? 27.9 : 28.1, lat: 0 }));
const flat = p => ({ x: p.lng, y: p.lat });
assert.equal(clusterScatter(boundary, 12, {}, flat).length, 1);
// Centers apart in world space overlap after pitch compression. Count stays exact.
const tilted = Array.from({ length: 18 }, (_, i) => ({ id: `t${i}`, lng: 0, lat: i < 9 ? 0 : 40 }));
assert.equal(clusterScatter(tilted, 12, {}, flat).length, 2);
const merged = clusterScatter(tilted, 12, {}, p => ({ x: p.lng, y: p.lat * .5 }));
assert.equal(merged.length, 1); assert.equal(merged[0].ids.length, 18); assert.equal(new Set(merged[0].ids).size, 18);
assert.equal(merged[0].lat, 20);
// Pin footprints (including tail) overlap even if clustering distance is small.
assert.equal(clusterScatter(tilted, 12, { clusterDistance: 4, clusterPinWidth: 40 }, flat).length, 1);
assert.deepEqual(clusterScatter([], 12), []);
assert.throws(() => clusterScatter([...rows, rows[0]], 12), /Invalid scatter/);
assert.throws(() => clusterScatter(rows, 12, { clusterPinWidth: 0 }), /Invalid scatter/);
assert.throws(() => heatFeatures([], [0, 0]), /valueRange/);
assert.deepEqual(heatFeatures([], [0, 100]).features, []);
const features = heatFeatures([{ id: 'a', lng: 114, lat: 22, value: 50 }], [0, 100]);
assert.equal(features.features[0].properties.traffic, 0.5);

class FakeMap {
  sources = new Map(); layers = new Map([['road', { id: 'road', type: 'line' }], ['boundary', { id: 'boundary', type: 'line' }], ['label', { id: 'label', type: 'symbol' }]]);
  events = new Map(); repaints = 0;
  getSource(id) { return this.sources.get(id); }
  getLayer(id) { return this.layers.get(id); }
  getStyle() { return { layers: [...this.layers.values()] }; }
  getContainer() { return { getBoundingClientRect: () => ({ width: 642, height: 698 }) }; }
  addSource(id, options) { this.sources.set(id, { data: options.data, setData(data) { this.data = data; } }); }
  addLayer(layer, before) { this.before = before; this.layers.set(layer.id, layer); }
  setPaintProperty(id, key, value) { this.layers.get(id).paint[key] = value; }
  setLayoutProperty(id, key, value) { this.layers.get(id)[key] = value; }
  setLayerZoomRange() {}
  triggerRepaint() { this.repaints++; }
  removeLayer(id) { this.layers.delete(id); }
  removeSource(id) { this.sources.delete(id); }
  on(event, callback) { const group = this.events.get(event) ?? new Set(); group.add(callback); this.events.set(event, group); }
  off(event, callback) { this.events.get(event)?.delete(callback); }
  emit(event) { for (const callback of this.events.get(event) ?? []) callback(); }
}
const map = new FakeMap();
const heat = new MapHeatLayer(map, { id: 'traffic', valueRange: [0, 100] });
assert.equal(map.before, 'boundary');
assert.equal(map.getLayer('traffic').visibility, 'none');
heat.setData([{ id: 'a', lng: 114, lat: 22, value: 50 }]);
assert.equal(map.getLayer('traffic').visibility, 'visible');
assert.equal(map.getSource('traffic:source').data.features[0].properties.traffic, 0.5);
heat.setOptions({ visible: false }); assert.equal(map.getLayer('traffic').visibility, 'none');
map.layers.delete('traffic'); map.sources.clear(); map.emit('style.load');
assert.equal(map.getLayer('traffic').visibility, 'none');
assert.equal(map.getSource('traffic:source').data.features[0].properties.traffic, 0.5);
heat.setData([]); heat.setOptions({ visible: true }); assert.equal(map.getLayer('traffic').visibility, 'none');
assert.throws(() => new MapHeatLayer(map, { id: 'traffic', valueRange: [0, 100] }), /already used/);
heat.dispose(); heat.dispose();
assert.equal(map.layers.size, 3); assert.equal(map.sources.size, 0);
assert.equal([...map.events.values()].reduce((n, set) => n + set.size, 0), 0);
assert.throws(() => heat.setData([]), /disposed/);
assert.ok(map.repaints > 0);
const drawings = [], canvases = new Set();
const context = { setTransform: (...args) => drawings.push(['transform', ...args]), clearRect() {}, save() {}, restore() {}, translate() {},
  scale: (...args) => drawings.push(['scale', ...args]), fill() {}, stroke() {}, beginPath() {}, arc: (...args) => drawings.push(['arc', ...args]),
  fillText: (...args) => drawings.push(['text', ...args]) };
globalThis.Path2D = class { constructor(path) { assert.ok(path.startsWith('M12 0')); } };
globalThis.getComputedStyle = () => ({ fontFamily: 'sans-serif' });
globalThis.document = { createElement: () => {
  const canvas = { style: {}, setAttribute() {}, width: 0, height: 0, getContext: () => context, remove: () => canvases.delete(canvas) };
  return canvas;
} };
let zoom = 12, dpr = 1;
map.getZoom = () => zoom; map.getPixelRatio = () => dpr;
map.getCanvas = () => ({ getBoundingClientRect: () => ({ width: 642, height: 698 }) });
map.getCanvasContainer = () => ({ appendChild: canvas => canvases.add(canvas) });
map.project = () => ({ x: 100, y: 100 });
let selected;
const scatter = new MapScatterLayer(map, { onSelect: marker => { selected = marker; } }, rows);
for (const ratio of [0.75, 1, 2]) {
  dpr = ratio; drawings.length = 0; map.emit('render');
  assert.deepEqual(drawings[0], ['transform', ratio, 0, 0, ratio, 0, 0]);
  assert.ok(drawings.some(row => row[0] === 'scale' && row[1] === 1 && row[2] === 1));
  assert.equal([...canvases][0].width, Math.round(642 * ratio));
}
for (const callback of map.events.get('click')) callback({ point: { x: 100, y: 100 } });
assert.equal(selected.ids.length, 12);
scatter.setOptions({ theme: 'dark' }); map.emit('render'); assert.equal(context.fillStyle, '#ffffff');
zoom = 17; map.emit('moveend'); drawings.length = 0; map.emit('render');
assert.equal(drawings.filter(row => row[0] === 'arc').length, 12);
assert.ok(drawings.filter(row => row[0] === 'arc').every(row => row[3] === 3.4));
scatter.setData([]); drawings.length = 0; map.emit('render'); assert.equal(drawings.length, 1);
scatter.dispose(); scatter.dispose(); assert.equal(canvases.size, 0);
assert.equal([...map.events.values()].reduce((n, set) => n + set.size, 0), 0);
console.log('PASS: exact heat profile, fixed scale, stable scatter, CSS sizing/DPR, empty/update/visibility/style reload/disposal (mock host).');
