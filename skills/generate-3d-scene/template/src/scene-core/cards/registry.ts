/**
 * cards/registry — 2D 卡片系统（v3：卡片内联在节点 card 字段）
 *
 * 卡片 = 锚在 3D 物体上的 DOM 元素（CSS2DRenderer 投影跟随）。
 * v3 语义：SceneNode.card（CardSpec）声明卡片；组件 type 查 components 表；
 * 显示 props 自动注入 = 本节点 params（生产数据源）+ 物体 id。
 * 生命周期随节点：节点删除 = 卡片消失（SceneEngine removeObject 级联）。
 * 依赖注入：scene/camera/resolveNode 由 createScene 装配时传入，本文件不反向依赖引擎层。
 */
import { createApp, type Component } from 'vue';
import type * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CardSpec, CardState, SceneNode } from '../types';

export interface CardSystemDeps {
  scene: THREE.Scene;

  /** 相机活引用（getter：透视/正交切换会替换实例） */
  readonly camera: THREE.Camera;

  /** 物体 id → 节点数据（card 声明与 params 注入来源） */
  resolveNode: (id: string) => SceneNode | null;

  /** 物体 id → Object3D（锚点挂载目标解析） */
  resolveObject: (id: string) => THREE.Object3D | null;

  /** 全部节点遍历器（id → node；卡片随节点声明同步挂载/卸载） */
  enumerateNodes: () => Array<[string, SceneNode]>;

  /** CSS2D 层挂载的容器（canvas 的父元素） */
  container: HTMLElement;

  /** 组件注册名 → Vue 组件（CardSpec.type 在此查表） */
  components: Record<string, Component>;
}

export interface CardSystem {
  onState(cb: (states: CardState[]) => void): () => void;

  /** 节点增删改/undo 重建后调用：同步锚点挂载与卸载 + 应用显隐 + 推状态 */
  refresh(): void;

  /** click 触发：命中物体 id 时切换其卡片显隐（其余 click 卡片互斥关闭） */
  handleClick(objectId: string): void;

  /** 每帧投影（createScene 接进 RenderLoop） */
  updateProjection(): void;

  /** 视口尺寸变化（与 renderer 同步，否则卡片投影错位/锁死 0,0） */
  resize(width: number, height: number): void;
  dispose(): void;
}

const DEFAULT_CARD_OFFSET: [number, number, number] = [0, 1, 0];

export const setupCards = (deps: CardSystemDeps): CardSystem => {
  // camera 是 getter（投影切换会换实例），不解构以保持活性；其余为静态引用
  const {
    scene, resolveNode, resolveObject, enumerateNodes, container, components,
  } = deps;

  const css2dRenderer = new CSS2DRenderer();
  css2dRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
  container.appendChild(css2dRenderer.domElement);

  /** 视口尺寸（投影矩阵依赖；resize 时同步，否则投影 NaN 元素锁死在 0,0） */
  const setSize = (w: number, h: number): void => {
    css2dRenderer.setSize(w, h);
  };
  setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

  /** cardKey（`nodeId/card`）→ CSS2DObject */
  const anchors = new Map<string, CSS2DObject>();

  /** cardKey → 运行态 */
  const states = new Map<string, CardState>();

  /** cardKey → 已挂载的 Vue app（dispose 时卸载） */
  const apps = new Map<string, ReturnType<typeof createApp>>();

  /** click 卡片默认互斥态（每个物体独立记忆展开/收起） */
  const clickToggled = new Set<string>();

  const listeners = new Set<(states: CardState[]) => void>();

  /** 当前场景全部带 card 的节点（遍历引擎数据） */
  const collectCardNodes = (): Array<{ id: string; card: CardSpec; params: Record<string, unknown> }> => {
    const out: Array<{ id: string; card: CardSpec; params: Record<string, unknown> }> = [];
    for (const [id, node] of enumerateNodes()) {
      if (node.card) {
        out.push({ id, card: node.card, params: node.params ?? {} });
      }
    }
    return out;
  };

  /** 单张卡片挂载（创建锚点/DOM/Vue 实例） */
  const mountCard = (nodeId: string, card: CardSpec, params: Record<string, unknown>): void => {
    const key = `${nodeId}/card`;
    if (anchors.has(key)) {
      return;
    }
    const el = document.createElement('div');
    el.dataset.cardId = key;
    el.style.pointerEvents = 'auto';
    const comp = components[card.type];
    // props 自动注入：本节点 params（生产数据源）+ id（卡片定位/业务主键）
    const props = { ...params, id: nodeId };
    if (comp) {
      const app = createApp(comp, props);
      app.mount(el);
      apps.set(key, app);
    } else {
      console.warn(`[cards] 未注册的卡片组件: ${card.type}（node=${nodeId}）`);
      el.textContent = nodeId;
    }
    const anchorObj = new CSS2DObject(el);
    anchorObj.name = `card_anchor_${key}`;
    anchors.set(key, anchorObj);
    states.set(key, {
      id: key,
      component: card.type,
      props,
      visible: card.trigger === 'click' ? clickToggled.has(nodeId) : true,
      anchor: { x: 0, y: 0, z: 0 },
    });
  };

  /** 单张卡片卸载（移除锚点 + 卸 Vue 实例 + 清 DOM；CSS2DObject.removeFromParent 不清 element） */
  const unmountCard = (key: string): void => {
    const anchor = anchors.get(key);
    if (anchor) {
      anchor.removeFromParent();
      anchor.element.remove();
      anchors.delete(key);
    }
    const app = apps.get(key);
    if (app) {
      app.unmount();
      apps.delete(key);
    }
    states.delete(key);
  };

  /** 显隐应用到 DOM（notify 与 refresh 统一走这里） */
  const applyVisibility = (): void => {
    for (const [key, state] of states) {
      const anchor = anchors.get(key);
      if (anchor) {
        const nodeId = key.slice(0, -'/card'.length);
        // 锚点物体不存在（删除物体后级联遗漏/数据孤儿）时隐藏卡片
        const orphan = !resolveObject(nodeId);
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
    for (const [key, anchor] of anchors) {
      const nodeId = key.slice(0, -'/card'.length);
      const node = resolveNode(nodeId);
      const target = resolveObject(nodeId);
      if (!node?.card || !target) {
        continue;
      }
      if (anchor.parent !== target) {
        target.add(anchor);
        anchor.position.set(...(node.card.offset ?? DEFAULT_CARD_OFFSET));
      }
    }
  };

  /** 全量同步：引擎节点表 → 卡片挂载/卸载（v3 生命周期随节点） */
  const syncWithNodes = (): void => {
    const present = new Set<string>();
    for (const { id, card, params } of collectCardNodes()) {
      present.add(`${id}/card`);
      mountCard(id, card, params);
    }
    [...anchors.keys()].forEach((key) => {
      if (!present.has(key)) {
        unmountCard(key);
      }
    });
    attachAnchors();
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
      syncWithNodes();
      notify();
    },

    handleClick(objectId) {
      let changed = false;
      for (const [key, state] of states) {
        const nodeId = key.slice(0, -'/card'.length);
        const node = resolveNode(nodeId);
        if (node?.card?.trigger !== 'click') {
          continue;
        }
        if (nodeId === objectId) {
          // 点击同物体切换显隐（记忆态）
          if (clickToggled.has(nodeId)) {
            clickToggled.delete(nodeId);
            state.visible = false;
          } else {
            clickToggled.add(nodeId);
            state.visible = true;
          }
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
