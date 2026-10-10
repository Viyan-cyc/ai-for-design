/**
 * import-assets.mjs — 资产入库管线（解压 / manifest 校验 / 规格门禁 / 落库 / 建索引）
 *
 * 零依赖：自解析 ZIP（stored + deflate），内嵌 manifest schema 校验器，
 * 复用 validate-model.mjs 做规格门禁、build-search-index.mjs 重建索引并跑检索冒烟。
 *
 * 流程：
 *   ① 解压/读目录 → 临时 staging 目录
 *   ② manifest schema 校验（embedded validator）
 *   ③ 跨文件校验：file_path/thumbnail/textures/states.model 引用的文件必须齐全
 *   ④ 规格门禁：每个模型过 validate-model（默认 art 档；--strict 切 AI 生成档）
 *   ⑤ 落库：模型/贴图/缩略图 → assets/{models,textures,thumbnails}；包 manifest → assets/manifests/
 *   ⑥ 重建检索索引 + 检索冒烟（失败即入库 FAIL）
 *
 * CLI：node import-assets.mjs <package.zip|dir> [--name <pkg>] [--lib <dir>] [--strict]
 *      [--profile main|prop] [--force] [--no-index] [--json]
 *   退出码：0 成功 / 1 校验或门禁失败 / 2 用法或 IO 错误
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve, posix, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { inflateRawSync, deflateRawSync, crc32 } from 'node:zlib';
import { validateModelFile } from './validate-model.mjs';
import { buildIndexFile, runSmoke, DEFAULT_LIB } from './build-search-index.mjs';

const KNOWN_CATEGORIES = ['demo', 'equipment', 'building', 'vegetation', 'vehicle'];
const MODEL_EXTS = new Set(['.glb', '.gltf']);
const ID_RE = /^[a-z][a-z0-9_]*$/;

/* ── ZIP 读取（stored + deflate，零依赖）────────────────────────────────────── */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

/** 解析 ZIP → Map<name, Buffer>（跳过目录项）。 */
export const readZip = (buffer) => {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let eocd = -1;
  const from = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= from; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('非 ZIP 压缩包（找不到 EOCD 记录）');
  }
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map();
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(p, true) !== CEN_SIG) {
      throw new Error('ZIP 中央目录损坏');
    }
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);
    if (view.getUint32(localOffset, true) !== LOC_SIG) {
      throw new Error(`ZIP 本地头损坏: ${name}`);
    }
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const comp = buffer.subarray(dataStart, dataStart + compSize);
    let data;
    if (method === 0) {
      data = Buffer.from(comp);
    } else if (method === 8) {
      data = inflateRawSync(comp);
    } else {
      throw new Error(`不支持的 ZIP 压缩方式 ${method}: ${name}`);
    }
    if (!name.endsWith('/')) {
      files.set(name.replace(/\\/g, '/'), data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
};

/** 写 ZIP（deflate 优先，回退 stored）——供构建样例包/往返测试用。 */
export const writeZip = (entries, outPath) => {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data);
    const sum = crc32(data);
    const comp = deflateRawSync(data);
    const useDeflate = comp.length < data.length;
    const payload = useDeflate ? comp : data;
    const method = useDeflate ? 8 : 0;
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(LOC_SIG, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt16LE(0x800, 6);
    loc.writeUInt16LE(method, 8);
    loc.writeUInt32LE(sum, 14);
    loc.writeUInt32LE(payload.length, 18);
    loc.writeUInt32LE(data.length, 22);
    loc.writeUInt16LE(nameBuf.length, 26);
    chunks.push(loc, nameBuf, payload);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(CEN_SIG, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x800, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(sum, 16);
    cen.writeUInt32LE(payload.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += loc.length + nameBuf.length + payload.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  writeFileSync(outPath, Buffer.concat([...chunks, centralBuf, eocd]));
};

/* ── manifest schema 校验（内嵌）────────────────────────────────────── */

const isRelPath = (p) => typeof p === 'string' && p.length > 0 && !posix.isAbsolute(p) && !/(^|\/)\.\.(\/|$)/.test(p) && !p.includes('\\');
const basenameOf = (p) => p.split('/').pop();

/** 从 file_name 派生合规 id。 */
const deriveId = (entry) => {
  if (entry.id) {
    return entry.id;
  }
  const stem = basenameOf(entry.file_name ?? '').replace(/\.[^.]+$/, '').toLowerCase();
  return stem;
};

/**
 * 校验 manifest 结构（schema + 双形态扩展）。
 * @returns {{errors: string[], warnings: string[]}}
 */
export const validateManifest = (obj) => {
  const errors = [];
  const warnings = [];
  if (!obj || typeof obj !== 'object') {
    return { errors: ['manifest 不是 JSON 对象'], warnings };
  }
  if (!obj.meta || typeof obj.meta !== 'object') {
    errors.push('缺少 meta 对象');
  } else if (!obj.meta.version) {
    warnings.push('meta.version 建议填写（版本追溯）');
  }
  if (!Array.isArray(obj.data) || obj.data.length === 0) {
    errors.push('data 必须是非空数组');
    return { errors, warnings };
  }
  const ids = new Set();
  obj.data.forEach((e, idx) => {
    const at = `data[${idx}]`;
    if (!e || typeof e !== 'object') {
      errors.push(`${at} 不是对象`);
      return;
    }
    if (typeof e.name !== 'string' || !e.name) {
      errors.push(`${at}.name 必填（显示名）`);
    }
    if (typeof e.file_name !== 'string' || !e.file_name) {
      errors.push(`${at}.file_name 必填`);
    }
    if (!isRelPath(e.file_path)) {
      errors.push(`${at}.file_path 必填且为包内相对路径（不含 .. / 绝对路径）`);
    } else if (e.file_name && basenameOf(e.file_path) !== e.file_name) {
      errors.push(`${at}.file_name（${e.file_name}）须等于 file_path 的文件名（${basenameOf(e.file_path)}）`);
    }
    if (e.file_path && !MODEL_EXTS.has(extname(e.file_path).toLowerCase())) {
      errors.push(`${at}.file_path 须为 .glb 或 .gltf`);
    }
    if (e.thumbnail_path !== undefined && !isRelPath(e.thumbnail_path)) {
      errors.push(`${at}.thumbnail_path 须为包内相对路径`);
    }
    if (e.tags !== undefined && (!Array.isArray(e.tags) || e.tags.some((t) => typeof t !== 'string'))) {
      errors.push(`${at}.tags 须为字符串数组`);
    }
    if (e.category !== undefined && typeof e.category === 'string' && !KNOWN_CATEGORIES.includes(e.category)) {
      warnings.push(`${at}.category "${e.category}" 不在建议集 [${KNOWN_CATEGORIES.join('/')}]（继续入库，检索仍可用）`);
    }
    const id = deriveId(e);
    if (!ID_RE.test(id)) {
      errors.push(`${at} id "${id}" 不合法（应 ^[a-z][a-z0-9_]*$；可显式填 id）`);
    } else if (ids.has(id)) {
      errors.push(`${at} id "${id}" 在同包内重复`);
    }
    ids.add(id);

    // 双形态：textures / states
    if (e.textures !== undefined) {
      if (typeof e.textures !== 'object' || Array.isArray(e.textures)) {
        errors.push(`${at}.textures 须为对象（key → 包内相对路径）`);
      } else {
        for (const [key, val] of Object.entries(e.textures)) {
          if (!isRelPath(val)) {
            errors.push(`${at}.textures.${key} 须为包内相对路径`);
          }
        }
      }
    }
    if (e.states !== undefined) {
      if (typeof e.states !== 'object' || Array.isArray(e.states)) {
        errors.push(`${at}.states 须为对象（状态名 → StateVisual）`);
      } else if (!e.textures) {
        errors.push(`${at}.states 使用了 map 键但未声明 textures`);
      } else {
        for (const [stateName, visual] of Object.entries(e.states)) {
          if (!visual || typeof visual !== 'object') {
            errors.push(`${at}.states.${stateName} 须为对象`);
            continue;
          }
          if (visual.map !== undefined && !(visual.map in e.textures)) {
            errors.push(`${at}.states.${stateName}.map "${visual.map}" 不在 textures 的 key 中`);
          }
        }
      }
    }
  });
  return { errors, warnings };
};

/* ── 解包到 staging ───────────────────────────────────────────────────────── */

/** zip 或目录 → staging 目录（返回 staging 路径，调用方负责清理）。 */
const stagePackage = (input) => {
  const st = statSync(input);
  const staging = mkdtemp(`gts3d-import-`);
  if (st.isDirectory()) {
    copyTree(input, staging);
    return staging;
  }
  const files = readZip(readFileSync(input));
  for (const [name, data] of files) {
    const dest = resolve(staging, name);
    if (!dest.startsWith(staging + sep)) {
      throw new Error(`包内路径越界（zip slip）: ${name}`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
  }
  return staging;
};

const mkdtemp = (prefix) => {
  const dir = join(tmpdir(), prefix + Math.random().toString(36).slice(2));
  mkdirSync(dir, { recursive: true });
  return dir;
};

/** 目录树复制。 */
const copyTree = (src, dest) => {
  mkdirSync(dest, { recursive: true });
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, ent.name);
    const d = join(dest, ent.name);
    if (ent.isDirectory()) {
      copyTree(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
};

/* ── 落库 ─────────────────────────────────────────────────────────────────── */

/** 计算 modelPath / 贴图落点用的库内相对路径（统一以 assets/ 前缀）。 */
const libRel = (...parts) => posix.join('assets', ...parts);

/** 读库内已有资产 id → 所属包（跨包唯一性检查用）。 */
const collectExistingIds = (libDir) => {
  const map = new Map();
  const dir = join(libDir, 'manifests');
  if (!existsSync(dir)) {
    return map;
  }
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      for (const e of pkg.entries ?? []) {
        map.set(e.id, f);
      }
    } catch {
      /* 忽略坏包（重建索引时会另行报错） */
    }
  }
  return map;
};

/**
 * 入库：staging 包目录 → 资产库。
 * @returns {{entries: object[], warnings: string[]}}
 */
export const importPackage = (staging, { libDir = DEFAULT_LIB, packageName, strict = false, profile = 'main', force = false } = {}) => {
  const manifestPath = join(staging, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error('包内缺少 manifest.json');
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { errors, warnings } = validateManifest(manifest);
  if (errors.length) {
    const err = new Error(`manifest 校验失败:\n  ${errors.join('\n  ')}`);
    err.details = { errors, warnings };
    throw err;
  }

  const existing = collectExistingIds(libDir);
  const pkgName = packageName ?? 'package';
  const outModels = join(libDir, 'models');
  const outThumbs = join(libDir, 'thumbnails');
  const outTex = join(libDir, 'textures');
  const outManifests = join(libDir, 'manifests');
  for (const d of [outModels, outThumbs, outTex, outManifests]) {
    mkdirSync(d, { recursive: true });
  }

  const entries = [];
  const gateReports = [];
  for (const e of manifest.data) {
    const id = deriveId(e);
    const owner = existing.get(id);
    if (owner && owner !== `${pkgName}.json` && !force) {
      throw new Error(`资产 id "${id}" 已被包 ${owner} 占用（--force 可覆盖）`);
    }
    const srcModel = join(staging, e.file_path);
    if (!existsSync(srcModel)) {
      throw new Error(`data id=${id} 的模型文件缺失: ${e.file_path}`);
    }
    // 跨文件校验：缩略图 / 贴图集
    if (e.thumbnail_path && !existsSync(join(staging, e.thumbnail_path))) {
      throw new Error(`data id=${id} 的缩略图缺失: ${e.thumbnail_path}`);
    }
    for (const [key, rel] of Object.entries(e.textures ?? {})) {
      if (!existsSync(join(staging, rel))) {
        throw new Error(`data id=${id} 的贴图 "${key}" 缺失: ${rel}`);
      }
    }

    // 规格门禁（从 staging 读，gltf 外部引用相对自洽）
    const report = validateModelFile(srcModel, { assetId: id, strict, profile });
    // 双形态入库判定：多状态资产（白模+贴图集）要求 UV 完好，缺 UV 即 FAIL
    if (e.textures && report.uvMissing) {
      const err = new Error(`规格门禁 FAIL（id=${id}）: 多状态资产（textures+states）要求白模 UV 完好，但 POSITION 网格缺 TEXCOORD_0`);
      err.details = { gateReports: [{ id, passed: false, violations: [err.message], warnings: [] }] };
      throw err;
    }
    gateReports.push({ id, passed: report.passed, violations: report.violations, warnings: report.warnings });
    if (!report.passed) {
      const err = new Error(`规格门禁 FAIL（id=${id}）:\n  ${report.violations.join('\n  ')}`);
      err.details = { gateReports };
      throw err;
    }

    const ext = extname(e.file_name).toLowerCase();
    const format = ext === '.glb' ? 'glb' : 'gltf';
    let modelDest;
    if (format === 'glb') {
      modelDest = join(outModels, `${id}.glb`);
      copyFileSync(srcModel, modelDest);
    } else {
      // gltf 多文件：连同其所在目录子树复制到 models/<id>/
      const subDir = dirname(e.file_path);
      modelDest = join(outModels, id);
      copyTree(join(staging, subDir === '.' ? '' : subDir), modelDest);
    }

    let thumbnail;
    if (e.thumbnail_path) {
      const tExt = extname(e.thumbnail_path);
      thumbnail = libRel('thumbnails', `${id}${tExt}`);
      copyFileSync(join(staging, e.thumbnail_path), join(outThumbs, `${id}${tExt}`));
    }

    let textures;
    if (e.textures) {
      textures = {};
      for (const [key, rel] of Object.entries(e.textures)) {
        const tExt = extname(rel);
        const dest = join(outTex, id, `${key}${tExt}`);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(join(staging, rel), dest);
        textures[key] = libRel('textures', id, `${key}${tExt}`);
      }
    }

    entries.push({
      id,
      name: e.name,
      file: e.file_name,
      format,
      modelPath: format === 'glb' ? libRel('models', `${id}.glb`) : libRel('models', id, basename(e.file_path)),
      category: e.category ?? '',
      tags: e.tags ?? [],
      description: e.description ?? '',
      search_text: e.search_text ?? '',
      thumbnail,
      polycount: report.triangles,
      textures,
      states: e.states,
      gate: { tier: report.tier, conventionsOk: report.conventionsOk, deviations: report.warnings },
      report,
    });
  }

  // 写包 manifest（用户元数据 + 解析结果，供 build-search-index 消费）
  writeFileSync(
    join(outManifests, `${pkgName}.json`),
    `${JSON.stringify({ package: pkgName, importedAt: new Date().toISOString(), meta: manifest.meta, entries }, null, 2)}\n`,
  );

  const devWarnings = gateReports.flatMap((g) => g.warnings.map((w) => `id=${g.id}: ${w}`));
  return { entries, warnings: [...warnings, ...devWarnings] };
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node import-assets.mjs <package.zip|dir> [选项]

选项:
  --name <pkg>        包名（默认取压缩包/目录 basename）
  --lib <dir>         资产库目录（默认 skill 的 assets/）
  --strict            规格门禁切 strict 档（AI 生成资产；默认 art 档）
  --profile main|prop 面数档位（默认 main）
  --force             允许覆盖其他包已占用的资产 id
  --no-index          跳过重建检索索引与冒烟
  --json              输出摘要 JSON`;

const parseArgs = (argv) => {
  const opts = {};
  const pos = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--name') {
      opts.name = argv[++i];
    } else if (a === '--lib') {
      opts.lib = argv[++i];
    } else if (a === '--strict') {
      opts.strict = true;
    } else if (a === '--profile') {
      opts.profile = argv[++i];
    } else if (a === '--force') {
      opts.force = true;
    } else if (a === '--no-index') {
      opts.noIndex = true;
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (!a.startsWith('--')) {
      pos.push(a);
    } else {
      throw new Error(`未知选项: ${a}`);
    }
  }
  return { opts, input: pos[0] };
};

const main = () => {
  const { opts, input } = parseArgs(process.argv.slice(2));
  if (opts.help || !input) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  if (!existsSync(input)) {
    console.error(`[import-assets] 输入不存在: ${input}`);
    process.exit(2);
  }
  const libDir = opts.lib ? resolve(opts.lib) : DEFAULT_LIB;
  const packageName = opts.name ?? basename(input).replace(/\.(zip|tar|gz)$/i, '');
  let staging;
  try {
    staging = stagePackage(resolve(input));
  } catch (err) {
    console.error(`[import-assets] 解包失败: ${err.message}`);
    process.exit(2);
  }
  let result;
  try {
    result = importPackage(staging, { libDir, packageName, strict: opts.strict, profile: opts.profile, force: opts.force });
  } catch (err) {
    console.error(`[import-assets] 入库失败: ${err.message}`);
    process.exit(1);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  const summary = {
    package: packageName,
    libDir,
    imported: result.entries.map((e) => ({ id: e.id, modelPath: e.modelPath, polycount: e.polycount })),
    warnings: result.warnings,
  };

  if (!opts.noIndex) {
    const { indexPath, index } = buildIndexFile(libDir);
    const smoke = runSmoke(index);
    summary.indexPath = indexPath;
    summary.smoke = smoke.passed;
    summary.smokeLines = smoke.lines;
    if (!smoke.passed) {
      for (const line of smoke.lines) {
        console.error(`  ${line}`);
      }
      console.error('[import-assets] 检索冒烟 FAIL → 入库 FAIL');
      process.exit(1);
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`[import-assets] 入库成功：${packageName} → ${result.entries.length} 资产`);
    for (const e of result.entries) {
      console.log(`  ✓ ${e.id}  ${e.modelPath}  ${e.polycount} 三角面`);
    }
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
    if (!opts.noIndex) {
      console.log(`[import-assets] 索引已重建并冒烟 PASS：${summary.indexPath}`);
    }
  }
  process.exit(0);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
