import { LogicalScatter, type ScatterPoint, type ScatterPatch } from '../../src/map';
import { controls, defaults } from '../../src/map/restored-map-suite/logical-scatter/parameters';
import { panel, stageFor } from './restored-controls';
const states = new WeakMap<HTMLElement, { scatter: LogicalScatter; disposed: boolean }>();
export const getScatterDemoState = (host: HTMLElement) => states.get(host);
function sample(): ScatterPoint[] {
  let seed = 43; const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: 600 }, (_, i) => ({ id: 'demo-' + i, x: .15 + random() * .7, y: .15 + random() * .7, label: '模拟点 ' + (i + 1) }));
}
export function scatterDemo(canvas: HTMLCanvasElement, ctrl: HTMLElement) {
  const host = stageFor(canvas), scatter = new LogicalScatter(host, {}, sample()), state = { scatter, disposed: false }; states.set(host, state);
  const ui = panel(ctrl);
  ui.select('colorMode', '主题', { system: '跟随系统', light: '浅色', dark: '深色' }, () => scatter.getOptions().colorMode, v => scatter.setOptions({ colorMode: v as 'system' | 'light' | 'dark' }));
  ui.select('markerTone', '标记颜色', { red: '红色', green: '绿色', blue: '蓝色', gray: '灰色' }, () => scatter.getOptions().markerTone, v => scatter.setOptions({ markerTone: v as 'red' | 'green' | 'blue' | 'gray' }));
  ui.range('zoom', '逻辑缩放', 0, 1, .01, () => scatter.getState().zoomTarget, v => scatter.setZoom(v));
  for (const [key, c] of Object.entries(controls)) ui.range(key, c[0], c[1], c[2], c[3], () => scatter.getOptions()[key as keyof typeof controls], v => scatter.setOptions({ [key]: v } as ScatterPatch), c[4]);
  ui.button('empty', '清空业务数据', () => scatter.setData([]));
  ui.button('sample', '加载演示数据', () => scatter.setData(sample()));
  ui.button('reset', '恢复默认参数', () => { scatter.setOptions(structuredClone(defaults)); scatter.setZoom(.12); });
  ui.info('600个模拟点；0–1逻辑坐标，不是经纬度。滚轮或键盘可以缩放。');
  const sync = () => ui.sync(); host.addEventListener('wheel', sync); host.addEventListener('keyup', sync); host.addEventListener('pointerup', sync); ui.sync();
  return () => { if (state.disposed) return; state.disposed = true; host.removeEventListener('wheel', sync); host.removeEventListener('keyup', sync); host.removeEventListener('pointerup', sync); scatter.dispose(); host.remove(); ctrl.replaceChildren(); };
}
