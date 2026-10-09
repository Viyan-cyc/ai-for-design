/**
 * cards/registry — 2D 卡片系统（CSS2D 锚点跟随 + 触发方式 + Vue 组件挂载）
 *
 * 卡片 = 锚在 3D 物体上的 DOM 元素（CSS2DRenderer 投影跟随）。
 * 本文件职责：锚点挂载、显隐状态、Vue 组件挂载、每帧投影；
 * 卡片外观/内容完全由传入的 components 表决定（二开者只写自己的 .vue）。
 * 依赖注入：scene/camera/resolveObject 由 createScene 装配时传入，本文件不反向依赖引擎层。
 */
import { createApp, type Component } from 'vue';
import type * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CardConfig, CardState } from '../types';

export interface CardSystemDeps {
  scene: THREE.Scene;

  /** 相机活引用（getter：透视/正交切换会替换实例） */
  readonly camera: THREE.Camera;

  /** 物体 id → Object3D（锚点挂载目标解析） */
  resolveObject: (id: string) => THREE.Object3D | null;

  /** CSS2D 层挂载的容器（canvas 的父元素） */
  container: HTMLElement;

  /** 组件注册名 → Vue 组件（scene-data.json 的 cards[].component 在此查表） */
  components: Record<string, Component>;
}

export interface CardSystem {
  onState(cb: (states: CardState[]) => void): () => void;

  /** 增量更新/undo 重建后调用：重挂锚点 + 应用显隐 + 推状态 */
  refresh(): void;

  /** 卡片配置整组替换（编辑层删除物体时级联删卡片；undo 重建时恢复） */
  replaceAll(configs: CardConfig[]): void;

  /** click 触发：命中物体 id 时切换其卡片显隐（其余 click 卡片互斥关闭） */
  handleClick(objectId: string): void;

  /** 每帧投影（createScene 接进 RenderLoop） */
  updateProjection(): void;

  /** 视口尺寸变化（与 renderer 同步，否则卡片投影错位/锁死 0,0） */
  resize(width: number, height: number): void;
  dispose(): void;
}

export const setupCards = (configs: CardConfig[], deps: CardSystemDeps): CardSystem => {
  // camera 是 getter（投影切换会换实例），不解构以保持活性；其余为静态引用
  const {
    scene, resolveObject, container, components,
  } = deps;

  // configs 可被 replaceAll 整组替换，内部一律经 holder.configs 访问
  const holder = { configs };

  const css2dRenderer = new CSS2DRenderer();
  css2dRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
  container.appendChild(css2dRenderer.domElement);

  /** 视口尺寸（投影矩阵依赖；resize 时同步，否则投影 NaN 元素锁死在 0,0） */
  const setSize = (w: number, h: number): void => {
    css2dRenderer.setSize(w, h);
  };
  setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

  /** config.id → CSS2DObject */
  const anchors = new Map<string, CSS2DObject>();

  /** config.id → 运行态 */
  const states = new Map<string, CardState>();

  /** config.id → 已挂载的 Vue app（dispose 时卸载） */
  const apps = new Map<string, ReturnType<typeof createApp>>();

  const listeners = new Set<(states: CardState[]) => void>();

  /** 单张卡片挂载（创建锚点/DOM/Vue 实例） */
  const mountCard = (config: CardConfig): void => {
    const el = document.createElement('div');
    el.dataset.cardId = config.id;
    el.style.pointerEvents = 'auto';
    const comp = components[config.component];
    if (comp) {
      const app = createApp(comp, config.props);
      app.mount(el);
      apps.set(config.id, app);
    } else {
      console.warn(`[cards] 未注册的卡片组件: ${config.component}（card=${config.id}）`);
      el.textContent = config.id;
    }
    const anchorObj = new CSS2DObject(el);
    anchorObj.name = `card_anchor_${config.id}`;
    anchors.set(config.id, anchorObj);
    states.set(config.id, {
      id: config.id,
      component: config.component,
      props: config.props,
      visible: config.trigger === 'always',
      anchor: { x: 0, y: 0, z: 0 },
    });
  };

  /** 单张卡片卸载（移除锚点 + 卸 Vue 实例 + 清 DOM；CSS2DObject.removeFromParent 不清 element） */
  const unmountCard = (id: string): void => {
    const anchor = anchors.get(id);
    if (anchor) {
      anchor.removeFromParent();
      anchor.element.remove();
      anchors.delete(id);
    }
    const app = apps.get(id);
    if (app) {
      app.unmount();
      apps.delete(id);
    }
    states.delete(id);
  };

  holder.configs.forEach(mountCard);

  /** 显隐应用到 DOM（notify 与 refresh 统一走这里） */
  const applyVisibility = (): void => {
    for (const config of holder.configs) {
      const state = states.get(config.id);
      const anchor = anchors.get(config.id);
      if (state && anchor) {
        // 锚点物体不存在（删除物体后级联遗漏/数据孤儿）时隐藏卡片
        const orphan = !resolveObject(config.attachTo);
        anchor.element.style.display = state.visible && !orphan ? '' : 'none';
      }
    }
  };

  const notify = (): void => {
    applyVisibility();
    const list = [...states.values()];
    listeners.forEach((cb) => cb(list));
  };

  /** 把未挂载的锚点挂到目标物体（undo/redo 重建后目标可能是新实例） */
  const attachAnchors = (): void => {
    for (const config of holder.configs) {
      const anchor = anchors.get(config.id);
      if (!anchor) {
        continue;
      }
      const target = resolveObject(config.attachTo);
      if (target && anchor.parent !== target) {
        target.add(anchor);
        anchor.position.set(0, 1, 0);
      }
    }
  };

  return {
    onState(cb) {
      listeners.add(cb);
      notify();
      return () => {
        listeners.delete(cb);
      };
    },

    refresh() {
      attachAnchors();
      notify();
    },

    replaceAll(nextConfigs: CardConfig[]) {
      [...anchors.keys()].forEach(unmountCard);
      holder.configs = nextConfigs;
      holder.configs.forEach(mountCard);
      attachAnchors();
      notify();
    },

    handleClick(objectId) {
      let changed = false;
      for (const config of holder.configs) {
        if (config.trigger !== 'click') {
          continue;
        }
        const state = states.get(config.id);
        if (!state) {
          continue;
        }
        if (config.attachTo === objectId) {
          state.visible = !state.visible;
          changed = true;
        } else if (state.visible) {
          state.visible = false;
          changed = true;
        }
      }
      if (changed) {
        notify();
      }
    },

    updateProjection() {
      css2dRenderer.render(scene, deps.camera);
    },

    resize(width, height) {
      setSize(width, height);
    },

    dispose() {
      anchors.forEach((anchor) => anchor.removeFromParent());
      anchors.clear();
      apps.forEach((app) => app.unmount());
      apps.clear();
      states.clear();
      listeners.clear();
      css2dRenderer.domElement.remove();
    },
  };
};
