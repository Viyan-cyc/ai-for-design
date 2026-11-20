import {attemptComponent} from '@a3d/a3d-components/utils';
import maplibregl from 'maplibre-gl';
import { attachSurfaceParticleScan, normalizeSurfaceParticleScanOptions, type SurfaceParticleScanOptions, type SurfaceData } from '@a3d/a3d-components/map';
export { localToMercator } from '@a3d/a3d-components/map';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { createScene, type SceneHandle, type SceneOptions } from '../scene/createScene';
import type { SceneData } from '../scene/types';
import type { Component } from 'vue';
import {normalizeMapExperienceParameters,mapExperienceThemes,validateMapExperienceOutside} from '@a3d/a3d-components/map';
import {ExperienceHost,type ExperienceConfig} from './experience-host';
import {MapComponents,validateComponents,type ComponentConfig} from './map-components';

export interface MapConfig extends ComponentConfig {
  runtime?: 'experience';
  experience?: ExperienceConfig;
  surfaceScan?: SurfaceParticleScanOptions;
  styleUrl: string;
  origin: [number, number];
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  theme?: 'light' | 'dark';
  view?: '2d' | '3d';
}

export function validateMapConfig(value: unknown, optionalComponents = true): asserts value is MapConfig {
  const config = value as MapConfig;
  const keys=new Set(['runtime','experience','surfaceScan','styleUrl','origin','center','zoom','pitch','bearing','theme','view','heat','geographicScatter','logicalScatter']);
  if(config && Object.keys(config).some(key=>!keys.has(key)))throw Error('未知地图配置字段');
  if (optionalComponents && config?.surfaceScan !== undefined) normalizeSurfaceParticleScanOptions(config.surfaceScan);
  if (!config || typeof config.styleUrl !== 'string' || !config.styleUrl.trim()
      || !Array.isArray(config.origin) || config.origin.length !== 2
      || !config.origin.every(Number.isFinite) || Math.abs(config.origin[0]) > 180 || Math.abs(config.origin[1]) > 85)
    throw new Error('地图需设置 styleUrl 和有效经纬度 origin（纬度范围 -85～85）');
  if (config.center !== undefined && (!Array.isArray(config.center) || config.center.length !== 2 || !config.center.every(Number.isFinite) || Math.abs(config.center[0]) > 180 || Math.abs(config.center[1]) > 85)) throw new Error('地图 center 经纬度无效');
  if (config.theme !== undefined && !['light', 'dark'].includes(config.theme)) throw new Error('地图 theme 需为 light 或 dark');
  if (config.view !== undefined && !['2d', '3d'].includes(config.view)) throw new Error('地图 view 需为 2d 或 3d');
  if (config.zoom !== undefined && (config.zoom < 0 || config.zoom > 22)) throw new Error('地图 zoom 范围为 0～22');
  if (config.pitch !== undefined && (config.pitch < 0 || config.pitch > 80)) throw new Error('地图 pitch 范围为 0～80');
  for (const key of ['zoom', 'pitch', 'bearing'] as const)
    if (config[key] !== undefined && !Number.isFinite(config[key])) throw new Error(`地图 ${key} 必须为有限数值`);
  if(config.runtime!==undefined&&config.runtime!=='experience')throw Error('未知地图runtime');
  {
    if(config.experience!==undefined&&(!config.experience||typeof config.experience!=='object'||Array.isArray(config.experience)))throw Error('experience参数无效');
    normalizeMapExperienceParameters(config.experience?.parameters??{},mapExperienceThemes[config.theme??'light']);
    if(config.experience?.outside)validateMapExperienceOutside(config.experience.outside);
    if((config.zoom??16)<2.2||(config.zoom??16)>20||(config.pitch??45)<15||(config.pitch??45)>75||Math.abs(config.bearing??0)>360)throw Error('experience视角范围：zoom2.2–20、目标pitch15–75、bearing±360');
  }
  if(optionalComponents)validateComponents(config);
}

export async function createMapScene(host: HTMLElement, data: SceneData, cards: Record<string, Component>, options: SceneOptions): Promise<SceneHandle> {
  validateMapConfig(data.map, false);
  const config = structuredClone(data.map);
  let handle: SceneHandle | undefined;
  const mapHost = document.createElement('div');
  mapHost.style.cssText = 'position:absolute;inset:0;visibility:hidden';
  const loading = document.createElement('div');
  loading.setAttribute('role', 'status');
  loading.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;background:#eff2f6;color:#475569';
  loading.textContent = '正在准备地图…';
  host.append(mapHost, loading);
  let cancelReveal = () => {};
  let runtime: ExperienceHost;
  try { runtime = await ExperienceHost.create(mapHost,{...config,getMaxFps:()=>handle?.internals.rendererEngine.getConfig().maxFps??data.renderer.maxFps??60});
  } catch (error) { mapHost.remove(); loading.remove(); throw error; }
  const { map, container, basis } = runtime;
  const experience = runtime;
  let disposed = false;
  let scan: ReturnType<typeof attachSurfaceParticleScan> | undefined;
  let scanConfig = structuredClone(config.surfaceScan);
  let components:MapComponents|undefined;
  const componentErrors=new Map<string,string>();
  const componentStatus=document.createElement('p');
  componentStatus.setAttribute('role','alert');componentStatus.hidden=true;
  componentStatus.style.cssText='position:absolute;left:12px;top:12px;z-index:10;max-width:440px;padding:8px;background:#fff4df;color:#714700;white-space:pre-wrap';
  container.append(componentStatus);
  const reportComponent=(name:string,error:unknown)=>{
    componentErrors.set(name,error instanceof Error?error.message:String(error));
    componentStatus.textContent=Array.from(componentErrors,([key,message])=>`${key} 未加载：${message}`).join('\n');
    componentStatus.hidden=false;console.error(`[${name}]`,error);
  };
  let experienceConfig=structuredClone(config.experience);
  const createScan=(value:SurfaceParticleScanOptions)=>{
    const scene=handle!.internals.scene, loop=handle!.internals.renderLoop;
    return attachSurfaceParticleScan({map,scene,origin:config.origin,
      invalidate:loop.invalidate,onFrame:(callback,demand)=>loop.onFrame(callback,demand),
      acceptsLayer:id=>['sh-rounded-buildings-3d','sh-rounded-buildings-3d-next','sh-rounded-buildings-3d-retained','sh-rounded-buildings-3d-next-retained','sh-buildings-3d','sh-halic-ordinary-buildings-3d'].includes(id),
      completeLayer:id=>id==='sh-rounded-buildings-3d'||id==='sh-rounded-buildings-3d-next',
      buildingHeight:f=>Number(f.properties?.render_height??f.properties?.height??6)*runtime.experience.getBuildingState().heightScale,
      growth:()=>runtime.experience.getBuildingState().growth,meshGrowth:()=>1,
      visible:()=>runtime.experience.getBuildingState().visible,
      getMeshes:()=>{
        scene.updateMatrixWorld(true);
        const meshes:SurfaceData['meshes']=[],seen=new Set<THREE.Object3D>();
        for(const id of handle!.internals.sceneEngine.getAllIds())handle!.internals.sceneEngine.getObject(id)?.traverse(object=>{
          if(seen.has(object))return;seen.add(object);
          if(object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry){
            let parent:THREE.Object3D|null=object;while(parent){if(!parent.visible)return;parent=parent.parent;}
            meshes.push({geometry:object.geometry,matrix:object.matrixWorld.clone()});
          }
        });return meshes;
      },
      onStatus:status=>{if(status.startsWith('采样失败'))reportComponent('surfaceScan',status);}
    },value);
  };

  const release = () => {
    if (disposed) return;
    disposed = true;
    cancelReveal(); loading.remove(); componentStatus.remove(); mapHost.remove();
    scan?.dispose();components?.dispose();
    runtime.dispose();
  };
  try {
    const sceneData = structuredClone(data);
    // Log depth cannot share MapLibre's standard depth buffer.
    sceneData.renderer.logarithmicDepthBuffer = false;
    sceneData.camera.type = 'PerspectiveCamera';
    handle = await createScene(map.getCanvas(), sceneData, cards, { ...options, externalView: {
      context: runtime.context as WebGL2RenderingContext, resize: runtime.resize, requestFrame: runtime.requestFrame,
    } });
    components=new MapComponents(map,container,config,reportComponent);
    if(runtime instanceof ExperienceHost)runtime.experience.setOutside(config.experience?.outside??null);
    runtime.setFrameTarget({ camera: handle.internals.camera as THREE.PerspectiveCamera, draw: () => {
      handle!.internals.scene.background = null;
      handle!.internals.scene.fog = null;
      // Only scene-owned business nodes, not editor gizmos/helpers, are tint targets.
      const roots=handle!.internals.sceneEngine.getAllIds().map(id=>handle!.internals.sceneEngine.getObject(id)).filter((o):o is THREE.Object3D=>!!o);
      const owned=new Set(roots);
      const targets={traverse(callback:(o:THREE.Object3D)=>void){for(const root of roots){let p=root.parent;let nested=false;while(p){if(owned.has(p)){nested=true;break;}p=p.parent;}if(!nested)root.traverse(callback);}}};
      if(!componentErrors.has('buildingTint.render')){
        const tintFrame=attemptComponent('buildingTint.render',()=>{
          components?.setLighting(runtime instanceof ExperienceHost?runtime.experience.getParameters():{});
          map.fire('heatmodelrender',{scene:targets,sceneToMercator:basis,renderer:handle!.internals.rendererEngine.renderer});
        },reportComponent);
        if(!tintFrame.ok)attemptComponent('buildingTint.cleanup',()=>components?.disableTint(),reportComponent);
      }
      handle!.internals.renderLoop.drawExternal();
    } });
    handle.viewMode = 'map';
    if(runtime instanceof ExperienceHost){const current=runtime;handle.mapParameters=()=>({...current.experience.getParameters()});}
    handle.validateUpdate=fragment=>{
      if(fragment.renderer?.logarithmicDepthBuffer)throw Error('地图不支持对数深度');
      if(fragment.map!==undefined){validateMapConfig(fragment.map);const next=fragment.map;
        if(JSON.stringify(next.experience?.assets)!==JSON.stringify(config.experience?.assets))throw Error('更换地图地标资产需要重新创建');
        if(next.styleUrl!==config.styleUrl||JSON.stringify(next.origin)!==JSON.stringify(config.origin))throw Error('地图服务、原点、宿主或图层映射改变需要重新创建');
      }
    };
    if(scanConfig){const result=attemptComponent('surfaceScan',()=>createScan(scanConfig!),reportComponent);if(result.ok)scan=result.value;}
    const originalSerialize = handle.serialize.bind(handle);
    handle.serialize = () => ({ ...originalSerialize(), camera: structuredClone(data.camera), map: {
      ...config, heat:components?.serialize().heat,geographicScatter:components?.serialize().geographicScatter,logicalScatter:components?.serialize().logicalScatter,experience:structuredClone(experienceConfig), surfaceScan: structuredClone(scanConfig), center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: experience!.getState().view === '2d' ? experience!.getState().pitch : map.getPitch(), bearing: map.getBearing(),
      theme: experience!.getState().theme, view: experience!.getState().view,
    } });
    const originalUpdate = handle.update.bind(handle);
    handle.update = fragment => {
      handle!.validateUpdate!(fragment);
      if(fragment.renderer?.logarithmicDepthBuffer)throw Error('地图共用标准深度缓冲，不支持对数深度');
      const next = fragment.map as MapConfig | undefined;
      if (next) {
        const previous=handle!.serialize().map as MapConfig;
        validateMapConfig(next);
        if (next.styleUrl !== config.styleUrl || JSON.stringify(next.origin) !== JSON.stringify(config.origin))
          throw new Error('更换地图服务或坐标原点需要重新创建场景');
        components!.update(next);
        const nextScan = next.surfaceScan;
        if(!nextScan){scan?.dispose();scan=undefined;}
        else if(!scan)scan=createScan(nextScan);
        else scan.component.setOptions(normalizeSurfaceParticleScanOptions(nextScan));
        scanConfig = structuredClone(nextScan);
        const appearanceChanged=['theme','view','pitch'].some(key=>JSON.stringify(next[key as keyof MapConfig])!==JSON.stringify(previous[key as keyof MapConfig]));
        if(appearanceChanged)experience!.applyState({ theme: next.theme ?? 'light', view: next.view ?? '3d', pitch: next.pitch ?? 45, overrides: {} });
        if(runtime instanceof ExperienceHost&&(next.theme!==previous.theme||JSON.stringify(next.experience?.parameters)!==JSON.stringify(experienceConfig?.parameters)))runtime.experience.setParameters(normalizeMapExperienceParameters(next.experience?.parameters??{},mapExperienceThemes[next.theme??'light']));
        if(runtime instanceof ExperienceHost&&JSON.stringify(next.experience?.outside)!==JSON.stringify(experienceConfig?.outside))runtime.experience.setOutside(next.experience?.outside??null);
        experienceConfig=structuredClone(next.experience);
        if(['center','zoom','pitch','bearing','view'].some(key=>JSON.stringify(next[key as keyof MapConfig])!==JSON.stringify(previous[key as keyof MapConfig])))map.jumpTo({ center: next.center ?? config.origin, zoom: next.zoom ?? 16, pitch: next.view === '2d' ? 0 : next.pitch ?? 45, bearing: next.bearing ?? 0 });
      }
      const { camera: _camera, controls: _controls, map: _map, ...rest } = fragment;
      if (rest.renderer?.logarithmicDepthBuffer) throw new Error('地图共用标准深度缓冲，不支持对数深度');
      const result = originalUpdate(rest);
      scan?.refresh();
      if(next){components!.clearRejected();componentErrors.clear();componentStatus.hidden=true;componentStatus.textContent='';}

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
    const resourceError = document.createElement('div');
    resourceError.setAttribute('role', 'status');
    resourceError.style.cssText = 'position:absolute;bottom:32px;left:12px;max-width:360px;padding:10px;background:#fff7ed;color:#9a3412;font:13px sans-serif;display:none;';
    container.appendChild(resourceError);
    map.on('error', () => { resourceError.textContent = '部分地图资源加载失败，请检查地图服务、字体和图标地址。已加载模型仍可编辑。'; resourceError.style.display = 'block'; });
    // Dispose Three first, then its host GL context.
    const disposeScene = handle.dispose.bind(handle);
    handle.dispose = () => { if (!disposed) { runtime.setFrameTarget();components?.dispose();map.fire('heatmodelremove');try { disposeScene(); } finally { release(); } } };
    let frames = 0;
    const reveal = () => { mapHost.style.visibility = 'visible'; loading.remove(); cancelReveal(); };
    const onPreparedFrame = () => {
      frames++;
      if (frames >= 2 && map.isStyleLoaded() && map.areTilesLoaded()) reveal();
      else if (frames < 2) runtime.requestFrame();
    };
    const revealTimeout = setTimeout(() => {
      if (disposed) return;
      resourceError.textContent = '部分地图资源尚未就绪，已显示当前地图。请检查地图服务或稍后重新打开。';
      resourceError.style.display = 'block';
      reveal();
    }, 30000);
    cancelReveal = () => { clearTimeout(revealTimeout); map.off('render', onPreparedFrame); };
    map.on('render', onPreparedFrame);
    runtime.requestFrame();
    return handle;
  } catch (error) { handle?.dispose(); release(); throw error; }
}
