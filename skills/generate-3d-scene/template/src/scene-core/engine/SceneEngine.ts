/**
 * SceneEngine — 场景图管理（物体树的生命周期：建/查/增/删/改）
 *
 * 职责边界：
 * - 持有 THREE.Scene 实例与 id → Object3D 索引
 * - objects 扁平数组 + parentId 组树，按依赖序（父先子后）创建
 * - 增量更新（upsert/remove/patch）不重建场景
 * 不负责：渲染（RenderLoop）、加载（AssetEngine）、交互（RaycastEngine）
 */
import * as THREE from 'three';
import type { SceneDataJSON, SceneObjectNode, ScenePatch } from '../types';
import { applyMaterialOverride } from '../utils/material';

/** id → Object3D 的场景内索引 */
interface ObjectIndex {
  nodes: Map<string, THREE.Object3D>;
  defs: Map<string, SceneObjectNode>;
}

export class SceneEngine {
  readonly scene: THREE.Scene;

  private index: ObjectIndex = { nodes: new Map(), defs: new Map() };

  /** 物体 id → 分组类型（type 分发用） */
  private typeById = new Map<string, string>();

  /** 物体创建工厂（由 handler 层注册，SceneEngine 只按 type 分发） */
  private factories = new Map<string, (node: SceneObjectNode) => THREE.Object3D | null>();

  constructor(data: SceneDataJSON) {
    this.scene = new THREE.Scene();
    this.applyEnvironment(data.scene);
  }

  /** 应用环境配置（背景/雾） */
  applyEnvironment(env: SceneDataJSON['scene']): void {
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
  registerFactory(type: string, factory: (node: SceneObjectNode) => THREE.Object3D | null): void {
    this.factories.set(type, factory);
  }

  /** 全量建树（初始化时一次），按 parentId 依赖序排布创建 */
  buildTree(objects: SceneObjectNode[]): void {
    const byId = new Map(objects.map((o) => [o.id, o]));
    const created = new Set<string>();
    const createWithParents = (node: SceneObjectNode): void => {
      if (created.has(node.id)) {
        return;
      }
      if (node.parentId && byId.has(node.parentId)) {
        createWithParents(byId.get(node.parentId) as SceneObjectNode);
      }
      this.createObject(node);
      created.add(node.id);
    };
    objects.forEach(createWithParents);
  }

  /** 单个物体创建（工厂分发 + 挂树） */
  createObject(node: SceneObjectNode): THREE.Object3D | null {
    const factory = this.factories.get(node.type);
    if (!factory) {
      console.warn(`[SceneEngine] 未注册的物体类型: ${node.type}（id=${node.id}），跳过`);
      return null;
    }
    const obj = factory(node);
    if (!obj) {
      return null;
    }
    obj.name = node.id;
    if (node.visible === false) {
      obj.visible = false;
    }
    this.attachObject(node, obj);
    return obj;
  }

  /** 挂到父节点（或场景根）并登记索引 */
  private attachObject(node: SceneObjectNode, obj: THREE.Object3D): void {
    const parent = node.parentId ? this.index.nodes.get(node.parentId) : undefined;
    if (node.parentId && !parent) {
      console.warn(`[SceneEngine] 父节点不存在: ${node.parentId}（id=${node.id}），挂到场景根`);
    }
    (parent ?? this.scene).add(obj);
    this.index.nodes.set(node.id, obj);
    this.index.defs.set(node.id, node);
    this.typeById.set(node.id, node.type);
  }

  /** 按 id 查 three.js 对象 */
  getObject(id: string): THREE.Object3D | null {
    return this.index.nodes.get(id) ?? null;
  }

  /** 按 id 查定义 */
  getDef(id: string): SceneObjectNode | null {
    return this.index.defs.get(id) ?? null;
  }

  /** 物体是否参与拾取（pickable=false 的装饰物跳过） */
  isPickable(id: string): boolean {
    const def = this.index.defs.get(id);
    return def ? def.pickable !== false : true;
  }

  /** 全部已创建物体 id（遍历/统计用） */
  getAllIds(): string[] {
    return [...this.index.nodes.keys()];
  }

  /** 从叶节点沿父链找最近的场景 id（拾取命中归属用） */
  resolveId(object: THREE.Object3D): string | null {
    let cur: THREE.Object3D | null = object;
    while (cur) {
      if (this.index.nodes.has(cur.name) && cur.name) {
        return cur.name;
      }
      cur = cur.parent;
    }
    return null;
  }

  /** 应用增量补丁（upsert/remove/patch），返回实际变更统计 */
  applyPatch(patch: ScenePatch): { created: number; updated: number; removed: number } {
    let created = 0;
    let updated = 0;
    let removed = 0;
    if (patch.remove) {
      for (const id of patch.remove) {
        if (this.removeObject(id)) {
          removed += 1;
        }
      }
    }
    if (patch.upsert) {
      for (const node of patch.upsert) {
        if (this.index.nodes.has(node.id)) {
          this.removeObject(node.id);
        }
        this.createObject(node);
        created += 1;
      }
    }
    if (patch.patch) {
      for (const p of patch.patch) {
        if (this.applyNodePatch(p)) {
          updated += 1;
        }
      }
    }
    return { created, updated, removed };
  }

  /** 单节点局部更新（transform/params），不改结构 */
  private applyNodePatch(p: NonNullable<ScenePatch['patch']>[number]): boolean {
    const obj = this.index.nodes.get(p.id);
    const def = this.index.defs.get(p.id);
    if (!obj || !def) {
      return false;
    }
    if (p.position) {
      obj.position.set(...p.position);
      def.position = [...p.position] as SceneObjectNode['position'];
    }
    if (p.rotation) {
      obj.rotation.set(...p.rotation);
      def.rotation = [...p.rotation] as SceneObjectNode['rotation'];
    }
    if (p.scale !== undefined) {
      if (typeof p.scale === 'number') {
        obj.scale.setScalar(p.scale);
      } else {
        obj.scale.set(...p.scale);
      }
      def.scale = p.scale;
    }
    if (p.materialOverride !== undefined) {
      def.materialOverride = p.materialOverride === null
        ? null
        : { ...(def.materialOverride ?? {}), ...p.materialOverride };
      applyMaterialOverride(obj, def.materialOverride);
    }
    if (p.visible !== undefined) {
      def.visible = p.visible;
      obj.visible = p.visible;
    }
    if (p.pickable !== undefined) {
      def.pickable = p.pickable;
    }
    if (p.castShadow !== undefined) {
      def.castShadow = p.castShadow;
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = p.castShadow as boolean;
        }
      });
    }
    if (p.receiveShadow !== undefined) {
      def.receiveShadow = p.receiveShadow;
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.receiveShadow = p.receiveShadow as boolean;
        }
      });
    }
    if (p.params) {
      def.params = { ...def.params, ...p.params };
    }
    return true;
  }

  /** 删除物体（含子树），返回是否删除了 */
  removeObject(id: string): boolean {
    const obj = this.index.nodes.get(id);
    if (!obj) {
      return false;
    }
    const toRemove: string[] = [id];
    this.index.nodes.forEach((o, oid) => {
      let cur: THREE.Object3D | null = o;
      while (cur) {
        if (cur === obj) {
          toRemove.push(oid);
          break;
        }
        cur = cur.parent;
      }
    });
    for (const oid of toRemove) {
      const target = this.index.nodes.get(oid);
      if (target) {
        target.removeFromParent();
      }
      this.index.nodes.delete(oid);
      this.index.defs.delete(oid);
      this.typeById.delete(oid);
    }
    return true;
  }

  /** dispose：清空场景（GPU 资源由 AssetEngine/RendererEngine 各自释放） */
  dispose(): void {
    this.scene.clear();
    this.index.nodes.clear();
    this.index.defs.clear();
    this.typeById.clear();
  }
}
