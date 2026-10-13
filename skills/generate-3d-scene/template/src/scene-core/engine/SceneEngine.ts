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
import type { MeshSpecEntry, ModelSpecReport, SceneData, SceneNode, TreeSceneFragment, UpdateStats, Vec3, MaterialLibEntry } from '../types';
import { RESERVED_KEYS } from '../types';
import { applyVisualOverride, findBySlotKey, NON_MATERIAL_VISUAL_KEYS, unnamedChildIndex, type VisualOverride } from '../materials';

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

/**
 * 释放节点实例的非共享 GPU 资源。GLB 实例是缓存根的 clone（geometry/material
 * 与源共享，AssetEngine.dispose 统一释放）——按 userData.isClone 标记跳过；
 * handler 每节点新建的独立 geometry/material 在此释放（编辑器反复增删不漏）。
 */
const disposeInstance = (root: THREE.Object3D): void => {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    if ((mesh.userData as { isClone?: boolean }).isClone) {
      return;
    }
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      m?.dispose();
    });
  });
};

export class SceneEngine {
  readonly scene: THREE.Scene;

  /** id → 引擎记录（唯一真相索引；分组字典不另存——序列化时按 type 聚合） */
  private entries = new Map<string, NodeEntry>();

  /** 物体创建工厂（handler 层注册，按 type 分发；type=分组 key） */
  private factories = new Map<string, (node: SceneNode) => THREE.Object3D | null>();

  /** 编辑器私有视觉层（id → override；serialize 进 __visuals，交付剥离） */
  private visuals = new Map<string, VisualOverride>();

  /** 编辑器私有材质库（mat_id → 条目；serialize 进 __materialLib，交付剥离） */
  private materialLib = new Map<string, MaterialLibEntry>();

  /** 节点生命周期钩子（编辑器视觉层重挂/级联通知用） */
  onNodeCreated: ((id: string) => void) | null = null;

  onNodeRemoved: ((id: string) => void) | null = null;

  /** params 原地更新后触发（handler 重放状态视觉/动画参数用） */
  onNodeUpdated: ((id: string) => void) | null = null;

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

  /**
   * 子网格清单：逐 mesh { key, name, triangles, materialType }。
   * 双数据源——资产报告优先（GLB 加载时预解析，无需重新遍历）；报告缺失时
   * 遍历活实例（代码组合模型：handler 工厂产物无 assetId/报告，但结构自描述）。
   * 两条路径的 key 口径一致：从场景节点自身起算的名称路径（未命名节点 #索引兜底），
   * 与 resolveSubMesh 的 slotKey 互查互通。
   */
  listSubMeshes(nodeId: string): MeshSpecEntry[] {
    const entry = this.entries.get(nodeId);
    if (!entry) {
      return [];
    }
    const assetId = entry.node.params?.assetId;
    if (typeof assetId === 'string' && this.assetReportProvider) {
      const report = this.assetReportProvider(assetId);
      if (report) {
        return report.meshes;
      }
    }
    return this.collectInstanceMeshes(entry.obj);
  }

  /**
   * 遍历活实例收集 mesh 清单（代码组合模型回退路径）。
   * GLB 实例也无害：结构一致时与资产报告同结果。
   * 工厂 Group 外壳自身若挂 mesh（当前无此形态）会计入——保持
   * "从场景节点起算"口径与 resolveSubMesh 一致，剥壳逻辑不在数据层做。
   */
  private collectInstanceMeshes(root: THREE.Object3D): MeshSpecEntry[] {
    const out: MeshSpecEntry[] = [];
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) {
        return;
      }
      const geo = mesh.geometry;
      const tris = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const keyOf = (node: THREE.Object3D): string => {
        const parts: string[] = [];
        let cur: THREE.Object3D | null = node;
        while (cur && cur !== root) {
          parts.unshift(cur.name || unnamedChildIndex(cur));
          cur = cur.parent;
        }
        return parts.join('/');
      };
      const key = keyOf(child);
      const lastName = key.split('/').pop();
      out.push({
        key,
        name: lastName ?? '',
        triangles: Math.round(tris),
        materialType: mat ? mat.type : 'unknown',
      });
    });
    return out;
  }

  /**
   * 拾取定位子网格：视口点中的 mesh → { 场景节点 id, 槽位 key }；非 GLB 内部命中返回 null。
   * 槽位 key 与 buildReport.collectMeshes 对齐：从**场景节点自身**起算的名称路径
   * （工厂的 Group 外壳与 GLB 根名如 'Scene' 不计入——与 listSubMeshes 的 key 可互查）。
   */
  resolveSubMesh(object: THREE.Object3D): { id: string; slotKey: string } | null {
    const entryObj = this.entries.get(this.resolveId(object) ?? '')?.obj;
    if (!entryObj) {
      return null;
    }
    // 从命中 mesh 沿父链到场景节点，收集名称路径（无名节点 #N=父级无名子序，与
    // findBySlotKey/collectInstanceMeshes 统一口径）
    const parts: string[] = [];
    let cur: THREE.Object3D | null = object;
    while (cur && cur !== entryObj) {
      parts.unshift(cur.name || unnamedChildIndex(cur));
      cur = cur.parent;
    }
    if (parts.length === 0 || cur !== entryObj) {
      return null;
    }
    // 视觉层槽位 key 是「GLB 内部根（如 Armature）起算」——若链上首段是 GLB 根壳
    // （工厂 Group 里的 gltf.scene，名字通常 'Scene'），剥掉它对齐 buildReport 口径
    const id = this.resolveId(object) ?? '';
    let slotKey = parts.join('/');
    if (parts.length > 1) {
      const inner = entryObj.children.find((c) => c.name === parts[0]);
      // parts[0] 是 gltf.scene（容器，无 mesh）时：从 report 的 key 形态对齐——
      // buildReport 从 gltf.scene 起算但**不包含它**，故剥掉首段容器
      if (inner && !(inner as THREE.Mesh).isMesh) {
        slotKey = parts.slice(1).join('/');
      }
    }
    if (!slotKey) {
      return null;
    }
    return { id, slotKey };
  }

  /** 资产报告提供者（createScene 装配时注入 AssetEngine.getReport） */
  assetReportProvider: ((assetId: string) => ModelSpecReport | null) | null = null;

  /**
   * 蒙皮感知包围盒（静态/蒙皮统一入口）。
   * SkinnedMesh 的 geometry 盒是 bind-pose（未蒙皮），Box3.setFromObject 的 coarse
   * 口径读不到真实渲染形状——蒙皮网格先 computeBoundingBox()（蒙皮采样）再乘
   * matrixWorld；无蒙皮网格回退 precise 口径 setFromObject(obj, true)。
   */
  getSkinnedAwareBox(obj: THREE.Object3D): THREE.Box3 {
    const box = new THREE.Box3();
    let hasSkinned = false;
    const v = new THREE.Vector3();
    obj.traverse((child) => {
      const sk = child as THREE.SkinnedMesh;
      if (!sk.isSkinnedMesh) {
        return;
      }
      hasSkinned = true;
      sk.computeBoundingBox();
      if (!sk.boundingBox) {
        return;
      }
      const attr = sk.geometry.attributes.position;
      if (!attr) {
        return;
      }
      const step = Math.max(1, Math.floor(attr.count / 256));
      for (let i = 0; i < attr.count; i += step) {
        sk.getVertexPosition(i, v);
        sk.localToWorld(v);
        box.expandByPoint(v);
      }
    });
    if (hasSkinned) {
      return box;
    }
    return new THREE.Box3().setFromObject(obj, true);
  }

  /**
   * 子网格信息（编辑器选中槽位时面板显示）：按槽位 key 定位 mesh，
   * 返回局部 transform（相对模型节点）+ 该 mesh 自己的世界包围盒 + 材质概要。
   * 未命中返回 null（模型重导出改名等场景）。
   */
  getSubMeshInfo(nodeId: string, slotKey: string): {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
    bboxMin: Vec3;
    bboxMax: Vec3;
    materialType: string;
    color: string | null;
  } | null {
    const entry = this.entries.get(nodeId);
    if (!entry) {
      return null;
    }
    const target = findBySlotKey(entry.obj, slotKey) as THREE.Mesh | null;
    if (!target || !target.isMesh) {
      return null;
    }
    // 蒙皮网格的 geometry 盒是 bind-pose——蒙皮感知口径（采样盒 × 世界矩阵）
    let box: THREE.Box3;
    if ((target as THREE.SkinnedMesh).isSkinnedMesh) {
      const sk = target as THREE.SkinnedMesh;
      const v = new THREE.Vector3();
      const attr = sk.geometry.attributes.position;
      if (!attr) {
        return null;
      }
      const step = Math.max(1, Math.floor(attr.count / 256));
      box = new THREE.Box3();
      for (let i = 0; i < attr.count; i += step) {
        sk.getVertexPosition(i, v);
        sk.localToWorld(v);
        box.expandByPoint(v);
      }
    } else {
      box = new THREE.Box3().setFromObject(target);
    }
    const mat = Array.isArray(target.material) ? target.material[0] : target.material;
    const std = mat as THREE.MeshStandardMaterial | undefined;
    return {
      position: [target.position.x, target.position.y, target.position.z],
      rotation: [target.rotation.x, target.rotation.y, target.rotation.z],
      scale: [target.scale.x, target.scale.y, target.scale.z],
      bboxMin: [box.min.x, box.min.y, box.min.z],
      bboxMax: [box.max.x, box.max.y, box.max.z],
      materialType: mat ? mat.type : 'unknown',
      color: std?.color ? `#${std.color.getHexString()}` : null,
    };
  }

  // ---- 生命周期 ----

  /** 应用编辑器视觉层（单物体；增量合入） */
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
    const merged = { ...(this.visuals.get(id) ?? {}), ...visual };
    // 纯开关增量（不含任何材质字段）不重放材质——避免材质已编辑物体的显隐/锁定
    // 操作反复克隆材质（旧 clone 不释放）+ 贴图异步重赋。
    // slots 增量（槽位换材质/隐藏）必须走 full——槽位命中在 applyVisualOverride 内部定位
    const hasMaterialField = visual.materialType !== undefined
      || visual.slots !== undefined
      || Object.entries(visual).some(([k, v]) => v !== undefined && !NON_MATERIAL_VISUAL_KEYS.has(k));
    this.visuals.set(id, merged);
    applyVisualOverride(obj, merged, hasMaterialField ? 'full' : 'switches');
  }

  /** 覆盖式写入视觉层（整条替换，不合并）——材料库链接/断开需清理互斥字段时用 */
  replaceVisual(id: string, visual: VisualOverride): void {
    const obj = this.entries.get(id)?.obj;
    if (!obj) {
      return;
    }
    this.visuals.set(id, { ...visual });
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

  // ---- 材质库（编辑器私有；对称 __visuals） ----

  /** 写入/覆盖库条目（整条替换，拷贝隔离） */
  setMaterialLibEntry(id: string, entry: MaterialLibEntry): void {
    this.materialLib.set(id, { name: entry.name, spec: { ...entry.spec } });
  }

  /** 读库条目 */
  getMaterialLibEntry(id: string): MaterialLibEntry | null {
    return this.materialLib.get(id) ?? null;
  }

  /** 全部库条目（serialize 进 __materialLib） */
  getAllMaterialLib(): Record<string, MaterialLibEntry> {
    const out: Record<string, MaterialLibEntry> = {};
    this.materialLib.forEach((v, id) => {
      out[id] = v;
    });
    return out;
  }

  /** 删除库条目 */
  removeMaterialLibEntry(id: string): void {
    this.materialLib.delete(id);
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

  /** 重建节点（视觉清除/结构性变化时：同 id 重建实例）。子节点实体重挂到新实例下，不留孤儿 */
  private recreateNode(type: string, node: SceneNode): void {
    const old = this.entries.get(node.id);
    if (!old) {
      this.createNode(type, node);
      return;
    }
    // 收集以旧实例为 3D 父的子节点实体（跨分组组树的挂载目标要跟着换）
    const childObjs: THREE.Object3D[] = [];
    this.entries.forEach((e) => {
      if (e.node.parentId === node.id && e.obj.parent === old.obj) {
        childObjs.push(e.obj);
      }
    });
    old.obj.removeFromParent();
    this.entries.delete(node.id);
    this.onNodeRemoved?.(node.id);
    const obj = this.createNode(type, node);
    if (obj) {
      childObjs.forEach((child) => {
        obj.add(child);
      });
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

    // 2. 分组 upsert（幂等：存在即 update）。
    // 父先建：片段内 child 先于 parent 出现（或跨分组组树）时，先建/更新父再挂子，
    // 否则 child 命中"父不存在"挂到场景根且永不再挂（undo rebuild 每次都会踩）。
    const pending = new Map<string, { type: string; node: SceneNode }>();
    for (const [type, nodes] of extractGroups(frag)) {
      for (const incoming of nodes) {
        if (!incoming || typeof incoming !== 'object' || !incoming.id) {
          continue;
        }
        pending.set(incoming.id, { type, node: incoming });
      }
    }
    // 访问中集合：parentId 环（a↔b 等脏数据）不再递归，跳过外层重访
    const visiting = new Set<string>();
    const visit = (item: { type: string; node: SceneNode }): void => {
      const incoming = item.node;
      const parentId = incoming.parentId ?? null;
      if (parentId && pending.has(parentId) && !this.entries.has(parentId) && !visiting.has(parentId)) {
        visiting.add(parentId);
        visit(pending.get(parentId)!);
      }
      if (this.entries.get(incoming.id)?.type === item.type) {
        this.updateNodeInPlace(this.entries.get(incoming.id)!, incoming);
        stats.updated.push(incoming.id);
      } else if (this.entries.has(incoming.id)) {
        this.recreateNode(item.type, incoming);
        stats.updated.push(incoming.id);
      } else if (this.createNode(item.type, incoming)) {
        stats.created.push(incoming.id);
      }
    };
    for (const item of pending.values()) {
      visiting.clear();
      visit(item);
    }

    // 3. 编辑器视觉层（提供即整表替换：undo/redo 快照为全集，快照里没有的 id
    //    必须清除引擎里的视觉层——否则撤销"改色"后颜色残留，视觉编辑全部不可回滚）
    if (frag.__visuals !== undefined) {
      const incoming = new Set(Object.keys(frag.__visuals));
      for (const id of [...this.visuals.keys()]) {
        if (!incoming.has(id)) {
          this.applyVisual(id, null);
        }
      }
      for (const [id, visual] of Object.entries(frag.__visuals)) {
        this.applyVisual(id, visual);
      }
    }

    // 4. 编辑器材质库（提供即整表替换：条目与节点无生命周期耦合，undo 快照为全集）
    if (frag.__materialLib !== undefined) {
      this.materialLib.clear();
      for (const [id, entry] of Object.entries(frag.__materialLib)) {
        this.setMaterialLibEntry(id, entry);
      }
    }

    return stats;
  }

  /**
   * 原地更新（不重建实例）：transform / params / card / 父子关系。
   * 契约（types.ts TreeSceneFragment）：节点字段全部可选，**缺的不动**——
   * 编辑器片段（Gizmo/对齐只发 transform）不得抹掉业务 params/card。
   * params/card 显式给值才替换（整块替换语义只对「给了数据」生效）。
   */
  private updateNodeInPlace(entry: NodeEntry, incoming: SceneNode): void {
    const { obj } = entry;
    // parentId：undefined = 不动；显式 null = 解挂到场景根
    if (incoming.parentId !== undefined) {
      const newParentId = incoming.parentId ?? null;
      if ((entry.node.parentId ?? null) !== newParentId) {
        const parent = newParentId ? this.entries.get(newParentId)?.obj : undefined;
        if (newParentId && !parent) {
          console.warn(`[SceneEngine] 更新时父节点不存在: ${newParentId}（id=${entry.node.id}），保持原父`);
        } else {
          (parent ?? this.scene).add(obj);
        }
        entry.node.parentId = newParentId;
      }
    }
    // transform（显式字段，引擎消费）
    if (incoming.position !== undefined) {
      obj.position.set(...(incoming.position as Vec3));
      entry.node.position = incoming.position;
    }
    if (incoming.rotation !== undefined) {
      obj.rotation.set(...(incoming.rotation as Vec3));
      entry.node.rotation = incoming.rotation;
    }
    if (incoming.scale !== undefined) {
      const s = incoming.scale;
      if (typeof s === 'number') {
        obj.scale.setScalar(s);
      } else {
        obj.scale.set(...(s as Vec3));
      }
      entry.node.scale = s;
    }
    // card / params：给了才整块替换（undefined = 不动；显式值 = 替换）
    if (incoming.card !== undefined) {
      entry.node.card = incoming.card;
    }
    if (incoming.params !== undefined) {
      entry.node.params = incoming.params;
      this.onNodeUpdated?.(incoming.id);
    }
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
        disposeInstance(target.obj);
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
    this.materialLib.clear();
  }
}
