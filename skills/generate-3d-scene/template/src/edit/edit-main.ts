/**
 * edit/edit-main — 编辑态入口（独立于 main.ts，strip-edit 后不存在于二开交付物）
 *
 * 装配序：createScene（core）→ 业务 handler 注册 → Bridge → Selection/LayoutGizmo/Save
 *   → EditApp.vue 挂载 → 全局快捷键。
 * 三栏布局 DOM（工具条/物体树/视口/属性面板）由 EditApp.vue 提供，canvas 移入视口栏。
 */
import { createApp } from 'vue';
import { createScene, ExampleCard } from '@/scene-core';
import { registerExampleHandler, registerTreeHandler } from '@/scene-core/handlers';
import type { SceneData, SceneNode } from '@/scene-core/types';
import { Bridge } from './Bridge';
import { SelectionService } from './SelectionService';
import { LayoutGizmo } from './LayoutGizmo';
import { LightHelperService } from './LightHelperService';
import { SaveService } from './SaveService';
import EditApp from './EditApp.vue';

const boot = async (): Promise<void> => {
  // DOM 骨架：edit-ui 根节点 + canvas（EditApp 挂载后三栏壳包住视口）
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('[edit-main] 找不到 #app');
  }
  const canvas = document.createElement('canvas');
  canvas.id = 'scene-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  const viewport = document.createElement('div');
  viewport.id = 'edit-viewport';
  viewport.style.cssText = 'position:relative;width:100%;height:100%;';
  viewport.appendChild(canvas);
  root.appendChild(viewport);

  // 场景数据：dev server 从 public/scene-data.json 提供
  const res = await fetch('/scene-data.json');
  if (!res.ok) {
    throw new Error(`[edit-main] scene-data.json 加载失败: ${res.status}`);
  }
  const data = (await res.json()) as SceneData;

  // 卡片组件注册表（编辑态所见即二开所得）
  const handle = await createScene(canvas, data, { example: ExampleCard });

  // 业务 handler 示例（注册要赶在首次建树后重喂——createScene 建树时 examples/cars
  // 分组尚无工厂被 warn 跳过，注册后按数据原样重喂，幂等 upsert 补建缺失节点）
  registerExampleHandler(
    handle.internals.sceneEngine,
    handle.internals.assetEngine,
    (cb) => void handle.internals.renderLoop.onFrame((delta) => cb(delta)),
  );
  registerTreeHandler(handle.internals.sceneEngine);
  const refeed: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val) && (key === 'examples' || key === 'cars' || key === 'trees')) {
      refeed[key] = val;
    }
  }
  if (Object.keys(refeed).length > 0) {
    handle.update(refeed);
  }
  handle.refreshCards();

  // 编辑服务
  const bridge = new Bridge(handle);
  const selection = new SelectionService(handle, bridge);
  const gizmo = new LayoutGizmo(
    handle,
    bridge,
    (enabled) => {
      handle.internals.controlsEngine.controls.enabled = enabled;
    },
  );
  const save = new SaveService(handle);
  const lightHelpers = new LightHelperService(handle);

  // 状态联动：选中→Gizmo/高亮；吸附开关→手柄磁吸值；模式→TransformControls（单路同步，
  // 工具条/面板/快捷键三条入口都汇到 bridge.setGizmoMode，这里统一生效）
  bridge.onState((state) => {
    gizmo.syncSelection();
    gizmo.syncMode(state.gizmoMode);
    selection.syncHighlights();
    gizmo.setSnapping(state.snapping);
    lightHelpers.sync();
  });

  // 全局快捷键：F 聚焦 / Del 删除 / Ctrl+D 复制 / Ctrl+Z|Shift 撤销重做 / Ctrl+S 保存
  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    const target = ev.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      save.save();
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) {
        bridge.redo();
      } else {
        bridge.undo();
      }
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'd') {
      ev.preventDefault();
      const anchorId = bridge.anchorId;
      if (!anchorId) {
        return;
      }
      const node = handle.internals.sceneEngine.getNode(anchorId) as SceneNode | null;
      const type = handle.internals.sceneEngine.getNodeType(anchorId);
      if (node && type) {
        const basePos = node.position ?? [0, 0, 0];
        bridge.commit('复制', () => {
          handle.update({
            [type]: [{
              ...node,
              id: `${node.id}_copy_${Date.now() % 10000}`,
              position: [basePos[0] + 1, basePos[1], basePos[2]],
            }],
          });
        });
      }
      return;
    }
    switch (ev.key) {
      case 'Delete':
      case 'Backspace': {
        bridge.removeObjects(bridge.selectedIds);
        break;
      }
      case 'f':
      case 'F': {
        const anchorId = bridge.anchorId;
        if (anchorId) {
          handle.frameObject(anchorId);
        }
        break;
      }
      default:
        break;
    }
  });

  // UI 壳（三栏：工具条/物体树/视口/属性面板；canvas 所在 viewport 移入中栏）
  const app = createApp(EditApp, {
    bridge,
    save,
    lightHelpers,
    viewportEl: viewport,
  });
  app.mount(root);

  // dev-only：编辑器调试口（冒烟脚本/控制台直接读引擎态）
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__gts3d = handle;
  }
};

void boot();
