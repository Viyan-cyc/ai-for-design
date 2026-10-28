/**
 * main.ts — 二开态入口（交付物运行入口）
 *
 * 二开者从这里起步：数据驱动的场景渲染 + 2D 卡片。
 * 业务 factory 与卡片注册在 scene-profile.ts（run/edit 共用）；编辑态走
 * edit/edit-main.ts（entry.ts 的 ?edit=1 分流），与本文件互不影响。
 */
import { createApp } from 'vue';
import App from './App.vue';
import { bootScene } from './boot-scene';

const boot = async (): Promise<void> => {
  // 全屏画布（二开态无三栏壳，canvas 直接铺满 body）
  const { handle } = await bootScene(document.body);

  // 卡片状态示例订阅（数据流演示：卡片系统 → 业务 UI）
  handle.onCardState((states) => {
    void states;
  });

  // Vue UI 层（2D 卡片之外的页面级 UI，如数据大屏侧栏）
  createApp(App, { handle }).mount('#app');

  // dev-only：调试口（冒烟脚本/控制台直接读引擎态；生产 build 自动剔除）
  if (import.meta.env.DEV || (window.__scene3dOffline && new URLSearchParams(window.location.search).get('debug') === '1')) {
    (window as unknown as Record<string, unknown>).__scene3d = handle;
  }
};

// An offline IIFE includes both entry modules; only boot the selected mode.
if (!window.__scene3dOffline || new URLSearchParams(window.location.search).get('edit') !== '1') {
  void boot();
}
