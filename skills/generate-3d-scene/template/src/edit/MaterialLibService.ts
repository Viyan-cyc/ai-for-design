/**
 * edit/MaterialLibService — 材质库服务
 *
 * 职责：
 * - 库 CRUD：写穿 __materialLib（整表替换语义，undo 快照天然覆盖）
 * - 实例注册表：mat_id → 单例材质（同 mat_id 物体 material === 同一实例）
 * - 引用追踪：__visuals[id].libraryRef 反查引用者
 * - 热更：改库条目 → 同类型标量热改实例 / 类型变更重建 → 引用物体即时变化
 * - 种子材质 4 个（glass/carpaint/brushed_metal/velvet；未被引用不参与交付转录）
 *
 * 共享实例重挂：订阅 bridge 变更，每次 commit/undo/redo 后 syncAll（幂等零成本）。
 * 材质实例化统一走 core 的 createMaterialFromSpec（本服务不 import core 内部文件——铁律 2）。
 */
import * as THREE from 'three';
import type { SceneHandle, MaterialLibEntry, MaterialSpec, VisualOverride } from '@/scene-core';
import { createMaterialFromSpec, applyMaterialScalars, applyMaterialTextures, NON_MATERIAL_VISUAL_KEYS } from '@/scene-core';
import type { Bridge } from './Bridge';

/** 内置种子材质（key 即 mat_id，转录时键名直接用） */
const SEED_MATERIALS: Record<string, MaterialLibEntry> = {
  glass: {
    name: '玻璃',
    spec: { type: 'MeshPhysicalMaterial', transmission: 1, ior: 1.5, roughness: 0.05, thickness: 0.5 },
  },
  carpaint: {
    name: '车漆',
    spec: { type: 'MeshPhysicalMaterial', clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.7, roughness: 0.35 },
  },
  brushed_metal: {
    name: '拉丝金属',
    spec: { type: 'MeshPhysicalMaterial', metalness: 1, roughness: 0.35, anisotropy: 1 },
  },
  velvet: {
    name: '绒布',
    spec: { type: 'MeshPhysicalMaterial', sheen: 1, sheenRoughness: 0.5, roughness: 1, metalness: 0 },
  },
};

/** VisualOverride 的内联材质部分 → MaterialSpec（非材质键复用 core 真相源） */
export const visualToSpec = (v: VisualOverride): MaterialSpec => {
  const out: Record<string, unknown> = { type: v.materialType ?? 'MeshStandardMaterial' };
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined || NON_MATERIAL_VISUAL_KEYS.has(k)) {
      continue;
    }
    out[k] = val;
  }
  return out as unknown as MaterialSpec;
};

/** MaterialSpec → VisualOverride 内联字段（materialType + 参数，与 libraryRef 互斥） */
export const specToInline = (spec: MaterialSpec): VisualOverride => {
  const { type, ...rest } = spec;
  return { materialType: type ?? 'MeshStandardMaterial', ...rest };
};

/** 保留物体现有非材质字段（显示/阴影） */
export const keepNonMaterial = (v: VisualOverride | null): VisualOverride => {
  const out: VisualOverride = {};
  if (v?.visible !== undefined) {
    out.visible = v.visible;
  }
  if (v?.castShadow !== undefined) {
    out.castShadow = v.castShadow;
  }
  if (v?.receiveShadow !== undefined) {
    out.receiveShadow = v.receiveShadow;
  }
  if (v?.locked !== undefined) {
    out.locked = v.locked;
  }
  return out;
};

/** 三种可编辑材质类型判定（GLB 自带材质可能超出此集，回退 Standard） */
const EDITABLE_TYPES: ReadonlyArray<MaterialSpec['type']> = [
  'MeshLambertMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial',
];

/**
 * 材质类型种子：物体无内联视觉时，从首个 mesh 的活材质取类型名。
 * 面板用——GLB 是 Standard 就显示 Standard，避免默认显示 Standard 与实际不符时一动滑杆触发跨类型重建。
 */
export const seedMaterialType = (obj: THREE.Object3D | null, fallback: MaterialSpec['type'] = 'MeshStandardMaterial'): MaterialSpec['type'] => {
  if (!obj) {
    return fallback;
  }
  let found: THREE.Material | null = null;
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!found && mesh.isMesh) {
      found = Array.isArray(mesh.material) ? mesh.material[0] ?? null : mesh.material;
    }
  });
  const type = found ? (found as THREE.Material).type : null;
  return type && (EDITABLE_TYPES as ReadonlyArray<string>).includes(type)
    ? (type as MaterialSpec['type'])
    : fallback;
};

export class MaterialLibService {
  private instances = new Map<string, THREE.Material>();

  /** mat_id → 已应用 spec（同类型热改 vs 重建的判定） */
  private applied = new Map<string, MaterialSpec>();

  /** mat_id → spec 签名（未变则跳过重建） */
  private sigs = new Map<string, string>();

  private unsub: () => void;

  constructor(private handle: SceneHandle, private bridge: Bridge) {
    this.unsub = this.bridge.onState(() => this.syncAll());
  }

  // ---- 读取 ----

  listEntries(): Array<{ id: string; name: string; spec: MaterialSpec }> {
    return Object.entries(this.handle.internals.sceneEngine.getAllMaterialLib())
      .map(([id, e]) => ({ id, name: e.name, spec: e.spec }));
  }

  getEntry(id: string): MaterialLibEntry | null {
    return this.handle.internals.sceneEngine.getMaterialLibEntry(id);
  }

  /** 取共享实例（冒烟断言 `material === 实例` 用） */
  getInstance(matId: string): THREE.Material | null {
    return this.instances.get(matId) ?? null;
  }

  /** 引用某库条目的物体 id 列表 */
  referencingNodes(matId: string): string[] {
    const se = this.handle.internals.sceneEngine;
    return se.getAllIds().filter((id) => se.getVisual(id)?.libraryRef === matId);
  }

  // ---- 种子 ----

  /** 注入 4 种子材质（仅缺的补；boot 时调用，不进撤销栈） */
  seeds(): void {
    const lib = { ...this.handle.internals.sceneEngine.getAllMaterialLib() };
    let changed = false;
    for (const [id, entry] of Object.entries(SEED_MATERIALS)) {
      if (!(id in lib)) {
        lib[id] = entry;
        changed = true;
      }
    }
    if (changed) {
      this.handle.update({ __materialLib: lib });
      this.syncAll();
    }
  }

  // ---- 库 CRUD（全部经 bridge.commit，undo 可恢复） ----

  createEntry(name: string, spec: MaterialSpec): string {
    const id = this.nextId();
    this.bridge.commit('新建材质', () => {
      const lib = { ...this.handle.internals.sceneEngine.getAllMaterialLib() };
      lib[id] = { name, spec: { ...spec } };
      this.handle.update({ __materialLib: lib });
    });
    return id;
  }

  updateEntry(id: string, spec: MaterialSpec, label = '材质库'): void {
    this.bridge.commitLive(label, () => {
      const lib = { ...this.handle.internals.sceneEngine.getAllMaterialLib() };
      const entry = lib[id];
      if (!entry) {
        return;
      }
      lib[id] = { name: entry.name, spec: { ...spec } };
      this.handle.update({ __materialLib: lib });
    });
  }

  renameEntry(id: string, name: string): void {
    this.bridge.commit('重命名材质', () => {
      const lib = { ...this.handle.internals.sceneEngine.getAllMaterialLib() };
      const entry = lib[id];
      if (!entry) {
        return;
      }
      lib[id] = { name, spec: entry.spec };
      this.handle.update({ __materialLib: lib });
    });
  }

  /** 删除条目；引用者自动断开为 inline（保留外观） */
  removeEntry(id: string): void {
    if (!this.getEntry(id)) {
      return;
    }
    this.bridge.commit('删除材质', () => {
      const lib = { ...this.handle.internals.sceneEngine.getAllMaterialLib() };
      const entry = lib[id];
      if (!entry) {
        return;
      }
      delete lib[id];
      const visuals: Record<string, VisualOverride> = {};
      for (const nid of this.referencingNodes(id)) {
        const cur = this.handle.internals.sceneEngine.getVisual(nid);
        visuals[nid] = { ...keepNonMaterial(cur), ...specToInline(entry.spec) };
      }
      this.handle.update({ __materialLib: lib, __visuals: visuals });
    });
  }

  // ---- 链接 / 断开 / 另存为 ----

  link(nodeId: string, matId: string): void {
    if (!this.getEntry(matId)) {
      return;
    }
    this.bridge.commit('链接材质', () => {
      const cur = this.handle.internals.sceneEngine.getVisual(nodeId);
      this.handle.internals.sceneEngine.replaceVisual(nodeId, { ...keepNonMaterial(cur), libraryRef: matId });
    });
  }

  disconnect(nodeId: string): void {
    const ref = this.handle.internals.sceneEngine.getVisual(nodeId)?.libraryRef;
    if (!ref) {
      return;
    }
    const spec = this.getEntry(ref)?.spec ?? this.linkedSpec(nodeId);
    this.bridge.commit('断开链接', () => {
      const cur = this.handle.internals.sceneEngine.getVisual(nodeId);
      this.handle.internals.sceneEngine.replaceVisual(nodeId, { ...keepNonMaterial(cur), ...specToInline(spec) });
    });
  }

  saveAs(nodeId: string, name: string): string {
    const v = this.handle.internals.sceneEngine.getVisual(nodeId) ?? {};
    const spec = v.libraryRef ? (this.getEntry(v.libraryRef)?.spec ?? visualToSpec(v)) : visualToSpec(v);
    const id = this.createEntry(name, { ...spec });
    this.link(nodeId, id);
    return id;
  }

  // ---- 运行时同步 ----

  /** 重挂全部引用物体的共享实例（幂等；bridge 变更后自动调用） */
  syncAll(): void {
    const lib = this.handle.internals.sceneEngine.getAllMaterialLib();
    this.reconcileInstances(lib);
    const se = this.handle.internals.sceneEngine;
    for (const id of se.getAllIds()) {
      const ref = se.getVisual(id)?.libraryRef;
      if (!ref) {
        continue;
      }
      const inst = this.instances.get(ref);
      const obj = se.getObject(id);
      if (inst && obj) {
        this.assignMaterial(obj, inst);
      }
    }
  }

  dispose(): void {
    this.unsub();
    this.instances.forEach((m) => m.dispose());
    this.instances.clear();
    this.applied.clear();
    this.sigs.clear();
  }

  // ---- private ----

  private linkedSpec(nodeId: string): MaterialSpec {
    const v = this.handle.internals.sceneEngine.getVisual(nodeId);
    return visualToSpec(v ?? {});
  }

  private nextId(): string {
    let max = 0;
    for (const id of Object.keys(this.handle.internals.sceneEngine.getAllMaterialLib())) {
      const m = /^mat_(\d+)$/.exec(id);
      if (m && m[1]) {
        max = Math.max(max, parseInt(m[1], 10));
      }
    }
    return `mat_${String(max + 1).padStart(3, '0')}`;
  }

  private assignMaterial(obj: THREE.Object3D, mat: THREE.Material): void {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material !== mat) {
        mesh.material = mat;
      }
    });
  }

  /** 实例对账：spec 变化时同类型热改 / 类型变更重建；删除的条目释放实例 */
  private reconcileInstances(lib: Record<string, MaterialLibEntry>): void {
    for (const [id, entry] of Object.entries(lib)) {
      const spec = entry.spec;
      const sig = JSON.stringify(spec);
      if (this.sigs.get(id) === sig) {
        continue;
      }
      const existing = this.instances.get(id);
      const prev = this.applied.get(id);
      const sameType = prev !== undefined
        && (prev.type ?? 'MeshStandardMaterial') === (spec.type ?? 'MeshStandardMaterial');
      if (existing && sameType) {
        applyMaterialScalars(existing, spec);
        void applyMaterialTextures(existing, spec);
      } else {
        existing?.dispose();
        const mat = createMaterialFromSpec(spec);
        this.instances.set(id, mat);
        void applyMaterialTextures(mat, spec);
      }
      this.sigs.set(id, sig);
      this.applied.set(id, { ...spec });
    }
    for (const id of [...this.instances.keys()]) {
      if (!(id in lib)) {
        this.instances.get(id)?.dispose();
        this.instances.delete(id);
        this.sigs.delete(id);
        this.applied.delete(id);
      }
    }
  }
}
