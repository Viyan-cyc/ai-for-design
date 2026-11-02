import { createScene3D } from './src/scene3d/create-scene';
import { Bridge } from './src/edit/Bridge';
import { MapRuntime, MapHeatLayer, clusterScatter } from '@a3d/a3d-components/map';
import { MapOverlays } from './src/scene3d/map/map-overlays';
import { defineComponent, h } from 'vue';
const host = document.querySelector('#host') as HTMLElement;
const result = document.querySelector('#result')!;
const lines: string[] = [];
const check = (value: unknown, name: string) => { if (!value) throw new Error(name); lines.push('PASS ' + name); result.textContent = lines.join('\n'); };
const frame = (handle: any) => new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('frame timeout')), 10000);
  const off = handle.internals.renderLoop.onAfterFrame(() => { clearTimeout(timeout); off(); resolve(); });
  handle.internals.renderLoop.invalidate();
});
let handle: any;
let runtime: MapRuntime | undefined;
let overlays: MapOverlays | undefined;
let heat: MapHeatLayer | undefined;
const styleUrl = URL.createObjectURL(new Blob([JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eeeeee' } }] })], { type: 'application/json' }));
try {
  const data = await (await fetch('/scene3d/scene-data.json')).json();
  const [lng, lat] = data.map.origin;
  data.map.styleUrl = styleUrl;
  data.map.overlays = [
    { id: 'devices', kind: 'scatter', data: [{ id: 'device_1', lng, lat }], options: { tone: 'blue' } },
    { id: 'traffic', kind: 'heat', options: { valueRange: [0, 100] }, data: [{ id: 'h1', lng, lat, value: 50 }] },
  ];
  handle = await createScene3D(host, { data });
  await handle.whenReady({ timeoutMs: 20000 }); await frame(handle);
  check(handle.getDiagnostics().firstFrame, '混合场景真实 WebGL 首帧');
  check(handle.getDiagnostics().failedAssets.length === 0, '已有 GLB 加载');
  check(handle.internals.rendererEngine.renderer.getContext().getError() === 0, '热力、散点、模型共享场景无 GL 错误');
  check(handle.surfaces.list().filter((item: any) => item.id.startsWith('overlay_')).length === 2, '两类叠加层进入模型列表');
  check(handle.serialize().map.overlays[1].options.displayMode === 'transparent', '缺省热力模式迁移并保存为透明');
  check(host.querySelectorAll('canvas').length === 2, '地图画布加单张散点画布');
  const bridge = new Bridge(handle);
  bridge.selectSurface('overlay_devices');
  bridge.commit('隐藏散点', () => handle.surfaces.update('overlay_devices', { visible: false }));
  check(handle.serialize().map.overlays[0].visible === false, '显隐序列化');
  bridge.undo(); check(handle.serialize().map.overlays[0].visible !== false, '撤销显隐');
  bridge.redo(); check(handle.serialize().map.overlays[0].visible === false, '重做显隐');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('overlay redraw timeout')), 5000);
    const off = handle.internals.renderLoop.onAfterFrame(() => { clearTimeout(timer); off(); resolve(); });
    handle.surfaces.update('overlay_devices', { visible: true, color: '#09aa71' });
  });
  check(true, '叠加层修改主动重绘，无额外点击或 invalidate');
  handle.surfaces.update('overlay_devices', { locked: true });
  let blocked = false; try { handle.surfaces.update('overlay_devices', { visible: false }); } catch { blocked = true; }
  check(blocked, '锁定阻止编辑');
  const state = handle.serialize().map;
  state.theme = 'dark'; handle.update({ map: state }); await frame(handle);
  check(handle.serialize().map.overlays[0].options.color === '#09aa71', '主题切换保留自定义散点颜色');
  const changed = handle.serialize().map;
  changed.overlays[1].options.thresholds = [0.2, 0.4, 0.7, 0.9];
  changed.overlays[1].data[0].value = 90;
  handle.update({ map: changed }); await frame(handle);
  check(handle.serialize().map.overlays[1].data[0].value === 90 && handle.internals.rendererEngine.renderer.getContext().getError() === 0, '热力参数与数据更新');
  for (const ratio of [0.75, 1.25, 2]) {
    handle.update({ renderer: { pixelRatio: ratio } }); await frame(handle);
    const canvas = [...host.querySelectorAll('canvas')].find(canvas => canvas !== handle.internals.canvas)!;
    check(Math.abs(canvas.width / canvas.getBoundingClientRect().width - ratio) < 0.01, '散点实际缓冲 DPR ' + ratio);
  }
  const empty = handle.serialize().map;
  empty.overlays.forEach((layer: any) => { layer.data = []; });
  handle.update({ map: empty }); await frame(handle);
  check(handle.serialize().map.overlays.every((layer: any) => layer.data.length === 0), '清空数据无模拟回填');
  const saved = handle.serialize(); bridge.dispose(); handle.dispose(); handle = null;
  check(host.querySelectorAll('canvas').length === 0, '卸载清理两个画布');
  handle = await createScene3D(host, { data: saved }); await handle.whenReady({ timeoutMs: 20000 }); await frame(handle);
  check(handle.serialize().map.overlays[0].locked === true, '重建保留叠加配置');
  check(handle.internals.rendererEngine.renderer.getContext().getError() === 0, '重建无 GL 错误');
  handle.dispose(); handle = null;
  check(host.querySelectorAll('canvas').length === 0, '再次卸载清理');
  runtime = await MapRuntime.create({ host, style: styleUrl, origin: [lng, lat], center: [lng, lat], zoom: 16 });
  const readCorner = () => new Promise<number[]>(resolve => {
    runtime!.map.once('render', () => { const gl = runtime!.context; const pixel = new Uint8Array(4); gl.readPixels(5, 5, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); resolve([...pixel]); });
    runtime!.map.triggerRepaint();
  });
  const background = await readCorner();
  heat = new MapHeatLayer(runtime.map, { id: 'pixel_heat', valueRange: [0, 100] }, [{ id: 'hotspot', lng, lat, value: 100 }]);
  const clearCorner = await readCorner();
  check(clearCorner.every((channel, i) => Math.abs(channel - background[i]!) <= 1), '真实热力零密度像素不改变底图');
  heat.setOptions({ displayMode: 'reference' });
  const referenceCorner = await readCorner();
  check(referenceCorner.some((channel, i) => Math.abs(channel - background[i]!) > 10), '原参考模式保留全域低值底色');
  heat.setOptions({ displayMode: 'transparent' });
  const restored = await readCorner();
  check(restored.every((channel, i) => Math.abs(channel - background[i]!) <= 1), '模式切换恢复透明');
  heat.dispose(); heat = undefined;
  // Actual map projections, including pitch and fractional zoom; no screenshots.
  const points = Array.from({ length: 40 }, (_, i) => ({ id: `edge_${i}`, lng: lng + (i < 20 ? 0 : .00035), lat: lat + (i % 5) * .000002 }));
  for (const pitch of [0, 45, 70]) for (const zoom of [14, 15.5, 16.8]) {
    runtime.map.jumpTo({ pitch, zoom });
    const markers = clusterScatter(points, zoom, {}, point => runtime!.map.project([point.lng, point.lat]));
    check(markers.flatMap(marker => marker.ids).length === 40 && new Set(markers.flatMap(marker => marker.ids)).size === 40, `实际投影计数守恒 pitch=${pitch} zoom=${zoom}`);
    const clusters = markers.filter(marker => marker.ids.length > 1).map(marker => runtime!.map.project([marker.lng, marker.lat]));
    check(clusters.every((p, i) => clusters.slice(i + 1).every(q => Math.abs(p.x - q.x) >= 24 || Math.abs(p.y - q.y) >= 29)), `实际投影聚合图钉不重叠 pitch=${pitch} zoom=${zoom}`);
  }
  runtime.map.jumpTo({ pitch: 45, zoom: 16 });
  const card = defineComponent({ props: ['id'], setup: props => () => h('div', { 'data-business-card': '' }, String(props.id)) });
  overlays = new MapOverlays(runtime.map, 'light', { device: card });
  overlays.replace([{ id: 'devices', kind: 'scatter', data: [{ id: 'device_1', lng, lat }], card: { type: 'device' } }]);
  await new Promise<void>(resolve => { runtime!.map.once('render', () => resolve()); runtime!.map.triggerRepaint(); });
  runtime.map.fire('click', { point: runtime.map.project([lng, lat]) });
  check(host.querySelector('[data-business-card]')?.textContent === 'device_1', '单点选择挂载外部 Vue 卡片');
  overlays.setTheme('dark');
  check(host.querySelectorAll('[data-business-card]').length === 1, '主题切换保留单一选中卡片');
  overlays.update('overlay_devices', { visible: false });
  check(!host.querySelector('[data-business-card]'), '隐藏散点卸载卡片');
  overlays.dispose(); overlays = undefined; runtime.dispose(); runtime = undefined;
  check(host.querySelectorAll('canvas').length === 0, '卡片与散点独立销毁清理');
  result.textContent = lines.join('\n') + '\nALL PASS';
} catch (error) { result.textContent = lines.join('\n') + '\nFAIL ' + (error as Error).stack; }
finally { heat?.dispose(); overlays?.dispose(); runtime?.dispose(); handle?.dispose(); URL.revokeObjectURL(styleUrl); }
