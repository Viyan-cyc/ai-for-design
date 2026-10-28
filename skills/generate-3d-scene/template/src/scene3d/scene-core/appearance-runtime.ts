/**
 * appearance-runtime — 编译外观的运行时应用（P4.1，F08/V17；P4-R1/R2/RR1 修复）
 *
 * strip-edit 把编辑器 __visuals/__materialLib 编译进 generated/appearance.ts
 * （纯数据常量）；本模块在装配期把编译外观写进引擎视觉层：
 * - 内联视觉（材质参数/显隐/阴影/槽位）走 sceneEngine.applyVisual（merge 语义，
 *   底层 applyVisualOverride 复用材质克隆/贴图/阴影/显隐/槽位全链路——P3 资源所有权
 *   对账自动继承）
 * - libraryRef 材质：createMaterialFromSpec + applyMaterialTextures 建 mat_id →
 *   共享实例表（标量+贴图完整应用，与编辑器 MaterialLibService 同语义），挂到
 *   引用者（物体级整树 + 槽位级单 mesh）
 *
 * P4-R1（迟到资产/重建保真）：库材质挂载订阅 created + updated 生命周期——
 * 节点重建（recreateNode 触发 created）与异步 GLB 挂载完成（makeAssetNodeFactory
 * 的 then 块在视觉重挂后 emit updated）都会重挂共享实例，boot 时一次挂载不再是
 * 唯一时点。
 *
 * P4-RR1（库级所有权）：库实例生命周期 = 引擎会话——由本模块 teardown 恰好释放
 * 一次；节点域按 cache 层登记（节点退出只解除登记不释放）。零引用窗口（最后
 * owner 退出后重建/迟到引用者）实例保持有效，不存在「边 dispose 边复用」。
 *
 * 编辑器数据优先：scene-data 带私有区（编辑态/含 __visuals 的旧工程）时跳过
 * 编译应用——编辑器自己的回灌（createScene 装配期）是唯一真相源。
 */
import * as THREE from 'three';
import type { SceneHandle } from './createScene';
import type { MaterialLibEntry } from './types';
import type { VisualOverride } from './materials';
import { applyMaterialTextures, createMaterialFromSpec, findBySlotKey } from './materials';
import { getResourceScope, markLibraryMaterial } from './resources';
import type { SceneEngine } from './engine/SceneEngine';
const compiledVisuals: Record<string, VisualOverride> = {};
const compiledMaterialLib: Record<string, MaterialLibEntry> = {};

export interface AppearanceApplyResult {

  /** 应用的视觉层条目数（编译表非空条目） */
  visualEntries: number;

  /** 实例化的材质库条目数 */
  materialInstances: number;

  /** 跳过原因（'editor-data' = scene-data 带私有区，编辑器回灌优先） */
  skipped: null | 'editor-data' | 'empty';
}

/** 应用源（由 boot 显式传入编译常量；省略则为空） */
export interface AppearanceSource {

  /** 节点视觉层（generated/appearance.ts 的 compiledVisuals） */
  visuals: Record<string, VisualOverride>;

  /** 材质库（generated/appearance.ts 的 compiledMaterialLib） */
  materialLib: Record<string, MaterialLibEntry>;
}

/** 编译表是否为空（空表零开销——母版/未编辑工程） */
export const hasCompiledAppearance = (source?: AppearanceSource): boolean => {
  const s = source ?? { visuals: compiledVisuals, materialLib: compiledMaterialLib };
  return Object.keys(s.visuals).length > 0 || Object.keys(s.materialLib).length > 0;
};

/** 引用库材质的编译视觉条目（nodeId → visual；只含物体级/槽位级 libraryRef） */
const libRefVisuals = (
  visuals: Record<string, VisualOverride>,
): Array<[string, VisualOverride]> =>
  Object.entries(visuals).filter(
    ([, v]) => typeof v?.libraryRef === 'string'
      || Object.values<VisualOverride>(v?.slots ?? {}).some((s) => typeof s?.libraryRef === 'string'),
  );

/**
 * 应用编译外观到已建树的场景。
 * @param handle createScene 产物（internals.sceneEngine 必须已建树）
 * @param snapshot 装配用的 scene-data（编辑器私有区判定用；不修改）
 * @param source 编译表来源（由 boot 传入 generated/appearance.ts 常量，缺省为空）
 */
export const applyCompiledAppearance = (
  handle: SceneHandle,
  snapshot?: { __visuals?: unknown },
  source?: AppearanceSource,
): AppearanceApplyResult => {
  const src = source ?? { visuals: compiledVisuals, materialLib: compiledMaterialLib };
  // 编辑器数据优先：数据带私有区 = 编辑态或含编辑快照的工程，createScene 的
  // 私有区回灌已应用真实视觉层，编译表（可能是上一次 strip 的残留）不得覆盖
  if (snapshot?.__visuals !== undefined) {
    return { visualEntries: 0, materialInstances: 0, skipped: 'editor-data' };
  }
  if (!hasCompiledAppearance(src)) {
    return { visualEntries: 0, materialInstances: 0, skipped: 'empty' };
  }

  const se = handle.internals.sceneEngine;
  const visuals = src.visuals;
  const materialLib = src.materialLib;

  // 1. 视觉层写入引擎（merge 语义；材质/显隐/阴影/槽位生效——含 libraryRef 视觉，
  //    applyVisualOverride 在 refMode 下只处理显示/阴影，材质由步骤 2/3 挂共享实例）
  for (const [nodeId, visual] of Object.entries(visuals)) {
    se.applyVisual(nodeId, visual);
  }

  // 2. libraryRef 材质实例化（标量 + 贴图完整应用——P4-R1：与 MaterialLibService
  //    同口径，createMaterialFromSpec 只应用标量，贴图槽异步赋值）
  const instances = instantiateMaterialLib(materialLib);

  // 3. 库材质挂载接线（P4-R1/R2）：
  //    - 引擎级共享实例表：后续异步引用者（迟到 GLB）与节点重建都从同一表挂载
  //    - 生命周期订阅：created（recreateNode 重建）/ updated（异步挂载完成 emit）
  //      重挂共享实例——boot 时一次挂载不再是唯一时点
  //    - shared 登记：每引用节点 acquire（refcount；最后退出才释放）
  if (instances.size > 0) {
    attachLibraryRuntime(se, instances, visuals);
    // boot 时刻的即时挂载（同步节点全部就位；异步 GLB 由 updated 事件补挂）
    for (const [nodeId, visual] of libRefVisuals(visuals)) {
      mountLibraryInstances(se, instances, nodeId, visual);
    }
  }

  return {
    visualEntries: Object.keys(visuals).length,
    materialInstances: instances.size,
    skipped: null,
  };
};

/** mat_id → 共享材质实例（P4-R1：标量 + 贴图槽异步赋值全应用；P4-RR1：打库标记） */
const instantiateMaterialLib = (
  lib: Record<string, MaterialLibEntry>,
): Map<string, THREE.Material> => {
  const instances = new Map<string, THREE.Material>();
  for (const [matId, entry] of Object.entries(lib)) {
    const mat = createMaterialFromSpec(entry.spec);
    markLibraryMaterial(mat);
    void applyMaterialTextures(mat, entry.spec);
    instances.set(matId, mat);
  }
  return instances;
};

/**
 * 库材质运行时接线（P4-R1/RR1）：生命周期订阅 + 库级 teardown。
 * - created：节点重建后重挂（recreateNode 新实例）
 * - updated：异步 GLB 挂载完成后重挂（makeAssetNodeFactory 视觉重挂后 emit）
 * - teardown（P4-RR1）：库实例由本模块持有到引擎销毁——onTeardown 恰好 dispose
 *   一次（releaseAll 跳过 cache 层登记、disposables 在其尾部执行，无双释放）；
 *   订阅句柄同样随 __handlerTeardowns 回收
 */
const attachLibraryRuntime = (
  se: SceneEngine,
  instances: Map<string, THREE.Material>,
  visuals: Record<string, VisualOverride>,
): void => {
  const scope = getResourceScope(se);
  const remount = (id: string): void => {
    // 编译表内该节点的 libraryRef 视觉（未引用库的节点零开销短路）
    const visual = visuals[id];
    if (!visual) {
      return;
    }
    const hasLibRef = typeof visual.libraryRef === 'string'
      || Object.values<VisualOverride>(visual.slots ?? {}).some((s) => typeof s?.libraryRef === 'string');
    if (!hasLibRef) {
      return;
    }
    mountLibraryInstances(se, instances, id, visual);
  };
  const unsubCreated = se.subscribeNodeEvent('created', remount);
  const unsubUpdated = se.subscribeNodeEvent('updated', remount);
  // 库级所有权（P4-RR1）：实例表存活到引擎 teardown——节点域零引用窗口不释放
  scope.onTeardown(() => {
    instances.forEach((mat) => {
      mat.dispose();
    });
    instances.clear();
  });
  // teardown 注册（引擎 dispose 回收——__handlerTeardowns 是 P3.4 既有机制）
  const engineAny = se as unknown as { __handlerTeardowns?: Array<() => void> };
  engineAny.__handlerTeardowns = [...(engineAny.__handlerTeardowns ?? []), unsubCreated, unsubUpdated];
};

/**
 * 单节点挂共享实例（物体级整树 + 槽位级单 mesh）。
 * P4-RR1：库材质不进节点域登记（收集器 isLibraryMaterial 跳过，release/releaseExcept
 * 不触碰）——释放责任完全在库级 teardown；syncResourcesFor 对账仍执行（被替换的
 * 旧独占材质及时解除）。
 */
const mountLibraryInstances = (
  se: SceneEngine,
  instances: Map<string, THREE.Material>,
  nodeId: string,
  visual: VisualOverride,
): void => {
  const obj = se.getObject(nodeId);
  if (!obj) {
    return;
  }
  const mounted: THREE.Material[] = [];
  if (typeof visual.libraryRef === 'string') {
    const inst = instances.get(visual.libraryRef);
    if (inst) {
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material !== inst) {
          mesh.material = inst;
        }
      });
      mounted.push(inst);
    }
  }
  for (const [slotKey, slot] of Object.entries(visual.slots ?? {})) {
    const inst = typeof slot?.libraryRef === 'string' ? instances.get(slot.libraryRef) : null;
    if (!inst) {
      continue;
    }
    const target = findBySlotKey(obj, slotKey);
    if (target) {
      (target as THREE.Mesh).material = inst;
      mounted.push(inst);
    }
  }
  if (mounted.length === 0) {
    return;
  }
  // P4-RR1：库材质不进节点域登记——收集器（isLibraryMaterial 跳过）与对账
  // （releaseExcept）都不会触碰它；释放责任完全在库级 teardown。
  // syncResourcesFor 仍执行：被库材质替换下来的旧独占材质及时解除。
  se.syncResourcesFor(nodeId, obj);
};
