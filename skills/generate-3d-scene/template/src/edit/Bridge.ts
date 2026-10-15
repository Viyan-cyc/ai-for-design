/**
 * edit/Bridge — 编辑器状态中枢（edit 世界的心脏，唯一持有 SceneHandle 引用的地方）
 *
 * 职责：
 * - 持有选中集合（多选：Shift 累计，基准=最后选中的）
 * - 选中变化时广播给各 UI 组件（面板/树/Gizmo）
 * - 统一的变更入口：所有编辑操作（Gizmo 拖拽/面板调参/对齐分布/增删）都经 commit()
 *   —— commit 前拍快照（撤销栈），再 apply 到 handle
 *
 * 其余 edit 文件不直接 import engine 内部，只经 Bridge 与 handle 交互（铁律 2）。
 * v3：快照 = serialize() 原样（SceneData v3 五用途一格式，undo 快照零转换）；
 *     重建 = 喂整份数据给 handle.update()（幂等 upsert）；卡片级联删除由引擎 removeObject 负责。
 */
import * as THREE from 'three';
import type { SceneHandle } from '@/scene-core/createScene';
import type { CardSpec, SceneData, SceneNode, TreeSceneFragment } from '@/scene-core/types';
import { RESERVED_KEYS } from '@/scene-core/types';

/** 编辑器快照（撤销栈元素：全量 serialize，v3 零转换） */
interface Snapshot {
  data: SceneData;
  label: string;
}

export interface EditorState {

  /** 选中物体 id 列表（有序，末位=基准） */
  selection: string[];

  /** 选中的子网格槽位（GLB 内部 mesh；null = 无——属性面板据此显示子网格信息） */
  selectedSlot: { nodeId: string; slotKey: string } | null;

  /** 撤销栈深度（UI 显示用） */
  undoDepth: number;
  redoDepth: number;

  /** 吸附开关 */
  snapping: boolean;

  /** Gizmo 模式 */
  gizmoMode: 'translate' | 'rotate' | 'scale';
}

type StateListener = (state: EditorState) => void;

export class Bridge {
  readonly handle: SceneHandle;

  private selection: string[] = [];

  private undoStack: Snapshot[] = [];

  private redoStack: Snapshot[] = [];

  private listeners = new Set<StateListener>();

  /** 复制序号（副本 id 后缀）；构造时扫存量 id 取 max，防重启后撞前会话副本被 upsert 覆盖 */
  private copySeq = 0;

  snapping = false;

  gizmoMode: EditorState['gizmoMode'] = 'translate';

  /** 选中的子网格槽位（树点 mesh 行设置；切物体/清空选中时清除） */
  private slot: { nodeId: string; slotKey: string } | null = null;

  constructor(handle: SceneHandle) {
    this.handle = handle;
    // 存量副本 id（<id>_copy_NNN）取 max，续号——避免重启后 duplicateObject 生成
    // 已存在 id（幂等 upsert 会覆盖前会话副本，transform 等编辑被清）
    for (const id of this.handle.internals.sceneEngine.getAllIds()) {
      const m = /^(.*)_copy_(\d+)$/.exec(id);
      if (m && m[1] && m[2]) {
        this.copySeq = Math.max(this.copySeq, parseInt(m[2], 10));
      }
    }
  }

  // ---- 状态订阅 ----

  onState(cb: StateListener): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): EditorState {
    return {
      selection: [...this.selection],
      selectedSlot: this.slot ? { ...this.slot } : null,
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length,
      snapping: this.snapping,
      gizmoMode: this.gizmoMode,
    };
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }

  // ---- 选中 ----

  /** 点选（无修饰键=重置为单选；Shift=切换累计；基准=最后选中的；再点已选中者保持选中——取消走点空白/ESC） */
  select(id: string, additive: boolean): void {
    this.slot = null;
    if (!additive) {
      if (this.selection.length === 1 && this.selection[0] === id) {
        this.emit();
        return;
      }
      this.selection = [id];
    } else {
      this.selection = this.selection.includes(id)
        ? this.selection.filter((s) => s !== id)
        : [...this.selection, id];
    }
    this.emit();
  }

  /** 选中子网格槽位（树点 mesh 行；选中父物体 + 记录槽位——属性面板据此显示该 mesh 信息） */
  selectSlot(nodeId: string, slotKey: string): void {
    this.selection = [nodeId];
    this.slot = { nodeId, slotKey };
    this.emit();
  }

  /** 清子网格槽位态（点空白/ESC；物体选中保留） */
  clearSelectedSlot(): void {
    if (this.slot) {
      this.slot = null;
      this.emit();
    }
  }

  /** 当前选中槽位（面板读） */
  get selectedSlot(): { nodeId: string; slotKey: string } | null {
    return this.slot;
  }

  /** 点空白/ESC 清空 */
  clearSelection(): void {
    this.selection = [];
    this.slot = null;
    this.emit();
  }

  get selectedIds(): string[] {
    return [...this.selection];
  }

  /** 基准物体（对齐/分布参照）= 最后选中的 */
  get anchorId(): string | null {
    const last = this.selection[this.selection.length - 1];
    return this.selection.length > 0 && last !== undefined ? last : null;
  }

  // ---- 快照与变更 ----

  private takeSnapshot(label: string): void {
    // v3 serialize 返回全新对象图（分组数组逐节点浅拷贝），但 undo 仍需深拷贝：
    // update 路径会原地改引擎 entries 里的 node 对象，快照必须与引擎态隔离
    this.undoStack.push({ data: structuredClone(this.handle.serialize()), label });
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /** 所有编辑操作的统一入口：先拍快照再应用 */
  commit(label: string, apply: () => void): void {
    this.lastLiveLabel = null;
    this.takeSnapshot(label);
    apply();
    this.emit();
  }

  private lastLiveLabel: string | null = null;

  private lastLiveTime = 0;

  /**
   * 实时生效入口（面板拖动/连续输入）：一次交互会话只压一层撤销快照。
   * 同标签 1s 内的连续调用不重复拍快照——撤销一步回到交互前状态。
   */
  commitLive(label: string, apply: () => void): void {
    const now = performance.now();
    const sameSession = this.lastLiveLabel === label && now - this.lastLiveTime < 1000;
    this.lastLiveLabel = label;
    this.lastLiveTime = now;
    if (!sameSession) {
      this.takeSnapshot(label);
    }
    apply();
    this.emit();
  }

  undo(): void {
    const snap = this.undoStack.pop();
    if (!snap) {
      return;
    }
    this.lastLiveLabel = null;
    this.redoStack.push({ data: structuredClone(this.handle.serialize()), label: snap.label });
    this.rebuild(snap.data);
  }

  redo(): void {
    const snap = this.redoStack.pop();
    if (!snap) {
      return;
    }
    this.lastLiveLabel = null;
    this.undoStack.push({ data: structuredClone(this.handle.serialize()), label: snap.label });
    this.rebuild(snap.data);
  }

  /**
   * 从快照恢复场景（P3.3 差量恢复 + P3-R4 快照完整语义）。
   * - 结构差量：快照没有的 id remove；快照有而引擎没有的 create。
   * - 快照是**完整状态**：节点缺 position/rotation/scale/card/params/parentId 的，
   *   必须显式恢复默认——update 的「缺的不动」适合片段，不等价快照替换
   *   （旧实现直接喂快照 → 撤销"新增 transform/params"时字段残留）。
   * - 完整节点喂回走 updateNodeInPlace：未变对象 paramsEqual 短路、
   *   transform 同值 set 无副作用——保实例身份（undo 不再全树拆建）。
   * - 视觉层/材质库：快照为全集语义（__visuals/__materialLib 整表替换）。
   */
  private rebuild(data: SceneData): void {
    const alive = new Set<string>();
    const groups: Array<[string, Array<{ id: string }>]> = [];
    for (const [key, val] of Object.entries(data)) {
      if (!RESERVED_KEYS.has(key) && Array.isArray(val)) {
        groups.push([key, val as Array<{ id: string }>]);
        (val as Array<{ id: string }>).forEach((n) => alive.add(n.id));
      }
    }
    this.selection = this.selection.filter((id) => alive.has(id));

    const se = this.handle.internals.sceneEngine;
    const current = new Set(se.getAllIds());

    // remove 差量：引擎有而快照没有的（含级联子树）
    const toRemove = [...current].filter((id) => !alive.has(id));
    if (toRemove.length > 0) {
      this.handle.update({ remove: toRemove });
    }

    // upsert 差量（P3-R4 + P3-RR2）：快照是完整状态——**引擎当前有值而快照缺省**
    // 的字段必须显式恢复默认（否则撤销"新增 transform/params"残留）；**两侧均缺省**
    // 的字段不带（undefined→强转默认会让 paramsEqual 判变、未变 legacy 节点被重建）。
    const { remove: _drop, __visuals: _vis, __materialLib: _lib, ...reserved } = data;
    void _drop; void _vis; void _lib;
    const frag: TreeSceneFragment = { ...reserved } as TreeSceneFragment;
    for (const [type, nodes] of groups) {
      frag[type] = nodes.map((n) => {
        const node = n as SceneNode;
        const cur = se.getNode(node.id);
        const out: SceneNode = { ...node };
        // 字段级差量：引擎有值而快照缺省 → 显式默认；两侧均缺省 → 不带（undefined）
        if (out.parentId === undefined && cur?.parentId != null) {
          out.parentId = null;
        }
        if (out.position === undefined && cur?.position != null) {
          out.position = [0, 0, 0];
        }
        if (out.rotation === undefined && cur?.rotation != null) {
          out.rotation = [0, 0, 0];
        }
        if (out.scale === undefined && cur?.scale != null) {
          out.scale = 1;
        }
        if (out.params === undefined && cur?.params != null) {
          out.params = {};
        }
        if (out.card === undefined && cur?.card != null) {
          // 显式清除哨兵：引擎 updateNodeInPlace 将 card:null 归一为 undefined（无卡片）
          (out as { card: CardSpec | null }).card = null;
        }
        return out;
      });
    }
    // 材质库整表替换语义：快照缺 key 时显式补空表，保证 undo 能清空库
    frag.__materialLib = data.__materialLib ?? {};
    if (data.__visuals !== undefined) {
      frag.__visuals = data.__visuals;
    } else {
      frag.__visuals = {};
    }
    this.handle.update(frag);
    this.emit();
  }

  // ---- 删除/复制（v3：引擎级联子树 + 内联卡片；快照经 undo 恢复） ----

  /**
   * 删除物体（引擎 removeObject 级联：子节点与内联卡片一起消失）。
   * 锁定物体挡删（锁定语义=防误改，删除最破坏性）；父级联仍带走锁定子（否则留孤儿链）。
   */
  removeObjects(ids: string[]): void {
    const se = this.handle.internals.sceneEngine;
    const del = ids.filter((id) => se.getVisual(id)?.locked !== true);
    if (del.length === 0) {
      return;
    }
    this.commit('删除', () => {
      this.handle.update({ remove: del });
    });
    this.selection = ids.filter((id) => se.getVisual(id)?.locked === true);
    this.emit();
  }

  /**
   * 复制基准物体（单源：工具条与 Ctrl+D 共用；副本带视觉层、清 locked）。
   * 只复制单节点（不递归子树）；libraryRef 一并保留——共享实例本就是库的用途。
   * P3.3：副本视觉层走 patchVisual（单节点合并），不再 update({__visuals}) 整表
   * 替换——其他节点的视觉层/材质库引用不被复制操作清掉（F06）。
   */
  duplicateObject(anchorId: string): string | null {
    const se = this.handle.internals.sceneEngine;
    const node = se.getNode(anchorId);
    const type = se.getNodeType(anchorId);
    if (!node || !type) {
      return null;
    }
    this.copySeq += 1;
    const newId = `${node.id}_copy_${String(this.copySeq).padStart(3, '0')}`;
    const basePos = node.position ?? [0, 0, 0];
    const vis = se.getVisual(anchorId);
    this.commit('复制', () => {
      const frag: TreeSceneFragment = {
        [type]: [{ ...node, id: newId, position: [basePos[0] + 1, basePos[1], basePos[2]] }],
      };
      this.handle.update(frag);
      if (vis) {
        const { locked: _drop, ...visCopy } = vis;
        void _drop;
        se.patchVisual(newId, visCopy);
      }
    });
    return newId;
  }

  // ---- Gizmo/吸附 ----

  setGizmoMode(mode: EditorState['gizmoMode']): void {
    this.gizmoMode = mode;
    this.emit();
  }

  toggleSnapping(): void {
    this.snapping = !this.snapping;
    this.emit();
  }

  // ---- 便捷读取 ----

  getBbox(id: string): THREE.Box3 | null {
    const obj = this.handle.internals.sceneEngine.getObject(id);
    return obj ? this.handle.internals.sceneEngine.getSkinnedAwareBox(obj) : null;
  }

  dispose(): void {
    this.listeners.clear();
    this.undoStack = [];
    this.redoStack = [];
  }
}
