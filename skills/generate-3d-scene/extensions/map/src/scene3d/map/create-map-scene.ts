import maplibregl from 'maplibre-gl';
import { MapRuntime, MapPresentation, validateLayerMapping, type MapLayerRule } from '@a3d/a3d-components/map';
export { localToMercator } from '@a3d/a3d-components/map';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { createScene, type SceneHandle, type SceneOptions } from '../scene-core/createScene';
import type { SceneData } from '../scene-core/types';
import type { Component } from 'vue';
import { MapOverlays, type MapOverlayConfig } from './map-overlays';

export interface MapConfig {
  layerMapping?: MapLayerRule[];
  overlays?: MapOverlayConfig[];
  styleUrl: string;
  origin: [number, number];
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  theme?: 'light' | 'dark';
  view?: '2d' | '3d';
  surfaces?: Record<string, { color?: string; visible?: boolean; locked?: boolean }>;
}

export function validateMapConfig(value: unknown): asserts value is MapConfig {
  const config = value as MapConfig;
  validateLayerMapping(config?.layerMapping);
  if (!config || typeof config.styleUrl !== 'string' || !config.styleUrl.trim()
      || !Array.isArray(config.origin) || config.origin.length !== 2
      || !config.origin.every(Number.isFinite) || Math.abs(config.origin[0]) > 180 || Math.abs(config.origin[1]) > 85)
    throw new Error('地图需设置 styleUrl 和有效经纬度 origin（纬度范围 -85～85）');
  if (config.center !== undefined && (!Array.isArray(config.center) || config.center.length !== 2 || !config.center.every(Number.isFinite) || Math.abs(config.center[0]) > 180 || Math.abs(config.center[1]) > 85)) throw new Error('地图 center 经纬度无效');
  if (config.theme !== undefined && !['light', 'dark'].includes(config.theme)) throw new Error('地图 theme 需为 light 或 dark');
  if (config.surfaces !== undefined) {
    if (!config.surfaces || typeof config.surfaces !== 'object' || Array.isArray(config.surfaces)) throw new Error('地图外观配置无效');
    for (const [id, patch] of Object.entries(config.surfaces)) {
      if (!/^(building|road|water|ground|greenery)(:(volume|area|edge|shadow|base))?$/.test(id) || !patch || typeof patch !== 'object'
        || (patch.color !== undefined && !/^#[0-9a-f]{6}$/i.test(patch.color))
        || (patch.locked !== undefined && typeof patch.locked !== 'boolean')
        || (patch.visible !== undefined && typeof patch.visible !== 'boolean')) throw new Error('地图颜色或显示配置无效');
    }
  }
  if (config.view !== undefined && !['2d', '3d'].includes(config.view)) throw new Error('地图 view 需为 2d 或 3d');
  if (config.zoom !== undefined && (config.zoom < 0 || config.zoom > 22)) throw new Error('地图 zoom 范围为 0～22');
  if (config.pitch !== undefined && (config.pitch < 0 || config.pitch > 80)) throw new Error('地图 pitch 范围为 0～80');
  for (const key of ['zoom', 'pitch', 'bearing'] as const)
    if (config[key] !== undefined && !Number.isFinite(config[key])) throw new Error(`地图 ${key} 必须为有限数值`);
}

function presentationOverrides(surfaces: MapConfig['surfaces']) {
  return Object.fromEntries(Object.entries(surfaces ?? {}).map(([id, value]) => [id, {
    ...(value.color !== undefined ? { color: value.color } : {}),
    ...(value.visible !== undefined ? { visible: value.visible } : {}),
  }]));
}

export async function createMapScene(host: HTMLElement, data: SceneData, cards: Record<string, Component>, options: SceneOptions): Promise<SceneHandle> {
  validateMapConfig(data.map);
  const config = structuredClone(data.map);
  let handle: SceneHandle | undefined;
  const runtime = await MapRuntime.create({ host, style: config.styleUrl, origin: config.origin,
    center: config.center, zoom: config.zoom,
    pitch: config.view === '2d' ? 0 : config.pitch ?? 45, bearing: config.bearing,
    pixelRatio: data.renderer.pixelRatio ?? 1, antialias: data.renderer.antialias ?? false,
    getMaxFps: () => handle?.internals.rendererEngine.getConfig().maxFps ?? data.renderer.maxFps ?? 60,
  });
  const { map, container, basis } = runtime;
  let experience: MapPresentation | undefined;
  let disposed = false;
  let overlays: MapOverlays | undefined;

  const release = () => {
    if (disposed) return;
    disposed = true;
    try { overlays?.dispose(); } finally { try { experience?.dispose(); } finally { runtime.dispose(); } }
  };
  try {
    experience = new MapPresentation(map, { theme: config.theme, view: config.view, pitch: config.pitch, layerMapping: config.layerMapping, overrides: presentationOverrides(config.surfaces) });
    const sceneData = structuredClone(data);
    // Log depth cannot share MapLibre's standard depth buffer.
    sceneData.renderer.logarithmicDepthBuffer = false;
    sceneData.camera.type = 'PerspectiveCamera';
    handle = await createScene(map.getCanvas(), sceneData, cards, { ...options, externalView: {
      context: runtime.context as WebGL2RenderingContext, resize: runtime.resize, requestFrame: runtime.requestFrame,
    } });
    runtime.setFrameTarget({ camera: handle.internals.camera as THREE.PerspectiveCamera, draw: () => {
      handle!.internals.scene.background = null;
      handle!.internals.scene.fog = null;
      handle!.internals.renderLoop.drawExternal();
    } });
    handle.viewMode = 'map';
    overlays = new MapOverlays(map, config.theme ?? 'light', cards, options.cardContext);
    overlays.replace(config.overlays ?? []);
    const originalSerialize = handle.serialize.bind(handle);
    handle.serialize = () => ({ ...originalSerialize(), camera: structuredClone(data.camera), map: {
      ...config, overlays: overlays!.snapshot(), center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: experience!.getState().view === '2d' ? experience!.getState().pitch : map.getPitch(), bearing: map.getBearing(),
      theme: experience!.getState().theme, view: experience!.getState().view,
    } });
    const originalUpdate = handle.update.bind(handle);
    handle.update = fragment => {
      const next = fragment.map as MapConfig | undefined;
      if (next) {
        validateMapConfig(next);
        if (next.styleUrl !== config.styleUrl || JSON.stringify(next.origin) !== JSON.stringify(config.origin))
          throw new Error('更换地图服务或坐标原点需要重新创建场景');
        if (JSON.stringify(next.layerMapping) !== JSON.stringify(config.layerMapping)) throw new Error('更换地图图层映射需要重新创建场景');
        overlays!.replace(next.overlays ?? []);
        overlays!.setTheme(next.theme ?? 'light');
        experience!.applyState({ theme: next.theme ?? 'light', view: next.view ?? '3d', pitch: next.pitch ?? 45, overrides: presentationOverrides(next.surfaces) });
        map.jumpTo({ center: next.center ?? config.origin, zoom: next.zoom ?? 16, pitch: next.view === '2d' ? 0 : next.pitch ?? 45, bearing: next.bearing ?? 0 });
      }
      const { camera: _camera, controls: _controls, map: _map, ...rest } = fragment;
      if (rest.renderer?.logarithmicDepthBuffer) throw new Error('地图共用标准深度缓冲，不支持对数深度');
      const result = originalUpdate(rest);

      return result;
    };
    // TransformControls' drag lock must lock map navigation, not a disconnected OrbitControls.
    const controls = handle.internals.controlsEngine.controls;
    let enabled = true;
    Object.defineProperty(controls, 'enabled', { configurable: true, get: () => enabled, set: (value: boolean) => {
      enabled = value;
      for (const control of [map.dragPan, map.dragRotate, map.touchZoomRotate, map.scrollZoom, map.keyboard]) {
        if (value) control.enable(); else control.disable();
      }
    } });
    handle.frameObject = id => {
      const object = handle!.internals.sceneEngine.getObject(id);
      if (!object) return;
      const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).applyMatrix4(basis);
      map.easeTo({ center: new maplibregl.MercatorCoordinate(point.x, point.y, point.z).toLngLat() });
    };
    const names: Record<string, string> = { building: '建筑', road: '道路', water: '水面', ground: '地面', greenery: '绿地' };
    let surfaceOverrides = structuredClone(config.surfaces ?? {});
    const entries = () => experience!.listSurfaces().map(item => ({ ...item, name: (item.parentId ? (item.id.endsWith(':shadow') ? '投影' : names[item.parentId]) : names[item.id]) ?? item.id, locked: surfaceOverrides[item.parentId ?? item.id]?.locked === true || surfaceOverrides[item.id]?.locked === true }));
    const serializeMap = handle.serialize.bind(handle);
    handle.serialize = () => {
      const value = serializeMap();
      (value.map as MapConfig).surfaces = structuredClone(surfaceOverrides);
      return value;
    };
    const updateMap = handle.update.bind(handle);
    handle.update = fragment => {
      if (fragment.map) {
        validateMapConfig(fragment.map);
        const next = fragment.map as MapConfig;
        if (next.styleUrl !== config.styleUrl || JSON.stringify(next.origin) !== JSON.stringify(config.origin)) throw new Error('更换地图服务或坐标原点需要重新创建场景');
      }
      const result = updateMap(fragment);
      if (fragment.map) surfaceOverrides = structuredClone((fragment.map as MapConfig).surfaces ?? {});
      return result;
    };
    handle.surfaces = {
      list: () => [...entries(), ...overlays!.entries()],
      update: (id, patch) => {
        if (id.startsWith('overlay_')) { overlays!.update(id, patch); return; }
        if (!entries().some(item => item.id === id)) throw new Error('未知地图内容');
        const selected = entries().find(item => item.id === id)!;
        if (selected.locked && (patch.color !== undefined || patch.visible !== undefined)) throw new Error('对象已锁定，请先解锁');
        const next = handle!.serialize().map as MapConfig;
        next.surfaces = { ...next.surfaces, [id]: { ...next.surfaces?.[id], ...patch } };
        // Parent edits apply to the whole category, including legacy child overrides.
        if (!id.includes(':')) {
          for (const [key, value] of Object.entries(next.surfaces)) {
            if (!key.startsWith(`${id}:`)) continue;
            if (patch.color !== undefined) delete value.color;
            if (patch.visible !== undefined && !key.endsWith(':shadow')) delete value.visible;
          }
        }
        validateMapConfig(next);
        // Color drags update only paint/visibility, never camera or the full theme.
        surfaceOverrides = structuredClone(next.surfaces ?? {});
        experience!.updateSurface(id, Object.fromEntries(Object.entries(patch).filter(([key, value]) => key !== 'locked' && value !== undefined)));
        map.triggerRepaint();
      },
    };

    const resourceError = document.createElement('div');
    resourceError.setAttribute('role', 'status');
    resourceError.style.cssText = 'position:absolute;bottom:32px;left:12px;max-width:360px;padding:10px;background:#fff7ed;color:#9a3412;font:13px sans-serif;display:none;';
    container.appendChild(resourceError);
    map.on('error', () => { resourceError.textContent = '部分地图资源加载失败，请检查地图服务、字体和图标地址。已加载模型仍可编辑。'; resourceError.style.display = 'block'; });
    // Dispose Three first, then its host GL context.
    const disposeScene = handle.dispose.bind(handle);
    handle.dispose = () => { if (!disposed) { runtime.setFrameTarget(); try { disposeScene(); } finally { release(); } } };
    map.triggerRepaint();
    return handle;
  } catch (error) { handle?.dispose(); release(); throw error; }
}
