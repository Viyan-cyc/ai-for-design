/**
 * asset-manifest — 生成工程的资产映射（P2-R1：init→build→run 同一真相源）
 *
 * init 脚手架从 skill manifests 落一份 id→相对路径映射到
 * public/assets/asset-manifest.json；build.mjs 与运行时 loader 共用它，
 * 消灭「models/<id>.glb 猜路径」（多文件 glTF/自定义落点全支持）。
 *
 * 旧工程无该文件 → 回退 legacy 猜测路径（assets/models/<id>.glb|gltf 逐个试），
 * 兼容已有项目不自动升级（§4.6）。
 */
import type { AssetEngine } from './engine/AssetEngine';

/** 映射条目：模型相对路径（相对 public/assets/，如 "models/x.glb"、"models/id/model.gltf"） */
export interface AssetManifestEntry {
  model: string;
  format: 'glb' | 'gltf';
  textures?: Record<string, string>;
}

export type AssetManifest = Record<string, AssetManifestEntry>;

const MANIFEST_URL = 'assets/asset-manifest.json';

let cached: AssetManifest | null = null;

/** 拉取并缓存资产映射（fetch 失败 = 无映射，返回空表走 legacy 回退） */
export const loadAssetManifest = async (): Promise<AssetManifest> => {
  if (cached !== null) {
    return cached;
  }
  try {
    const res = await fetch(`/${MANIFEST_URL}?t=${Date.now()}`);
    if (res.ok) {
      cached = (await res.json()) as AssetManifest;
      return cached;
    }
  } catch {
    // 离线/旧工程：走 legacy
  }
  cached = {};
  return cached;
};

/** 测试/重载用：清缓存 */
export const resetAssetManifestCache = (): void => {
  cached = null;
};

/** legacy 路径猜测（旧工程兼容：无映射条目时按老规则找 <id>.glb） */
const legacyUrl = (assetId: string): string => `assets/models/${assetId}.glb`;

/**
 * 造 id → URL 解析器（registerBuiltinFactories / 业务 handler 共用）。
 * 命中映射用真实路径；未命中（映射缺失或旧工程）回退 legacy 猜测。
 */
export const makeAssetUrlResolver = (): (assetId: string) => string => {
  const manifest = cached ?? {};
  return (assetId: string): string => {
    const entry = manifest[assetId];
    if (entry?.model) {
      return `assets/${entry.model.replace(/^assets\//, '')}`;
    }
    return legacyUrl(assetId);
  };
};

/** 注册资产状态贴图（多状态资产：manifest.textures key → URL） */
export const registerManifestStates = (
  assetEngine: AssetEngine,
  assetId: string,
): void => {
  const entry = (cached ?? {})[assetId];
  if (!entry?.textures) {
    return;
  }
  // 状态视觉（visualByState）由 materials.stateMaterials 持有；此处只登记贴图集
  assetEngine.registerAssetStates(assetId, {
    textures: Object.fromEntries(
      Object.entries(entry.textures).map(([k, rel]) => [k, `assets/${rel.replace(/^assets\//, '')}`]),
    ),
    visualByState: {},
  });
};
