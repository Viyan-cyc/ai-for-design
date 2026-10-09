/**
 * edit/LightHelperService — 灯光辅助线（调灯可视化）
 *
 * 每盏非 ambient 灯挂 three.js 对应 Helper：
 *   directional → DirectionalLightHelper / point → PointLightHelper
 *   spot → SpotLightHelper / hemisphere → HemisphereLightHelper / rectarea → RectAreaLightHelper
 * Helper 每帧 update() 跟随参数变化；灯删除/替换时同步清理重建。
 * ambient 无位置与方向，three.js 也无对应 Helper，跳过。
 */
import * as THREE from 'three';
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';
import type { SceneHandle } from '@/scene-core/createScene';

export class LightHelperService {
  private helpers = new Map<string, THREE.Object3D>();

  private unsubFrame: (() => void) | null = null;

  /** 辅助线总开关（false = 全部隐藏） */
  private enabled = true;

  /** 当前启用了哪盏灯的辅助线（null = 全部显示） */
  private activeId: string | null = null;

  constructor(private handle: SceneHandle) {
    this.unsubFrame = handle.internals.renderLoop.onFrame(() => {
      this.helpers.forEach((helper) => {
        const update = (helper as unknown as { update?: () => void }).update;
        if (typeof update === 'function') {
          update.call(helper);
        }
      });
    });
  }

  /** 辅助线开关（关 = 全部隐藏；开 = 恢复 focus 选择的显示态） */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyVisibility();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** 按 enabled + activeId 计算显示态（唯一出口，开关与 focus 都走这里） */
  private applyVisibility(): void {
    this.helpers.forEach((helper, id) => {
      helper.visible = this.enabled && (this.activeId === null || id === this.activeId);
    });
  }

  /** 与灯光配置同步：新增建 Helper、删除清 Helper（每次 emit 调用，幂等） */
  sync(): void {
    const { lightEngine, scene } = this.handle.internals;
    const ids = new Set(lightEngine.getLightIds());
    // 清掉已不存在的
    [...this.helpers.keys()].forEach((id) => {
      if (!ids.has(id)) {
        this.removeHelper(id);
      }
    });
    // 补上新增的（灯实例替换——replaceAll 重建后实例是新的，Helper 也要重建）
    for (const id of ids) {
      if (this.helpers.has(id)) {
        this.removeHelper(id);
      }
      const light = lightEngine.getLight(id);
      if (!light || light instanceof THREE.AmbientLight) {
        continue;
      }
      const helper = this.createHelper(light);
      if (helper) {
        helper.raycast = () => {};
        helper.visible = this.enabled && (this.activeId === null || id === this.activeId);
        scene.add(helper);
        this.helpers.set(id, helper);
      }
    }
  }

  /** 只显示指定灯的辅助线（null = 全部）；面板选灯时调用 */
  focus(id: string | null): void {
    this.activeId = id;
    this.applyVisibility();
  }

  private createHelper(light: THREE.Light): THREE.Object3D | null {
    if (light instanceof THREE.DirectionalLight) {
      return new THREE.DirectionalLightHelper(light, 2);
    }
    if (light instanceof THREE.SpotLight) {
      return new THREE.SpotLightHelper(light);
    }
    if (light instanceof THREE.PointLight) {
      return new THREE.PointLightHelper(light, 0.5);
    }
    if (light instanceof THREE.HemisphereLight) {
      return new THREE.HemisphereLightHelper(light, 2);
    }
    if (light instanceof THREE.RectAreaLight) {
      return new RectAreaLightHelper(light);
    }
    return null;
  }

  private removeHelper(id: string): void {
    const helper = this.helpers.get(id);
    if (!helper) {
      return;
    }
    helper.removeFromParent();
    (helper as unknown as { dispose?: () => void }).dispose?.();
    this.helpers.delete(id);
  }

  dispose(): void {
    this.unsubFrame?.();
    [...this.helpers.keys()].forEach((id) => this.removeHelper(id));
  }
}
