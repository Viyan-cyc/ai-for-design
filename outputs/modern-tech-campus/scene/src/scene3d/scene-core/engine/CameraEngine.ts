/**
 * CameraEngine — 相机（透视/正交创建 + 运行时投影切换 + lookAt + 视口宽高自适应）
 */
import * as THREE from 'three';
import type { CameraConfig } from '../types';

export class CameraEngine {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  private lookTarget: THREE.Vector3;

  /** 投影类型切换导致 camera 实例替换时触发（createScene 转发给控件重挂） */
  onCameraSwap: ((camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => void) | null = null;

  constructor(config: CameraConfig, aspect: number) {
    this.lookTarget = new THREE.Vector3(...config.lookAt);
    if (config.type === 'OrthographicCamera' && config.orthographic) {
      const o = config.orthographic;
      this.camera = new THREE.OrthographicCamera(o.left, o.right, o.top, o.bottom, 0.1, 2000);
    } else {
      this.camera = new THREE.PerspectiveCamera(
        config.fov ?? 50,
        aspect,
        config.near ?? 0.1,
        config.far ?? 2000,
      );
    }
    this.camera.position.set(...config.position);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateProjectionMatrix();
    this.lastPerspFov = config.fov ?? 50;
    this.lastPerspNear = config.near ?? 0.1;
  }

  /** 透视参数记忆（ortho→persp 往返切换不丢用户配置） */
  private lastPerspFov = 50;

  private lastPerspNear = 0.1;

  /** 当前投影类型（面板回显与切换判断用） */
  get type(): 'PerspectiveCamera' | 'OrthographicCamera' {
    return this.camera instanceof THREE.PerspectiveCamera ? 'PerspectiveCamera' : 'OrthographicCamera';
  }

  /**
   * 透视 ↔ 正交切换（保持位置与视线方向；正交视锥按当前物距与 fov 反推，画面内容近似不变）
   */
  setProjectionType(type: 'PerspectiveCamera' | 'OrthographicCamera', aspect: number): void {
    if (type === this.type) {
      return;
    }
    const old = this.camera;
    // 离开透视前记住用户配置（fov/near 面板可调，切回时不丢）
    if (old instanceof THREE.PerspectiveCamera) {
      this.lastPerspFov = old.fov;
      this.lastPerspNear = old.near;
    }
    const distance = old.position.distanceTo(this.lookTarget);
    const height = distance * Math.tan(THREE.MathUtils.degToRad(old instanceof THREE.PerspectiveCamera ? old.fov : 50) / 2) * 2;
    let next: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    if (type === 'OrthographicCamera') {
      const halfH = height / 2;
      const halfW = halfH * aspect;
      next = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, old.far * 2);
    } else {
      next = new THREE.PerspectiveCamera(this.lastPerspFov, aspect, this.lastPerspNear, old.far);
    }
    next.position.copy(old.position);
    next.lookAt(this.lookTarget);
    if (type === 'OrthographicCamera') {
      // 正交近面允许负值：相机拉远到物体后方时场景仍可见（建模软件惯例）
      next.near = -200;
    }
    next.updateProjectionMatrix();
    this.camera = next;
    this.onCameraSwap?.(next);
  }

  /** 更新投影（宽高比变化时） */
  setAspect(aspect: number): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    } else {
      const o = this.camera;
      const halfW = (o.right - o.left) / 2;
      const halfH = (o.top - o.bottom) / 2;
      const ratio = aspect / (halfW / halfH);
      o.left = -halfW * ratio;
      o.right = halfW * ratio;
      o.updateProjectionMatrix();
    }
  }

  /** 编辑态改 fov */
  setFov(fov: number): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** 编辑态改近/远裁剪面 */
  setClipping(near?: number, far?: number): void {
    if (near !== undefined) {
      this.camera.near = Math.max(near, this.camera instanceof THREE.OrthographicCamera ? -2000 : 0.01);
    }
    if (far !== undefined) {
      this.camera.far = far;
    }
    this.camera.updateProjectionMatrix();
  }

  /** 编辑态改 lookAt 目标（OrbitControls target 与之联动由调用方负责） */
  setLookAt(target: [number, number, number]): void {
    this.lookTarget.set(...target);
    this.camera.lookAt(this.lookTarget);
  }

  get lookAtTarget(): THREE.Vector3 {
    return this.lookTarget.clone();
  }

  get target(): THREE.Vector3 {
    return this.lookTarget.clone();
  }

  dispose(): void {
    // three.js Camera 无 GPU 资源，留空保持 dispose 协议一致
  }
}
