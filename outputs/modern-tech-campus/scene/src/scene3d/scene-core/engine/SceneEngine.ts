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
import type {
  FactoryContext, LegacyFactory, MaterialLibEntry, MeshSpecEntry, ModelSpecReport,
  NodeFactoryDefinition, SceneData, SceneNode, TreeSceneFragment, UpdateStats, Vec3,
} from '../types';
import { RESERVED_KEYS, paramsEqual } from '../types';
import { applyVisualOverride, findBySlotKey, NON_MATERIAL_VISUAL_KEYS, unnamedChildIndex, type VisualOverride } from '../materials';
import { getResourceScope, acquireObjectResources, syncObjectResources } from '../resources';

/** 引擎内部节点记录（索引项） */
interface NodeEntry {
  obj: THREE.Object3D;
  node: SceneNode;
  type: string;
}

/** 工厂登记项：definition（typed create/update/dispose）或旧 function */
interface FactoryEntry {
  definition: NodeFactoryDefinition | null;
  legacy: LegacyFactory | null;
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

/** 剔除 undefined 字段（片段展开合并用——undefined 会覆盖原值，违反「缺的不动」） */
const stripUndefined = (o: object): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
};

/**
 * 节点实例的 GPU 资源释放统一在 ResourceScope.disposeResource（resources.ts）：
 * 整树遍历 + isClone 跳过守卫 + geometry/material dispose。SceneEngine 不再
 * 保留第二条释放路径（P3-R3：双 dispose 消除）。
 */

export class SceneEngine {
  readonly scene: THREE.Scene;

  /** id → 引擎记录（唯一真相索引；分组字典不另存——序列化时按 type 聚合） */
  private entries = new Map<string, NodeEntry>();

  /** 物体创建工厂（handler 层注册，按 type 分发；type=分组 key） */
  private factories = new Map<string, FactoryEntry>();

  /** 工厂上下文（definition 的 create/update/dispose 回调参数；registerFactory 时定型） */
  private factoryContext: FactoryContext | null = null;

  /** 编辑器私有视觉层（id → override；serialize 进 __visuals，交付剥离） */
  private visuals = new Map<string, VisualOverride>();

  /** 编辑器私有材质库（mat_id → 条目；serialize 进 __materialLib，交付剥离） */
  private materialLib = new Map<string, MaterialLibEntry>();

  /** 节点生命周期钩子（编辑器视觉层重挂/级联通知用） */
  onNodeCreated: ((id: string) => void) | null = null;

  onNodeRemoved: ((id: string) => void) | null = null;

  /** params 原地更新后触发（handler 重放状态视觉/动画参数用） */
  onNodeUpdated: ((id: string) => void) | null = null;

  /**
   * 多订阅生命周期事件（P1 Review R3 / 优化 Spec §4.2）：订阅互不覆盖，释放时
   * 退订干净。与旧单槽字段并存：直接赋值 onNodeRemoved 仍然有效（兼容旧 handler），
   * 本方法新增的订阅不会被后一次赋值清掉。
   * @returns 退订函数
   */
  subscribeNodeEvent(
    event: 'created' | 'removed' | 'updated',
    callback: (id: string) => void,
  ): () => void {
    const list = this.nodeEventSubs[event];
    list.push(callback);
    return () => {
      const i = list.indexOf(callback);
      if (i >= 0) {
        list.splice(i, 1);
      }
    };
  }

  private nodeEventSubs = {
    created: [] as Array<(id: string) => void>,
    removed: [] as Array<(id: string) => void>,
    updated: [] as Array<(id: string) => void>,
  };

  /** 触发生命周期（旧单槽 + 多订阅都走这里） */
  private emitNodeEvent(event: 'created' | 'removed' | 'updated', id: string): void {
    const single = event === 'created' ? this.onNodeCreated
      : event === 'removed' ? this.onNodeRemoved : this.onNodeUpdated;
    single?.(id);
    for (const cb of [...this.nodeEventSubs[event]]) {
      cb(id);
    }
  }

  /**
   * 外部触发的 updated 事件（P4-R1）：异步挂载完成（makeAssetNodeFactory）等
   * 非引擎内部路径需要通知 updated 订阅者（appearance-runtime 的库材质重挂）。
   * 与 emitNodeEvent('updated') 同语义，公开给 handlers 层。
   */
  emitExternalNodeUpdated(id: string): void {
    this.emitNodeEvent('updated', id);
  }

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

  /**
   * 设置工厂上下文（P3.1）：definition 工厂的 create/update/dispose 回调参数。
   * createScene 装配期在 profile 注册前调用；测试/独立使用可省略（defaultFactoryContext 兜底）。
   */
  registerFactoryContext(context: FactoryContext): void {
    this.factoryContext = context;
  }

  /**
   * 注册 type → 工厂（handler 层在启动时调用）。
   * 兼容两种形态（P3.1）：
   * - 旧 function：等价 { create: (node) => fn(node) }，无 update（params 变化走重建兜底）
   * - NodeFactoryDefinition：typed create/update/dispose 契约
   * @param context definition 形态需要（create/update/dispose 回调参数）；function 形态可缺省
   */
  registerFactory(
    type: string,
    factory: LegacyFactory | NodeFactoryDefinition,
    context?: FactoryContext,
  ): void {
    if (typeof factory === 'function') {
      this.factories.set(type, { definition: null, legacy: factory });
      return;
    }
    if (context) {
      this.factoryContext = context;
    }
    this.factories.set(type, { definition: factory, legacy: null });
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
   * 子网格槽位唯一性校验（V13）：同一父节点直接子级中同名 mesh（稳定 slotKey 冲突）。
   * 返回冲突的 slotKey 列表（空 = 通过）。生成侧新程序化模型用——命名纪律：
   * 同父层子 mesh 名必须唯一（跨父层允许同名，路径含父段自然区分）。
   */
  findDuplicateSlotKeys(nodeId: string): string[] {
    const entry = this.entries.get(nodeId);
    if (!entry) {
      return [];
    }
    const dupes: string[] = [];
    const walk = (parent: THREE.Object3D): void => {
      const names = new Map<string, number>();
      const unnamed = new Map<number, number>();
      for (const child of parent.children) {
        if (child.name) {
          const n = (names.get(child.name) ?? 0) + 1;
          names.set(child.name, n);
          if (n === 2) {
            dupes.push(child.name);
          }
        } else {
          const idx = Number(unnamedChildIndex(child).slice(1));
          const n = (unnamed.get(idx) ?? 0) + 1;
          unnamed.set(idx, n);
        }
      }
      parent.children.forEach((child) => {
        if ((child as THREE.Mesh).isMesh || child.children.length > 0) {
          walk(child);
        }
      });
    };
    walk(entry.obj);
    return dupes;
  }

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

  /** 应用编辑器视觉层（单物体；增量合入——slots 逐槽合并，槽内字段覆盖） */
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
    const cur = this.visuals.get(id) ?? {};
    // 浅 merge 会整块替换 slots map（同物体其他槽位丢失）——slots 逐槽合并，
    // 槽内字段浅覆盖（编辑面板每次提交都带该槽完整意图字段）
    const merged = { ...cur, ...visual };
    if (visual.slots !== undefined || cur.slots !== undefined) {
      merged.slots = { ...(cur.slots ?? {}) };
      for (const [key, slotInc] of Object.entries(visual.slots ?? {})) {
        merged.slots[key] = { ...merged.slots[key], ...slotInc };
      }
    }
    // 纯开关增量（不含任何材质字段）不重放材质——避免材质已编辑物体的显隐/锁定
    // 操作反复克隆材质（旧 clone 不释放）+ 贴图异步重赋。
    // slots 增量（槽位换材质/隐藏）必须走 full——槽位命中在 applyVisualOverride 内部定位
    const hasMaterialField = visual.materialType !== undefined
      || visual.slots !== undefined
      || Object.entries(visual).some(([k, v]) => v !== undefined && !NON_MATERIAL_VISUAL_KEYS.has(k));
    this.visuals.set(id, merged);
    applyVisualOverride(obj, merged, hasMaterialField ? 'full' : 'switches');
    // P3-RRR1：材质路径会 clone/替换 mesh.material——资源集对账（新材质登记、
    // 被替换旧独占材质解除；开关路径不改资源集，跳过省一次遍历）
    if (hasMaterialField) {
      this.syncResourcesFor(id, obj);
    }
  }

  /**
   * 资源集对账（P3-RRRR1 节点边界）：本节点收集时跳过独立业务子节点子树
   * （其资源归各自登记——父重建/删除时子仍存活，不得随父释放）；父级编辑
   * 递归修改了子树内材质时（applyVisualOverride traverse 全树），对每个
   * 受影响子节点也做一次对账。异步挂载点（registry）也走本公共入口。
   */
  syncResourcesFor(id: string, obj: THREE.Object3D): void {
    const scope = getResourceScope(this);
    const isBusinessNode = (o: THREE.Object3D): boolean => this.entries.get(o.name)?.obj === o;
    const affected = syncObjectResources(scope, id, obj, isBusinessNode);
    // 受影响后代业务子节点：归属各自的登记同步（父编辑可能递归换了它们的材质）
    for (const childRoot of affected) {
      const childId = childRoot.name;
      if (childId && this.entries.has(childId)) {
        syncObjectResources(scope, childId, childRoot, isBusinessNode);
      }
    }
  }

  /** 覆盖式写入视觉层（整条替换，不合并）——材料库链接/断开需清理互斥字段时用 */
  replaceVisual(id: string, visual: VisualOverride): void {
    const obj = this.entries.get(id)?.obj;
    if (!obj) {
      return;
    }
    this.visuals.set(id, { ...visual });
    applyVisualOverride(obj, this.visuals.get(id));
    // P3-RRR1：整条替换可能切材质（libraryRef↔inline）——资源集对账
    this.syncResourcesFor(id, obj);
  }

  /**
   * 单节点视觉层 patch（P3.1 优化 Spec §4.2）：局部 merge 只影响目标节点，
   * 其他节点的视觉层不动。与 update({__visuals}) 的整表替换语义并存——
   * 复制（duplicateObject）/局部操作必须走本入口，禁止混用整表（F06）。
   */
  patchVisual(nodeId: string, patch: VisualOverride): void {
    this.applyVisual(nodeId, patch);
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
    const entry = this.factories.get(type);
    if (!entry) {
      console.warn(`[SceneEngine] 未注册的物体类型: ${type}（id=${node.id}），跳过`);
      return null;
    }
    const obj = entry.definition
      ? entry.definition.create(node, this.factoryContext ?? this.defaultFactoryContext())
      : entry.legacy!(node);
    if (!obj) {
      return null;
    }
    obj.name = node.id;
    // 资源登记（P3-RR1/RRRR1）：按实际资源粒度 exclusive 登记；recreate 时子节点
    // 实体先重挂到新实例（recreateNode），收集须跳过业务子节点子树（归各自登记）
    acquireObjectResources(
      getResourceScope(this), node.id, obj,
      (o) => o !== obj && this.entries.get(o.name)?.obj === o,
    );
    this.attachObject(type, node, obj);
    return obj;
  }

  /** definition 回调上下文兜底（未显式传入时按引擎自身构造） */
  private defaultFactoryContext(): FactoryContext {
    if (!this.factoryContext) {
      // 弱依赖循环导入规避：edit 侧装配时总会传入；独立使用（测试）给最小面
      this.factoryContext = {
        sceneEngine: this,
        assetEngine: null as unknown as FactoryContext['assetEngine'],
        renderLoop: null as unknown as FactoryContext['renderLoop'],
      };
    }
    return this.factoryContext;
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
    this.emitNodeEvent('created', node.id);
  }

  /**
   * 重建节点（视觉清除/结构性变化时：同 id 重建实例）。子节点实体重挂到新实例下，不留孤儿。
   * P3-R2：node 必须是**完整节点**（片段语义「缺的不动」已由调用方合成——
   * updateNodeInPlace 合并原 node 后才进来；applyFragment 的类型变化路径同样先合并）。
   * P3-R3：子节点实体先脱离旧树再释放旧实例——release/dispose 的整树遍历
   * 不得触及仍存活的子节点（其资源归子节点自己的登记，随父重建保留）。
   */
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
    // P3-R3：先脱离——子节点实体从旧树解挂后再释放旧实例，dispose 遍历不再命中它们
    childObjs.forEach((child) => {
      child.removeFromParent();
    });
    old.obj.removeFromParent();
    this.entries.delete(node.id);
    this.emitNodeEvent('removed', node.id);
    // 旧实例资源结算（P3-R3：唯一释放路径 = ResourceScope.release；definition.dispose
    // 先跑工厂私有清理；disposeInstance 已由 scope 的 disposeResource 等价覆盖，不再双调）
    this.disposeFactoryObject(type, old.obj);
    getResourceScope(this).release(node.id);
    const obj = this.createNode(type, node);
    if (obj) {
      childObjs.forEach((child) => {
        obj.add(child);
      });
    }
  }

  /** definition.dispose 回调（factory 持有的闭包表/帧回调等非 GPU 资源） */
  private disposeFactoryObject(type: string, obj: THREE.Object3D): void {
    this.factories.get(type)?.definition?.dispose?.(obj, this.factoryContext ?? this.defaultFactoryContext());
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
    const stats: UpdateStats = { created: [], updated: [], removed: [], rebuilt: [] };

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
        const verdict = this.updateNodeInPlace(this.entries.get(incoming.id)!, incoming);
        if (verdict === 'rebuild') {
          stats.rebuilt.push(incoming.id);
        } else {
          stats.updated.push(incoming.id);
        }
      } else if (this.entries.has(incoming.id)) {
        // P3-R2：类型变化重建——同样先合成完整节点（片段未提交字段沿用原值）
        const cur = this.entries.get(incoming.id)!.node;
        this.recreateNode(item.type, { ...cur, ...stripUndefined(incoming) });
        stats.rebuilt.push(incoming.id);
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
   *
   * params 变化走 factory 契约（P3.1）：
   * - JSON 值相同（键序无关）→ 不重放不重建（幂等）
   * - definition.update 存在 → 调用；'updated' 保实例，'rebuild' 局部重建
   * - 旧 function / 无 update → 局部重建兜底（不再是静默只存数据）
   * transform 永远引擎处理（update 契约不收 transform），保实例身份。
   *
   * P3-R1：previous 是调用前完整节点的**深快照**（修改索引前拍），next 是
   * 合并后的完整节点——definition.update 拿到的是真实前后值，不是已覆盖的索引。
   * P3-R2：rebuild 路径喂**合成完整节点**（片段未提交字段沿用原值），
   * transform/card/父链不因片段只带 params 而丢失。
   * @returns 'updated'（原地，含无变化）| 'rebuild'（触发了局部重建）
   */
  private updateNodeInPlace(entry: NodeEntry, incoming: SceneNode): 'updated' | 'rebuild' {
    const { obj } = entry;

    // P3-R1：进入即拍旧节点快照（结构化拷贝——后续所有索引写入都不污染 previous）
    const previous: SceneNode = {
      ...entry.node,
      params: entry.node.params === undefined ? undefined : { ...entry.node.params },
      card: entry.node.card === undefined ? undefined : { ...entry.node.card },
    };

    // 合成完整 next（P3-R2：「缺的不动」——片段未给的字段沿用当前值）。
    // card:null 是 Bridge 快照恢复的显式清除哨兵 → 归一为 undefined（无卡片）
    const next: SceneNode = { ...entry.node, ...stripUndefined(incoming) };
    if (incoming.card === null) {
      next.card = undefined;
    }
    next.params = incoming.params !== undefined ? incoming.params : entry.node.params;
    next.card = incoming.card !== undefined ? next.card : entry.node.card;

    // parentId：undefined = 不动；显式 null = 解挂到场景根
    if (next.parentId !== undefined) {
      const newParentId = next.parentId ?? null;
      if ((previous.parentId ?? null) !== newParentId) {
        const parent = newParentId ? this.entries.get(newParentId)?.obj : undefined;
        if (newParentId && !parent) {
          console.warn(`[SceneEngine] 更新时父节点不存在: ${newParentId}（id=${entry.node.id}），保持原父`);
          next.parentId = previous.parentId ?? null;
        } else {
          (parent ?? this.scene).add(obj);
        }
      }
    }
    // transform（显式字段，引擎消费——任何 factory 契约都不处理 transform）
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

    // params 值比较（previous vs next——都已是完整语义值）
    const changed = !paramsEqual(previous.params, next.params);

    // 索引整体换新（P3-R2：entry.node = 完整合成节点——片段不丢字段）
    entry.node = next;

    if (!changed || incoming.params === undefined) {
      return 'updated';
    }

    const factory = this.factories.get(entry.type);
    if (factory?.definition?.update) {
      const verdict = factory.definition.update(
        obj, next, previous, this.factoryContext ?? this.defaultFactoryContext(),
      );
      if (verdict === 'rebuild') {
        // 结构参数：局部重建（next 已是完整节点——保 transform/card/父链；
        // 子节点重挂/视觉层重挂由 recreateNode 处理）
        this.recreateNode(entry.type, next);
        this.emitNodeEvent('updated', next.id);
        return 'rebuild';
      }
      // P3-RRR1：definition.update 原地路径可能替换材质/几何——资源集对账
      // （RRRR1：经 syncResourcesFor 带节点边界与受影响子节点同步）
      this.syncResourcesFor(next.id, obj);
      const edited = this.getVisual(next.id);
      if (edited) {
        // Business defaults run first, explicit editor overrides remain authoritative.
        // Track intermediate handler materials before replay so replaced clones are released.
        applyVisualOverride(obj, edited);
      }
      this.emitNodeEvent('updated', next.id);
      this.syncResourcesFor(next.id, obj);
      return 'updated';
    }
    // 旧 function / definition 无 update：局部重建兜底（视觉层与子节点重挂由 recreateNode 处理）
    this.recreateNode(entry.type, next);
    this.emitNodeEvent('updated', next.id);
    return 'rebuild';
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
    // P3-R3：先整体摘树（父子都 removeFromParent + 清 entries），再统一释放——
    // 顺序释放会让父的整树遍历命中尚未摘下的子 mesh（双 dispose）
    const targets: Array<{ eid: string; type: string; obj: THREE.Object3D }> = [];
    toRemove.forEach((eid) => {
      const target = this.entries.get(eid);
      if (target) {
        this.disposeFactoryObject(target.type, target.obj);
        targets.push({ eid, type: target.type, obj: target.obj });
        target.obj.removeFromParent();
        this.entries.delete(eid);
        this.visuals.delete(eid);
        this.emitNodeEvent('removed', eid);
        removed.push(eid);
      }
    });
    const scope = getResourceScope(this);
    targets.forEach(({ eid }) => {
      scope.release(eid);
    });
    return removed;
  }

  /** dispose：清空场景（GPU 资源由 AssetEngine/RendererEngine 各自释放） */
  dispose(): void {
    // P3.4：业务 handler 注册的退订句柄（帧回调/订阅）统一回收
    const engineAny = this as unknown as { __handlerTeardowns?: Array<() => void> };
    engineAny.__handlerTeardowns?.forEach((off) => off());
    engineAny.__handlerTeardowns = [];
    // P3.2：资源域兜底释放（factory 独立资源 + teardown 句柄）。
    // AssetEngine.dispose 负责缓存根；这里释放登记的 exclusive/shared 资源
    this.entries.forEach((entry) => {
      this.disposeFactoryObject(entry.type, entry.obj);
    });
    getResourceScope(this).releaseAll();
    this.scene.clear();
    this.entries.clear();
    this.visuals.clear();
    this.materialLib.clear();
  }
}
