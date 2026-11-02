/**
 * RendererEngine — WebGL 渲染器（toneMapping/阴影/尺寸自适应/像素比保护）
 */
import * as THREE from 'three';
import type { RendererConfig } from '../types';
import { normalizeRenderer } from '../render-settings';

const toneMappingMap: Record<RendererConfig['toneMapping'], THREE.ToneMapping> = {
  NoToneMapping: THREE.NoToneMapping,
  Linear: THREE.LinearToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping,
  ACESFilmic: THREE.ACESFilmicToneMapping,
  AgX: THREE.AgXToneMapping,
  Neutral: THREE.NeutralToneMapping,
};

const shadowMapMap: Record<RendererConfig['shadowMap'], THREE.ShadowMapType> = {
  Basic: THREE.BasicShadowMap,
  PCF: THREE.PCFShadowMap,
  PCFSoft: THREE.PCFSoftShadowMap,
  VSM: THREE.VSMShadowMap,
};

export class RendererEngine {
  readonly renderer: THREE.WebGLRenderer;

  private config: RendererConfig;
  private shadowProgramsDirty = false;
  readonly initialOptions: { antialias: boolean; logarithmicDepthBuffer: boolean };

  constructor(canvas: HTMLCanvasElement, config: RendererConfig) {
    this.config = normalizeRenderer(config);
    this.initialOptions = { antialias: this.config.antialias!, logarithmicDepthBuffer: this.config.logarithmicDepthBuffer! };
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      ...this.initialOptions,
      alpha: true,
      powerPreference: 'default',
    });
    this.renderer.toneMapping = toneMappingMap[config.toneMapping] ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = config.exposure;
    this.renderer.shadowMap.enabled = config.shadowMapEnabled;
    this.renderer.shadowMap.type = shadowMapMap[config.shadowMap] ?? THREE.PCFShadowMap;
    this.applySize();
  }

  /** 尺寸与像素比自适应（resize 时与初始化时调用）；返回实际渲染尺寸 */
  applySize(): { width: number; height: number } {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    // 0 宽高（容器被移动/隐藏的中间态）回退全屏，避免 0 尺寸渲染
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.config.pixelRatio ?? 1);
    this.renderer.setSize(width, height, false);
    return { width, height };
  }

  /** 编辑态调参 */
  setToneMapping(toneMapping: RendererConfig['toneMapping']): void {
    this.config.toneMapping = toneMapping;
    this.renderer.toneMapping = toneMappingMap[toneMapping] ?? THREE.ACESFilmicToneMapping;
  }

  setExposure(exposure: number): void {
    this.config.exposure = exposure;
    this.renderer.toneMappingExposure = exposure;
  }

  setShadowMapType(type: RendererConfig['shadowMap']): void {
    if (this.renderer.shadowMap.type !== (shadowMapMap[type] ?? THREE.PCFShadowMap)) this.shadowProgramsDirty = true;
    this.renderer.shadowMap.type = shadowMapMap[type] ?? THREE.PCFShadowMap;
    this.config.shadowMap = type;
    // shadowMap 类型变更需重编译材质着色器
    this.renderer.shadowMap.needsUpdate = true;
  }

  setShadowMapEnabled(enabled: boolean): void {
    if (this.renderer.shadowMap.enabled !== enabled) this.shadowProgramsDirty = true;
    this.renderer.shadowMap.enabled = enabled;
    this.config.shadowMapEnabled = enabled;
    this.renderer.shadowMap.needsUpdate = true;
  }

  applyConfig(patch: Partial<RendererConfig>): void {
    const next = normalizeRenderer({ ...this.config, ...patch });
    this.config = next;
    this.setToneMapping(next.toneMapping);
    this.setExposure(next.exposure);
    this.setShadowMapEnabled(next.shadowMapEnabled);
    this.setShadowMapType(next.shadowMap);
    this.applySize();
  }

  getConfig(): RendererConfig {
    return { ...this.config };
  }

  /** 每帧渲染 */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    // Shadow enable/type changes alter shader sampler declarations. Updating the
    // shadow map alone leaves cached material programs using the old sampler type.
    if (this.shadowProgramsDirty) {
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        const material = (object as THREE.Mesh).material;
        if (Array.isArray(material)) material.forEach(item => materials.add(item));
        else if (material) materials.add(material);
      });
      materials.forEach(material => { material.needsUpdate = true; });
      this.shadowProgramsDirty = false;
    }
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
