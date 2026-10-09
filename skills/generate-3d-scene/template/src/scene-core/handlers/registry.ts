/**
 * handlers/registry — 物体工厂注册表（v3）
 *
 * 内建工厂两类：
 * - 每种图元一个分组 key（'Box'/'Sphere'/…，primitives.ts 底座统一产出）
 * - 'asset' 通用 GLB 工厂（资产 id 在 params.assetId）
 * 业务 handler 追加注册自定义分组 key。SceneEngine 按节点所在分组分发。
 * v3：默认材质从代码取；编辑器视觉层（sceneEngine.getVisual）在工厂内重挂。
 */
import * as THREE from 'three';
import type { SceneEngine } from '../engine/SceneEngine';
import type { AssetEngine } from '../engine/AssetEngine';
import type { SceneNode } from '../types';
import { applyVisualOverride, type VisualOverride } from '../materials';
import { createPrimitiveGeometry, createPrimitiveMaterial, PRIMITIVE_KINDS } from '../primitives';

/** 应用 transform（position/rotation/scale，全部显式字段缺省安全值） */
export const applyTransform = (obj: THREE.Object3D, node: SceneNode): void => {
  obj.position.set(...(node.position ?? [0, 0, 0]));
  obj.rotation.set(...(node.rotation ?? [0, 0, 0]));
  const s = node.scale ?? 1;
  if (typeof s === 'number') {
    obj.scale.setScalar(s);
  } else {
    obj.scale.set(...s);
  }
};

/**
 * 阴影默认值（视觉在代码）：物体默认 cast+receive（引擎内建默认）。
 * 个体覆盖（如地面不投影）走编辑器视觉层 __visuals，交付转录进代码——数据层零渲染字段。
 */
const applyShadowDefaults = (obj: THREE.Object3D): void => {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

/** 应用编辑器视觉层（visuals[id] 存在时；工厂与重建路径共用） */
export const applyVisualIfAny = (
  obj: THREE.Object3D,
  id: string,
  getVisual: (id: string) => VisualOverride | null,
): void => {
  const v = getVisual(id);
  if (v) {
    applyVisualOverride(obj, v);
  }
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
  // 每种图元一个分组 key：'Box'/'Sphere'/'Cylinder'/'Plane'/'Cone'/'Torus'
  for (const kind of PRIMITIVE_KINDS) {
    sceneEngine.registerFactory(kind, (node) => {
      const geometry = createPrimitiveGeometry(kind);
      if (!geometry) {
        return null;
      }
      const mesh = new THREE.Mesh(geometry, createPrimitiveMaterial());
      applyVisualIfAny(mesh, node.id, (id) => sceneEngine.getVisual(id));
      applyTransform(mesh, node);
      applyShadowDefaults(mesh);
      return mesh;
    });
  }

  // 'asset'：GLB 资产实例（资产 id 在 params.assetId）
  sceneEngine.registerFactory('asset', (node) => {
    const group = new THREE.Group();
    applyTransform(group, node);
    const assetId = node.params?.assetId;
    if (typeof assetId !== 'string' || !assetId) {
      console.warn(`[registry] asset 节点缺 params.assetId: ${node.id}`);
      return group;
    }
    const url = resolveAssetUrl(assetId);
    void assetEngine.getInstance(assetId, url).then((instance) => {
      applyShadowDefaults(instance);
      applyVisualIfAny(instance, node.id, (id) => sceneEngine.getVisual(id));
      group.add(instance);
    }).catch((err: unknown) => {
      console.warn(`[registry] 资产加载失败: ${assetId}（id=${node.id}）`, err);
    });
    return group;
  });
};

/** 导出给业务 handler 复用的工具 */
export const handlerUtils = { applyTransform, applyVisualIfAny };
