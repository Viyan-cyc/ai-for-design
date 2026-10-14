/**
 * asset-catalog.mjs — skill 资产库目录解析（P2.2）
 *
 * 统一从 manifests（真相源）解析资产，替代「文件名猜路径」（models/<id>.glb 硬编码）：
 * - resolveAsset(id, catalog)：真实 modelPath + 格式 + 依赖闭包 + 状态贴图
 * - glTF 多文件（models/<id>/ 子树）整目录复制；GLB 单文件
 * - 路径必须在资产根内（防 manifest 被写入越界路径）
 *
 * 路径基准：manifest 的 modelPath/textures 形如 "assets/models/<id>.glb"，
 * 相对 **skill 根**（import-assets 的 libRel 以 assets/ 前缀落库）。
 * 因此 catalog 以 skill 根为 root；resolveAsset 返回的 files 也是相对 skill 根
 * （消费方拷贝时 dest = <target>/public/<rel>，"assets/…" 前缀自然对齐 public 资产根）。
 *
 * 目录形态（import-assets.mjs 落库产物）：
 *   assets/models/<id>.glb | assets/models/<id>/<file>.gltf + <bin/textures…>
 *   assets/textures/<id>/<key>.<ext>（多状态贴图集）
 *   assets/manifests/<pkg>.json（entries[].modelPath / textures / states）
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, relative, posix } from 'node:path';

/** 构建资产目录：扫 manifests 聚合成 id → entry 索引。 */
export const buildAssetCatalog = (skillRoot) => {
  const root = resolve(skillRoot);
  const manifestsDir = join(root, 'assets', 'manifests');
  const byId = new Map();
  const packages = [];
  if (existsSync(manifestsDir)) {
    for (const f of readdirSync(manifestsDir).filter((x) => x.endsWith('.json'))) {
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(join(manifestsDir, f), 'utf8'));
      } catch {
        packages.push({ file: f, error: 'manifest 解析失败' });
        continue;
      }
      packages.push({ file: f, entries: (pkg.entries ?? []).length });
      for (const e of pkg.entries ?? []) {
        if (e?.id && !byId.has(e.id)) {
          byId.set(e.id, { ...e, _pkg: f });
        }
      }
    }
  }
  return { root, byId, packages };
};

/** 路径必须在资产根内（防 zip-slip 形态的 manifest 越界引用）。 */
const insideRoot = (root, relPath) => {
  if (typeof relPath !== 'string' || relPath === '' || /^([a-zA-Z]:|[\\/])/.test(relPath) || relPath.includes('..')) {
    return false;
  }
  const abs = resolve(root, relPath);
  return relative(root, abs).startsWith('..') === false;
};

/**
 * 解析单个资产：真实文件 + 依赖闭包。
 * @returns {{ ok: true, id, format, files: string[], textures?: object } | { ok: false, id, error }}
 *  files：相对资产根的待复制文件清单（模型 + glTF 外部依赖；目录项展开为文件）
 */
export const resolveAsset = (id, catalog) => {
  const entry = catalog.byId.get(id);
  if (!entry) {
    return { ok: false, id, error: `资产目录无此 id（manifests 未登记）：${id}` };
  }
  const { root } = catalog;
  const modelPath = entry.modelPath;
  if (!insideRoot(root, modelPath)) {
    return { ok: false, id, error: `modelPath 越界或非法：${modelPath}` };
  }
  if (!existsSync(join(root, modelPath))) {
    return { ok: false, id, error: `modelPath 文件缺失：${modelPath}` };
  }

  const format = entry.format === 'gltf' || /\.gltf$/i.test(modelPath) ? 'gltf' : 'glb';
  const files = [];
  if (format === 'glb') {
    files.push(modelPath);
  } else {
    // glTF 多文件：连同所在目录子树整包复制（bin/textures 与 .gltf 同目录或子目录）
    const dirRel = posix.dirname(modelPath.replace(/\\/g, '/'));
    const dirAbs = dirRel === '.' ? root : join(root, dirRel);
    const collect = (dir, prefix) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        if (name.isDirectory()) {
          collect(join(dir, name.name), `${prefix}${name.name}/`);
        } else {
          files.push(`${prefix}${name.name}`);
        }
      }
    };
    collect(dirAbs, dirRel === '.' ? '' : `${dirRel}/`);
  }

  // 多状态贴图集（assets/textures/<id>/…，manifest.textures: key → 相对路径）
  const textures = {};
  if (entry.textures && typeof entry.textures === 'object') {
    for (const [key, rel] of Object.entries(entry.textures)) {
      if (!insideRoot(root, rel) || !existsSync(join(root, rel))) {
        return { ok: false, id, error: `贴图 ${key} 缺失或越界：${rel}` };
      }
      textures[key] = rel;
      files.push(rel);
    }
  }

  return {
    ok: true,
    id,
    format,
    files: [...new Set(files)],
    textures: Object.keys(textures).length > 0 ? textures : undefined,
    entry,
  };
};

/**
 * 从 scene-data 收集被引用的资产 id（params.assetId）。
 * 与旧 init.referencedAssets 同口径，供依赖闭包注入复用。
 */
export const referencedAssetIds = (data) => {
  const ids = new Set();
  for (const [key, group] of Object.entries(data ?? {})) {
    if (key.startsWith('__') || key === 'remove' || !Array.isArray(group)) {
      continue;
    }
    for (const node of group) {
      if (node?.params?.assetId) {
        ids.add(node.params.assetId);
      }
    }
  }
  return [...ids];
};
