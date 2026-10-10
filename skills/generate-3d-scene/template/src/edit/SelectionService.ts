/**
 * edit/SelectionService — 点选与高亮
 *
 * - canvas click → handle.pick → bridge.select（Shift 累计）
 * - 选中物体套 BoxHelper 包围盒（基准物体与普通成员分色）；
 *   每帧 helper.update() → 移/转/缩实时跟随（含 Gizmo 拖拽）
 * - 点空白/ESC → bridge.clearSelection
 */
import * as THREE from 'three';
import type { SceneHandle } from '@/scene-core/createScene';
import type { Bridge } from './Bridge';

const SELECT_COLOR = 0x00a2ff;
const ANCHOR_COLOR = 0xffb020;

export class SelectionService {
  private scene: THREE.Scene;

  /** id → 包围盒 helper */
  private highlights = new Map<string, THREE.BoxHelper>();

  private lastShift = false;

  /** pointerdown 位置：click 时比较位移，区分「点击」与「拖拽结束」 */
  private downX = 0;

  private downY = 0;

  /** 锁定物体跳过视口拾取（__visuals.locked；树中仍可选中看属性，Spline 同款） */
  private isUnlocked = (id: string): boolean =>
    this.handle.internals.sceneEngine.getVisual(id)?.locked !== true;

  constructor(
    private handle: SceneHandle,
    private bridge: Bridge,
  ) {
    this.scene = handle.internals.scene;
    const canvas = handle.internals.canvas;
    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeydown);
    // 每帧刷新包围盒：物体被 Gizmo 拖拽/面板调参/动画驱动时实时跟随
    handle.internals.renderLoop.onFrame(() => {
      this.highlights.forEach((helper) => {
        helper.update();
      });
    });
  }

  private onPointerDown = (ev: PointerEvent): void => {
    // click 事件不含可靠修饰键组合，pointerdown 时先存
    this.lastShift = ev.shiftKey;
    this.downX = ev.clientX;
    this.downY = ev.clientY;
  };

  private onClick = (ev: MouseEvent): void => {
    // 位移超阈值 = Gizmo 拖拽/轨道旋转的收尾 click，不改选区（Spline 同款行为）
    const moved = Math.hypot(ev.clientX - this.downX, ev.clientY - this.downY);
    if (moved > 3) {
      return;
    }
    const hit = this.handle.pick(ev.clientX, ev.clientY, this.isUnlocked);
    if (hit) {
      this.bridge.select(hit.id, this.lastShift);
    } else if (!this.lastShift) {
      this.bridge.clearSelection();
    }
    this.syncHighlights();
  };

  private onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      this.bridge.clearSelection();
      this.syncHighlights();
    }
  };

  /** 选中变化后重建包围盒 */
  syncHighlights(): void {
    this.highlights.forEach((helper) => {
      helper.removeFromParent();
      helper.geometry.dispose();
      (helper.material as THREE.Material).dispose();
    });
    this.highlights.clear();

    const ids = this.bridge.selectedIds;
    const anchorId = this.bridge.anchorId;
    for (const id of ids) {
      const obj = this.handle.internals.sceneEngine.getObject(id);
      if (obj) {
        const color = id === anchorId ? ANCHOR_COLOR : SELECT_COLOR;
        const helper = new THREE.BoxHelper(obj, color);
        // helper 自身不可被拾取（否则点中边框会命中 helper 干扰 pick）
        helper.raycast = () => {};
        const mat = helper.material;
        mat.depthTest = false;
        mat.transparent = true;
        mat.opacity = 0.9;
        helper.renderOrder = 999;
        this.scene.add(helper);
        helper.update();
        this.highlights.set(id, helper);
      }
    }
  }

  dispose(): void {
    const canvas = this.handle.internals.canvas;
    canvas.removeEventListener('click', this.onClick);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeydown);
    this.highlights.forEach((helper) => {
      helper.removeFromParent();
      helper.geometry.dispose();
      (helper.material as THREE.Material).dispose();
    });
    this.highlights.clear();
  }
}
