/**
 * createScene — scene-core 唯一对外入口
 *
 * 业务方（main.ts / edit/Bridge.ts）只需：
 *   import { createScene } from '@/scene-core'
 *   const handle = await createScene(canvas, sceneData)
 *   handle.update({ upsert: [...] })   // 增量更新
 *   handle.dispose()                   // 卸载
 *
 * 装配序：renderer → scene → camera → lights → controls → environment → objects → loop。
 * 本文件绝不 import edit/ 下任何内容（build 铁律 1）。
 */
import * as THREE from 'three';
import type {
  CardState, PickResult, SceneDataJSON, ScenePatch,
} from './types';
import {
  SceneEngine, CameraEngine, LightEngine, ControlsEngine,
  RendererEngine, RaycastEngine, AssetEngine, RenderLoop, EnvironmentEngine,
} from './engine';

/** 对外 Handle API（edit 外壳只允许经此触达 core——build 铁律 2） */
export interface SceneHandle {

  /** 增量更新（物体增删改 + 环境/灯光/相机/控制器/renderer 局部更新） */
  update(patch: ScenePatch): void;

  /** 当前场景序列化（编辑态保存的数据源；含运行态回写） */
  serialize(): SceneDataJSON;

  /** 射线拾取（屏幕坐标 → 命中物体） */
  pick(clientX: number, clientY: number): PickResult | null;

  /** Debug HUD 开关（fps/calls/triangles） */
  setDebug(enabled: boolean): void;

  /** 卡片状态订阅（卡片系统 → UI 层渲染） */
  onCardState(cb: (states: CardState[]) => void): () => void;

  /** 手动触发卡片状态刷新 */
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

export const createScene = async (
  canvas: HTMLCanvasElement,
  data: SceneDataJSON,

  /** 卡片组件注册表（scene-data.json 的 cards[].component 在此查表挂载） */
  cardComponents: Record<string, import('vue').Component> = {},
): Promise<SceneHandle> => {
  // 装配（依赖序）。工厂注册先于建树：自定义 type 才能在 buildTree 时被分发。
  const rendererEngine = new RendererEngine(canvas, data.renderer);
  const sceneEngine = new SceneEngine(data);
  const cameraEngine = new CameraEngine(data.camera, canvas.clientWidth / Math.max(canvas.clientHeight, 1));
  const lightEngine = new LightEngine(sceneEngine.scene, data.lights);
  const controlsEngine = new ControlsEngine(cameraEngine.camera, canvas, data.controls);
  const environmentEngine = new EnvironmentEngine();
  const assetEngine = new AssetEngine();
  const raycastEngine = new RaycastEngine();

  void environmentEngine.apply(rendererEngine.renderer, sceneEngine.scene, data.scene.environment);

  // 物体工厂注册（内建），先于 buildTree
  const { registerBuiltinFactories } = await import('./handlers/registry');
  registerBuiltinFactories(sceneEngine, assetEngine);

  // 卡片系统（依赖注入场景图与相机；Vue 组件表由业务方传入）
  const { setupCards } = await import('./cards/registry');
  const cardSystem = setupCards(data.cards, {
    scene: sceneEngine.scene,
    get camera() {
      return cameraEngine.camera;
    },
    resolveObject: (id) => sceneEngine.getObject(id),
    container: canvas.parentElement ?? document.body,
    components: cardComponents,
  });

  // 全量建树 + 卡片锚点挂载
  sceneEngine.buildTree(data.objects);
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

  // 序列化：运行态回写（相机/灯光/控制器/renderer 当前值），编辑态保存的数据源
  const serialize = (): SceneDataJSON => {
    const objects = sceneEngine.getAllIds().map((id) => sceneEngine.getDef(id)).filter((d): d is NonNullable<typeof d> => d !== null);
    return {
      ...data,
      scene: { ...data.scene },
      camera: {
        ...data.camera,
        type: cameraEngine.type,
        position: cameraEngine.camera.position.toArray(),
        fov: cameraEngine.camera instanceof THREE.PerspectiveCamera ? cameraEngine.camera.fov : data.camera.fov,
      },
      lights: lightEngine.getConfigs(),
      controls: controlsEngine.getConfig(),
      renderer: rendererEngine.getConfig(),
      objects,
      cards: data.cards,
    };
  };

  const handle: SceneHandle = {
    update(patch: ScenePatch): void {
      sceneEngine.applyPatch(patch);
      if (patch.scene) {
        data.scene = { ...data.scene, ...patch.scene };
        sceneEngine.applyEnvironment(data.scene);
        if (patch.scene.environment !== undefined) {
          void environmentEngine.apply(rendererEngine.renderer, sceneEngine.scene, data.scene.environment);
        }
      }
      if (patch.lights) {
        data.lights = patch.lights;
        lightEngine.replaceAll(patch.lights);
      }
      if (patch.camera) {
        Object.assign(data.camera, patch.camera);
        if (patch.camera.position) {
          cameraEngine.camera.position.set(...patch.camera.position);
        }
        if (patch.camera.lookAt) {
          cameraEngine.setLookAt(patch.camera.lookAt);
        }
        if (patch.camera.type !== undefined) {
          cameraEngine.setProjectionType(
            patch.camera.type,
            canvas.clientWidth / Math.max(canvas.clientHeight, 1),
          );
          data.camera.type = cameraEngine.type;
        }
        if (patch.camera.fov !== undefined) {
          cameraEngine.setFov(patch.camera.fov);
        }
        if (patch.camera.near !== undefined || patch.camera.far !== undefined) {
          cameraEngine.setClipping(patch.camera.near, patch.camera.far);
        }
      }
      if (patch.controls) {
        Object.assign(data.controls, patch.controls);
        controlsEngine.applyConfig(patch.controls);
      }
      if (patch.renderer) {
        Object.assign(data.renderer, patch.renderer);
        if (patch.renderer.toneMapping) {
          rendererEngine.setToneMapping(patch.renderer.toneMapping);
        }
        if (patch.renderer.exposure !== undefined) {
          rendererEngine.setExposure(patch.renderer.exposure);
        }
        if (patch.renderer.shadowMapEnabled !== undefined) {
          rendererEngine.renderer.shadowMap.enabled = patch.renderer.shadowMapEnabled;
        }
        if (patch.renderer.shadowMap) {
          rendererEngine.setShadowMapType(patch.renderer.shadowMap);
        }
      }
      if (patch.cards) {
        data.cards = patch.cards;
        cardSystem.replaceAll(patch.cards);
      }
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
