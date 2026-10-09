/**
 * SceneEngine — 场景图管理（v3 key:Array 分组存储 + 节点生命周期）
 *
 * 职责边界：
 * - 持有 THREE.Scene 实例与 id→{Object3D, node, type} 索引（3d-templete buildNodeIndex 模式）
 * - 分组字典存储：type = 分组 key（节点无 type 字段），分组名即业务类型
 * - upsert 幂等：存在（transform/params 视为同一物体）即原地 update，不存在才 create
 * - remove 先行（含子树级联）；params 整块替换（不做深合并，后端语义简单可预测）
 * 不负责：渲染（RenderLoop）、加载（AssetEngine）、交互（RaycastEngine）
 */
import * as THREE from 'three';
import type { SceneData, SceneNode, TreeSceneFragment, UpdateStats, Vec3 } from '../types';
import { RESERVED_KEYS } from '../types';
import { applyVisualOverride, type VisualOverride } from '../materials';

/** 引擎内部节点记录（索引项） */
interface NodeEntry {
  obj: THREE.Object3D;
  node: SceneNode;
  type: string;
}

/** 从片段提取 type 分组（跳过保留 key 与非数组值） */
const extractGroups = (frag: TreeSceneFragment): Array<[string, SceneNode[]]> => {
  const groups: Array<[string, SceneNode[]]> = [];
  for (const [key, val] of Object.entries(frag)) {
    if (RESERVED_KEYS.has(key)) {
      continue;
    }
    if (Array.isArray(val)) {
      groups.push([key, val as SceneNode[]]);
    }
  }
  return groups;
};

export class SceneEngine {
  readonly scene: THREE.Scene;

  /** id → 引擎记录（唯一真相索引；分组字典不另存——序列化时按 type 聚合） */
  private entries = new Map<string, NodeEntry>();

  /** 物体创建工厂（handler 层注册，按 type 分发；type=分组 key） */
  private factories = new Map<string, (node: SceneNode) => THREE.Object3D | null>();

  /** 编辑器私有视觉层（id → override；serialize 进 __visuals，交付剥离） */
  private visuals = new Map<string, VisualOverride>();

  /** 节点生命周期钩子（编辑器视觉层重挂/级联通知用） */
  onNodeCreated: ((id: string) => void) | null = null;

  onNodeRemoved: ((id: string) => void) | null = null;

  constructor() {
    this.scene = new THREE.Scene();
  }

  /** 应用环境配置（背景/雾） */
  applyEnvironment(env: SceneData['scene']): void {
    if (env.background !== null && env.background !== undefined) {
      this.scene.background = new THREE.Color(env.background);
    } else {
      this.scene.background = null;
    }
    if (env.fog) {
      this.scene.fog = new THREE.Fog(
        new THREE.Color(env.fog.color),
        env.fog.near,
        env.fog.far,
      );
    } else {
      this.scene.fog = null;
    }
  }

  /** 注册 type → 工厂（handler 层在启动时调用） */
  registerFactory(type: string, factory: (node: SceneNode) => THREE.Object3D | null): void {
    this.factories.set(type, factory);
  }

  /** 工厂是否已注册（更新 vs 创建的判定依赖它） */
  hasFactory(type: string): boolean {
    return this.factories.has(type);
  }

  // ---- 查询 ----

  /** 按 id 查 three.js 对象 */
  getObject(id: string): THREE.Object3D | null {
    return this.entries.get(id)?.obj ?? null;
  }

  /** 按 id 查节点数据（含 type 的运行时视图） */
  getNode(id: string): SceneNode | null {
    return this.entries.get(id)?.node ?? null;
  }

  /** 节点所属 type（= 分组 key） */
  getNodeType(id: string): string | null {
    return this.entries.get(id)?.type ?? null;
  }

  /** 物体是否参与拾取 */
  isPickable(id: string): boolean {
    return this.entries.has(id);
  }

  /** 全部已创建物体 id */
  getAllIds(): string[] {
    return [...this.entries.keys()];
  }

  /** 按 type 列出节点（v3：分组即类型） */
  getNodesWithType(type: string): SceneNode[] {
    return [...this.entries.values()].filter((e) => e.type === type).map((e) => e.node);
  }

  /** 当前全部 type 分组名 */
  getGroupNames(): string[] {
    return [...new Set([...this.entries.values()].map((e) => e.type))];
  }

  /** 从叶节点沿父链找最近的场景 id（拾取命中归属用） */
  resolveId(object: THREE.Object3D): string | null {
    let cur: THREE.Object3D | null = object;
    while (cur) {
      if (cur.name && this.entries.has(cur.name)) {
        return cur.name;
      }
      cur = cur.parent;
    }
    return null;
  }

  // ---- 生命周期 ----

  /** 应用编辑器视觉层（单物体） */
  applyVisual(id: string, visual: VisualOverride | null): void {
    const obj = this.entries.get(id)?.obj;
    if (!obj) {
      return;
    }
    if (visual === null) {
      this.visuals.delete(id);
      // 重挂工厂重建（视觉清除 = 回默认）
      const entry = this.entries.get(id);
      if (entry) {
        this.recreateNode(entry.type, { ...entry.node });
      }
      return;
    }
    this.visuals.set(id, { ...(this.visuals.get(id) ?? {}), ...visual });
    applyVisualOverride(obj, this.visuals.get(id));
  }

  /** 读编辑器视觉层 */
  getVisual(id: string): VisualOverride | null {
    return this.visuals.get(id) ?? null;
  }

  /** 全部视觉层（serialize 进 __visuals） */
  getAllVisuals(): Record<string, VisualOverride> {
    const out: Record<string, VisualOverride> = {};
    this.visuals.forEach((v, id) => {
      out[id] = v;
    });
    return out;
  }

  /** 单节点创建（工厂分发 + 挂树 + 视觉层重挂） */
  private createNode(type: string, node: SceneNode): THREE.Object3D | null {
    const factory = this.factories.get(type);
    if (!factory) {
      console.warn(`[SceneEngine] 未注册的物体类型: ${type}（id=${node.id}），跳过`);
      return null;
    }
    const obj = factory(node);
    if (!obj) {
      return null;
    }
    obj.name = node.id;
    this.attachObject(type, node, obj);
    return obj;
  }

  /** 挂到父节点（或场景根）并登记索引 */
  private attachObject(type: string, node: SceneNode, obj: THREE.Object3D): void {
    const parentId = node.parentId ?? null;
    const parent = parentId ? this.entries.get(parentId)?.obj : undefined;
    if (parentId && !parent) {
      console.warn(`[SceneEngine] 父节点不存在: ${parentId}（id=${node.id}），挂到场景根`);
    }
    (parent ?? this.scene).add(obj);
    this.entries.set(node.id, { obj, node: { ...node, parentId }, type });
    this.onNodeCreated?.(node.id);
  }

  /** 重建节点（视觉清除/结构性变化时：同 id 同 type 重建实例） */
  private recreateNode(type: string, node: SceneNode): void {
    const old = this.entries.get(node.id);
    if (old) {
      old.obj.removeFromParent();
      this.entries.delete(node.id);
      this.onNodeRemoved?.(node.id);
    }
    const obj = this.createNode(type, node);
    if (obj) {
      this.onNodeCreated?.(node.id);
    }
  }

  /** 全量建树（初始化时一次），按 parentId 依赖序排布创建 */
  buildTree(groups: Array<[string, SceneNode[]]>): void {
    const byId = new Map<string, { type: string; node: SceneNode }>();
    for (const [type, nodes] of groups) {
      for (const node of nodes) {
        byId.set(node.id, { type, node });
      }
    }
    const created = new Set<string>();
    const createWithParents = (type: string, node: SceneNode): void => {
      if (created.has(node.id)) {
        return;
      }
      created.add(node.id);
      const parentId = node.parentId ?? null;
      if (parentId) {
        const parentEntry = byId.get(parentId);
        if (parentEntry && !this.entries.has(parentId)) {
          createWithParents(parentEntry.type, parentEntry.node);
        }
      }
      this.createNode(type, { ...node, parentId });
    };
    for (const [type, nodes] of groups) {
      for (const node of nodes) {
        if (!created.has(node.id)) {
          createWithParents(type, node);
        }
      }
    }
  }

  /**
   * 增量更新（v3 统一语义，3d-templete updateTreeScene 移植）：
   * 1. remove 先行（含子树级联）
   * 2. 每分组每节点：存在且同 type → 原地 update（transform/params/card，不重建实例）
   *                  存在但类型不同 → 重建
   *                  不存在 → create
   * 3. params 整块替换；__visuals 应用编辑器视觉层
   */
  applyFragment(frag: TreeSceneFragment): UpdateStats {
    const stats: UpdateStats = { created: [], updated: [], removed: [] };

    // 1. remove 先行
    if (frag.remove?.length) {
      for (const id of frag.remove) {
        stats.removed.push(...this.removeObject(id));
      }
    }

    // 2. 分组 upsert（幂等：存在即 update）
    for (const [type, nodes] of extractGroups(frag)) {
      for (const incoming of nodes) {
        if (!incoming || typeof incoming !== 'object' || !incoming.id) {
          continue;
        }
        const existing = this.entries.get(incoming.id);
        if (existing && existing.type === type) {
          this.updateNodeInPlace(existing, incoming);
          stats.updated.push(incoming.id);
        } else if (existing) {
          this.recreateNode(type, incoming);
          stats.updated.push(incoming.id);
        } else {
          const obj = this.createNode(type, incoming);
          if (obj) {
            stats.created.push(incoming.id);
          }
        }
      }
    }

    // 3. 编辑器视觉层
    if (frag.__visuals) {
      for (const [id, visual] of Object.entries(frag.__visuals)) {
        this.applyVisual(id, visual);
      }
    }

    return stats;
  }

  /**
   * 原地更新（不重建实例）：transform / params 整块替换 / card / 父子关系。
   * updateObject 语义（Spec §4.2 core API：同格式片段幂等 upsert，不重建场景）。
   */
  private updateNodeInPlace(entry: NodeEntry, incoming: SceneNode): void {
    const { obj } = entry;
    // parentId 变化：重新挂树
    const newParentId = incoming.parentId ?? null;
    if ((entry.node.parentId ?? null) !== newParentId) {
      const parent = newParentId ? this.entries.get(newParentId)?.obj : undefined;
      if (newParentId && !parent) {
        console.warn(`[SceneEngine] 更新时父节点不存在: ${newParentId}（id=${entry.node.id}），保持原父`);
      } else {
        (parent ?? this.scene).add(obj);
      }
    }
    // transform（显式字段，引擎消费）
    if (incoming.position !== undefined) {
      obj.position.set(...(incoming.position as Vec3));
    }
    if (incoming.rotation !== undefined) {
      obj.rotation.set(...(incoming.rotation as Vec3));
    }
    if (incoming.scale !== undefined) {
      const s = incoming.scale;
      if (typeof s === 'number') {
        obj.scale.setScalar(s);
      } else {
        obj.scale.set(...(s as Vec3));
      }
    }
    // card / params 整块替换（更新不 diff：有数据就走）
    entry.node = {
      id: entry.node.id,
      parentId: newParentId,
      position: incoming.position ?? entry.node.position,
      rotation: incoming.rotation ?? entry.node.rotation,
      scale: incoming.scale ?? entry.node.scale,
      card: incoming.card ?? undefined,
      params: incoming.params ?? undefined,
    };
  }

  /** 删除物体（含子树级联），返回全部被删 id */
  removeObject(id: string): string[] {
    const entry = this.entries.get(id);
    if (!entry) {
      return [];
    }
    // 子树级联：所有 parentId 链指向 id 的后代
    const toRemove = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      this.entries.forEach((e, eid) => {
        const pid = e.node.parentId ?? null;
        if (pid && toRemove.has(pid) && !toRemove.has(eid)) {
          toRemove.add(eid);
          grew = true;
        }
      });
    }
    const removed: string[] = [];
    toRemove.forEach((eid) => {
      const target = this.entries.get(eid);
      if (target) {
        target.obj.removeFromParent();
        this.entries.delete(eid);
        this.visuals.delete(eid);
        this.onNodeRemoved?.(eid);
        removed.push(eid);
      }
    });
    return removed;
  }

  /** dispose：清空场景（GPU 资源由 AssetEngine/RendererEngine 各自释放） */
  dispose(): void {
    this.scene.clear();
    this.entries.clear();
    this.visuals.clear();
  }
}
