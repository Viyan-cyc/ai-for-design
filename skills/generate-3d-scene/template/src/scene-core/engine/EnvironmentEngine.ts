/**
 * EnvironmentEngine — IBL 环境光照（RoomEnvironment PMREM 生成）
 *
 * v3：数据层只有 intensity（preset 收窄为代码内实现细节——当前统一 RoomEnvironment
 * 中性影棚光；后续扩展 HDRI 风格时只改本文件的 resolveEnvironment 实现）。
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class EnvironmentEngine {
  private pmrem: THREE.PMREMGenerator | null = null;

  private currentEnv: THREE.Texture | null = null;

  /** 应用环境配置（scene.environment；null = 关闭环境光） */
  async apply(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    env: { intensity: number } | null,
  ): Promise<void> {
    // 先清理旧环境
    if (this.currentEnv) {
      scene.environment = null;
      this.currentEnv.dispose();
      this.currentEnv = null;
    }
    if (!env) {
      return;
    }
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
    }
    // 当前所有 preset 统一走 RoomEnvironment（中性影棚光），强度走 envMapIntensity 分级
    const rt = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.currentEnv = rt.texture;
    scene.environment = rt.texture;
    scene.environmentIntensity = env.intensity;
  }

  dispose(): void {
    if (this.currentEnv) {
      this.currentEnv.dispose();
      this.currentEnv = null;
    }
    if (this.pmrem) {
      this.pmrem.dispose();
      this.pmrem = null;
    }
  }
}
