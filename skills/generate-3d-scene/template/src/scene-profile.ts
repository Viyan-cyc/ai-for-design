/**
 * scene-profile — 业务装配单一入口（run/edit 共用，P2.1）
 *
 * 二开者只改本文件：新增业务 factory/card/appearance 全部在此登记，
 * main.ts 与 edit/edit-main.ts 自动一致（不再各自维护重复注册列表）。
 * 注册发生在 createScene 建树之前（createScene 第四参 options.profile），
 * 首次建树即命中工厂，无需建树后重喂（refeed）。
 *
 * P2-RR1：BUSINESS_REGISTRARS 是业务工厂的唯一登记表——type → 注册实现。
 * 注册循环遍历它（真实来源），scripts 侧校验器也从同一结构提取分组名。
 * 新增业务分组 = 加一条 type → registerXxx 映射；
 * 声明了却没有注册实现会在装配期抛错，注册实现未声明则不会被遍历到。
 */
import type { SceneEngine } from './scene-core/engine/SceneEngine';
import type { AssetEngine } from './scene-core/engine/AssetEngine';
import type { RenderLoop } from './scene-core/engine/RenderLoop';
import { getLoadBadgeState } from './scene-core';
import {
  registerExampleHandler, registerTreeHandler,
  registerCarHandler, registerWorkerHandler, registerRackHandler,
} from './scene-core/handlers';
import ExampleCard from './scene-core/cards/ExampleCard.vue';
import type { Component } from 'vue';

/** 注册上下文（装配期可用引擎；与 createScene options.profile 同构） */
export interface BusinessRegistrarContext {
  sceneEngine: SceneEngine;
  assetEngine: AssetEngine;
  renderLoop: RenderLoop;
}

// example 业务注册（examples + cars 双分组：状态视觉/spinners/每帧旋转）
const registerExampleBusiness = ({ sceneEngine, assetEngine, renderLoop }: BusinessRegistrarContext): void => {
  registerExampleHandler(
    sceneEngine,
    assetEngine,
    (cb) => renderLoop.onFrame((delta) => cb(delta)),
    getLoadBadgeState(assetEngine).onCount,
  );
};

/**
 * 业务工厂登记表（唯一来源）：type → 注册实现。
 * 一个注册函数可覆盖多个 type（如 example 同时注册 examples/cars）——两个 key 指同一实现。
 */
export const BUSINESS_REGISTRARS: Record<string, (ctx: BusinessRegistrarContext) => void> = {
  examples: registerExampleBusiness,
  cars: registerExampleBusiness,
  trees: ({ sceneEngine }) => registerTreeHandler(sceneEngine),
  codecars: ({ sceneEngine }) => registerCarHandler(sceneEngine),
  codeworkers: ({ sceneEngine }) => registerWorkerHandler(sceneEngine),
  coderacks: ({ sceneEngine }) => registerRackHandler(sceneEngine),
};

/** 业务工厂分组清单（从登记表派生，不重复维护） */
export const BUSINESS_FACTORY_TYPES = Object.keys(BUSINESS_REGISTRARS);

// 业务 factory 注册（建树前调用）：遍历登记表逐项注册，缺实现即抛错（装配期硬失败）。
// 同一注册实现只调用一次（一个实现可登记多个 type——重复调用会重复挂帧回调/闭包状态）。
// 注册完成后逐项后置校验 sceneEngine.hasFactory(type)（P2-RRR1）——空实现/注册错名
// （执行了但没在引擎登记该 type 的工厂）在装配期硬失败，不留到建树时静默跳过。
export const registerBusinessFactories = (ctx: BusinessRegistrarContext): void => {
  const called = new Set<(ctx: BusinessRegistrarContext) => void>();
  for (const [type, register] of Object.entries(BUSINESS_REGISTRARS)) {
    if (typeof register !== 'function') {
      throw new Error(`[scene-profile] 业务分组 "${type}" 声明了注册实现但不可调用（检查 BUSINESS_REGISTRARS）`);
    }
    if (!called.has(register)) {
      called.add(register);
      register(ctx);
    }
  }
  const unregistered = Object.keys(BUSINESS_REGISTRARS)
    .filter((type) => !ctx.sceneEngine.hasFactory(type));
  if (unregistered.length > 0) {
    const msg = `[scene-profile] 以下业务分组声明了注册实现，但执行后引擎未登记工厂（空实现或注册错名）：${unregistered.join(', ')}`;
    throw new Error(msg);
  }
};

/** 卡片组件注册表（key = 节点 card.type；新增卡片在此登记） */
export const cardComponents: Record<string, Component> = { example: ExampleCard };
