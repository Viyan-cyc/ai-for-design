/**
 * handlers/example — 示例业务 handler（演示 + 二开参照，v3 通用化）
 *
 * 演示两个自定义分组（基于 asset 工厂加载 GLB）：
 *   'cars'     — 状态视觉演示：params.status 变化时经 materials.ts 查表应用
 *                状态视觉（normal/alarm/maintenance，数据无材质，视觉在代码）
 *   'examples' — 每帧动画演示：params.spin 打开时旋转整组（每帧回调）
 * 二开者写新 handler 参照此文件：注册工厂 → 读 node.params（业务字段）→ 返回 Object3D。
 * 注意：阴影等渲染属性不读 params（数据只有业务属性）——默认值在代码，个体覆盖走 __visuals。
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

export const registerExampleHandler = (
  sceneEngine: SceneEngine,
  assetEngine: AssetEngine,
  onFrame: (cb: (delta: number) => void) => void,
): void => {
  /** 需要旋转的实例表（id → Object3D） */
  const spinners = new Map<string, THREE.Object3D>();

  /** 共享资产工厂（type = 分组 key；status 视觉按各自分组查 stateMaterials） */
  const makeAssetNode = (type: string) => (node: SceneNode): THREE.Object3D => {
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    const assetId = node.params?.assetId;
    if (typeof assetId === 'string' && assetId) {
      void assetEngine.getInstance(assetId, `assets/models/${assetId}.glb`)
        .then((instance) => {
          applyShadowDefaults(instance);
          group.add(instance);
          if (node.params?.spin) {
            spinners.set(node.id, instance);
          }
          // 状态视觉（params.status → materials.ts 按分组查表；业务字段驱动视觉是合法通道）
          const status = node.params?.status;
          if (typeof status === 'string') {
            const visual = stateMaterials[type]?.[status];
            if (visual) {
              void applyState(instance, status, visual);
            }
          }
        });
    }
    return group;
  };

  sceneEngine.registerFactory('cars', makeAssetNode('cars'));
  sceneEngine.registerFactory('examples', makeAssetNode('examples'));

  // 每帧旋转（注册的实例才转）
  onFrame((delta) => {
    spinners.forEach((blades) => {
      blades.rotation.y += delta * 1.2;
    });
  });
};
