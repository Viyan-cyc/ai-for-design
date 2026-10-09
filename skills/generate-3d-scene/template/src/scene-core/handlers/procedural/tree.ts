/**
 * handlers/procedural/tree — 低模树（过程化建模参照：组合图元，零 GLB）
 *
 * 演示「简模走代码不走资产」：树干 + 三层锥形树冠全用 three.js 图元几何拼装，
 * 改形态 = 改本文件常量（可 review 可 diff），不产出二进制。美术级资产（贴图/绑定/
 * 动画）才进 GLB 管线（assets/models/ + validate-model 门禁）。
 * 自然语言流程找不到合适模型需降级简模时，参照本文件写 handler——不生成 GLB。
 *
 * 业务 params（全可选）：trunkColor / foliageColor / height。
 * 视觉默认值在代码（本文件），个体覆盖走编辑器视觉层 __visuals——params 不收渲染字段。
 */
import * as THREE from 'three';
import type { SceneEngine } from '../../engine/SceneEngine';
import type { SceneNode } from '../../types';
import { handlerUtils } from '../registry';

/** 形态默认值（低模预算：干 7 段 + 冠各 7 段 ≈ 百面内） */
const TRUNK = { radius: 0.16, top: 0.11, height: 0.9, segments: 7 };
const FOLIAGE_TIERS = [
  { radius: 0.85, height: 0.9, y: 0.55, color: '#3F7D3A' },
  { radius: 0.62, height: 0.8, y: 1.05, color: '#4A8C42' },
  { radius: 0.4, height: 0.7, y: 1.55, color: '#58A052' },
];
const TRUNK_COLOR = '#7A5230';

export const registerTreeHandler = (sceneEngine: SceneEngine): void => {
  sceneEngine.registerFactory('trees', (node: SceneNode) => {
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    const params = node.params ?? {};
    const scale = typeof node.scale === 'number' ? node.scale : 1;
    const height = typeof params.height === 'number' ? params.height : 1;
    const trunkColor = typeof params.trunkColor === 'string' ? params.trunkColor : TRUNK_COLOR;

    // 树干（锥度圆柱）
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.95 });
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(TRUNK.radius * height, TRUNK.top * height, TRUNK.height * height, TRUNK.segments),
      trunkMat,
    );
    trunk.position.y = (TRUNK.height * height) / 2;
    group.add(trunk);

    // 三层锥形树冠（逐层收窄上移，色阶渐亮）
    FOLIAGE_TIERS.forEach((tier, i) => {
      const color = i === 0 && typeof params.foliageColor === 'string'
        ? params.foliageColor
        : tier.color;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(tier.radius * scale * height, tier.height * height, TRUNK.segments),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
      );
      cone.position.y = tier.y * height + (TRUNK.height * height - TRUNK.height) / 2;
      group.add(cone);
    });
    return group;
  });
};
