/**
 * handlers/example — 示例业务 handler（演示 + 二开参照，v3 通用化）
 *
 * 演示两个自定义分组（基于 asset 工厂加载 GLB）：
 *   'cars'     — 状态视觉演示：params.status 变化时经 materials.ts 查表应用
 *                状态视觉（normal/alarm/maintenance，数据无材质，视觉在代码）
 *   'examples' — 每帧动画演示：params.spin 打开时旋转整组（每帧回调）
 * 二开者写新 handler 参照此文件：注册工厂 → 读 node.params（业务字段）→ 返回 Object3D。
 * 注意：阴影等渲染属性不读 params（数据只有业务属性）——默认值在代码，个体覆盖走 __visuals。
 *
 * 更新通道：params 原地更新经 onNodeUpdated 钩子重放（状态视觉/旋转开关都响应生产推送）；
 * 节点删除经 onNodeRemoved 清理 spinners（防孤儿实例每帧空转）。
 */
import * as THREE from 'three';
import type { SceneEngine } from '../../engine/SceneEngine';
import type { AssetEngine } from '../../engine/AssetEngine';
import type { SceneNode } from '../../types';
import { applyState, stateMaterials } from '../../materials';
import { handlerUtils } from '../registry';

/** 阴影默认值（与内建工厂同规：默认 cast+receive；写 handler 时直接复用此模式） */
const applyShadowDefaults = (obj: THREE.Object3D): void => {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

/** 加载代际令牌：节点重建后旧加载的 then 不再落盘（防孤儿实例/错注册 spinners） */
const loadTokens = new Map<string, number>();

export const registerExampleHandler = (
  sceneEngine: SceneEngine,
  assetEngine: AssetEngine,
  onFrame: (cb: (delta: number) => void) => void,
): void => {
  /** 需要旋转的实例表（id → Object3D；remove/update 时清理） */
  const spinners = new Map<string, THREE.Object3D>();

  /** 状态视觉查表应用（create 与 update 共用；type = 分组 key） */
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

  /** 共享资产工厂（type = 分组 key；status 视觉按各自分组查 stateMaterials） */
  const makeAssetNode = (type: string) => (node: SceneNode): THREE.Object3D => {
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    const assetId = node.params?.assetId;
    if (typeof assetId === 'string' && assetId) {
      const token = (loadTokens.get(node.id) ?? 0) + 1;
      loadTokens.set(node.id, token);
      const isCurrent = (): boolean => loadTokens.get(node.id) === token;
      void assetEngine.getInstance(assetId, `assets/models/${assetId}.glb`)
        .then((instance) => {
          // 节点已被删除/重建：旧加载结果丢弃（不挂孤儿、不抢注 spinners）
          if (!isCurrent() || !sceneEngine.getObject(node.id)) {
            return;
          }
          applyShadowDefaults(instance);
          group.add(instance);
          spinners.delete(node.id);
          if (node.params?.spin) {
            spinners.set(node.id, instance);
          }
          applyStatusVisual(type, node, instance);
        });
    }
    return group;
  };

  sceneEngine.registerFactory('cars', makeAssetNode('cars'));
  sceneEngine.registerFactory('examples', makeAssetNode('examples'));

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

  // 节点删除/重建：清理旋转表与加载代际（重建时旧 then 自然失效）
  sceneEngine.onNodeRemoved = (id: string) => {
    spinners.delete(id);
    loadTokens.delete(id);
  };

  // 每帧旋转（注册的实例才转）
  onFrame((delta) => {
    spinners.forEach((blades) => {
      blades.rotation.y += delta * 1.2;
    });
  });
};
