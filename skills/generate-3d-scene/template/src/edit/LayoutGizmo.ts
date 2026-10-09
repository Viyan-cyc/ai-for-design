/**
 * edit/LayoutGizmo — 变换手柄（three.js TransformControls 封装）
 *
 * - 选中单个物体时挂手柄；多选时只挂基准物体（对齐/分布由属性面板驱动）
 * - G/R/S 或工具条切换 translate/rotate/scale
 * - 吸附开关：translationSnap=0.5m / rotationSnap=15° / scaleSnap=0.1
 * - 拖拽期间禁用 OrbitControls（构造时注入）；
 *   拖拽结束（mouseUp）→ bridge.commit 把最终 transform 写回（进撤销栈）
 */
import type * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { SceneHandle } from '@/scene-core/createScene';
import type { Bridge } from './Bridge';

const SNAP = {
  translation: 0.5,
  rotation: Math.PI / 12,
  scale: 0.1,
};

export class LayoutGizmo {
  private controls: TransformControls;

  private unsubCameraSwap: (() => void) | null = null;

  /** 拖拽开始时的 transform（结束时算增量写回） */
  private startTransform: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  } | null = null;

  constructor(
    handle: SceneHandle,
    private bridge: Bridge,

    /** 拖拽期间禁用轨道（构造时由 edit-main 注入） */
    setOrbitEnabled: (enabled: boolean) => void,
  ) {
    const { camera, canvas, scene } = handle.internals;
    this.controls = new TransformControls(camera, canvas);
    scene.add(this.controls.getHelper());

    // 透视/正交切换时相机实例被替换，TransformControls 需换绑
    this.unsubCameraSwap = handle.onCameraSwap((cam) => {
      this.controls.camera = cam;
    });

    this.controls.addEventListener('dragging-changed', (ev) => {
      const dragging = (ev as unknown as { value: boolean }).value;
      setOrbitEnabled(!dragging);
      if (dragging) {
        const obj = this.controls.object;
        if (obj) {
          this.startTransform = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
          };
        }
      } else {
        this.writeBack();
        this.startTransform = null;
      }
    });

    window.addEventListener('keydown', this.onHotkey);
  }

  private onHotkey = (ev: KeyboardEvent): void => {
    // 输入框聚焦时不抢快捷键；带 Ctrl/Meta 的组合键（Ctrl+S 等）不抢
    const target = ev.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) {
      return;
    }
    switch (ev.key.toLowerCase()) {
      case 'g':
        this.setMode('translate');
        break;
      case 'r':
        this.setMode('rotate');
        break;
      case 's':
        this.setMode('scale');
        break;
      default:
        break;
    }
  };

  /** 选中变化时由外部调用（edit-main 订阅 bridge 状态后转发） */
  syncSelection(): void {
    const ids = this.bridge.selectedIds;
    if (ids.length === 0) {
      this.detach();
      return;
    }
    const anchorId = this.bridge.anchorId as string;
    const obj = this.bridge.handle.internals.sceneEngine.getObject(anchorId);
    if (obj && this.controls.object !== obj) {
      // 幂等：已在同一物体上时不再 attach（重挂会打断进行中的拖拽）
      this.controls.attach(obj);
    } else if (!obj) {
      this.detach();
    }
  }

  /** gizmo 模式与 bridge 状态同步（工具条/面板/快捷键三条入口统一经此生效） */
  syncMode(mode: Bridge['gizmoMode']): void {
    if (this.controls.mode !== mode) {
      this.controls.setMode(mode);
    }
  }

  /** 吸附开关（bridge.toggleSnapping 后由 edit-main 转发） */
  setSnapping(enabled: boolean): void {
    this.controls.translationSnap = enabled ? SNAP.translation : null;
    this.controls.rotationSnap = enabled ? SNAP.rotation : null;
    this.controls.scaleSnap = enabled ? SNAP.scale : null;
  }

  private detach(): void {
    if (this.controls.object) {
      this.controls.detach();
    }
  }

  setMode(mode: 'translate' | 'rotate' | 'scale'): void {
    // 统一走 bridge（emit 后经 edit-main 的 onState 回调 syncMode 生效），
    // 保证工具条/面板/快捷键/undo 全部入口走同一条单路同步
    this.bridge.setGizmoMode(mode);
  }

  /** 拖拽结束：把 transform 差值写回场景定义（进撤销栈） */
  private writeBack(): void {
    const obj = this.controls.object;
    if (!obj || !this.startTransform) {
      return;
    }
    const id = obj.name;
    if (!id) {
      return;
    }
    const start = this.startTransform;
    const moved = !obj.position.equals(start.position)
      || !obj.rotation.equals(start.rotation)
      || !obj.scale.equals(start.scale);
    if (!moved) {
      return;
    }
    // XYZ 均匀缩放柄在物体投影正中心按下时 pointStart≈0，上游 d=pointEnd/pointStart 会爆炸，
    // 病态结果直接回滚到拖拽前状态（不进撤销栈）
    const insane = [obj.scale.x, obj.scale.y, obj.scale.z]
      .some((v) => !Number.isFinite(v) || Math.abs(v) > 1e4 || Math.abs(v) < 1e-6);
    if (insane) {
      obj.position.copy(start.position);
      obj.rotation.copy(start.rotation);
      obj.scale.copy(start.scale);
      return;
    }
    this.bridge.commit('变换', () => {
      this.bridge.handle.update({
        patch: [{
          id,
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        }],
      });
    });
  }

  dispose(): void {
    this.unsubCameraSwap?.();
    window.removeEventListener('keydown', this.onHotkey);
    this.controls.dispose();
    this.controls.getHelper().removeFromParent();
  }
}
