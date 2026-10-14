/**
 * edit/edit-main — 编辑态入口（独立于 main.ts，strip-edit 后不存在于二开交付物）
 *
 * 装配序：bootScene（core + 业务 factory，建树前注册）→ Bridge →
 *   Selection/LayoutGizmo/Save → EditApp.vue 挂载 → 全局快捷键。
 * 三栏布局 DOM（工具条/物体树/视口/属性面板）由 EditApp.vue 提供，canvas 移入视口栏。
 */
import { createApp } from 'vue';
import { bootScene } from '@/boot-scene';
import { Bridge } from './Bridge';
import { SelectionService } from './SelectionService';
import { LayoutGizmo } from './LayoutGizmo';
import { LightHelperService } from './LightHelperService';
import { SaveService } from './SaveService';
import { MaterialLibService } from './MaterialLibService';
import EditApp from './EditApp.vue';

const boot = async (): Promise<void> => {
  // DOM 骨架：edit-ui 根节点 + canvas（EditApp 挂载后三栏壳包住视口）
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('[edit-main] 找不到 #app');
  }
  const viewport = document.createElement('div');
  viewport.id = 'edit-viewport';
  viewport.style.cssText = 'position:relative;width:100%;height:100%;';
  root.appendChild(viewport);

  // 场景装配（业务 factory 建树前注册，与 run 态共用 scene-profile）
  const { handle } = await bootScene(viewport);
  handle.refreshCards();

  // 编辑服务
  const bridge = new Bridge(handle);
  const materialLib = new MaterialLibService(handle, bridge);
  materialLib.seeds(); // 注入 4 种子材质（写穿 __materialLib）
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
      if (anchorId) {
        bridge.duplicateObject(anchorId);
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
    materialLib,
    viewportEl: viewport,
  });
  app.mount(root);

  // dev-only：编辑器调试口（冒烟脚本/控制台直接读引擎态 + 编辑服务）
  if (import.meta.env.DEV) {
    const dbg = window as unknown as Record<string, unknown>;
    dbg.__gts3d = handle;
    dbg.__gts3dEdit = { bridge, materialLib, save, selection, gizmo, lightHelpers };
  }
};

void boot();
