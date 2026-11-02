import type { AppContext, Component } from 'vue';
import { createScene, type SceneHandle } from './scene-core';
import type { SceneData } from './scene-core/types';
import { loadAssetManifest } from './scene-core/asset-manifest';
import { applyCompiledAppearance } from './scene-core/appearance-runtime';
import { offlineData, installOfflineResources, showSceneError } from './scene-core/offline';
import { compiledVisuals, compiledMaterialLib } from './scene/generated/appearance';
import { registerBusinessFactories } from './scene-profile';

export interface Scene3DOptions {
  cards?: Record<string, Component>;
  cardContext?: AppContext;
  /** Directory containing scene-data.json and assets/. Relative URLs follow the host page. */
  assetBaseUrl?: string;
  data?: SceneData;
}

export async function createScene3D(host: HTMLElement, options: Scene3DOptions = {}): Promise<SceneHandle> {
  installOfflineResources();
  const base = (options.assetBaseUrl ?? `${import.meta.env.BASE_URL}scene3d/`).replace(/\/?$/, '/');
  // Offline resource keys are relative to the exported page, independent of its original Vite base.
  const assetBaseUrl = offlineData() ? 'scene3d/' : base;
  let data = options.data ? structuredClone(options.data) : offlineData()?.scene;
  if (!data) {
    const response = await fetch(`${assetBaseUrl}scene-data.json`);
    if (!response.ok) throw new Error(`场景配置加载失败: ${response.status}`);
    data = await response.json() as SceneData;
  }
  const manifest = await loadAssetManifest(assetBaseUrl);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  host.appendChild(canvas);
  let handle: SceneHandle | undefined;
  try {
    handle = await createScene(canvas, structuredClone(data), options.cards ?? {}, {
      profile: registerBusinessFactories, cardContext: options.cardContext, assetBaseUrl, assetManifest: manifest,
    });
    handle.onDispose(() => canvas.remove());
    applyCompiledAppearance(handle, data, { visuals: compiledVisuals, materialLib: compiledMaterialLib });
    if (offlineData()) void handle.whenReady({ timeoutMs: 60000 }).catch(showSceneError);
    return handle;
  } catch (error) {
    handle?.dispose();
    canvas.remove();
    throw error;
  }
}
