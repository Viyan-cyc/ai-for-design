/**
 * ControlsEngine — 轨道控制器（orbit 封装，target/限位可调）
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ControlsConfig } from '../types';

export class ControlsEngine {
  readonly controls: OrbitControls;

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    config: ControlsConfig,
  ) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.target.set(...config.target);
    this.controls.enableDamping = config.enableDamping ?? true;
    this.controls.dampingFactor = config.dampingFactor ?? 0.08;
    if (config.autoRotate !== undefined) {
      this.controls.autoRotate = config.autoRotate;
    }
    if (config.autoRotateSpeed !== undefined) {
      this.controls.autoRotateSpeed = config.autoRotateSpeed;
    }
    if (config.minDistance !== undefined) {
      this.controls.minDistance = config.minDistance;
    }
    if (config.maxDistance !== undefined) {
      this.controls.maxDistance = config.maxDistance;
    }
    if (config.enablePan !== undefined) {
      this.controls.enablePan = config.enablePan;
    }
    if (config.minPolarAngle !== undefined) {
      this.controls.minPolarAngle = config.minPolarAngle;
    }
    if (config.maxPolarAngle !== undefined) {
      this.controls.maxPolarAngle = config.maxPolarAngle;
    }
    if (config.zoomSpeed !== undefined) {
      this.controls.zoomSpeed = config.zoomSpeed;
    }
    this.controls.update();
  }

  /** 编辑态改目标点 */
  setTarget(target: [number, number, number]): void {
    this.controls.target.set(...target);
    this.controls.update();
  }

  setDistanceRange(min: number, max: number): void {
    this.controls.minDistance = min;
    this.controls.maxDistance = max;
    this.controls.update();
  }

  /** 应用控制器局部配置（编辑态调参） */
  applyConfig(patch: Partial<ControlsConfig>): void {
    if (patch.target) {
      this.controls.target.set(...patch.target);
    }
    if (patch.minDistance !== undefined) {
      this.controls.minDistance = patch.minDistance;
    }
    if (patch.maxDistance !== undefined) {
      this.controls.maxDistance = patch.maxDistance;
    }
    if (patch.enablePan !== undefined) {
      this.controls.enablePan = patch.enablePan;
    }
    if (patch.minPolarAngle !== undefined) {
      this.controls.minPolarAngle = patch.minPolarAngle;
    }
    if (patch.maxPolarAngle !== undefined) {
      this.controls.maxPolarAngle = patch.maxPolarAngle;
    }
    if (patch.autoRotate !== undefined) {
      this.controls.autoRotate = patch.autoRotate;
    }
    if (patch.autoRotateSpeed !== undefined) {
      this.controls.autoRotateSpeed = patch.autoRotateSpeed;
    }
    if (patch.enableDamping !== undefined) {
      // 关闭瞬间若正处于惯性滑行，清空剩余速度——否则下一帧走无阻尼分支
      // 会把残余 sphericalDelta 全额一次性应用，表现为「关了阻尼反而猛跳一下」
      if (this.controls.enableDamping && !patch.enableDamping) {
        (this.controls as unknown as { _sphericalDelta: { set: (a: number, b: number, c: number) => void } })
          ._sphericalDelta.set(0, 0, 0);
        (this.controls as unknown as { _panOffset: { set: (a: number, b: number, c: number) => void } })
          ._panOffset.set(0, 0, 0);
      }
      this.controls.enableDamping = patch.enableDamping;
    }
    if (patch.dampingFactor !== undefined) {
      this.controls.dampingFactor = patch.dampingFactor;
    }
    if (patch.zoomSpeed !== undefined) {
      this.controls.zoomSpeed = patch.zoomSpeed;
    }
    this.controls.update();
  }

  /** 当前控制器配置（serialize 回写用） */
  getConfig(): ControlsConfig {
    const c = this.controls;
    return {
      type: 'OrbitControls',
      target: [c.target.x, c.target.y, c.target.z],
      minDistance: c.minDistance,
      maxDistance: c.maxDistance,
      enablePan: c.enablePan,
      minPolarAngle: c.minPolarAngle,
      maxPolarAngle: c.maxPolarAngle,
      autoRotate: c.autoRotate,
      autoRotateSpeed: c.autoRotateSpeed,
      enableDamping: c.enableDamping,
      dampingFactor: c.dampingFactor,
      zoomSpeed: c.zoomSpeed,
    };
  }

  /** 相机聚焦到指定包围盒（F 聚焦） */
  frameBox(box: THREE.Box3, camera: THREE.Camera): void {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 + 1;
    const dir = camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(center);
    camera.position.copy(center.clone().add(dir.multiplyScalar(radius * 2.5)));
    this.controls.update();
  }

  /** 每帧调用（damping/autoRotate 生效需要 deltaTime） */
  update(delta?: number): void {
    this.controls.update(delta ?? null);
  }

  dispose(): void {
    this.controls.dispose();
  }
}
