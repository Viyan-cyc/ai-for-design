/**
 * EnvironmentEngine — IBL 环境光照（RoomEnvironment PMREM 生成）
 *
 * v3：数据层只有 intensity（preset 收窄为代码内实现细节——当前统一 RoomEnvironment
 * 中性影棚光；后续扩展 HDRI 风格时只改本文件的 resolveEnvironment 实现）。
 *
 * P3.4（F14）：PMREM 复用——intensity-only 变化不重新 fromScene（PMREM 生成是
 * 渲染器级重活，scene.environmentIntensity 只是采样标量）；环境贴图源不变时
 * 复用现有 renderTarget.texture，只改 intensity。关闭→重开才重建。
 * 临时 scene（RoomEnvironment）在 fromScene 后立即 dispose；renderTarget 由
 * 本引擎持有到下一次替换或 dispose（PMREMGenerator.fromScene 的返回约定）。
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class EnvironmentEngine {
  private pmrem: THREE.PMREMGenerator | null = null;

  private currentEnv: THREE.Texture | null = null;

  /**
   * PMREM 生成器工厂（测试缝：Node 无 WebGL 时注入计数 fake；
   * 生产缺省走真 THREE.PMREMGenerator）。
   */
  pmremFactory: (renderer: THREE.WebGLRenderer) => THREE.PMREMGenerator = (renderer) => new THREE.PMREMGenerator(renderer);

  /** 应用环境配置（scene.environment；null = 关闭环境光） */
  async apply(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    env: { intensity: number } | null,
  ): Promise<void> {
    if (!env) {
      // 关闭：释放持有贴图（下次重开重建）
      if (this.currentEnv) {
        scene.environment = null;
        this.currentEnv.dispose();
        this.currentEnv = null;
      }
      return;
    }
    // intensity-only 变化（贴图源不变——当前唯一源是 RoomEnvironment）：
    // 复用现有 renderTarget.texture，只改采样强度（F14：不重新生成 PMREM）
    if (this.currentEnv) {
      scene.environment = this.currentEnv;
      scene.environmentIntensity = env.intensity;
      return;
    }
    if (!this.pmrem) {
      this.pmrem = this.pmremFactory(renderer);
    }
    // 当前所有 preset 统一走 RoomEnvironment（中性影棚光），强度走 envMapIntensity 分级。
    // 临时 scene 用完即 dispose（不留渲染资源）；RT 由本引擎持有
    const tempScene = new RoomEnvironment();
    try {
      const rt = this.pmrem.fromScene(tempScene, 0.04);
      this.currentEnv = rt.texture;
      scene.environment = rt.texture;
      scene.environmentIntensity = env.intensity;
    } finally {
      tempScene.dispose();
    }
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
