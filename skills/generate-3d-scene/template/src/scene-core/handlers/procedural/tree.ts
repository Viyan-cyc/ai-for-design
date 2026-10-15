/**
 * handlers/procedural/tree — 低模树（过程化建模参照：组合图元，零 GLB）
 *
 * 演示「简模走代码不走资产」：树干 + 三层锥形树冠全用 three.js 图元几何拼装，
 * 改形态 = 改本文件常量（可 review 可 diff），不产出二进制。美术级资产（贴图/绑定/
 * 动画）才进 GLB 管线（assets/models/ + validate-model 门禁）。
 * 自然语言流程找不到合适模型需降级简模时，参照本文件写 handler——不生成 GLB。
 *
 * P3.1 typed definition：
 * - 业务 params（全可选）：trunkColor / foliageColor / height。
 * - height 是结构参数（几何随它变）→ update 返回 'rebuild'；
 *   颜色参数原地重放（保实例、保视觉层）。
 * - transform 由引擎处理（group transform 统一作用，不重复乘）。
 * 视觉默认值在代码（本文件），个体覆盖走编辑器视觉层 __visuals——params 不收渲染字段。
 */
import * as THREE from 'three';
import type { SceneEngine } from '../../engine/SceneEngine';
import type { NodeFactoryDefinition, SceneNode } from '../../types';
import { handlerUtils } from '../registry';

/** 形态默认值（低模预算：干 7 段 + 冠各 7 段 ≈ 百面内） */
const TRUNK = { radius: 0.16, top: 0.11, height: 0.9, segments: 7 };
const FOLIAGE_TIERS = [
  { radius: 0.85, height: 0.9, y: 0.55, color: '#3F7D3A' },
  { radius: 0.62, height: 0.8, y: 1.05, color: '#4A8C42' },
  { radius: 0.4, height: 0.7, y: 1.55, color: '#58A052' },
];
const TRUNK_COLOR = '#7A5230';

const readHeight = (node: SceneNode | undefined): number => {
  const h = node?.params?.height;
  return typeof h === 'number' ? h : 1;
};

const readColor = (node: SceneNode | undefined, key: 'trunkColor' | 'foliageColor', fallback: string): string => {
  const v = node?.params?.[key];
  return typeof v === 'string' ? v : fallback;
};

const FOLIAGE_BASE_COLOR = FOLIAGE_TIERS[0]?.color ?? '#3F7D3A';

export const registerTreeHandler = (sceneEngine: SceneEngine): void => {
  const definition: NodeFactoryDefinition = {
    create(node: SceneNode): THREE.Object3D {
      const group = new THREE.Group();
      handlerUtils.applyTransform(group, node);
      const height = readHeight(node);
      const trunkColor = readColor(node, 'trunkColor', TRUNK_COLOR);
      const foliageColor = readColor(node, 'foliageColor', FOLIAGE_BASE_COLOR);

      // 树干（锥度圆柱）
      const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.95 });
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(TRUNK.top * height, TRUNK.radius * height, TRUNK.height * height, TRUNK.segments),
        trunkMat,
      );
      trunk.name = 'trunk';
      trunk.position.y = (TRUNK.height * height) / 2;
      group.add(trunk);

      // 三层锥形树冠（逐层收窄上移，色阶渐亮）
      FOLIAGE_TIERS.forEach((tier, i) => {
        const color = i === 0 ? foliageColor : tier.color;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(tier.radius * height, tier.height * height, TRUNK.segments),
          new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
        );
        cone.name = `foliage_${i + 1}`;
        cone.position.y = tier.y * height;
        group.add(cone);
      });
      return group;
    },

    update(obj: THREE.Object3D, next: SceneNode, previous: SceneNode): 'updated' | 'rebuild' {
      // height 是结构参数：几何尺寸随它变 → 局部重建（引擎 recreateNode 保父链/视觉层）
      if (readHeight(next) !== readHeight(previous)) {
        return 'rebuild';
      }
      // 颜色参数原地重放（保实例；材质每节点独立创建，直接改不动其他树）
      const trunk = obj.children.find((c) => c.name === 'trunk') as THREE.Mesh | undefined;
      if (trunk) {
        (trunk.material as THREE.MeshStandardMaterial).color.set(readColor(next, 'trunkColor', TRUNK_COLOR));
      }
      const foliage = obj.children.find((c) => c.name === 'foliage_1') as THREE.Mesh | undefined;
      if (foliage) {
        (foliage.material as THREE.MeshStandardMaterial).color.set(readColor(next, 'foliageColor', FOLIAGE_BASE_COLOR));
      }
      return 'updated';
    },
  };
  sceneEngine.registerFactory('trees', definition);
};
