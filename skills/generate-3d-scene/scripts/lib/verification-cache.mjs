/**
 * verification-cache.mjs — 验证结果缓存（内容 hash 键 + 按变更失效）
 *
 * P5.1/V22 + P5-R1：同 hash 检查命中缓存；改 scene/handler/edit/lock/vendor
 * **及资产闭包（模型/bin/贴图）、index.html、expect 内容、目标 URL、session 指纹**
 * 均失效；未知影响按保守失效（宁可重跑，不冒充命中）。
 *
 * 缓存 key 组成（P5-R1 修复后的完整输入）：
 *   - 检查名（check id，如 'verify:run' / 'build' / 'typecheck'）+ CHECK_VERSION
 *   - 影响域文件内容 hash：
 *       scene-data.json / asset-manifest.json / **public/assets 资产闭包整树**
 *       （模型 .glb/.gltf/.bin/贴图——改任一字节 key 即变）
 *       src/**（run 模式不含 src/edit；edit 模式含——run/edit 结论互不复用）
 *       index.html（入口模板）、vendor tgz、lock、package.json
 *       eslint/tsconfig/vite 配置（config 域）
 *   - 目标指纹：URL、expect 内容 hash、viewport、browser/gpu、mode、profile
 *   - 运行会话指纹：options.session 的 id（注入会话 ≠ 自起会话，结论不互用）
 *
 * 语义约束：
 *   - 只缓存 PASS 结论（FAIL/WARN/SKIP 不进缓存——失败修复后必须重验）
 *   - 缓存条目记录**完整 key 快照**（keyInputs）：lookup 时重算 key 并整串比对，
 *     任何输入漂移（含本模块未显式枚举的 key 成分变化）都不会命中
 *   - 命中时输出 source='cache' 的报告，不静默吞掉
 *   - 无法可靠绑定目标构建与磁盘快照（资产目录读取失败等）→ key 标记 unstable，
 *     永不命中也不存储（宁可不缓存，不假 PASS）
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** 检查器版本（缓存键成分）：语义变更时递增，使全部旧缓存失效。 */
export const CHECK_VERSION = 'p5-v2';

/** 缓存文件名（工程根下，单文件 JSON）。 */
export const CACHE_FILENAME = '.verification-cache.json';

/**
 * 文件 → 影响域标签（changeSet 分层；返回 null = 未知影响 → 保守全失效）。
 * 域定义对齐 Spec §3.5 + P5-R1：
 *   'scene'   scene-data.json / asset-manifest.json / public/assets/**（资产闭包）
 *   'code'    src/** 非 edit（run 与 edit 共享的 core/handlers/cards）
 *   'edit'    src/edit/**（只影响 edit 模式结论）
 *   'deps'    package-lock / package.json / vendor tgz / node_modules 语义
 *   'config'  eslint/tsconfig/vite/index.html（影响 build/typecheck/lint 结论）
 */
export const fileAffect = (file) => {
  const f = file.split(sep).join('/');
  if (f.endsWith('scene-data.json') || f.endsWith('asset-manifest.json')
    || f.startsWith('public/assets/') || f === 'index.html') {
    return 'scene';
  }
  if (f.startsWith('src/edit/') || f.includes('/edit/')) {
    return 'edit';
  }
  if (f.startsWith('src/')) {
    return 'code';
  }
  if (f.endsWith('package-lock.json') || f.endsWith('package.json')
    || f.includes('vendor/') || f.startsWith('node_modules')) {
    return 'deps';
  }
  if (f.endsWith('.config.mjs') || f.endsWith('.config.ts') || f.startsWith('tsconfig')
    || f.endsWith('.npmrc')) {
    return 'config';
  }
  return null;
};

/**
 * 每个检查名依赖的影响域集合。
 * run 模式不依赖 edit 域（编辑器代码不影响运行态）；edit 模式依赖全部源码。
 * P5-RR1：verify:run/edit 补 config 域——vite.config 的 base/alias 直接改变运行
 * 行为（页面资源加载路径），改配置必须失效浏览器结论。
 */
export const CHECK_AFFECTS = {
  'verify:run': ['scene', 'code', 'deps', 'config'],
  'verify:edit': ['scene', 'code', 'edit', 'deps', 'config'],
  build: ['scene', 'code', 'edit', 'deps', 'config'],
  typecheck: ['code', 'edit', 'deps', 'config'],
  lint: ['code', 'edit', 'deps', 'config'],
};

/** hash 辅助：Buffer/字符串 → sha256 hex。 */
const sha = (data) => createHash('sha256').update(data).digest('hex');

// 读文件内容 hash：不存在 → 'missing'（稳定的键成分——空工程/无配置是常态）；
// 读取失败（权限/IO 错误）→ null（不稳定，调用方按 unstable 处理）。
const hashFile = (absPath) => {
  try {
    return sha(readFileSync(absPath));
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return 'missing';
    }
    return null;
  }
};

/** 目录内容聚合 hash（跳过 node_modules/dist/.git；大目录逐文件名+hash 拼接）。 */
const hashTree = (root, skip = new Set(['node_modules', 'dist', '.git', '.smoke-r', '.smoke-vendor'])) => {
  if (!existsSync(root)) {
    return sha(`missing:${ root}`);
  }
  const parts = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      // 目录读取失败 → 聚合 hash 不稳定，调用方须按 unstable 处理
      throw new Error(`hashTree unreadable: ${dir}`);
    }
    for (const name of names) {
      if (skip.has(name)) {
        continue;
      }
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
      } else {
        parts.push(`${relative(root, full).split(sep).join('/')}:${sha(readFileSync(full))}`);
      }
    }
  }
  parts.sort();
  return sha(parts.join('\n'));
};

/** src 树分层 hash：{ core（非 edit）, edit }——run/edit 隔离的键成分。 */
const hashSrcSplit = (srcDir) => {
  const coreParts = [];
  const editParts = [];
  const walk = (dir, bucket) => {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      throw new Error(`hashSrcSplit unreadable: ${dir}`);
    }
    for (const name of names) {
      if (name === 'node_modules' || name === 'dist') {
        continue;
      }
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        // edit/ 子树整目录进 edit 桶（edit 内部不再分层）
        walk(full, dir === srcDir && name === 'edit' ? editParts : bucket);
      } else if (/\.(ts|vue)$/.test(name)) {
        bucket.push(`${relative(srcDir, full).split(sep).join('/')}:${sha(readFileSync(full))}`);
      }
    }
  };
  if (!existsSync(srcDir)) {
    return { core: sha('missing'), edit: sha('missing') };
  }
  walk(srcDir, coreParts);
  coreParts.sort();
  editParts.sort();
  return { core: sha(coreParts.join('\n')), edit: sha(editParts.join('\n')) };
};

/**
 * 计算缓存键（P5-R1：返回 { key, inputs, stable }）。
 *
 * @param {string} projectRoot 工程根
 * @param {object} opts
 *   - check：检查名（CHECK_AFFECTS 键或任意 → 全域保守）
 *   - mode/profile/viewport/browser/gpu：调度维度
 *   - url：目标 URL（P5-R1：换 URL ≠ 同一检查目标）
 *   - expectHash：期望文件内容 hash（P5-R1：换 expect ≠ 同一断言）
 *   - sessionFingerprint：运行会话指纹（P5-R1：注入 session 不与自起会话互用结论）
 *   - affects 覆盖：changeSet 已知时直接传影响域列表
 * @returns {{ key: string, inputs: Record<string,string>, stable: boolean }}
 *   stable=false（资产/源码树读取失败）→ key 仍返回（用于区分）但语义上永不命中
 */
export const computeCacheKey = (projectRoot, opts = {}) => {
  const {
    check = 'unknown', mode = 'run', profile = 'preview', viewport = '1280x800',
    browser = 'edge-headless', gpu = 'swiftshader',
    url = '', expectHash = '', sessionFingerprint = '',
  } = opts;
  const affects = opts.affects ?? CHECK_AFFECTS[check] ?? ['scene', 'code', 'edit', 'deps', 'config'];
  const inputs = {};
  inputs.v = CHECK_VERSION;
  inputs.check = check;
  inputs.mode = mode;
  inputs.profile = profile;
  inputs.viewport = viewport;
  inputs.browser = `${browser}:${gpu}`;
  inputs.url = url;
  inputs.expectHash = expectHash;
  inputs.sessionFingerprint = sessionFingerprint;

  let stable = true;
  const pushOrUnstable = (label, value) => {
    if (value === null || value === undefined) {
      stable = false;
      inputs[label] = 'unstable';
    } else {
      inputs[label] = value;
    }
  };

  try {
    if (affects.includes('scene')) {
      pushOrUnstable('sceneData', hashFile(join(projectRoot, 'public', 'scene-data.json')));
      pushOrUnstable('assetManifest', hashFile(join(projectRoot, 'public', 'assets', 'asset-manifest.json')));
      // P5-R1：资产闭包整树（模型/bin/贴图改一个字节 key 即变）
      pushOrUnstable('assetsClosure', hashTree(join(projectRoot, 'public', 'assets')));
      // P5-R1：入口模板（index.html 改脚本引用/容器结构影响挂载检查）
      pushOrUnstable('indexHtml', hashFile(join(projectRoot, 'index.html')));
    }
    if (affects.includes('code') || affects.includes('edit')) {
      const split = hashSrcSplit(join(projectRoot, 'src'));
      if (affects.includes('code')) {
        inputs.srcCore = split.core;
      }
      if (affects.includes('edit')) {
        inputs.srcEdit = split.edit;
      }
    }
    if (affects.includes('deps')) {
      pushOrUnstable('lock', hashFile(join(projectRoot, 'package-lock.json')));
      pushOrUnstable('pkg', hashFile(join(projectRoot, 'package.json')));
      const vendorDir = join(projectRoot, 'vendor');
      inputs.vendor = existsSync(vendorDir) ? hashTree(vendorDir) : 'none';
    }
    if (affects.includes('config')) {
      for (const f of ['eslint.config.mjs', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts']) {
        pushOrUnstable(f, hashFile(join(projectRoot, f)));
      }
    }
  } catch {
    // hashTree/hashSrcSplit 读取失败：unstable 键——永不命中也不存储
    return { key: sha(`unstable:${JSON.stringify(inputs)}`), inputs, stable: false };
  }

  // stable=false 时（单文件 hash null）同样标记；key 仍可计算用于记录，但语义拒绝
  const key = stable ? sha(JSON.stringify(inputs)) : sha(`unstable:${JSON.stringify(inputs)}`);
  return { key, inputs, stable };
};

/**
 * 变更清单 → 影响域集合（V22「改什么失效什么」）。
 * @param {string[]} changedFiles 相对工程根的变更文件
 * @returns {string[]|null} 影响域；null = 有未知影响文件 → 全失效
 */
export const affectsFromChanges = (changedFiles) => {
  const affects = new Set();
  for (const f of changedFiles ?? []) {
    const domain = fileAffect(f);
    if (domain === null) {
      return null;
    }
    affects.add(domain);
  }
  return [...affects];
};

/** 读缓存（文件不存在返回空表）。 */
export const loadCache = (projectRoot) => {
  const p = join(projectRoot, CACHE_FILENAME);
  if (!existsSync(p)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
};

/** 写缓存（原子覆盖写）。 */
export const saveCache = (projectRoot, cache) => {
  writeFileSync(join(projectRoot, CACHE_FILENAME), `${JSON.stringify(cache, null, 2)}\n`);
};

/**
 * 查缓存（P5-R1：条目记录的 keyInputs 必须与当前 key 整串一致才命中）。
 * @param {string} key computeCacheKey 产物
 * @param {object} keyInputs computeCacheKey 产物（键快照比对）
 * @returns {{ hit: boolean, report?: object }} 命中时 report 为原 PASS 报告（带 source:'cache'）
 */
export const lookup = (projectRoot, key, keyInputs) => {
  const cache = loadCache(projectRoot);
  const entry = cache[key];
  if (!entry || entry.verdict !== 'PASS') {
    return { hit: false };
  }
  // P5-R1：键快照整串比对——key 相同但记录的输入指纹不同（碰撞/篡改）不放行
  if (keyInputs && JSON.stringify(entry.keyInputs) !== JSON.stringify(keyInputs)) {
    return { hit: false };
  }
  return {
    hit: true,
    report: {
      ...entry.report,
      source: 'cache',
      cachedAt: entry.cachedAt,
      duration: 0,
    },
  };
};

/**
 * 存结果（只存 PASS 且 stable；FAIL/WARN/SKIP/unstable 拒绝）。
 * @param {object} keyInputs computeCacheKey 产物（随条目持久化，命中时比对）
 * @returns {boolean} 是否实际写入
 */
export const record = (projectRoot, key, report, opts = {}) => {
  if (report?.verdict !== 'PASS') {
    return false;
  }
  if (opts.stable === false) {
    return false; // 输入指纹不稳定（资产读取失败等）——不缓存
  }
  const cache = loadCache(projectRoot);
  cache[key] = {
    verdict: 'PASS',
    cachedAt: new Date().toISOString(),
    checkVersion: CHECK_VERSION,
    keyInputs: opts.keyInputs ?? null,
    affects: opts.affects ?? CHECK_AFFECTS[opts.check ?? 'unknown'] ?? null,
    summary: opts.summary ?? {
      checks: report.checks?.map((c) => ({ id: c.id, status: c.status })) ?? null,
      duration: report.duration ?? null,
    },
    report: {
      verdict: 'PASS',
      profile: report.profile,
      mode: report.mode,
      checks: report.checks ?? [],
    },
  };
  saveCache(projectRoot, cache);
  return true;
};

/**
 * 失效：按影响域删除相关条目。
 * @param {string[]|null} affects 影响域列表；null = 全失效（未知改动保守处理）
 * @returns {number} 删除条数
 */
export const invalidate = (projectRoot, affects) => {
  const cache = loadCache(projectRoot);
  const entries = Object.entries(cache);
  if (!entries.length) {
    return 0;
  }
  let removed = 0;
  const next = {};
  for (const [key, entry] of entries) {
    const affectsOfEntry = entry.affects ?? null;
    // 条目影响域未记录、或与失效域相交 → 删（保守）
    const stale = affects === null
      || affectsOfEntry === null
      || affects.some((a) => affectsOfEntry.includes(a));
    if (stale) {
      removed += 1;
    } else {
      next[key] = entry;
    }
  }
  if (removed) {
    saveCache(projectRoot, next);
  }
  return removed;
};

/** 清空全部缓存（CLI --reset）。 */
export const resetCache = (projectRoot) => {
  saveCache(projectRoot, {});
};
