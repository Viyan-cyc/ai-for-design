/**
 * handlers/example — 示例业务 handler（演示 + 二开参照）
 *
 * 演示一个自定义类型 'wind_turbine'：基于 asset 工厂加载风机资产，
 * 并在 params.spin 打开时旋转叶片（每帧回调）。
 * 二开者写新 handler 参照此文件：注册工厂 → 读 node.params → 返回 Object3D。
 */
import * as THREE from 'three';
import type { SceneEngine } from '../../engine/SceneEngine';
import type { AssetEngine } from '../../engine/AssetEngine';
import type { SceneObjectNode } from '../../types';
import { handlerUtils } from '../registry';

export const registerExampleHandler = (
  sceneEngine: SceneEngine,
  assetEngine: AssetEngine,
  onFrame: (cb: (delta: number) => void) => void,
): void => {
  /** 需要旋转的叶片实例表（id → 叶片 Object3D） */
  const spinners = new Map<string, THREE.Object3D>();

  sceneEngine.registerFactory('wind_turbine', (node: SceneObjectNode) => {
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    void assetEngine.getInstance('wind_turbine', `assets/models/${node.assetId ?? 'wind_turbine'}.glb`)
      .then((instance) => {
        handlerUtils.applyMaterialOverride(instance, node.materialOverride);
        group.add(instance);
        // 约定：资产内名为 blades 的子节点旋转（若无则旋转整组）
        const blades = instance.getObjectByName('blades') ?? instance;
        if (node.params?.spin) {
          spinners.set(node.id, blades);
        }
      });
    return group;
  });

  // 每帧旋转（注册的实例才转）
  onFrame((delta) => {
    spinners.forEach((blades) => {
      blades.rotation.y += delta * 1.2;
    });
  });
};
