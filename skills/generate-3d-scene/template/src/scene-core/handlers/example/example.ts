/**
 * handlers/example — 示例业务 handler（演示 + 二开参照，P3.1 迁移到 typed definition）
 *
 * 演示两个自定义分组（基于 asset 工厂加载 GLB）：
 *   'cars'     — 状态视觉演示：params.status 变化时经 materials.ts 查表应用
 *                状态视觉（normal/alarm/maintenance，数据无材质，视觉在代码）
 *   'examples' — 每帧动画演示：params.spin 打开时旋转整组（每帧回调）
 * 二开者写新 handler 参照本文件：typed definition（create/update/dispose）+
 * subscribeNodeEvent 多订阅（不覆写全局单槽，P1 diagnostics 接线不受影响）。
 *
 * 通用职责（占位 Group/过期守卫/阴影默认/编辑器视觉层重挂）全在 makeAssetNodeFactory，
 * 这里只剩业务：状态视觉查表 + spinners 注册。
 *
 * update 契约：status/spin 参数变化原地重放（保实例）；assetId 结构参数变化
 * 返回 'rebuild'（引擎局部重建）。transform 不进 update——引擎处理。
 */
import type * as THREE from 'three';
import type { SceneEngine } from '../../engine/SceneEngine';
import type { AssetEngine } from '../../engine/AssetEngine';
import type { SceneNode } from '../../types';
import { applyState, stateMaterials } from '../../materials';
import { makeAssetUrlResolver } from '../../asset-manifest';
import { makeAssetNodeFactory } from '../registry';

export const registerExampleHandler = (
  sceneEngine: SceneEngine,
  assetEngine: AssetEngine,

  /** 帧回调注册（profile 层注入；返回退订函数——RenderLoop.onFrame 的 () => void） */
  onFrame: (cb: (delta: number) => void) => () => void,
  onLoadCount?: (loaded: number, total: number) => void,
): void => {
  /** 需要旋转的实例表（id → Object3D；remove/update 时清理） */
  const spinners = new Map<string, THREE.Object3D>();

  /** 本 handler 的全部退订句柄（引擎 teardown 钩子统一回收） */
  const teardowns: Array<() => void> = [];
  const engineAny = sceneEngine as unknown as { __handlerTeardowns?: Array<() => void> };
  engineAny.__handlerTeardowns = teardowns;

  /** 状态视觉查表应用（加载完成与 params 更新共用；type = 分组 key） */
  const applyStatusVisual = (type: string, node: SceneNode, instance: THREE.Object3D): void => {
    const status = node.params?.status;
    if (typeof status !== 'string') {
      return;
    }
    const visual = stateMaterials[type]?.[status];
    if (visual) {
      void applyState(instance, status, visual);
    }
  };

  /** GLB 加载完成后的业务回调（instance 已应用完通用视觉） */
  const resolveAssetUrl = makeAssetUrlResolver();

  /** typed definition（P3.1）：create = 共享构建器；update = 状态/spin 原地重放 */
  const makeDefinition = (type: string): {
    create: (node: SceneNode) => THREE.Object3D;
    update: (obj: THREE.Object3D, next: SceneNode, previous: SceneNode) => 'updated' | 'rebuild';
    dispose: (obj: THREE.Object3D) => void;
  } => {
    const create = makeAssetNodeFactory(
      sceneEngine,
      assetEngine,
      resolveAssetUrl,
      (node, instance) => {
        spinners.delete(node.id);
        if (node.params?.spin) {
          spinners.set(node.id, instance);
        }
        applyStatusVisual(type, node, instance);
      },
      onLoadCount,
    );
    return {
      create,
      update(obj, next, previous) {
        // assetId 是结构参数（换资产 = 换实例）——P3-R1：比较 previous（修改前的真实旧值）
        if (next.params?.assetId !== previous.params?.assetId) {
          return 'rebuild';
        }
        // spin 开关：原地切换 spinners 注册（保实例）
        if (next.params?.spin) {
          if (!spinners.has(next.id)) {
            const instance = obj.children.find((c) => c.type === 'Group') ?? obj;
            spinners.set(next.id, instance);
          }
        } else {
          spinners.delete(next.id);
        }
        // 状态视觉：原地重放（查表 + applyState 材质克隆更新）
        applyStatusVisual(type, next, obj.children.find((c) => c.type === 'Group') ?? obj);
        return 'updated';
      },
      dispose(obj) {
        // 工厂私有资源：spinners 表项（帧回调闭包状态，不是 GPU 资源）
        spinners.delete(obj.name);
      },
    };
  };

  // P3.1：definition 注册（typed 契约）；context 由 createScene.registerFactoryContext 统一供给
  sceneEngine.registerFactory('cars', makeDefinition('cars'));
  sceneEngine.registerFactory('examples', makeDefinition('examples'));

  // params 原地更新：definition.update 之外的全局重放兜底（旧 function 路径等价）。
  // 多订阅（subscribeNodeEvent）不覆写单槽——P1 diagnostics 接线不受影响
  const unsubUpdated = sceneEngine.subscribeNodeEvent('updated', (id: string) => {
    const type = sceneEngine.getNodeType(id);
    const node = sceneEngine.getNode(id);
    const obj = sceneEngine.getObject(id);
    if (!type || !node || !obj) {
      return;
    }
    if (type !== 'cars' && type !== 'examples') {
      return;
    }
    // definition.update 已重放；此处只兜 spinners（rebuild 路径重建实例后旧表项清空）
    if (!node.params?.spin) {
      spinners.delete(id);
    }
  });

  // 节点删除/重建：清理旋转表（过期守卫在构建器内，旧加载结果不会错注册 spinners）
  const unsubRemoved = sceneEngine.subscribeNodeEvent('removed', (id: string) => {
    spinners.delete(id);
  });

  // Subscribe only while actual animated instances exist; empty registrars must not prevent sleep.
  let unsubFrame: (() => void) | null = null;
  const syncAnimation = (): void => {
    if (spinners.size && !unsubFrame) {
      unsubFrame = onFrame(delta => spinners.forEach(blades => { blades.rotation.y += delta * 1.2; }));
    } else if (!spinners.size && unsubFrame) { unsubFrame(); unsubFrame = null; }
  };
  const syncUpdated = sceneEngine.subscribeNodeEvent('updated', syncAnimation);
  const syncRemoved = sceneEngine.subscribeNodeEvent('removed', syncAnimation);
  teardowns.push(unsubUpdated, unsubRemoved, syncUpdated, syncRemoved, () => unsubFrame?.());
};
