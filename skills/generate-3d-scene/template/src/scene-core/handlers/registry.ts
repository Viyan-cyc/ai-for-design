/**
 * handlers/registry — 物体工厂注册表
 *
 * 内建两类工厂（asset = GLB 资产实例 / primitive = 图元），业务 handler 可追加注册自定义类型。
 * SceneEngine 建树时按 node.type 分发到这里的工厂。
 */
import * as THREE from 'three';
import type { SceneEngine } from '../engine/SceneEngine';
import type { AssetEngine } from '../engine/AssetEngine';
import type { SceneObjectNode } from '../types';
import { applyMaterialOverride } from '../utils/material';

/** 应用 transform（position/rotation/scale） */
const applyTransform = (obj: THREE.Object3D, node: SceneObjectNode): void => {
  obj.position.set(...node.position);
  obj.rotation.set(...node.rotation);
  if (typeof node.scale === 'number') {
    obj.scale.setScalar(node.scale);
  } else {
    obj.scale.set(...node.scale);
  }
};

/** 图元几何工厂（低分段，对齐 model-spec 面数纪律） */
const primitiveFactory = (node: SceneObjectNode): THREE.BufferGeometry | null => {
  const seg = { w: 16, h: 8 };
  switch (node.primitive) {
    case 'Box': return new THREE.BoxGeometry(1, 1, 1);
    case 'Sphere': return new THREE.SphereGeometry(0.5, seg.w, seg.h);
    case 'Cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, seg.w);
    case 'Plane': return new THREE.PlaneGeometry(1, 1);
    case 'Cone': return new THREE.ConeGeometry(0.5, 1, seg.w);
    case 'Torus': return new THREE.TorusGeometry(0.5, 0.2, seg.h, seg.w);
    default:
      console.warn(`[registry] 图元类型缺失或未知: ${node.primitive}（id=${node.id}）`);
      return null;
  }
};

/** 应用阴影开关到子树全部 mesh（castShadow/receiveShadow 是 mesh 级属性，父节点不继承） */
const applyShadowFlags = (obj: THREE.Object3D, node: SceneObjectNode): void => {
  if (node.castShadow === undefined && node.receiveShadow === undefined) {
    return;
  }
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      if (node.castShadow !== undefined) {
        child.castShadow = node.castShadow;
      }
      if (node.receiveShadow !== undefined) {
        child.receiveShadow = node.receiveShadow;
      }
    }
  });
};

/**
 * 注册内建工厂到 SceneEngine（createScene 装配时调用一次）。
 * 异步工厂（asset 加载）：先返回占位 Group，加载完成后填充——建树保持同步、渲染不等待。
 */
export const registerBuiltinFactories = (
  sceneEngine: SceneEngine,
  assetEngine: AssetEngine,

  /** 资产 id → URL 解析器（模板按资产清单静态生成；默认走 public/assets/） */
  resolveAssetUrl: (assetId: string) => string = (id) => `assets/models/${id}.glb`,
): void => {
  // type=asset：GLB 资产实例
  sceneEngine.registerFactory('asset', (node) => {
    const group = new THREE.Group();
    applyTransform(group, node);
    if (!node.assetId) {
      console.warn(`[registry] asset 节点缺 assetId: ${node.id}`);
      return group;
    }
    const url = resolveAssetUrl(node.assetId);
    void assetEngine.getInstance(node.assetId, url).then((instance) => {
      applyMaterialOverride(instance, node.materialOverride);
      applyShadowFlags(instance, node);
      group.add(instance);
    }).catch((err: unknown) => {
      console.warn(`[registry] 资产加载失败: ${node.assetId}（id=${node.id}）`, err);
    });
    return group;
  });

  // type=primitive：图元
  sceneEngine.registerFactory('primitive', (node) => {
    const geometry = primitiveFactory(node);
    if (!geometry) {
      return null;
    }
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: node.materialOverride?.color ?? '#9cabb8' }),
    );
    applyMaterialOverride(mesh, node.materialOverride);
    applyTransform(mesh, node);
    applyShadowFlags(mesh, node);
    return mesh;
  });
};

/** 导出给业务 handler 复用的工具 */
export const handlerUtils = { applyTransform, applyMaterialOverride };
