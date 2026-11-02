/**
 * asset-manifest — 生成工程的资产映射（P2-R1：init→build→run 同一真相源）
 *
 * init 脚手架从 skill manifests 落一份 id→相对路径映射到
 * public/scene3d/assets/asset-manifest.json；build.mjs 与运行时 loader 共用它，
 * 消灭「models/<id>.glb 猜路径」（多文件 glTF/自定义落点全支持）。
 *
 * 旧工程无该文件 → 回退 legacy 猜测路径（assets/models/<id>.glb|gltf 逐个试），
 * 兼容已有项目不自动升级（§4.6）。
 */
import type { AssetEngine } from './engine/AssetEngine';
import { offlineData } from './offline';

/** 映射条目：模型相对路径（相对 public/scene3d/assets/，如 "models/x.glb"、"models/id/model.gltf"） */
export interface AssetManifestEntry {
  model: string;
  format: 'glb' | 'gltf';
  textures?: Record<string, string>;
}

export type AssetManifest = Record<string, AssetManifestEntry>;

const MANIFEST_URL = 'assets/asset-manifest.json';

let cached: AssetManifest | null = null;
const manifestRequests = new Map<string, Promise<AssetManifest>>();
const bindings = new WeakMap<AssetEngine, { manifest: AssetManifest; base: string }>();
export const bindAssetManifest = (engine: AssetEngine, manifest: AssetManifest, base: string): void => { bindings.set(engine, { manifest, base }); };

/** 拉取并缓存资产映射（fetch 失败 = 无映射，返回空表走 legacy 回退） */
export const loadAssetManifest = async (base = 'scene3d/'): Promise<AssetManifest> => {
  const offline = offlineData();
  if (offline) return (cached = offline.manifest);
  let request = manifestRequests.get(base);
  if (!request) {
    request = fetch(`${base}${MANIFEST_URL}`)
      .then(async response => response.ok ? await response.json() as AssetManifest : {})
      .catch(() => ({}));
    manifestRequests.set(base, request);
  }
  cached = await request;
  return cached;
};

/** 测试/重载用：清缓存 */
export const resetAssetManifestCache = (): void => {
  cached = null;
  manifestRequests.clear();
};

/** legacy 路径猜测（旧工程兼容：无映射条目时按老规则找 <id>.glb） */
const legacyUrl = (assetId: string): string => `assets/models/${assetId}.glb`;

/**
 * 造 id → URL 解析器（registerBuiltinFactories / 业务 handler 共用）。
 * 命中映射用真实路径；未命中（映射缺失或旧工程）回退 legacy 猜测。
 */
export const makeAssetUrlResolver = (engine?: AssetEngine): (assetId: string) => string => {
  const binding = engine ? bindings.get(engine) : undefined;
  const manifest = binding?.manifest ?? cached ?? {};
  const base = binding?.base ?? 'scene3d/';
  return (assetId: string): string => {
    const entry = manifest[assetId];
    if (entry?.model) {
      return `${base}assets/${entry.model.replace(/^assets\//, '')}`;
    }
    return `${base}${legacyUrl(assetId)}`;
  };
};

/** 注册资产状态贴图（多状态资产：manifest.textures key → URL） */
export const registerManifestStates = (
  assetEngine: AssetEngine,
  assetId: string,
): void => {
  const binding = bindings.get(assetEngine);
  const base = binding?.base ?? 'scene3d/';
  const entry = (binding?.manifest ?? cached ?? {})[assetId];
  if (!entry?.textures) {
    return;
  }
  // 状态视觉（visualByState）由 scene/appearance.stateMaterials 持有；此处只登记贴图集
  assetEngine.registerAssetStates(assetId, {
    textures: Object.fromEntries(
      Object.entries(entry.textures).map(([k, rel]) => [k, `${base}assets/${rel.replace(/^assets\//, '')}`]),
    ),
    visualByState: {},
  });
};
