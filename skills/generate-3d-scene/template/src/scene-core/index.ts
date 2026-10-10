/**
 * scene-core/index — 核心包统一出口
 *
 * 二开者只需要认识这个文件：createScene + 类型 + 卡片组件注册 + 状态视觉注册表。
 */
export { createScene, type SceneHandle } from './createScene';
export * from './types';
export { stateMaterials, applyState, type StateVisual, type VisualOverride, NON_MATERIAL_VISUAL_KEYS } from './materials';
export {
  createMaterialFromSpec, applyMaterialTextures, applyMaterialScalars, migrateMaterialSpec,
  clearMaterialTextureCache,
} from './materials';
export { PRIMITIVE_KINDS, type PrimitiveKind } from './primitives';
export { handlerUtils } from './handlers/registry';
export { registerExampleHandler } from './handlers/example/example';
export { registerTreeHandler } from './handlers/procedural/tree';
export { default as ExampleCard } from './cards/ExampleCard.vue';
export type { Component } from 'vue';
