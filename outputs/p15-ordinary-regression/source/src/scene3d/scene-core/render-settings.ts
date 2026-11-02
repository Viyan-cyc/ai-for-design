import type { RendererConfig } from './types';

export const QUALITY_PRESETS = {
  fluent: { pixelRatio: 1, shadowMapEnabled: false, shadowMapSize: 512, shadowMap: 'PCF' },
  balanced: { pixelRatio: 1.25, shadowMapEnabled: true, shadowMapSize: 512, shadowMap: 'PCF' },
  fine: { pixelRatio: 1.5, shadowMapEnabled: true, shadowMapSize: 1024, shadowMap: 'PCF' },
} as const;
export type QualityPreset = keyof typeof QUALITY_PRESETS;
export const SHADOW_SIZES = [256, 512, 1024, 2048, 4096];
export function normalizeRenderer(config: RendererConfig): RendererConfig {
  const ratio = config.pixelRatio ?? config.maxPixelRatio ?? 1;
  const fps = config.maxFps ?? 60;
  const size = config.shadowMapSize ?? 512;
  if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 2) throw new Error('渲染像素比必须为 0.5～2');
  if (!Number.isInteger(fps) || fps < 0 || fps > 240) throw new Error('帧率上限必须为 0～240 的整数，0 表示不限制');
  if (!SHADOW_SIZES.includes(size)) throw new Error('阴影分辨率必须为 256、512、1024、2048 或 4096');
  if (config.renderMode && !['demand', 'continuous'].includes(config.renderMode)) throw new Error('无效渲染模式');
  const { maxPixelRatio: _legacy, ...rest } = config;
  return { ...rest, pixelRatio: ratio, shadowMapSize: size, maxFps: fps,
    renderMode: config.renderMode ?? 'demand', antialias: config.antialias ?? false,
    logarithmicDepthBuffer: config.logarithmicDepthBuffer ?? false };
}
export function qualityPreset(config: RendererConfig): QualityPreset | 'custom' {
  const value = normalizeRenderer(config);
  for (const [key, preset] of Object.entries(QUALITY_PRESETS)) {
    if (Object.entries(preset).every(([field, expected]) => value[field as keyof RendererConfig] === expected)) return key as QualityPreset;
  }
  return 'custom';
}
