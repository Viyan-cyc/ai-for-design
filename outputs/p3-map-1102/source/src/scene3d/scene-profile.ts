/** Business assembly: add only the factories/cards used by this scene. */
import type { SceneEngine } from './scene-core';
import type { AssetEngine } from './scene-core';
import type { RenderLoop } from './scene-core';

export interface BusinessRegistrarContext {
  sceneEngine: SceneEngine;
  assetEngine: AssetEngine;
  renderLoop: RenderLoop;
}

export const BUSINESS_REGISTRARS: Record<string, (ctx: BusinessRegistrarContext) => void> = {};
export const BUSINESS_FACTORY_TYPES = Object.keys(BUSINESS_REGISTRARS);
export const registerBusinessFactories = (ctx: BusinessRegistrarContext): void => {
  const called = new Set<(ctx: BusinessRegistrarContext) => void>();
  for (const [type, register] of Object.entries(BUSINESS_REGISTRARS)) {
    if (typeof register !== 'function') throw new Error(`Missing factory registration: ${type}`);
    if (!called.has(register)) { register(ctx); called.add(register); }
  }
  const missing = BUSINESS_FACTORY_TYPES.filter((type) => !ctx.sceneEngine.hasFactory(type));
  if (missing.length) throw new Error(`Factories were not registered: ${missing.join(', ')}`);
};
