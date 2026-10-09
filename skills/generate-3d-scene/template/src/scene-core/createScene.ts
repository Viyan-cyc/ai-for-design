/**
 * createScene — scene-core 唯一对外入口（v3）
 *
 * 业务方（main.ts / edit/Bridge.ts）只需：
 *   import { createScene } from '@/scene-core'
 *   const handle = await createScene(canvas, sceneData)
 *   handle.update({ cars: [...], remove: ['car_03'] })  // 同格式片段增量更新
 *   handle.dispose()                                     // 卸载
 *
 * 装配序：renderer → scene → camera → lights → controls → environment → factories
 *   → cards → 建树 → loop。
 * 本文件绝不 import edit/ 下任何内容（build 铁律 1）。
 */
import * as THREE from 'three';
import type {
  CardState, PickResult, SceneData, SceneNode, TreeSceneFragment, UpdateStats,
} from './types';
import { RESERVED_KEYS } from './types';
import {
  SceneEngine, CameraEngine, LightEngine, ControlsEngine,
  RendererEngine, RaycastEngine, AssetEngine, RenderLoop, EnvironmentEngine,
} from './engine';

/** 对外 Handle API（edit 外壳只允许经此触达 core——build 铁律 2） */
export interface SceneHandle {

  /**
   * 增量更新（v3 统一语义）：喂整份 = 建场景；喂片段 = 增量。
   * remove 先行 → 每节点存在即 update / 不存在即 create → params 整块替换 → 不 diff。
   * 生产数据（MQTT/WebSocket/轮询）推同格式片段直接喂这里。
   */
  update(frag: TreeSceneFragment): UpdateStats;

  /**
   * 当前场景序列化（= scene-data.json v3 完整形态）。
   * 编辑器保存数据源；含 __visuals（编辑器私有视觉层，交付时剥离转录）。
   */
  serialize(): SceneData;

  /** 射线拾取（屏幕坐标 → 命中物体） */
  pick(clientX: number, clientY: number): PickResult | null;

  /** Debug HUD 开关（fps/calls/triangles） */
  setDebug(enabled: boolean): void;

  /** 卡片状态订阅（卡片系统 → UI 层渲染） */
  onCardState(cb: (states: CardState[]) => void): () => void;

  /** 手动触发卡片同步与状态刷新 */
  refreshCards(): void;

  /** F 聚焦：相机看向指定物体 */
  frameObject(id: string): void;

  /** 相机实例被替换（透视/正交切换）时回调：TransformControls/OrbitControls 重挂用 */
  onCameraSwap(cb: (camera: THREE.Camera) => void): () => void;

  /** 内部引擎访问（edit 高级用途：Gizmo 需要相机/画布/控制器） */
  internals: {
    scene: THREE.Scene;
    camera: THREE.Camera;
    canvas: HTMLCanvasElement;
    renderLoop: RenderLoop;
    sceneEngine: SceneEngine;
    assetEngine: AssetEngine;
    lightEngine: LightEngine;
    cameraEngine: CameraEngine;
    controlsEngine: ControlsEngine;
    rendererEngine: RendererEngine;
  };
  dispose(): void;
}

/** Debug HUD DOM（轻量实现，复用渲染循环统计） */
const createDebugHud = (canvas: HTMLCanvasElement): HTMLElement => {
  const hud = document.createElement('div');
  hud.style.cssText = [
    'position:absolute', 'top:8px', 'left:8px', 'z-index:10',
    'font:12px/1.6 monospace', 'color:#0f0', 'background:rgba(0,0,0,.55)',
    'padding:4px 8px', 'border-radius:4px', 'pointer-events:none', 'white-space:pre',
  ].join(';');
  (canvas.parentElement ?? canvas).appendChild(hud);
  return hud;
};

/** 提取片段中的 type 分组（跳过保留 key 与非数组值） */
const extractGroups = (frag: TreeSceneFragment): Array<[string, SceneNode[]]> => {
  const groups: Array<[string, SceneNode[]]> = [];
  for (const [key, val] of Object.entries(frag)) {
    if (!RESERVED_KEYS.has(key) && Array.isArray(val)) {
      groups.push([key, val as SceneNode[]]);
    }
  }
  return groups;
};

/** 把 SceneData/片段的对象形态规整为分组数组（建树用） */
const toGroups = (source: SceneData | TreeSceneFragment): Array<[string, SceneNode[]]> =>
  extractGroups(source as TreeSceneFragment);

export const createScene = async (
  canvas: HTMLCanvasElement,
  data: SceneData,

  /** 卡片组件注册表（节点 card.type 在此查表挂载） */
  cardComponents: Record<string, import('vue').Component> = {},
): Promise<SceneHandle> => {
  // 装配（依赖序）。工厂注册先于建树：自定义 type 才能在 buildTree 时被分发。
  const rendererEngine = new RendererEngine(canvas, data.renderer);
  const sceneEngine = new SceneEngine();
  const cameraEngine = new CameraEngine(data.camera, canvas.clientWidth / Math.max(canvas.clientHeight, 1));
  const lightEngine = new LightEngine(sceneEngine.scene, data.lights);
  const controlsEngine = new ControlsEngine(cameraEngine.camera, canvas, data.controls);
  const environmentEngine = new EnvironmentEngine();
  const assetEngine = new AssetEngine();
  const raycastEngine = new RaycastEngine();

  void environmentEngine.apply(
    rendererEngine.renderer, sceneEngine.scene,
    data.scene.environment ? { intensity: data.scene.environment.intensity } : null,
  );

  // 物体工厂注册（内建），先于建树
  const { registerBuiltinFactories } = await import('./handlers/registry');
  registerBuiltinFactories(sceneEngine, assetEngine);

  // 卡片系统（依赖注入节点视图与相机；Vue 组件表由业务方传入）
  const { setupCards } = await import('./cards/registry');
  const cardSystem = setupCards({
    scene: sceneEngine.scene,
    get camera() {
      return cameraEngine.camera;
    },
    resolveNode: (id) => sceneEngine.getNode(id),
    resolveObject: (id) => sceneEngine.getObject(id),
    enumerateNodes: () => [...sceneEngine.getAllIds()]
      .map((id) => [id, sceneEngine.getNode(id)] as [string, SceneNode])
      .filter((pair): pair is [string, SceneNode] => pair[1] !== null),
    container: canvas.parentElement ?? document.body,
    components: cardComponents,
  });

  // 全量建树 + 卡片同步
  sceneEngine.buildTree(toGroups(data));
  cardSystem.refresh();

  // 渲染循环（卡片投影回调在 start 前注册）
  const renderLoop = new RenderLoop(
    rendererEngine,
    controlsEngine,
    () => sceneEngine.scene,
    () => cameraEngine.camera,
  );
  renderLoop.onFrame(() => cardSystem.updateProjection());
  // resize：相机 aspect 与 CSS2D 投影层同步（编辑态 canvas 被移入中栏后尺寸必变）
  renderLoop.onResize((w, h) => {
    cameraEngine.setAspect(w / Math.max(h, 1));
    cardSystem.resize(w, h);
  });

  // 相机投影切换后 TransformControls/OrbitControls 持有旧相机引用，经回调重挂
  const cameraSwapCbs: Array<(camera: THREE.Camera) => void> = [];
  cameraEngine.onCameraSwap = (camera) => {
    controlsEngine.controls.object = camera;
    controlsEngine.controls.update();
    cameraSwapCbs.forEach((cb) => cb(camera));
  };

  // click → 卡片触发（编辑态的选中逻辑由 edit/SelectionService 另行监听）
  canvas.addEventListener('click', (ev: MouseEvent) => {
    const hit = raycastEngine.pick(
      ev.clientX, ev.clientY, canvas, cameraEngine.camera,
      sceneEngine.scene.children, (id) => sceneEngine.isPickable(id),
      (obj) => sceneEngine.resolveId(obj),
    );
    if (hit) {
      cardSystem.handleClick(hit.id);
    }
  });

  // Debug HUD 状态
  let hud: HTMLElement | null = null;
  let hudUnsub: (() => void) | null = null;

  // 序列化（v3）：保留区运行态回写 + 分组字典聚合 + __visuals 编辑器视觉层。
  // lookAt 一致性（评审 R2-7）：serialize 时回写 camera.lookAt = controls.target，
  // 消除"相机看向 lookAt、控制器绕 target 转"的初始跳变。
  const serialize = (): SceneData => {
    const groups: SceneData = {
      ...data,
      scene: { ...data.scene },
      camera: {
        ...data.camera,
        type: cameraEngine.type,
        position: cameraEngine.camera.position.toArray(),
        fov: cameraEngine.camera instanceof THREE.PerspectiveCamera ? cameraEngine.camera.fov : data.camera.fov,
        lookAt: controlsEngine.controls.target.toArray(),
      },
      lights: lightEngine.getConfigs(),
      controls: controlsEngine.getConfig(),
      renderer: rendererEngine.getConfig(),
    };
    // 分组字典聚合（保留 key 之外的现有分组按引擎实态重建）
    for (const key of Object.keys(data)) {
      if (!RESERVED_KEYS.has(key)) {
        delete groups[key];
      }
    }
    for (const type of sceneEngine.getGroupNames()) {
      groups[type] = sceneEngine.getNodesWithType(type).map((n) => ({ ...n }));
    }
    const visuals = sceneEngine.getAllVisuals();
    if (Object.keys(visuals).length > 0) {
      groups.__visuals = visuals;
    } else {
      delete groups.__visuals;
    }
    return groups;
  };

  const handle: SceneHandle = {
    update(frag: TreeSceneFragment): UpdateStats {
      // 保留区
      if (frag.scene) {
        data.scene = { ...data.scene, ...frag.scene };
        sceneEngine.applyEnvironment(data.scene);
        if (frag.scene.environment !== undefined) {
          void environmentEngine.apply(
            rendererEngine.renderer, sceneEngine.scene,
            data.scene.environment ? { intensity: data.scene.environment.intensity } : null,
          );
        }
      }
      if (frag.lights) {
        data.lights = frag.lights;
        lightEngine.replaceAll(frag.lights);
      }
      if (frag.camera) {
        Object.assign(data.camera, frag.camera);
        if (frag.camera.position) {
          cameraEngine.camera.position.set(...frag.camera.position);
        }
        if (frag.camera.lookAt) {
          cameraEngine.setLookAt(frag.camera.lookAt);
        }
        if (frag.camera.type !== undefined) {
          cameraEngine.setProjectionType(
            frag.camera.type,
            canvas.clientWidth / Math.max(canvas.clientHeight, 1),
          );
          data.camera.type = cameraEngine.type;
        }
        if (frag.camera.fov !== undefined) {
          cameraEngine.setFov(frag.camera.fov);
        }
        if (frag.camera.near !== undefined || frag.camera.far !== undefined) {
          cameraEngine.setClipping(frag.camera.near, frag.camera.far);
        }
      }
      if (frag.controls) {
        Object.assign(data.controls, frag.controls);
        controlsEngine.applyConfig(frag.controls);
      }
      if (frag.renderer) {
        Object.assign(data.renderer, frag.renderer);
        if (frag.renderer.toneMapping) {
          rendererEngine.setToneMapping(frag.renderer.toneMapping);
        }
        if (frag.renderer.exposure !== undefined) {
          rendererEngine.setExposure(frag.renderer.exposure);
        }
        if (frag.renderer.shadowMapEnabled !== undefined) {
          rendererEngine.renderer.shadowMap.enabled = frag.renderer.shadowMapEnabled;
        }
        if (frag.renderer.shadowMap) {
          rendererEngine.setShadowMapType(frag.renderer.shadowMap);
        }
      }
      // 业务区（分组 upsert + remove 先行在 SceneEngine 内）
      const stats = sceneEngine.applyFragment(frag);
      if (extractGroups(frag).length > 0 || frag.remove?.length) {
        cardSystem.refresh();
      }
      return stats;
    },

    serialize,

    pick(clientX: number, clientY: number): PickResult | null {
      return raycastEngine.pick(
        clientX, clientY, canvas, cameraEngine.camera,
        sceneEngine.scene.children, (id) => sceneEngine.isPickable(id),
        (obj) => sceneEngine.resolveId(obj),
      );
    },

    setDebug(enabled: boolean): void {
      if (enabled && !hud) {
        hud = createDebugHud(canvas);
        hudUnsub = renderLoop.onFrame(() => {
          if (hud) {
            const s = renderLoop.getStats();
            hud.textContent = `fps: ${s.fps}\ncalls: ${s.calls}\ntris: ${s.triangles}`;
          }
        });
      } else if (!enabled && hud) {
        hudUnsub?.();
        hud.remove();
        hud = null;
        hudUnsub = null;
      }
    },

    onCardState(cb) {
      return cardSystem.onState(cb);
    },

    refreshCards() {
      cardSystem.refresh();
    },

    frameObject(id: string): void {
      const obj = sceneEngine.getObject(id);
      if (obj) {
        const box = new THREE.Box3().setFromObject(obj);
        controlsEngine.frameBox(box, cameraEngine.camera);
      }
    },

    onCameraSwap(cb: (camera: THREE.Camera) => void): () => void {
      cameraSwapCbs.push(cb);
      return () => {
        const i = cameraSwapCbs.indexOf(cb);
        if (i >= 0) {
          cameraSwapCbs.splice(i, 1);
        }
      };
    },

    internals: {
      scene: sceneEngine.scene,

      /** 活引用（getter）：透视/正交切换会替换相机实例，静态捕获会陈旧 */
      get camera() {
        return cameraEngine.camera;
      },
      canvas,
      renderLoop,
      sceneEngine,
      assetEngine,
      lightEngine,
      cameraEngine,
      controlsEngine,
      rendererEngine,
    },

    dispose(): void {
      renderLoop.dispose();
      cardSystem.dispose();
      sceneEngine.dispose();
      lightEngine.dispose();
      controlsEngine.dispose();
      environmentEngine.dispose();
      assetEngine.dispose();
      raycastEngine.dispose();
      rendererEngine.dispose();
    },
  };

  renderLoop.start();
  return handle;
};
