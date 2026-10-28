/**
 * scene-core/resources — 节点资源所有权登记（P3.2 / P3-RR1）
 *
 * 所有权按**实际资源**结算（geometry / material / texture 逐个登记），
 * 不登记 Object3D 根、不做树遍历释放——树遍历会绕过共享登记
 * （两个节点共用 material 时，任一根释放都整树 dispose 该材质，P3-RR1 复现）。
 *
 * 三层所有权：
 * - exclusive：节点独占资源（factory 每节点新建的 geometry/material）。
 *   owner 退出即释放。
 * - shared：多节点共享的资源（材质库共享实例、多个节点显式共用材质）。
 *   最后一个 owner 退出才释放。
 * - cache：资产缓存根（AssetEngine dispose 统一释放）——owner 退出只解除登记，
 *   节点域永不越权释放。
 *
 * SceneEngine 在节点 remove/recreate/dispose 时统一走这里对账。
 */
import * as THREE from 'three';

/** 资源所有权层级 */
export type ResourceOwnership = 'exclusive' | 'shared' | 'cache';

/** 资源域登记的资源类型（实际 GPU 资源，非 Object3D） */
export type OwnedResource = THREE.BufferGeometry | THREE.Material | THREE.Texture;

interface ResourceEntry {

  /** 引用此资源的节点 id 集合 */
  owners: Set<string>;

  ownership: ResourceOwnership;
}

/**
 * 一个场景（= 一个 SceneEngine/handle）的资源域。
 * 节点级 acquire 去重（同节点同资源不重复计数）；release 空引用后按层级结算。
 */
export class ResourceScope {

  private entries = new Map<OwnedResource, ResourceEntry>();

  private disposables = new Set<() => void>();

  /** 引擎销毁时兜底释放句柄（非资源对象：PMREM renderTarget 等） */
  onTeardown(fn: () => void): void {
    this.disposables.add(fn);
  }

  /**
   * 登记节点对实际资源的持有。
   * - exclusive：重复 acquire 同资源同节点幂等（Set 天然去重）
   * - shared/cache：多 owner 共享登记
   * 层级以首次登记为准（同资源跨层级登记视为误用，取更保守的 shared）。
   */
  acquire(nodeId: string, resource: OwnedResource, ownership: ResourceOwnership): void {
    let entry = this.entries.get(resource);
    if (!entry) {
      entry = { owners: new Set(), ownership };
      this.entries.set(resource, entry);
    }
    if (entry.ownership !== ownership) {
      entry.ownership = entry.ownership === 'exclusive' ? 'shared' : entry.ownership;
    }
    entry.owners.add(nodeId);
  }

  /**
   * 节点退出（remove/recreate）时解除登记。
   * exclusive 且是唯一 owner → 立即释放；shared → 最后一个 owner 退出释放；
   * cache → 只解除登记不释放（节点域不越权）。
   */
  release(nodeId: string): void {
    for (const [resource, entry] of this.entries) {
      if (!entry.owners.delete(nodeId)) {
        continue;
      }
      if (entry.ownership === 'cache' || entry.owners.size > 0) {
        continue;
      }
      this.entries.delete(resource);
      resource.dispose();
    }
  }

  /**
   * 解除节点在 keep 集合之外的全部登记（P3-RRR1 资源集对账用）——
   * 被替换的旧独占资源无人引用即释放；共享资源按 refcount 守护。
   */
  releaseExcept(nodeId: string, keep: Set<OwnedResource>): void {
    for (const [resource, entry] of this.entries) {
      if (keep.has(resource) || !entry.owners.delete(nodeId)) {
        continue;
      }
      if (entry.ownership === 'cache' || entry.owners.size > 0) {
        continue;
      }
      this.entries.delete(resource);
      resource.dispose();
    }
  }

  /** 资源当前引用计数（测试/诊断用） */
  refCount(resource: OwnedResource): number {
    return this.entries.get(resource)?.owners.size ?? 0;
  }

  /** 是否仍被登记（测试用） */
  isTracked(resource: OwnedResource): boolean {
    return this.entries.has(resource);
  }

  /**
   * 引擎销毁：释放全部登记资源。Map key 去重天然保证同资源只 dispose 一次
   * （同一 material 被多节点登记也是单个 entry）；cache 层由 AssetEngine.dispose
   * 释放，这里跳过（节点域不越权释放缓存根）。
   */
  releaseAll(): void {
    for (const [resource, entry] of this.entries) {
      if (entry.ownership !== 'cache') {
        resource.dispose();
      }
    }
    this.entries.clear();
    this.disposables.forEach((fn) => fn());
    this.disposables.clear();
  }
}

/**
 * 登记节点工厂产物的全部实际资源（P3-RRR1 口径）：geometry 按材质级跳过 clone
 * mesh；材质按 isCloneResource 区分（缓存共享不登记，节点私有的含被替换材质登记）。
 * Object3D 根不登记（P3-RR1：树遍历释放绕过共享登记）。
 * isBoundary（可选）：独立业务子节点判定——其子树不归本节点登记（P3-RRRR1）。
 */
export const acquireObjectResources = (
  scope: ResourceScope,
  nodeId: string,
  root: THREE.Object3D,
  isBoundary?: (obj: THREE.Object3D) => boolean,
): void => {
  const current = new Set<OwnedResource>();
  collectObjectResources(root, current, isBoundary);
  current.forEach((r) => scope.acquire(nodeId, r, 'exclusive'));
};

/** 单个材质是否缓存共享（AssetEngine 克隆时打 isCloneResource；私有克隆已清除） */
const isCacheSharedMaterial = (m: THREE.Material): boolean =>
  (m.userData as { isCloneResource?: boolean }).isCloneResource === true;

/**
 * 库材质标记（P4-RR1）：appearance-runtime 的编译库共享实例。生命周期归库级
 * teardown（引擎 dispose 一次释放），节点域收集跳过（同缓存根口径——节点退出
 * 不触发释放，跨零引用窗口实例保持有效，重建/迟到引用者复用同一活实例）。
 */
export const markLibraryMaterial = (m: THREE.Material): void => {
  (m.userData as { isLibraryMaterial?: boolean }).isLibraryMaterial = true;
};

/** 是否库共享材质（资源收集跳过用——释放责任在库级 teardown） */
export const isLibraryMaterial = (m: THREE.Material): boolean =>
  (m.userData as { isLibraryMaterial?: boolean }).isLibraryMaterial === true;

/**
 * 收集对象的当前实际资源集（P3-RRRR1 节点边界感知）：
 * - geometry 按 mesh 级 isClone 跳过（clone 不产新 geometry）；材质按材质级
 *   isCloneResource 区分缓存共享（跳过）与节点私有（含被替换进 clone mesh 的新材质）。
 * - isBoundary 判定独立业务子节点根：不深入其子树（其资源归子节点自己的登记，
 *   不能记给父——父重建/删除时子仍存活，资源不得随父释放）。
 *   未提供（如独立 ResourceScope 测试）= 全树收集（旧行为）。
 */
const collectObjectResources = (
  root: THREE.Object3D,
  out: Set<OwnedResource>,
  isBoundary?: (obj: THREE.Object3D) => boolean,
): void => {
  root.traverse((child) => {
    if (isBoundary && child !== root && isBoundary(child)) {
      // 独立业务子节点：其子树资源归它自己——跳过（不深入；traverse 无 skip，
      // 用标记位在回调外过滤）
      skippedSubtrees.add(child);
    }
    if (skippedSubtrees.size > 0) {
      // 检查当前节点是否在任一被跳过子树内：沿父链找边界根
      let cur: THREE.Object3D | null = child;
      while (cur) {
        if (skippedSubtrees.has(cur)) {
          return; // 在被跳过子树内
        }
        cur = cur.parent;
      }
    }
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const cloneMesh = (mesh.userData as { isClone?: boolean }).isClone === true;
    if (mesh.geometry && !cloneMesh) {
      out.add(mesh.geometry);
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && !isCacheSharedMaterial(m) && !isLibraryMaterial(m)) {
        out.add(m);
      }
    }
  });
  skippedSubtrees.clear();
};

/** traverse 回调内的被跳过子树根集合（模块级复用，traverse 结束清空） */
const skippedSubtrees = new Set<THREE.Object3D>();

/**
 * 资源集对账（P3-RRR1 + P3-RRRR1）：把节点的登记同步成对象**当前**的实际资源集。
 * - 视觉层编辑（applyVisual 的材质 clone/替换）、工厂 update 改材质等动态路径
 *   调用——新材质登记、被替换的旧独占资源解除（无人引用即释放）。
 * - 不能用重复 acquire 留住废弃资源：不在当前集合的 owner 登记会被 release。
 * - 共享资源安全：release 按 refcount——其他节点仍持有则不释放。
 * - 节点边界（RRRR1）：isBoundary 判定的独立业务子节点子树**不归本节点**——
 *   遍历时跳过；若父级编辑递归修改了子树内材质（applyVisualOverride traverse
 *   全树），子节点的资源集也变了——返回受影响的后代业务节点根，由调用方
 *   对每个子节点再做一次对账（归属各自登记）。
 * @returns 受影响的后代业务子节点根（调用方需逐个 syncObjectResources）
 */
export const syncObjectResources = (
  scope: ResourceScope,
  nodeId: string,
  root: THREE.Object3D,
  isBoundary?: (obj: THREE.Object3D) => boolean,
): THREE.Object3D[] => {
  const affectedDescendants: THREE.Object3D[] = [];
  const current = new Set<OwnedResource>();
  if (isBoundary) {
    // 先找出后代业务子节点根（traverse 全树，含边界子树内部——材质替换可能深入）
    root.traverse((child) => {
      if (child !== root && isBoundary(child)) {
        affectedDescendants.push(child);
      }
    });
  }
  collectObjectResources(root, current, isBoundary);
  // 解除该 owner 在当前集合之外的登记（release 内部按 refcount/层级结算）
  scope.releaseExcept(nodeId, current);
  // 新资源登记（已登记的幂等）
  current.forEach((r) => scope.acquire(nodeId, r, 'exclusive'));
  return affectedDescendants;
};

/** 每场景（SceneEngine 实例）一个 ResourceScope */
const scopes = new WeakMap<object, ResourceScope>();

/** 取（或建）某引擎实例的资源域 */
export const getResourceScope = (engine: object): ResourceScope => {
  let scope = scopes.get(engine);
  if (!scope) {
    scope = new ResourceScope();
    scopes.set(engine, scope);
  }
  return scope;
};
