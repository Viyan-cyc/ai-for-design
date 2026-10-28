/** Shared resource boundary; no editor dependency and no fetch interception. */
import { DefaultLoadingManager } from 'three';
import type { SceneData } from './types';
import type { AssetManifest } from './asset-manifest';

export interface OfflineData {
  version: 1;
  sourceId: string;
  scene: SceneData;
  manifest: AssetManifest;
  resources: Record<string, string>;
}

declare global {
  interface Window {
    __scene3dOffline?: OfflineData;
  }
}

export const offlineData = (): OfflineData | undefined => typeof window === 'undefined' ? undefined : window.__scene3dOffline;

// Package resources are shared by instances and undo snapshots for the page lifetime.
const resourceUrls = new Map<string, string>();
if (typeof window !== 'undefined') {
window.addEventListener?.('pagehide', () => {
  resourceUrls.forEach((url) => URL.revokeObjectURL(url));
  resourceUrls.clear();
});
}

export const offlineResource = (url: string): string => {
  const data = offlineData();
  if (!data || /^(data:|blob:)/i.test(url)) {
    return url;
  }
  const base = new URL('./', window.location.href);
  const absolute = new URL(url.replace(/^\/(?!\/)/, ''), base);
  if (absolute.protocol !== base.protocol || !absolute.pathname.startsWith(base.pathname)) {
    throw new Error(`离线预览无法读取资源：${url}`);
  }
  const key = decodeURIComponent(absolute.pathname.slice(base.pathname.length));
  const resource = data.resources[key];
  if (!resource) {
    throw new Error(`离线包缺少资源：${key}`);
  }
  const cached = resourceUrls.get(key);
  if (cached) {
return cached;
}
  const match = /^data:([^;]+);base64,(.*)$/s.exec(resource);
  if (!match || match[1] === undefined || match[2] === undefined) {
throw new Error(`离线资源格式错误：${key}`);
}
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
bytes[index] = binary.charCodeAt(index);
}
  const urlValue = URL.createObjectURL(new Blob([bytes], { type: match[1] }));
  resourceUrls.set(key, urlValue);
  return urlValue;
};

export const installOfflineResources = (): void => {
  if (offlineData()) {
    DefaultLoadingManager.setURLModifier(offlineResource);
  }
};

export const showSceneError = (error: unknown): void => {
  let panel = document.getElementById('scene-error');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'scene-error';
    panel.setAttribute('role', 'alert');
    panel.style.cssText =
      'position:fixed;inset:16px 16px auto;z-index:99999;padding:16px;background:#fff0ef;color:#8b1a10;white-space:pre-wrap';
    document.body.appendChild(panel);
  }
  panel.textContent = `场景加载失败：${error instanceof Error ? error.message : String(error)}`;
};

