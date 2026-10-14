/**
 * handlers/example — 示例业务 handler（演示 + 二开参照，v3 通用化）
 *
 * 演示两个自定义分组（基于 asset 工厂加载 GLB）：
 *   'cars'     — 状态视觉演示：params.status 变化时经 materials.ts 查表应用
 *                状态视觉（normal/alarm/maintenance，数据无材质，视觉在代码）
 *   'examples' — 每帧动画演示：params.spin 打开时旋转整组（每帧回调）
 * 二开者写新 handler 参照此文件：makeAssetNodeFactory 委托 + onLoaded 业务回调。
 *
 * 通用职责（占位 Group/过期守卫/阴影默认/编辑器视觉层重挂）全在构建器内，
 * 这里只剩业务：状态视觉查表 + spinners 注册。
 *
 * 更新通道：params 原地更新经 onNodeUpdated 钩子重放（状态视觉/旋转开关都响应生产推送）；
 * 节点删除经 onNodeRemoved 清理 spinners（防孤儿实例每帧空转）。
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
  onFrame: (cb: (delta: number) => void) => void,
  onLoadCount?: (loaded: number, total: number) => void,
): void => {
  /** 需要旋转的实例表（id → Object3D；remove/update 时清理） */
  const spinners = new Map<string, THREE.Object3D>();

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

  /** 共享构建器 + 业务回调：状态视觉 + spinners 注册（onLoaded 时 instance 已应用完通用视觉） */
  const resolveAssetUrl = makeAssetUrlResolver();
  const factory = (type: string) => makeAssetNodeFactory(
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

  sceneEngine.registerFactory('cars', factory('cars'));
  sceneEngine.registerFactory('examples', factory('examples'));

  // params 原地更新：重放状态视觉 + 旋转开关
  sceneEngine.onNodeUpdated = (id: string) => {
    const type = sceneEngine.getNodeType(id);
    const node = sceneEngine.getNode(id);
    const obj = sceneEngine.getObject(id);
    if (!type || !node || !obj) {
      return;
    }
    if (type !== 'cars' && type !== 'examples') {
      return;
    }
    const instance = [...spinners.values()].includes(obj) ? obj : obj.children.find((c) => c.type === 'Group') ?? obj;
    if (node.params?.spin) {
      if (!spinners.has(id) && instance) {
        spinners.set(id, instance);
      }
    } else {
      spinners.delete(id);
    }
    applyStatusVisual(type, node, instance);
  };

  // 节点删除/重建：清理旋转表（过期守卫在构建器内，旧加载结果不会错注册 spinners）
  sceneEngine.onNodeRemoved = (id: string) => {
    spinners.delete(id);
  };

  // 每帧旋转（注册的实例才转）
  onFrame((delta) => {
    spinners.forEach((blades) => {
      blades.rotation.y += delta * 1.2;
    });
  });
};
