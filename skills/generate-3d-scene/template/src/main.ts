/**
 * main.ts — 二开态入口（交付物运行入口）
 *
 * 二开者从这里起步：数据驱动的场景渲染 + 2D 卡片。
 * 业务 handler 在 handlers/index.ts 启用；卡片组件在下方注册表登记。
 * 编辑态走 edit-main.ts（index.html 的 ?edit=1 分流），与本文件互不影响。
 */
import { createApp } from 'vue';
import { createScene, ExampleCard, registerExampleHandler, registerTreeHandler } from '@/scene-core';
import type { SceneData } from '@/scene-core/types';
import App from './App.vue';

const boot = async (): Promise<void> => {
  const res = await fetch('/scene-data.json');
  if (!res.ok) {
    throw new Error(`[main] scene-data.json 加载失败: ${res.status}`);
  }
  const data = (await res.json()) as SceneData;

  // 全屏画布（二开态无三栏壳，canvas 直接铺满 body）
  const canvas = document.createElement('canvas');
  canvas.id = 'scene-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  document.body.appendChild(canvas);

  // 卡片组件注册表：二开者写好 .vue 后在此登记（key = 节点 card.type）
  const cardComponents = { example: ExampleCard };

  // 业务 handler 要在首次建树前注册（createScene 内部先注册内建工厂再建树，
  // 自定义分组延迟注册则需一次 update 重建——这里选择先行注册再进 createScene）
  // 方案：先建 handle，随即注册 example handler 并对业务分组重喂（幂等 upsert）
  const handle = await createScene(canvas, data, cardComponents);

  registerExampleHandler(
    handle.internals.sceneEngine,
    handle.internals.assetEngine,
    (cb) => void handle.internals.renderLoop.onFrame((delta) => cb(delta)),
  );
  registerTreeHandler(handle.internals.sceneEngine);
  // handler 注册后才存在的分组（cars/examples/trees）重喂（幂等 upsert：已存在节点原地 update）
  const refeed: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val) && (key === 'examples' || key === 'cars' || key === 'trees')) {
      refeed[key] = val;
    }
  }
  if (Object.keys(refeed).length > 0) {
    handle.update(refeed);
  }

  // 卡片状态示例订阅（数据流演示：卡片系统 → 业务 UI）
  handle.onCardState((states) => {
    void states;
  });

  // Vue UI 层（2D 卡片之外的页面级 UI，如数据大屏侧栏）
  createApp(App, { handle }).mount('#app');

  // dev-only：调试口（冒烟脚本/控制台直接读引擎态；生产 build 自动剔除）
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__gts3d = handle;
  }
};

void boot();
