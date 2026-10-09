/**
 * main.ts — 二开态入口（交付物运行入口）
 *
 * 二开者从这里起步：数据驱动的场景渲染 + 2D 卡片。
 * 业务 handler 在 handlers/index.ts 启用；卡片组件在下方注册表登记。
 * 编辑态走 edit-main.ts（index.html 的 ?edit=1 分流），与本文件互不影响。
 */
import { createApp } from 'vue';
import { createScene, ExampleCard, registerExampleHandler } from '@/scene-core';
import type { SceneDataJSON } from '@/scene-core/types';
import App from './App.vue';

const boot = async (): Promise<void> => {
  const res = await fetch('/scene-data.json');
  if (!res.ok) {
    throw new Error(`[main] scene-data.json 加载失败: ${res.status}`);
  }
  const data = (await res.json()) as SceneDataJSON;

  // 全屏画布（二开态无三栏壳，canvas 直接铺满 body）
  const canvas = document.createElement('canvas');
  canvas.id = 'scene-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  document.body.appendChild(canvas);

  // 卡片组件注册表：二开者写好 .vue 后在此登记（key = scene-data.json 的 cards[].component）
  const cardComponents = { example: ExampleCard };

  const handle = await createScene(canvas, data, cardComponents);

  // 业务 handler（如 wind_turbine）。注册发生在 createScene 建树之后时，
  // 对应类型节点经一次 update 重建即可生效（下方自动完成）。
  registerExampleHandler(
    handle.internals.sceneEngine,
    handle.internals.assetEngine,
    (cb) => void handle.internals.renderLoop.onFrame((delta) => cb(delta)),
  );
  const customTypes = handle.serialize().objects
    .map((o) => o.type)
    .filter((type) => type !== 'asset' && type !== 'primitive');
  if (customTypes.length > 0) {
    handle.update({ upsert: data.objects.filter((o) => customTypes.includes(o.type)) });
  }

  // 卡片状态示例订阅（数据流演示：卡片系统 → 业务 UI）
  handle.onCardState((states) => {
    void states;
  });

  // Vue UI 层（2D 卡片之外的页面级 UI，如数据大屏侧栏）
  createApp(App, { handle }).mount('#app');
};

void boot();
