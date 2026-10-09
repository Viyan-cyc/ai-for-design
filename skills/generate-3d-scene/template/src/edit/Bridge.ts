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
import type { SceneData } from '@/scene-core/types';

/** 编辑器快照（撤销栈元素：全量 serialize，v3 零转换） */
interface Snapshot {
  data: SceneData;
  label: string;
}

export interface EditorState {

  /** 选中物体 id 列表（有序，末位=基准） */
  selection: string[];

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

  snapping = false;

  gizmoMode: EditorState['gizmoMode'] = 'translate';

  constructor(handle: SceneHandle) {
    this.handle = handle;
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

  /** 点选（无修饰键=重置为单选；Shift=切换累计；基准=最后选中的） */
  select(id: string, additive: boolean): void {
    if (!additive) {
      this.selection = this.selection.length === 1 && this.selection[0] === id
        ? []
        : [id];
    } else {
      this.selection = this.selection.includes(id)
        ? this.selection.filter((s) => s !== id)
        : [...this.selection, id];
    }
    this.emit();
  }

  /** 点空白/ESC 清空 */
  clearSelection(): void {
    this.selection = [];
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

  /** 从快照重建场景（v3：整份数据喂 update，幂等 upsert + 引擎级联处理增删） */
  private rebuild(data: SceneData): void {
    const alive = new Set<string>();
    for (const [key, val] of Object.entries(data)) {
      if (!['version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove', '__visuals'].includes(key)
        && Array.isArray(val)) {
        (val as Array<{ id: string }>).forEach((n) => alive.add(n.id));
      }
    }
    this.selection = this.selection.filter((id) => alive.has(id));
    // 全量重建：remove 全部现存 → 整份快照喂回（v3 五用途一格式，无转换）
    const current = this.handle.internals.sceneEngine.getAllIds();
    this.handle.update({ remove: current.length > 0 ? current : undefined });
    const { remove: _drop, ...frag } = data;
    void _drop;
    this.handle.update(frag);
    this.emit();
  }

  // ---- 删除（v3：引擎级联子树 + 内联卡片；快照经 undo 恢复） ----

  /** 删除物体（引擎 removeObject 级联：子节点与内联卡片一起消失） */
  removeObjects(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    this.commit('删除', () => {
      this.handle.update({ remove: ids });
    });
    this.clearSelection();
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
    return obj ? new THREE.Box3().setFromObject(obj) : null;
  }

  dispose(): void {
    this.listeners.clear();
    this.undoStack = [];
    this.redoStack = [];
  }
}
