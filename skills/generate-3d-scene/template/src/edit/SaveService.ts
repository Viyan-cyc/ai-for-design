import { sceneChanges, copyChanges } from './scene-changes';
/**
 * edit/SaveService — 写回工程 scene-data.json
 *
 * 开发模式使用同源写入端点；离线模式复制带冲突检查信息的修改，交给 LLM 回写。
 */
import { ref } from 'vue';
import type { SceneHandle } from '../scene3d/scene-core/createScene';
import {
  offlineData, offlineResource, RESERVED_KEYS, type SceneData,
} from '../scene3d/scene-core/index';
import type { Bridge } from './Bridge';
import { showEditorMessage } from './message';

export class SaveService {
  readonly saving = ref(false);
  readonly status = ref('无修改');

  readonly dirty = ref(false);
  private savedSnapshot = '';
  private unsubscribe?: () => void;
  constructor(
    private handle: SceneHandle,
    private bridge?: Bridge,
  ) {
    this.savedSnapshot = JSON.stringify(handle.serialize());
    this.unsubscribe = bridge?.onState(() => {
      this.dirty.value = JSON.stringify(handle.serialize()) !== this.savedSnapshot;
    });
  }

  dispose(): void {
    this.unsubscribe?.();
  }

  /** Save uploads once per data URI, never persist temporary blob URLs. */
  encode(): unknown {
    const data = this.handle.serialize();
    const offline = offlineData();
    if (!offline) {
      return data;
    }
    const textures: Record<string, string> = {};
    const ids = new Map<string, string>();
    const scene = JSON.parse(JSON.stringify(data, (_key, value: unknown) => {
      if (typeof value !== 'string') {
        return value;
      }
      if (value.startsWith('blob:')) {
        throw new Error('场景含临时资源，请重新选择贴图后保存');
      }
      if (!value.startsWith('data:image/')) {
        return value;
      }
      let id = ids.get(value);
      if (!id) {
        id = `saved-texture:${ids.size}`;
        ids.set(value, id);
        textures[id] = value;
      }
      return id;
    })) as SceneData;
    return {
      format: 'scene3d-scene', version: 1, sourceId: offline.sourceId, scene, textures,
    };
  }

  importText(text: string): void {
    if (!this.bridge) {
      throw new Error('当前页面不支持导入');
    }
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('无效场景文件');
    }
    const envelope = parsed as Record<string, unknown>;
    let value: unknown = parsed;
    if (envelope.format === 'scene3d-scene') {
      if (envelope.version !== 1 || envelope.sourceId !== offlineData()?.sourceId) {
        throw new Error('保存文件版本或来源不匹配，请打开保存时使用的预览');
      }
      const textures = envelope.textures as Record<string, unknown> | undefined;
      value = JSON.parse(JSON.stringify(envelope.scene), (_key, item: unknown) => {
        if (typeof item !== 'string' || !item.startsWith('saved-texture:')) {
          return item;
        }
        const image = textures?.[item];
        if (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp|avif);base64,/i.test(image)) {
          throw new Error(`保存文件缺少有效贴图：${item}`);
        }
        return image;
      }) as unknown;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('缺少场景快照');
    }
    const scene = value as SceneData;
    if (
      typeof scene.version !== 'string' ||
      !scene.scene ||
      !scene.camera ||
      !scene.controls ||
      !scene.renderer ||
      !Array.isArray(scene.lights)
    ) {
      throw new Error('场景保留字段缺失');
    }
    const ids = new Set<string>();
    for (const [key, group] of Object.entries(scene)) {
      if (RESERVED_KEYS.has(key)) {
        continue;
      }
      if (!this.handle.internals.sceneEngine.hasFactory(key)) {
        throw new Error(`当前预览不支持分组：${key}`);
      }
      if (!Array.isArray(group)) {
        throw new Error(`场景分组不是数组：${key}`);
      }
      for (const node of group as Array<{ id?: unknown }>) {
        if (!node || typeof node.id !== 'string' || ids.has(node.id)) {
          throw new Error(`节点 ID 缺失或重复：${key}`);
        }
        ids.add(node.id);
      }
    }
    // Resolve before mutating: old JSON with unavailable images must fail visibly.
    JSON.stringify(scene, (key, item: unknown) => {
      if (typeof item === 'string' && item.startsWith('blob:')) {
        throw new Error('保存文件包含已失效的临时资源');
      }
      if (
        offlineData() &&
        typeof item === 'string' &&
        (/^(?:map|lightMap|envMap|sheenColorMap|sheenRoughnessMap|iridescenceMap|iridescenceThicknessMap|anisotropyMap|normalMap|roughnessMap|metalnessMap|aoMap|emissiveMap|alphaMap|bumpMap|displacementMap|clearcoatMap|clearcoatNormalMap|clearcoatRoughnessMap|transmissionMap|thicknessMap|specularMap|specularColorMap|specularIntensityMap|url|texture)$/i.test(key) ||
          /^\/?(?:scene3d\/)?assets\//.test(item))
      ) {
        offlineResource(item);
      }
      if (offlineData() && key === 'assetId' && typeof item === 'string' && !offlineData()?.manifest[item]) {
        throw new Error(`预览不含模型：${item}`);
      }
      return item;
    });
    this.bridge.restoreSnapshot(scene);
    this.dirty.value = JSON.stringify(this.handle.serialize()) !== this.savedSnapshot;
    showEditorMessage('场景已导入，可撤销恢复导入前状态。');
  }

  chooseImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        void file
          .text()
          .then((text) => this.importText(text))
          .catch((error: unknown) => showEditorMessage(`导入失败：${String(error)}`));
      }
    };
    input.click();
  }

  /** Persist a captured snapshot; edits made during I/O remain dirty. */
  async save(): Promise<void> {
    if (this.saving.value) { return; }
    if (JSON.stringify(this.handle.serialize()) === this.savedSnapshot) { return; }
    this.saving.value = true;
    try {
      this.bridge?.endLiveEdit();
      const snapshot = JSON.stringify(this.handle.serialize());
      if (snapshot.includes('blob:')) { throw new Error('场景含临时资源，请重新选择贴图后保存'); }

      // 构造 scene3d-changes 文本,两种模式都通过 postMessage 回传 host:
      // host 收到后自行决定回写方式(dev 模式直接写文件 / 离线模式发 AI 重构建)。
      const changes = sceneChanges(JSON.parse(this.savedSnapshot), JSON.parse(snapshot));
      console.log('[scene3d/save] changes count:', changes.length, 'DEV:', import.meta.env.DEV, 'inHostIframe:', typeof window !== 'undefined' && window.parent !== window, 'offlineData:', !!offlineData());
      if (changes.length) {
        const payload = {
          format: 'scene3d-changes', version: 1, sourceId: offlineData()?.sourceId,
          changes,
        };
        const text = '请将以下场景修改应用到对应工程 public/scene3d/scene-data.json。先逐项核对 before；不匹配时不要覆盖已有修改。path 是路径数组；缺少 after 表示删除，数组整体替换。保留其他数据，完成后重新构建离线页面。图片 data URI 为资源内容，请保留或落盘后更新引用。\n\n' + JSON.stringify(payload, null, 2);
        try {
          parent?.postMessage({ type: 'od:scene3d-save', payload: text, sourceId: offlineData()?.sourceId }, '*');
          console.log('[scene3d/save] postMessage od:scene3d-send sent, payload length:', text.length);
        } catch (e) { console.warn('[scene3d/save] postMessage failed:', e) }
      }

      // 仅在真正的 Vite dev server(独立浏览器窗口,parent === self)里直写工程文件;
      // host app iframe 内(parent !== self)无此端点,fetch 必 404,跳过,只走 postMessage + 剪贴板。
      const inHostIframe = typeof window !== 'undefined' && window.parent !== window;
      if (import.meta.env.DEV && !inHostIframe) {
        const json = JSON.stringify(JSON.parse(snapshot), null, 2) + '\n';
        const response = await fetch('/__scene3d/save-scene', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json,
        });
        if (!response.ok) { throw new Error(`写入工程失败 (${response.status})`); }
        this.savedSnapshot = snapshot;
        this.dirty.value = JSON.stringify(this.handle.serialize()) !== snapshot;
        this.status.value = '已保存到源码';
        showEditorMessage('已写入 public/scene3d/scene-data.json。离线页面需重新构建才会包含此次修改。');
        return;
      }

      // host iframe 内 或 离线模式:postMessage 已回传。host iframe 内不再走剪贴板
      // (postMessage 已送达 host,会自动发 AI);仅在非 host 环境降级剪贴板兜底。
      if (!changes.length) { showEditorMessage('没有需要保存的修改。'); return; }
      if (inHostIframe) {
        this.status.value = '已回传宿主';
        showEditorMessage('修改已回传宿主,源码待写回。');
      } else {
        const fallbackText = '请将以下场景修改应用到对应工程 public/scene3d/scene-data.json。先逐项核对 before；不匹配时不要覆盖已有修改。path 是路径数组；缺少 after 表示删除，数组整体替换。保留其他数据，完成后重新构建离线页面。图片 data URI 为资源内容，请保留或落盘后更新引用。\n\n' + JSON.stringify({ format: 'scene3d-changes', version: 1, sourceId: offlineData()?.sourceId, changes }, null, 2);
        const copied = await copyChanges(fallbackText);
        this.status.value = copied ? '已复制,待写回源码' : '待手动复制';
        showEditorMessage(copied ? '修改已回传宿主,源码待写回。' : '请在弹窗中手动复制修改。');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') { return; }
      this.status.value = '保存失败';
      showEditorMessage(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.saving.value = false;
    }
  }
}
