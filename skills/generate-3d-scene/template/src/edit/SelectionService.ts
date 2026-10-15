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
import { findBySlotKey } from '@/scene-core';
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
    // 每帧刷新包围盒：物体被 Gizmo 拖拽/面板调参/动画驱动时实时跟随。
    // 蒙皮网格先重算蒙皮采样盒/球（BoxHelper 的 setFromObject 与 raycast
    // 都优先读 object.boundingBox/boundingSphere——重算即跟随真实渲染形状）
    handle.internals.renderLoop.onFrame(() => {
      this.highlights.forEach((helper) => {
        this.refreshSkinnedBounds(helper.userData.target as THREE.Object3D | undefined);
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

  /**
   * 选中变化后同步包围盒（P3.4：幂等复用——同 key 同 target 同色不重建 helper，
   * 只清多余/失效项。undo 差量恢复后选区通常不变，避免每次重建 BoxHelper 的
   * geometry/material 分配）。
   */
  syncHighlights(): void {
    // 目标集合：key → { obj, color }
    const targets = new Map<string, { obj: THREE.Object3D; color: number }>();

    // 子网格槽位选中态：包围盒只包该 mesh（EditMaterial 聚焦的视觉反馈）
    const slot = this.bridge.selectedSlot;
    if (slot) {
      const entry = this.handle.internals.sceneEngine.getObject(slot.nodeId);
      if (entry) {
        const target = findBySlotKey(entry, slot.slotKey);
        if (target) {
          targets.set(`slot:${slot.slotKey}`, { obj: target, color: ANCHOR_COLOR });
        }
      }
    }

    if (targets.size === 0) {
      const ids = this.bridge.selectedIds;
      const anchorId = this.bridge.anchorId;
      for (const id of ids) {
        const obj = this.handle.internals.sceneEngine.getObject(id);
        if (obj) {
          targets.set(id, { obj, color: id === anchorId ? ANCHOR_COLOR : SELECT_COLOR });
        }
      }
    }

    // 差量：失效的（不在目标集 / target 换了对象）清掉；仍有效的保留复用
    for (const [key, helper] of [...this.highlights]) {
      const want = targets.get(key);
      const cur = helper.userData.target as THREE.Object3D | undefined;
      const curColor = (helper.material as THREE.LineBasicMaterial).color.getHex();
      if (!want || cur !== want.obj || curColor !== want.color) {
        helper.removeFromParent();
        helper.geometry.dispose();
        (helper.material as THREE.Material).dispose();
        this.highlights.delete(key);
      }
    }
    // 新增的（目标集有而 highlights 没有）
    for (const [key, { obj, color }] of targets) {
      if (!this.highlights.has(key)) {
        this.addHelper(obj, color, key);
      }
    }
  }

  /**
   * 蒙皮网格的 geometry 盒是 bind-pose——BoxHelper 派生自它，选中骨骼模型时
   * 框的是假盒。每帧 update 前重算蒙皮采样盒（getVertexPosition），
   * 并把 geometry.boundingBox 同步成蒙皮盒，让 helper 跟真实渲染形状。
   */
  private refreshSkinnedBounds(target: THREE.Object3D | undefined): void {
    if (!target) {
      return;
    }
    target.traverse((child) => {
      const sk = child as THREE.SkinnedMesh;
      if (!sk.isSkinnedMesh) {
        return;
      }
      sk.computeBoundingBox();
      sk.computeBoundingSphere();
    });
  }

  private addHelper(obj: THREE.Object3D, color: number, key: string): void {
    const helper = new THREE.BoxHelper(obj, color);
    // helper 自身不可被拾取（否则点中边框会命中 helper 干扰 pick）
    helper.raycast = () => {};
    const mat = helper.material;
    mat.depthTest = false;
    mat.transparent = true;
    mat.opacity = 0.9;
    helper.renderOrder = 999;
    helper.userData.target = obj;
    this.refreshSkinnedBounds(obj);
    this.scene.add(helper);
    helper.update();
    this.highlights.set(key, helper);
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
