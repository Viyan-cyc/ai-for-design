/**
 * edit/SaveService — 保存（serialize → 下载 scene-data.json）
 *
 * LLM 调参模式下也可以直接读下载产物回写工程文件；人用编辑器时点保存/ Ctrl+S。
 */
import type { SceneHandle } from '@/scene-core/createScene';
import { offlineData, offlineResource, RESERVED_KEYS, type SceneData } from '@/scene-core';
import type { Bridge } from './Bridge';
import { showEditorMessage } from './message';

export class SaveService {
  constructor(
    private handle: SceneHandle,
    private bridge?: Bridge,
  ) {}

  /** Save uploads once per data URI, never persist temporary blob URLs. */
  encode(): unknown {
    const data = this.handle.serialize();
    const offline = offlineData();
    if (!offline) {
      return data;
    }
    const textures: Record<string, string> = {};
    const ids = new Map<string, string>();
    const scene = JSON.parse(
      JSON.stringify(data, (_key, value: unknown) => {
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
      }),
    ) as SceneData;
    return { format: 'gts3d-scene', version: 1, sourceId: offline.sourceId, scene, textures };
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
    if (envelope.format === 'gts3d-scene') {
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
        (/^(?:map|lightMap|envMap|sheenColorMap|sheenRoughnessMap|iridescenceMap|iridescenceThicknessMap|anisotropyMap|normalMap|roughnessMap|metalnessMap|aoMap|emissiveMap|alphaMap|bumpMap|displacementMap|clearcoatMap|clearcoatNormalMap|clearcoatRoughnessMap|transmissionMap|thicknessMap|specularMap|specularColorMap|specularIntensityMap|url|texture)$/i.test(
          key,
        ) ||
          /^\/?assets\//.test(item))
      ) {
        offlineResource(item);
      }
      if (offlineData() && key === 'assetId' && typeof item === 'string' && !offlineData()?.manifest[item]) {
        throw new Error(`预览不含模型：${item}`);
      }
      return item;
    });
    this.bridge.restoreSnapshot(scene);
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

  /** 序列化并触发浏览器下载 */
  save(downloadName = 'scene-data.json'): void {
    const data = this.encode();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = offlineData() ? 'scene.3d.json' : downloadName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
