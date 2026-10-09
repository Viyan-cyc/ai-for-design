/**
 * scene-core/index — 核心包统一出口
 *
 * 二开者只需要认识这个文件：createScene + 类型 + 卡片组件注册。
 */
export { createScene, type SceneHandle } from './createScene';
export * from './types';
export { handlerUtils } from './handlers/registry';
export { registerExampleHandler } from './handlers/example/windTurbine';
export { default as ExampleCard } from './cards/ExampleCard.vue';
export type { Component } from 'vue';
