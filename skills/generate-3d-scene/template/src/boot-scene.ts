/**
 * boot-scene — run/edit 共用业务装配（P2.1）
 *
 * 数据获取 + 画布创建 + createScene（带 profile）的单一实现。
 * main.ts 与 edit/edit-main.ts 只负责各自的 DOM/UI 壳差异（run 铺满 body、
 * edit 移入三栏视口），装配链路不再重复。
 */
import { createScene, type SceneHandle, type SceneOptions } from '@/scene-core';
import { applyCompiledAppearance } from '@/scene-core/appearance-runtime';
import { loadAssetManifest } from '@/scene-core/asset-manifest';
import type { SceneData } from '@/scene-core/types';
import { cardComponents, registerBusinessFactories } from './scene-profile';
import { offlineData, installOfflineResources, showSceneError } from './scene-core/offline';

export interface BootResult {
  handle: SceneHandle;
  data: SceneData;
  canvas: HTMLCanvasElement;
}

/**
 * 场景装配（两态共用）。
 * @param host canvas 宿主元素（run 态 body / edit 态视口栏）
 */
export const bootScene = async (host: HTMLElement, options: SceneOptions = {}): Promise<BootResult> => {
  installOfflineResources();
  let data: SceneData;
  const offline = offlineData();
  if (offline) {
    data = structuredClone(offline.scene);
  } else {
    const res = await fetch('/scene-data.json');
    if (!res.ok) {
      throw new Error(`[boot] scene-data.json 加载失败: ${res.status}`);
    }
    data = (await res.json()) as SceneData;
  }

  // 资产映射先于建树加载（P2-R1）：内建/业务工厂的 URL 解析共用这一份
  await loadAssetManifest();

  const canvas = document.createElement('canvas');
  canvas.id = 'scene-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  host.appendChild(canvas);

  const handle = await createScene(canvas, data, cardComponents, {
    profile: registerBusinessFactories,
    ...options,
  });

  // 编译外观应用（P4.1）：运行包（数据无私有区）时把 strip-edit 编译的视觉层/
  // 材质库写进引擎；编辑态（数据带 __visuals）由 createScene 私有区回灌优先，跳过
  applyCompiledAppearance(handle, data);
  if (offlineData()) {
    void handle.whenReady({ timeoutMs: 60000 }).catch(showSceneError);
  }

  return { handle, data, canvas };
};
