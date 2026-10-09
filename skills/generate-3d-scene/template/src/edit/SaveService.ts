/**
 * edit/SaveService — 保存（serialize → 下载 scene-data.json）
 *
 * LLM 调参模式下也可以直接读下载产物回写工程文件；人用编辑器时点保存/ Ctrl+S。
 */
import type { SceneHandle } from '@/scene-core/createScene';

export class SaveService {
  constructor(private handle: SceneHandle) {}

  /** 序列化并触发浏览器下载 */
  save(downloadName = 'scene-data.json'): void {
    const data = this.handle.serialize();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
