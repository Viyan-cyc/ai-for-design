/**
 * scene-core/primitives — 图元底座（一个文件吃全部几何体，3d-templete Primitive/geometry 模式）
 *
 * v3：图元类型 = 分组 key（'Box'/'Sphere'/…），几何与默认材质都在本文件（代码层），
 * 数据层不出现任何几何/材质字段。低分段对齐 model-spec 面数纪律。
 */
import * as THREE from 'three';
import { PRIMITIVE_DEFAULT_COLOR } from './materials';

/** 支持的图元 kind（= 内建分组 key = three.js 几何类名省 Geometry 后缀） */
export const PRIMITIVE_KINDS = ['Box', 'Sphere', 'Cylinder', 'Plane', 'Cone', 'Torus'] as const;

export type PrimitiveKind = (typeof PRIMITIVE_KINDS)[number];

/** 低分段面数纪律（model-spec：prop 级图元） */
const SEGMENTS = { width: 16, height: 8 };

/** kind → BufferGeometry（未知 kind 返回 null） */
export const createPrimitiveGeometry = (kind: string): THREE.BufferGeometry | null => {
  switch (kind) {
    case 'Box': return new THREE.BoxGeometry(1, 1, 1);
    case 'Sphere': return new THREE.SphereGeometry(0.5, SEGMENTS.width, SEGMENTS.height);
    case 'Cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, SEGMENTS.width);
    case 'Plane': return new THREE.PlaneGeometry(1, 1);
    case 'Cone': return new THREE.ConeGeometry(0.5, 1, SEGMENTS.width);
    case 'Torus': return new THREE.TorusGeometry(0.5, 0.2, SEGMENTS.height, SEGMENTS.width);
    default: return null;
  }
};

/** 图元默认材质（视觉在代码：统一默认色；状态视觉/编辑器调参在其上覆盖） */
export const createPrimitiveMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: PRIMITIVE_DEFAULT_COLOR });
