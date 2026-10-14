/**
 * handlers/registry — 物体工厂注册表（v3）
 *
 * 内建工厂两类：
 * - 每种图元一个分组 key（'Box'/'Sphere'/…，primitives.ts 底座统一产出）
 * - 'asset' 通用 GLB 工厂（资产 id 在 params.assetId）
 * 业务 handler 追加注册自定义分组 key。SceneEngine 按节点所在分组分发。
 * v3：默认材质从代码取；编辑器视觉层（sceneEngine.getVisual）在工厂内重挂。
 *
 * 异步 GLB 节点的唯一构建器是 makeAssetNodeFactory——加载完成时刻的通用职责
 * （过期守卫/阴影默认/视觉层重挂）集中于此，业务 handler 经 onLoaded 只挂业务逻辑。
 */
import * as THREE from 'three';
import type { SceneEngine } from '../engine/SceneEngine';
import type { AssetEngine } from '../engine/AssetEngine';
import type { SceneNode } from '../types';
import { applyVisualOverride, type VisualOverride } from '../materials';
import { createPrimitiveGeometry, createPrimitiveMaterial, PRIMITIVE_KINDS } from '../primitives';
import { getDiagnosticsTracker } from '../diagnostics';

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
 * 加载期间占位可视化：已裁决撤除（2026-10-13）——探针实证首载报告缓存恒空
 * （盒永不出）+ 资产缓存后 GLB 毫秒级回归（盒一闪而过），视觉价值窗口≈0；
 * 加载感知由 N/M 徽标承担（createLoadBadge）。
 */

/**
 * 异步 GLB 节点的唯一构建器（'asset' 内建工厂与业务 handler 共用）。
 *
 * 同步返回占位 Group（建树不等待、渲染不阻塞），加载完成后按序：
 * 过期守卫 → 阴影默认 → 编辑器视觉层重挂 → 挂树 → onLoaded 业务回调。
 *
 * 过期守卫用身份比对（getObject(node.id) === group）：节点被删除/重建后引擎
 * 索引里的对象已不是本 group，旧加载结果直接丢弃——不挂孤儿、不重复应用视觉。
 *
 * 视觉层重挂是本构建器的结构性职责：视觉层可能在 GLB 加载完成前写入
 * （boot 回灌 / undo-redo 重建 / 视觉清除重建三个窗口都会先建节点后到数据），
 * slots 按 mesh 名定位、在空 Group 上命中不了——没有这步，异步窗口内的
 * 槽位 transform 与内联材质编辑会在重建后静默丢失。
 *
 * 加载计数（节点实例口径：创建 M+1，完成/过期/失败三态收敛 N+1，防指示永不消失）
 * 在本构建器——业务经 onLoaded 只挂业务逻辑，感知能力零成本获得。
 *
 * @param onLoaded 业务回调（状态视觉/spinners 注册等；instance 已应用完通用视觉）
 * @param onLoadCount 加载计数回调（不传即无感知）
 */
/**
 * 加载计数回调：由调用方注入。
 * P1.2 起推荐喂 installDiagnostics 的 tracker（每 handle 隔离 + 失败/取消分态）；
 * 旧注入（徽标直连）继续可用——本构建器只透传，不持有计数状态。
 */
export const makeAssetNodeFactory = (
  sceneEngine: SceneEngine,
  assetEngine: AssetEngine,
  resolveAssetUrl: (assetId: string) => string,
  onLoaded?: (node: SceneNode, instance: THREE.Object3D) => void,
  onLoadCount?: (loaded: number, total: number) => void,
): (node: SceneNode) => THREE.Object3D => (node: SceneNode): THREE.Object3D => {
  const group = new THREE.Group();
  applyTransform(group, node);
  const assetId = node.params?.assetId;
  if (typeof assetId !== 'string' || !assetId) {
    console.warn(`[registry] asset 节点缺 params.assetId: ${node.id}`);
    return group;
  }
  // P1.2：tracker（每 AssetEngine 隔离）接管 begin/settle；未安装时退回旧回调语义。
  // R2：begin 返回 token，settle 按 token 对账——同节点重建/重试不会互相覆盖。
  const tracker = getDiagnosticsTracker(assetEngine);
  const report = (): void => {
    if (tracker) {
      const { loaded, total } = tracker.counts();
      onLoadCount?.(loaded, total);
    }
  };
  const token = tracker?.begin(node.id, assetId);
  report();
  void Promise.resolve().then(() => assetEngine.getInstance(assetId, resolveAssetUrl(assetId)))
    .then((instance) => {
      if (sceneEngine.getObject(node.id) !== group) {
        tracker?.settle(token!, 'cancelled');
        report();
        return;
      }
      applyShadowDefaults(instance);
      applyVisualIfAny(instance, node.id, (id) => sceneEngine.getVisual(id));
      group.add(instance);
      onLoaded?.(node, instance);
      tracker?.settle(token!, 'succeeded');
      report();
    })
    .catch((err: unknown) => {
      console.warn(`[registry] 资产加载失败: ${assetId}（id=${node.id}）`, err);
      tracker?.settle(token!, 'failed', String((err as Error)?.message ?? err));
      report();
    });
  return group;
};

/**
 * 注册内建工厂到 SceneEngine（createScene 装配时调用一次）。
 * @param onLoadCount 加载计数回调（'asset' 工厂与业务 handler 的 GLB 节点统一汇入）
 */
export const registerBuiltinFactories = (
  sceneEngine: SceneEngine,
  assetEngine: AssetEngine,

  /** 资产 id → URL 解析器（模板按资产清单静态生成；默认走 public/assets/） */
  resolveAssetUrl: (assetId: string) => string = (id) => `assets/models/${id}.glb`,
  onLoadCount?: (loaded: number, total: number) => void,
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

  // 'asset'：GLB 资产实例（asset id 在 params.assetId）
  sceneEngine.registerFactory('asset', makeAssetNodeFactory(sceneEngine, assetEngine, resolveAssetUrl, undefined, onLoadCount));
};

/** 导出给业务 handler 复用的工具 */
export const handlerUtils = { applyTransform, applyVisualIfAny };
