import { texturePreviews, type TexturePreviews } from './material-preview';
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
import type * as THREE from 'three';
import type {
  SceneHandle, MaterialLibEntry, MaterialSpec, VisualOverride,
} from '../scene3d/scene-core/index';
import {
  createMaterialFromSpec, applyMaterialScalars, applyMaterialTextures, NON_MATERIAL_VISUAL_KEYS, findBySlotKey, readMaterialSpec,
} from '../scene3d/scene-core/index';
import type { Bridge } from './Bridge';
import { showEditorMessage } from './message';

/** 内置种子材质（key 即 mat_id，转录时键名直接用） */
const SEED_MATERIALS: Record<string, MaterialLibEntry> = {
  glass: {
    name: '玻璃',
    spec: {
      type: 'MeshPhysicalMaterial', transmission: 1, ior: 1.5, roughness: 0.05, thickness: 0.5,
    },
  },
  carpaint: {
    name: '车漆',
    spec: {
      type: 'MeshPhysicalMaterial', clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.7, roughness: 0.35,
    },
  },
  brushed_metal: {
    name: '拉丝金属',
    spec: {
      type: 'MeshPhysicalMaterial', metalness: 1, roughness: 0.35, anisotropy: 1,
    },
  },
  velvet: {
    name: '绒布',
    spec: {
      type: 'MeshPhysicalMaterial', sheen: 1, sheenRoughness: 0.5, roughness: 1, metalness: 0,
    },
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
    return se.getAllIds().filter((id) => {
      const visual = se.getVisual(id);
      return visual?.libraryRef === matId
        || Object.values(visual?.slots ?? {}).some((slot) => slot.libraryRef === matId);
    });
  }

  texturePreview(nodeId?: string | null, slotKey?: string | null, matId?: string | null): TexturePreviews {
    if (matId) { return texturePreviews(this.getInstance(matId)); }
    const root = nodeId ? this.handle.internals.sceneEngine.getObject(nodeId) : null;
    const target = root && slotKey ? findBySlotKey(root, slotKey) : root;
    let material: THREE.Material | null = null;
    target?.traverse((child) => {
      if (material || !(child as THREE.Mesh).isMesh) { return; }
      const value = (child as THREE.Mesh).material;
      material = Array.isArray(value) ? value[0] ?? null : value;
    });
    return texturePreviews(material);
  }

  /** Read the actual target, retaining serialized texture references when present. */
  effectiveSpec(nodeId: string, slotKey?: string | null): MaterialSpec {
    const se = this.handle.internals.sceneEngine;
    const root = se.getObject(nodeId);
    const visual = se.getVisual(nodeId);
    const override = slotKey ? visual?.slots?.[slotKey] : visual;
    const ref = override?.libraryRef ?? (slotKey ? visual?.libraryRef : undefined);
    const stored = ref ? this.getEntry(ref)?.spec : undefined;
    let mesh: THREE.Mesh | null = null;
    const target = root && slotKey ? findBySlotKey(root, slotKey) : root;
    target?.traverse((child) => {
      if (!mesh && (child as THREE.Mesh).isMesh) {
        mesh = child as THREE.Mesh;
      }
    });
    const live = mesh ? readMaterialSpec(mesh) : { type: 'MeshStandardMaterial' as const };
    return { ...stored, ...visualToSpec(override ?? {}), ...live };
  }

  /** Replace a slot, clearing mutually exclusive library/inline fields. */
  writeSlot(nodeId: string, slotKey: string, value: VisualOverride): void {
    const se = this.handle.internals.sceneEngine;
    const visual = se.getVisual(nodeId) ?? {};
    const old = visual.slots?.[slotKey] ?? {};
    const nonMaterial = Object.fromEntries(Object.entries(old)
      .filter(([key]) => NON_MATERIAL_VISUAL_KEYS.has(key) && key !== 'libraryRef' && key !== 'materialType'));
    se.replaceVisual(nodeId, { ...visual, slots: { ...visual.slots, [slotKey]: { ...nonMaterial, ...value } } });
  }

  // ---- 种子 ----

  /** 注入 4 种内置材质——仅工程首次（材质库为空）时；用户删除后不再复活 */
  seeds(): void {
    const lib = this.handle.internals.sceneEngine.getAllMaterialLib();
    if (Object.keys(lib).length > 0) {
      return;
    }
    this.handle.update({ __materialLib: { ...SEED_MATERIALS } });
    this.syncAll();
  }

  private blocked(ids: string[]): boolean {
    const locked = ids.some((id) => this.bridge.isLocked(id));
    if (locked) {
      showEditorMessage('目标或共享材质引用对象已锁定，请先解锁。');
    }
    return locked;
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
    if (this.blocked(this.referencingNodes(id))) {
      return;
    }
    this.bridge.commitLive(`${label }:${ id}`, () => {
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
    if (this.blocked(this.referencingNodes(id))) {
      return;
    }
    const entry = this.getEntry(id);
    if (!entry) {
      return;
    }
    this.bridge.commit('删除材质', () => {
      const refs = this.referencingNodes(id);
      const lib = { ...this.handle.internals.sceneEngine.getAllMaterialLib() };
      delete lib[id];
      this.handle.update({ __materialLib: lib });
      // 引用者整条替换为内联——replaceVisual 覆盖式写入（合并语义会残留旧 libraryRef，
      // 令 D4 跳过材质处理、内联字段失效）
      for (const nid of refs) {
        const cur = this.handle.internals.sceneEngine.getVisual(nid);
        const slots = { ...cur?.slots };
        for (const [key, slot] of Object.entries(slots)) {
          if (slot.libraryRef === id) {
            const { libraryRef: omitted, ...rest } = slot;
            void omitted;
            slots[key] = { ...rest, ...specToInline(entry.spec) };
          }
        }
        const next = cur?.libraryRef === id
          ? { ...keepNonMaterial(cur), ...specToInline(entry.spec), slots }
          : { ...cur, slots };
        this.handle.internals.sceneEngine.replaceVisual(nid, next);
      }
    });
  }

  // ---- 链接 / 断开 / 另存为 / 槽位 ----

  link(nodeId: string, matId: string): void {
    if (this.blocked([nodeId])) {
      return;
    }
    if (!this.getEntry(matId)) {
      return;
    }
    this.bridge.commit('链接材质', () => {
      const cur = this.handle.internals.sceneEngine.getVisual(nodeId);
      this.handle.internals.sceneEngine.replaceVisual(nodeId, { ...keepNonMaterial(cur), libraryRef: matId });
    });
  }

  /** 槽位级链接：把子网格槽位指向库条目（物体级与其它槽位不动；共享实例语义同物体级） */
  applySlotLink(nodeId: string, slotKey: string, matId: string): void {
    if (this.blocked([nodeId])) {
      return;
    }
    if (!this.getEntry(matId)) {
      return;
    }
    this.bridge.commit('槽位链接材质', () => {
      // applyVisual 单物体合并语义——update({__visuals}) 是整表替换（会清其他物体的视觉层）
      this.writeSlot(nodeId, slotKey, { libraryRef: matId });
    });
  }

  /** 读槽位视觉（编辑面板槽位模式显示用） */
  getSlotVisual(nodeId: string, slotKey: string): VisualOverride | null {
    return this.handle.internals.sceneEngine.getVisual(nodeId)?.slots?.[slotKey] ?? null;
  }

  disconnect(nodeId: string, slotKey?: string | null): void {
    if (this.blocked([nodeId])) {
      return;
    }
    const visual = this.handle.internals.sceneEngine.getVisual(nodeId);
    const ref = slotKey ? visual?.slots?.[slotKey]?.libraryRef : visual?.libraryRef;
    if (!ref) {
      return;
    }
    const spec = this.getEntry(ref)?.spec ?? this.linkedSpec(nodeId);
    this.bridge.commit('断开链接', () => {
      const cur = this.handle.internals.sceneEngine.getVisual(nodeId);
      if (slotKey) {
        this.writeSlot(nodeId, slotKey, specToInline(spec));
      } else {
        this.handle.internals.sceneEngine.replaceVisual(nodeId, { ...keepNonMaterial(cur), ...specToInline(spec), slots: cur?.slots });
      }
    });
  }

  saveAs(nodeId: string, name: string, slotKey?: string | null): string {
    if (this.bridge.isLocked(nodeId)) {
      throw new Error('目标已锁定，请先解锁。');
    }
    const spec = this.effectiveSpec(nodeId, slotKey);
    const root = this.handle.internals.sceneEngine.getObject(nodeId);
    const target = root && slotKey ? findBySlotKey(root, slotKey) : root;
    let unsupportedTexture = false;
    target?.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const [key, value] of Object.entries(material)) {
          if (value && (value as THREE.Texture).isTexture
            && typeof (spec as unknown as Record<string, unknown>)[key] !== 'string') {
            unsupportedTexture = true;
          }
        }
      }
    });
    if (unsupportedTexture) {
      throw new Error('当前材质包含未登记的模型内嵌贴图，暂不能完整另存到库；可直接编辑当前材质。');
    }
    const id = this.nextId();
    this.bridge.commit('另存材质', () => {
      const se = this.handle.internals.sceneEngine;
      this.handle.update({ __materialLib: { ...se.getAllMaterialLib(), [id]: { name, spec } } });
      if (slotKey) {
        this.writeSlot(nodeId, slotKey, { libraryRef: id });
      } else {
        se.replaceVisual(nodeId, { ...keepNonMaterial(se.getVisual(nodeId)), libraryRef: id });
      }
    });
    return id;
  }

  // ---- 运行时同步 ----

  /** 重挂全部引用物体的共享实例（幂等；bridge 变更后自动调用）——物体级 + 槽位级 */
  syncAll(): void {
    const lib = this.handle.internals.sceneEngine.getAllMaterialLib();
    this.reconcileInstances(lib);
    const se = this.handle.internals.sceneEngine;
    for (const id of se.getAllIds()) {
      const vis = se.getVisual(id);
      if (!vis) {
        continue;
      }
      // 物体级引用：整树重挂共享实例
      if (vis.libraryRef) {
        const inst = this.instances.get(vis.libraryRef);
        const obj = se.getObject(id);
        if (inst && obj) {
          const excluded = new Set<THREE.Object3D>();
          for (const [key, slot] of Object.entries(vis.slots ?? {})) {
            if (slot.libraryRef || slot.materialType || Object.keys(visualToSpec(slot)).length > 1) {
              const target = findBySlotKey(obj, key);
              target?.traverse((child) => excluded.add(child));
            }
          }
          this.assignMaterial(obj, inst, excluded);
        }
      }
      // 槽位级引用：该子网格单独挂共享实例
      if (vis.slots) {
        const obj = se.getObject(id);
        if (obj) {
          for (const [slotKey, slot] of Object.entries(vis.slots)) {
            const inst = slot?.libraryRef ? this.instances.get(slot.libraryRef) : null;
            if (!inst) {
              continue;
            }
            const target = findBySlotKey(obj, slotKey);
            if (target) {
              (target as THREE.Mesh).material = inst;
            }
          }
        }
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

  private assignMaterial(obj: THREE.Object3D, mat: THREE.Material, excluded = new Set<THREE.Object3D>()): void {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !excluded.has(mesh) && mesh.material !== mat) {
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
