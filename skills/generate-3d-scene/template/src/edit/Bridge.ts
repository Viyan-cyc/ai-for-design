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
 */
import * as THREE from 'three';
import type { SceneHandle } from '@/scene-core/createScene';
import type { SceneDataJSON } from '@/scene-core/types';

/** 编辑器快照（撤销栈元素：全量 serialize，简单可靠） */
interface Snapshot {
  data: SceneDataJSON;
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
    // 深拷贝：serialize 返回的 objects 是引擎内部 def 引用，后续 patch 会原地改 def，
    // 不 clone 撤销栈里存的是"当前值"，undo 失效
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

  /** 从快照重建场景（全量：物体 + 环境/灯光/相机/控制器/渲染器/卡片一起恢复） */
  private rebuild(data: SceneDataJSON): void {
    const alive = new Set(data.objects.map((o) => o.id));
    this.selection = this.selection.filter((id) => alive.has(id));
    // 全量重建：先删全部再建（数据量级 ≤千级，全量重建成本可接受，正确性优先）
    const current = this.handle.internals.sceneEngine.getAllIds();
    if (current.length > 0) {
      this.handle.update({ remove: current });
    }
    this.handle.update({ upsert: data.objects });
    this.handle.update({
      scene: data.scene,
      lights: data.lights,
      camera: data.camera,
      controls: data.controls,
      renderer: data.renderer,
      cards: data.cards,
    });
    this.emit();
  }

  // ---- 删除（含卡片级联） ----

  /** 删除物体：attachTo 指向被删物体的卡片一起删（undo 时经快照恢复） */
  removeObjects(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    this.commit('删除', () => {
      const cards = this.handle.serialize().cards.filter((c) => !ids.includes(c.attachTo));
      this.handle.update({ remove: ids, cards });
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
