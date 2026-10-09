/**
 * RendererEngine — WebGL 渲染器（toneMapping/阴影/尺寸自适应/像素比保护）
 */
import * as THREE from 'three';
import type { RendererConfig } from '../types';

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

  constructor(canvas: HTMLCanvasElement, config: RendererConfig) {
    this.config = config;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = toneMappingMap[config.toneMapping] ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = config.exposure;
    this.renderer.shadowMap.enabled = config.shadowMapEnabled;
    this.renderer.shadowMap.type = shadowMapMap[config.shadowMap] ?? THREE.PCFSoftShadowMap;
    this.applySize();
  }

  /** 尺寸与像素比自适应（resize 时与初始化时调用）；返回实际渲染尺寸 */
  applySize(): { width: number; height: number } {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    // 0 宽高（容器被移动/隐藏的中间态）回退全屏，避免 0 尺寸渲染
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    const maxRatio = this.config.maxPixelRatio ?? 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
    this.renderer.setSize(width, height, false);
    return { width, height };
  }

  /** 编辑态调参 */
  setToneMapping(toneMapping: RendererConfig['toneMapping']): void {
    this.renderer.toneMapping = toneMappingMap[toneMapping] ?? THREE.ACESFilmicToneMapping;
  }

  setExposure(exposure: number): void {
    this.renderer.toneMappingExposure = exposure;
  }

  setShadowMapType(type: RendererConfig['shadowMap']): void {
    this.renderer.shadowMap.type = shadowMapMap[type] ?? THREE.PCFSoftShadowMap;
    this.config.shadowMap = type;
    // shadowMap 类型变更需重编译材质着色器
    this.renderer.shadowMap.needsUpdate = true;
  }

  setShadowMapEnabled(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled;
    this.config.shadowMapEnabled = enabled;
    this.renderer.shadowMap.needsUpdate = true;
  }

  getConfig(): RendererConfig {
    return { ...this.config };
  }

  /** 每帧渲染 */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
