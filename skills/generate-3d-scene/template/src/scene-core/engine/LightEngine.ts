/**
 * LightEngine — 灯光（按配置创建/更新/释放，支持增量替换）
 */
import * as THREE from 'three';
import type { LightConfig } from '../types';

const createLight = (config: LightConfig): THREE.Light => {
  let light: THREE.Light;
  switch (config.type) {
    case 'DirectionalLight': {
      const d = new THREE.DirectionalLight(
        new THREE.Color(config.color ?? '#ffffff'),
        config.intensity,
      );
      if (config.target) {
        d.target.position.set(...config.target);
      }
      light = d;
      break;
    } case 'AmbientLight':
      light = new THREE.AmbientLight(new THREE.Color(config.color ?? '#ffffff'), config.intensity);
      break;
    case 'PointLight':
      light = new THREE.PointLight(
        new THREE.Color(config.color ?? '#ffffff'),
        config.intensity,
        config.distance ?? 0,
        config.decay ?? 2,
      );
      break;
    case 'SpotLight': {
      const s = new THREE.SpotLight(
        new THREE.Color(config.color ?? '#ffffff'),
        config.intensity,
        config.distance ?? 0,
        config.angle ?? Math.PI / 6,
        config.penumbra ?? 0,
        config.decay ?? 2,
      );
      if (config.target) {
        s.target.position.set(...config.target);
      }
      light = s;
      break;
    }
    case 'HemisphereLight':
      light = new THREE.HemisphereLight(
        new THREE.Color(config.color ?? '#ffffff'),
        new THREE.Color(config.groundColor ?? '#444444'),
        config.intensity,
      );
      break;
    case 'RectAreaLight': {
      const r = new THREE.RectAreaLight(
        new THREE.Color(config.color ?? '#ffffff'),
        config.intensity,
        config.width ?? 2,
        config.height ?? 2,
      );
      r.lookAt(0, 0, 0);
      light = r;
      break;
    }
    default:
      console.warn(`[LightEngine] 未知灯光类型: ${(config).type}，退化为环境光`);
      light = new THREE.AmbientLight(0xffffff, config.intensity);
  }
  return light;
};

/** 阴影参数应用到灯（addLight/mutate 共用；castShadow 仅 directional/spot 有效） */
const applyShadowParams = (light: THREE.Light, config: Partial<LightConfig>): void => {
  const shadowLight = light as THREE.DirectionalLight;
  if (!shadowLight.shadow) {
    return;
  }
  if (config.castShadow !== undefined) {
    shadowLight.castShadow = config.castShadow;
  }
  if (config.shadowMapSize !== undefined) {
    shadowLight.shadow.mapSize.set(config.shadowMapSize, config.shadowMapSize);
    // mapSize 变更需释放旧贴图，下一帧按新尺寸重建
    shadowLight.shadow.map?.dispose();
    shadowLight.shadow.map = null;
  }
  if (config.shadowBias !== undefined) {
    shadowLight.shadow.bias = config.shadowBias;
  }
  if (config.shadowCameraNear !== undefined) {
    shadowLight.shadow.camera.near = config.shadowCameraNear;
  }
  if (config.shadowCameraFar !== undefined) {
    shadowLight.shadow.camera.far = config.shadowCameraFar;
  }
  if (shadowLight.shadow.camera instanceof THREE.OrthographicCamera) {
    const sc = shadowLight.shadow.camera;
    if (config.shadowCameraLeft !== undefined) {
      sc.left = config.shadowCameraLeft;
    }
    if (config.shadowCameraRight !== undefined) {
      sc.right = config.shadowCameraRight;
    }
    if (config.shadowCameraTop !== undefined) {
      sc.top = config.shadowCameraTop;
    }
    if (config.shadowCameraBottom !== undefined) {
      sc.bottom = config.shadowCameraBottom;
    }
  }
  shadowLight.shadow.camera.updateProjectionMatrix();
};

export class LightEngine {
  private lights = new Map<string, THREE.Light>();

  /** id → 当前配置（serialize 回写用） */
  private configs = new Map<string, LightConfig>();

  constructor(private scene: THREE.Scene, configs: LightConfig[]) {
    configs.forEach((c) => this.addLight(c));
  }

  /** 新增/替换一盏灯（按 id） */
  addLight(config: LightConfig): void {
    this.removeLight(config.id);
    const light = createLight(config);
    light.name = config.id;
    if (config.position) {
      light.position.set(...config.position);
    }
    applyShadowParams(light, config);
    // spotlight 的 target 不在场景树内则不生效，需挂到场景
    if (light instanceof THREE.SpotLight || light instanceof THREE.DirectionalLight) {
      this.scene.add(light.target);
    }
    this.scene.add(light);
    this.lights.set(config.id, light);
    this.configs.set(config.id, { ...config });
  }

  /** 删除一盏灯 */
  removeLight(id: string): void {
    const light = this.lights.get(id);
    if (light) {
      this.scene.remove(light);
      if (light instanceof THREE.SpotLight || light instanceof THREE.DirectionalLight) {
        this.scene.remove(light.target);
      }
      this.lights.delete(id);
      this.configs.delete(id);
    }
  }

  /** 整组替换 */
  replaceAll(configs: LightConfig[]): void {
    [...this.lights.keys()].forEach((id) => this.removeLight(id));
    configs.forEach((c) => this.addLight(c));
  }

  /** 当前灯光配置（serialize 回写用） */
  getConfigs(): LightConfig[] {
    return [...this.configs.values()].map((c) => ({ ...c }));
  }

  /** 编辑态调参：改强度/颜色（同步回配置，serialize 才能带回） */
  setIntensity(id: string, intensity: number): void {
    const light = this.lights.get(id);
    if (light) {
      light.intensity = intensity;
      const config = this.configs.get(id);
      if (config) {
        config.intensity = intensity;
      }
    }
  }

  setColor(id: string, color: string): void {
    const light = this.lights.get(id);
    if (light) {
      light.color = new THREE.Color(color);
      const config = this.configs.get(id);
      if (config) {
        config.color = color;
      }
    }
  }

  /** 编辑态局部调参（不重建灯实例；serialize 经 configs 回写） */
  mutate(id: string, patch: Partial<Omit<LightConfig, 'id' | 'type'>>): void {
    const light = this.lights.get(id);
    const config = this.configs.get(id);
    if (!light || !config) {
      return;
    }
    if (patch.intensity !== undefined) {
      light.intensity = patch.intensity;
      config.intensity = patch.intensity;
    }
    if (patch.color !== undefined) {
      light.color = new THREE.Color(patch.color);
      config.color = patch.color;
    }
    if (patch.position) {
      light.position.set(...patch.position);
      config.position = [...patch.position];
    }
    if (patch.target) {
      if (light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight) {
        light.target.position.set(...patch.target);
      }
      config.target = [...patch.target];
    }
    if (patch.groundColor !== undefined && light instanceof THREE.HemisphereLight) {
      light.groundColor = new THREE.Color(patch.groundColor);
      config.groundColor = patch.groundColor;
    }
    if (patch.distance !== undefined
      && (light instanceof THREE.PointLight || light instanceof THREE.SpotLight)) {
      light.distance = patch.distance;
      config.distance = patch.distance;
    }
    if (patch.decay !== undefined
      && (light instanceof THREE.PointLight || light instanceof THREE.SpotLight)) {
      light.decay = patch.decay;
      config.decay = patch.decay;
    }
    if (patch.angle !== undefined && light instanceof THREE.SpotLight) {
      light.angle = patch.angle;
      config.angle = patch.angle;
    }
    if (patch.penumbra !== undefined && light instanceof THREE.SpotLight) {
      light.penumbra = patch.penumbra;
      config.penumbra = patch.penumbra;
    }
    if (patch.width !== undefined && light instanceof THREE.RectAreaLight) {
      light.width = patch.width;
      config.width = patch.width;
    }
    if (patch.height !== undefined && light instanceof THREE.RectAreaLight) {
      light.height = patch.height;
      config.height = patch.height;
    }
    if (patch.castShadow !== undefined
      || patch.shadowMapSize !== undefined
      || patch.shadowBias !== undefined
      || patch.shadowCameraNear !== undefined
      || patch.shadowCameraFar !== undefined
      || patch.shadowCameraLeft !== undefined
      || patch.shadowCameraRight !== undefined
      || patch.shadowCameraTop !== undefined
      || patch.shadowCameraBottom !== undefined) {
      applyShadowParams(light, patch);
      if (patch.castShadow !== undefined) {
        config.castShadow = patch.castShadow;
      }
      if (patch.shadowMapSize !== undefined) {
        config.shadowMapSize = patch.shadowMapSize;
      }
      if (patch.shadowBias !== undefined) {
        config.shadowBias = patch.shadowBias;
      }
      if (patch.shadowCameraNear !== undefined) {
        config.shadowCameraNear = patch.shadowCameraNear;
      }
      if (patch.shadowCameraFar !== undefined) {
        config.shadowCameraFar = patch.shadowCameraFar;
      }
      if (patch.shadowCameraLeft !== undefined) {
        config.shadowCameraLeft = patch.shadowCameraLeft;
      }
      if (patch.shadowCameraRight !== undefined) {
        config.shadowCameraRight = patch.shadowCameraRight;
      }
      if (patch.shadowCameraTop !== undefined) {
        config.shadowCameraTop = patch.shadowCameraTop;
      }
      if (patch.shadowCameraBottom !== undefined) {
        config.shadowCameraBottom = patch.shadowCameraBottom;
      }
    }
  }

  getLightIds(): string[] {
    return [...this.lights.keys()];
  }

  /** 按 id 取 three.js 光源实例（辅助线挂载用） */
  getLight(id: string): THREE.Light | null {
    return this.lights.get(id) ?? null;
  }

  dispose(): void {
    this.lights.forEach((light) => {
      this.scene.remove(light);
      if (light instanceof THREE.SpotLight || light instanceof THREE.DirectionalLight) {
        this.scene.remove(light.target);
      }
    });
    this.lights.clear();
  }
}
