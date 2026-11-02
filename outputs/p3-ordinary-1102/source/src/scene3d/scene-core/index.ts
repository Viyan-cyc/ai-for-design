/**
 * scene-core/index — 核心包统一出口
 *
 * 二开者只需要认识这个文件：createScene + 类型 + 通用模型/材质机制。业务登记位于 scene-profile。
 */
export { createScene, type SceneHandle, type SceneOptions, getLoadBadgeState } from './createScene';
export {
  loadAssetManifest, makeAssetUrlResolver, resetAssetManifestCache,
  type AssetManifest, type AssetManifestEntry,
} from './asset-manifest';
export * from './types';
export type { SceneDiagnostics, LoadOutcome } from './diagnostics';
export { offlineData, offlineResource } from './offline';
export { getResourceScope, ResourceScope, type ResourceOwnership } from './resources';
export {
  applyCompiledAppearance, hasCompiledAppearance, type AppearanceApplyResult,
} from './appearance-runtime';
export { applyState, type StateVisual, type VisualOverride, NON_MATERIAL_VISUAL_KEYS, findBySlotKey } from './materials';
export {
  createMaterialFromSpec, applyMaterialTextures, applyMaterialScalars, migrateMaterialSpec,
  readMaterialSpec, clearMaterialTextureCache,
} from './materials';
export { PRIMITIVE_KINDS, type PrimitiveKind } from './primitives';
export { handlerUtils } from './handlers/registry';
export type { Component } from 'vue';

export { QUALITY_PRESETS, qualityPreset, SHADOW_SIZES, normalizeRenderer, type QualityPreset } from './render-settings';
export type { FrameStats } from './engine/RenderLoop';

export type { SceneEngine } from './engine/SceneEngine';
export type { AssetEngine } from './engine/AssetEngine';
export type { RenderLoop } from './engine/RenderLoop';
export { makeAssetNodeFactory } from './handlers/registry';
