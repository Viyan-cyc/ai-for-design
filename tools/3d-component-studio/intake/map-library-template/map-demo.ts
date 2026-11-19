import 'maplibre-gl/dist/maplibre-gl.css';
import { MapExperience, GridHeat, BuildingTint, HeatField } from '../../src/map';
import { controls as mapControls, type MapParameters } from '../../src/map/restored-map-suite/map-experience/parameters';
import { defaults, mercator, lngLat, type HeatRecord } from '../../src/map/restored-map-suite/heat-field/field';
import { panel, stageFor } from './restored-controls';
import { modelDemo } from './restored-tint-model';

type Kind = 'MapExperience' | 'GridHeat' | 'BuildingTint';
export interface DemoState { kind: Kind; disposed: boolean; ready: boolean; map?: MapExperience; field?: HeatField; grid?: GridHeat; tint?: BuildingTint }
const states = new WeakMap<HTMLElement, DemoState>();
/** Read-only demo inspection; not part of the runtime component API. */
export const getDemoState = (stage: HTMLElement) => states.get(stage);
function sampleData(): HeatRecord[] {
  const [ox, oy] = mercator(...defaults.origin), step = defaults.cellSizeMeters / (40075016.68557849 * Math.cos(defaults.origin[1] * Math.PI / 180)), data: HeatRecord[] = [];
  for (let y = -15; y <= 15; y++) for (let x = -15; x <= 15; x++) { const [lng, lat] = lngLat(ox + (x + .5) * step, oy + (y + .5) * step); data.push({ lng, lat, value: Math.round(255 * Math.max(0, 1 - Math.hypot(x - 2, y - 1) / 20)) }); }
  return data;
}

export function restoredMapDemo(canvas: HTMLCanvasElement, ctrl: HTMLElement, kind: Kind) {
  const stage = stageFor(canvas), state: DemoState = { kind, disposed: false, ready: false }; states.set(stage, state);
  let releaseModel: (() => void) | undefined, timer: ReturnType<typeof setTimeout> | undefined, generation = 0;
  const observer = new ResizeObserver(() => state.map?.resize()); observer.observe(stage);
  const release = () => { clearTimeout(timer); state.tint?.dispose(); state.grid?.dispose(); releaseModel?.(); releaseModel = undefined; state.field?.dispose(); state.map?.dispose(); state.tint = undefined; state.grid = undefined; state.field = undefined; state.map = undefined; state.ready = false; };
  const start = () => {
    if (state.disposed) return; ++generation; const ticket = generation; release(); ctrl.replaceChildren();
    const ui = panel(ctrl); ui.status.textContent = '正在加载在线地图…';
    ui.button('retry', '重新加载地图', start);
    const active = () => !state.disposed && ticket === generation;
    try {
      const host = new MapExperience({ container: stage, style: 'https://tiles.openfreemap.org/styles/liberty', center: [...defaults.origin], zoom: 16.2, pitch: 48, mode: '3d' }); state.map = host;
      host.map.on('load', () => { if (active()) { state.ready = true; clearTimeout(timer); ui.status.textContent = '地图已就绪'; } });
      host.map.on('error', () => { if (active()) ui.status.textContent = '部分地图资源加载失败，请检查网络后重新加载。'; });
      timer = setTimeout(() => { if (active() && !state.ready) ui.status.textContent = '地图加载超时，请检查网络后重新加载。'; }, 30000);
      let theme = 'light';
      ui.select('theme', '地图主题', { light: '浅色', dark: '深色' }, () => theme, v => { host.setTheme(v as 'light' | 'dark'); theme = v; });
      ui.select('mode', '地图视角', { '2d': '2D', '3d': '3D' }, () => host.getView().mode, v => host.setMode(v as '2d' | '3d'));
      ui.range('pitch', '俯仰', 15, 75, 1, () => host.getView().targetPitch, v => host.setPitch(v), '°');
      if (kind === 'MapExperience') {
        for (const c of mapControls) {
          if (c.type === 'color') ui.color(c.key, c.label, () => host.getParameters()[c.key] as string, v => host.setParameters({ [c.key]: v }));
          else if (c.type === 'checkbox') ui.check(c.key, c.label, () => host.getParameters()[c.key] as boolean, v => host.setParameters({ [c.key]: v }));
          else ui.range(c.key, c.label, c.min!, c.max!, c.step!, () => host.getParameters()[c.key] as number, v => host.setParameters({ [c.key]: v } as Partial<MapParameters>), c.unit);
        }
        ui.button('reset', '恢复默认外观与演示视角', () => { host.setTheme('light'); theme = 'light'; host.restoreView({ center: [...defaults.origin], zoom: 16.2, bearing: 0, pitch: 48, targetPitch: 48, mode: '3d' }); });
        ui.info('在线底图；地标模型需由应用显式提供，本页不预置地标资产。');
      } else {
        const field = new HeatField(), grid = new GridHeat(host.map, field); state.field = field; state.grid = grid;
        if (kind === 'BuildingTint') { state.tint = new BuildingTint(host.map, field); releaseModel = modelDemo(host.map); }
        field.setData(sampleData());
        ui.check('grid-visible', '显示地面栅格', () => grid.getVisible(), v => grid.setVisible(v));
        if (state.tint) {
          const tint = state.tint;
          ui.check('tint-enabled', '建筑染色', () => tint.getOptions().enabled, enabled => tint.setOptions({ enabled }));
          ui.range('strength', '染色强度', 0, 1, .01, () => tint.getOptions().strength, strength => tint.setOptions({ strength }));
          ui.range('brightness', '建筑明度', 0, 2, .01, () => tint.getOptions().brightness, brightness => tint.setOptions({ brightness }));
        }
        ui.range('edge', '格子边长', .1, defaults.cellSizeMeters, .1, () => field.getOptions().sizeStart * field.getOptions().cellSizeMeters, v => field.setOptions({ sizeStart: v / field.getOptions().cellSizeMeters, sizeEnd: v / field.getOptions().cellSizeMeters }), '米');
        ui.range('opacity', '栅格不透明度', 0, 1, .01, () => field.getOptions().alphaStart, v => field.setOptions({ alphaStart: v, alphaEnd: v }));
        ui.range('threshold', '最低显示值', 0, 100, .1, () => field.getOptions().threshold * 100, v => field.setOptions({ threshold: v / 100 }), '%');
        ui.range('blur', '颜色平滑', 0, 8, .01, () => field.getOptions().colorBlur, colorBlur => field.setOptions({ colorBlur }));
        const colors = document.createElement('div'); colors.style.cssText = 'display:flex;gap:4px;'; ctrl.append(colors);
        for (let i = 0; i < 5; i++) { ui.color('color-' + i, String(i + 1), () => field.getOptions().colors[i], v => { const values = [...field.getOptions().colors]; values[i] = v; field.setOptions({ colors: values }); }, colors); }
        const bounds: HTMLInputElement[] = [];
        for (let i = 0; i < 4; i++) bounds.push(ui.range('break-' + i, `第${i + 1}/${i + 2}级分界`, 0, 100, .1, () => field.getOptions().breaks[i] * 100, v => { const values = [...field.getOptions().breaks]; values[i] = v / 100; field.setOptions({ breaks: values }); }, '%'));
        const syncBounds = () => { const b = field.getOptions().breaks; bounds.forEach((input, i) => { input.min = String(i ? b[i - 1] * 100 + .1 : .1); input.max = String(i < 3 ? b[i + 1] * 100 - .1 : 99.9); }); };
        const updateBounds = field.subscribe(syncBounds); syncBounds();
        const priorRelease = releaseModel; releaseModel = () => { updateBounds(); priorRelease?.(); };
        ui.button('empty', '清空业务数据', () => field.setData([]));
        ui.button('sample', '加载演示数据', () => field.setData(sampleData()));
        ui.button('reset', '恢复默认参数', () => { field.setOptions(structuredClone(defaults)); grid.setVisible(true); state.tint?.setOptions({ enabled: true, strength: 1, brightness: 1.5 }); });
        ui.info(kind === 'BuildingTint' ? '模拟热力数据；白色塔体为程序生成的Three演示建筑，不代表真实地标。' : '经纬度模拟数据；清空后无热力，不自动补入演示数据。');
      }
      ui.sync(); host.map.on('moveend', () => { if (active()) ui.sync(); });
    } catch (e) { release(); ui.status.textContent = '启动失败：' + String(e); }
  };
  start();
  return () => { if (state.disposed) return; state.disposed = true; ++generation; observer.disconnect(); release(); stage.remove(); ctrl.replaceChildren(); };
}
