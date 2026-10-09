/**
 * validate-model.mjs — GLB/glTF 规格校验器（入库门禁 + 独立 CLI）
 *
 * 零依赖：自解析 GLB（JSON chunk + BIN chunk）与 .gltf（外部 bin/贴图或 data: URI），
 * 统计面数/节点/命名/贴图尺寸/包围盒，对照 model-spec.md 默认规格出报告。
 * 报告字段对齐 template 的 ModelSpecReport（types.ts），供 build.mjs 读预算估算。
 *
 * CLI：
 *   node validate-model.mjs <model.glb|gltf> [--profile main|prop] [--json]
 *        [--max-triangles N] [--max-nodes N] [--max-texture-size N] [--max-textures N]
 *        [--origin-tolerance F] [--height-min F] [--height-max F] [--check-mesh-names]
 *   退出码：0 通过 / 1 规格违规 / 2 用法或解析错误
 *
 * 作为模块被 import-assets.mjs 复用：validateModelFile / inspectModel / DEFAULT_LIMITS。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

/* ── 规格阈值（§4.2 默认值 + 2026-10-09 分级门禁裁决）──────────────────────────
 *
 * 两档：
 * - art（默认）：第三方美术资产档。性能类阈值放宽（真实资产普遍 10k+ 面 / 2048 贴图）；
 *   命名/原点/高度属"约定类"，默认**告警不阻断**（Sketchfab/Collada 导出系统性违规，
 *   且美术资产以不透明实例加载，内部命名/原点对其使用价值影响很小）。
 * - strict：AI 生成资产档（降级阶梯第 4/5 层）。§4.2 紧阈值；约定类升为**阻断**。
 *
 * 用户可经 CLI 逐项覆盖（覆盖项优先级最高，profile --strict 之后仍可微调）。
 */
export const ART_LIMITS = {
  maxTriangles: 50000,
  maxNodes: 64,
  maxTextureSize: 2048,
  maxTextures: 8,
  originTolerance: 0.01,
  heightMin: 0.05,
  heightMax: 200,
};

export const STRICT_LIMITS = {
  ...ART_LIMITS,
  maxTriangles: 10000,
  maxTextureSize: 1024,
  maxTextures: 4,
};

const PROFILE_TRIANGLES = {
  art: { main: 50000, prop: 5000 },
  strict: { main: 10000, prop: 2000 },
};

/** 兼容别名（旧调用点语义 = 默认 art 档） */
export const DEFAULT_LIMITS = ART_LIMITS;

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/* ── GLB / glTF 资源装载 ──────────────────────────────────────────────────── */

/** 解析 GLB 容器 → { json, bin }；非 GLB 抛错。 */
export const parseGlb = (buffer) => {
  if (buffer.byteLength < 12) {
    throw new Error('文件过小，非有效 GLB');
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('GLB magic 错误（应为 glTF 二进制 0x46546C67）');
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`不支持的 GLB 版本 ${version}（仅支持 glTF 2.0）`);
  }
  const total = view.getUint32(8, true);
  let json = null;
  let bin = null;
  let offset = 12;
  while (offset + 8 <= Math.min(total, buffer.byteLength)) {
    const chunkLen = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + chunkLen;
    if (end > buffer.byteLength) {
      throw new Error('GLB chunk 越界（文件被截断）');
    }
    const slice = buffer.subarray(start, end);
    if (chunkType === CHUNK_JSON) {
      json = JSON.parse(new TextDecoder().decode(slice));
    } else if (chunkType === CHUNK_BIN) {
      bin = slice;
    }
    offset = end;
  }
  if (!json) {
    throw new Error('GLB 缺少 JSON chunk');
  }
  return { json, bin };
};

/** data: URI → Buffer（base64 或百分号编码）。 */
const decodeDataUri = (uri) => {
  const comma = uri.indexOf(',');
  const meta = uri.slice(5, comma);
  const data = uri.slice(comma + 1);
  if (/;base64/i.test(meta)) {
    return Buffer.from(data, 'base64');
  }
  return Buffer.from(decodeURIComponent(data), 'binary');
};

/**
 * 装载模型文件 → { json, bin, baseDir }。
 * .glb 走 GLB 容器；.gltf 为 JSON，buffer/image 可由外部文件或 data: URI 提供。
 */
export const loadModel = (filePath) => {
  const buffer = readFileSync(filePath);
  const baseDir = dirname(resolve(filePath));
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === GLB_MAGIC) {
    const { json, bin } = parseGlb(buffer);
    return { json, bin, baseDir, format: 'glb' };
  }
  const text = buffer.toString('utf8').trimStart();
  if (text.startsWith('{')) {
    return { json: JSON.parse(buffer.toString('utf8')), bin: null, baseDir, format: 'gltf' };
  }
  throw new Error('无法识别的模型格式（非 GLB，也非 glTF JSON）');
};

/** 读 bufferView 原始字节（GLB 内或外部 .bin），失败返回 null。 */
const readBufferView = (json, bin, baseDir, bufferViewIndex) => {
  const bv = json.bufferViews?.[bufferViewIndex];
  if (!bv) {
    return null;
  }
  const start = bv.byteOffset ?? 0;
  const len = bv.byteLength ?? 0;
  if (bv.buffer === 0 && bin) {
    return bin.subarray(start, start + len);
  }
  const bufferDef = json.buffers?.[bv.buffer];
  if (!bufferDef) {
    return null;
  }
  try {
    if (bufferDef.uri?.startsWith('data:')) {
      return decodeDataUri(bufferDef.uri).subarray(start, start + len);
    }
    if (bufferDef.uri) {
      const p = isAbsolute(bufferDef.uri) ? bufferDef.uri : resolve(baseDir, bufferDef.uri);
      return readFileSync(p).subarray(start, start + len);
    }
  } catch {
    return null;
  }
  return null;
};

/** 读 image 源字节（bufferView / 外部 uri / data: uri），失败返回 null。 */
const readImageBytes = (json, bin, baseDir, imageDef) => {
  if (!imageDef) {
    return null;
  }
  if (imageDef.bufferView !== undefined) {
    return readBufferView(json, bin, baseDir, imageDef.bufferView);
  }
  if (imageDef.uri?.startsWith('data:')) {
    try {
      return decodeDataUri(imageDef.uri);
    } catch {
      return null;
    }
  }
  if (imageDef.uri) {
    try {
      const p = isAbsolute(imageDef.uri) ? imageDef.uri : resolve(baseDir, imageDef.uri);
      return readFileSync(p);
    } catch {
      return null;
    }
  }
  return null;
};

/* ── 图像尺寸解析（PNG / JPEG / WebP）──────────────────────────────────────── */

const pngSize = (buf) => {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
    return null;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

const jpegSize = (buf) => {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return null;
  }
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15（排除 DHT/DAC/RSTn）
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) {
      return null;
    }
    i += 2 + segLen;
  }
  return null;
};

const webpSize = (buf) => {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (fourcc === 'VP8 ') {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (fourcc === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
};

/** 图像字节 → { width, height } 或 null（未知格式 KTX2/Basis 等）。 */
export const imageDimensions = (buf) => {
  if (!buf) {
    return null;
  }
  return pngSize(buf) ?? jpegSize(buf) ?? webpSize(buf);
};

/* ── 场景图统计 ──────────────────────────────────────────────────────────── */

/** 从默认 scene 出发可达的节点索引集（去重，含环保护）。 */
const reachableNodes = (json) => {
  const nodes = json.nodes ?? [];
  const sceneIndex = json.scene ?? 0;
  const roots = json.scenes?.[sceneIndex]?.nodes ?? nodes.map((_, i) => i);
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const i = stack.pop();
    if (i === undefined || seen.has(i)) {
      continue;
    }
    seen.add(i);
    for (const child of nodes[i]?.children ?? []) {
      stack.push(child);
    }
  }
  return seen;
};

/** 单 primitive 面数（仅三角形图元计入）。 */
const primitiveTriangles = (prim, accessors) => {
  const mode = prim.mode ?? 4;
  const accessorIndex = prim.indices ?? prim.attributes?.POSITION;
  if (accessorIndex === undefined) {
    return 0;
  }
  const count = accessors?.[accessorIndex]?.count ?? 0;
  if (mode === 4) {
    return count / 3;
  }
  if (mode === 5 || mode === 6) {
    return Math.max(0, count - 2);
  }
  return 0; // 点/线图元不产生三角面
};

const NAMING_RE = /^[a-z][a-z0-9_]*$/;

/** 节点名/网格名违规（空名豁免，与 AssetEngine.checkNaming 同规则）。 */
const collectNameViolations = (names) => names.filter((n) => n && !NAMING_RE.test(n));

/* ── 矩阵（列主序，同 glTF/three）────────────────────────────────────────── */

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const multiply = (a, b) => {
  const out = new Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
};

const localMatrix = (node) => {
  if (node.matrix) {
    return node.matrix.slice();
  }
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
};

const transformPoint = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

/* ── 核心：inspectModel ──────────────────────────────────────────────────── */

/**
 * 检查已装载模型 → 规格报告。
 * @param {{json: object, bin: Buffer|null, baseDir: string, format?: string}} model
 * @param {{assetId?: string, profile?: 'main'|'prop', strict?: boolean, limits?: object, checkMeshNames?: boolean}} opts
 */
export const inspectModel = (model, opts = {}) => {
  const { json, bin, baseDir } = model;
  const tier = opts.strict ? 'strict' : 'art';
  const base = opts.strict ? STRICT_LIMITS : ART_LIMITS;
  const limits = { ...base, maxTriangles: PROFILE_TRIANGLES[tier][opts.profile ?? 'main'], ...opts.limits };
  const enforceConventions = Boolean(opts.strict);
  const assetId = opts.assetId ?? 'model';
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const accessors = json.accessors ?? [];
  const reachable = reachableNodes(json);

  const warnings = [];
  let triangles = 0;
  let uvMissing = false;
  const nodeNames = [];
  const meshNames = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const visit = (index, parentWorld) => {
    const node = nodes[index];
    if (!node) {
      return;
    }
    nodeNames.push(node.name ?? '');
    const world = multiply(parentWorld, localMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = meshes[node.mesh];
      if (mesh?.name) {
        meshNames.push(mesh.name);
      }
      for (const prim of mesh?.primitives ?? []) {
        triangles += primitiveTriangles(prim, accessors);
        if (!prim.attributes || prim.attributes.TEXCOORD_0 === undefined) {
          uvMissing = true;
        }
        const posIndex = prim.attributes?.POSITION;
        const acc = posIndex === undefined ? null : accessors[posIndex];
        if (!acc?.min || !acc?.max) {
          continue;
        }
        // POSITION accessor min/max（glTF 对 POSITION 强制要求）→ 本地 AABB 八角变换后并入
        for (let corner = 0; corner < 8; corner += 1) {
          const local = [
            corner & 1 ? acc.max[0] : acc.min[0],
            corner & 2 ? acc.max[1] : acc.min[1],
            corner & 4 ? acc.max[2] : acc.min[2],
          ];
          const wp = transformPoint(world, local);
          for (let k = 0; k < 3; k += 1) {
            min[k] = Math.min(min[k], wp[k]);
            max[k] = Math.max(max[k], wp[k]);
          }
        }
      }
    }
    for (const child of node.children ?? []) {
      visit(child, world);
    }
  };

  const sceneIndex = json.scene ?? 0;
  const roots = json.scenes?.[sceneIndex]?.nodes ?? nodes.map((_, i) => i);
  for (const root of roots) {
    visit(root, IDENTITY);
  }

  const hasGeometry = Number.isFinite(min[0]);
  const bboxMin = hasGeometry ? min : [0, 0, 0];
  const bboxMax = hasGeometry ? max : [0, 0, 0];
  const height = bboxMax[1] - bboxMin[1];

  // 贴图：images 数组为文件级真相；逐张解析尺寸取最大
  const images = json.images ?? [];
  let maxTextureSize = 0;
  let unknownTextureFormats = 0;
  for (const imageDef of images) {
    const dims = imageDimensions(readImageBytes(json, bin, baseDir, imageDef));
    if (dims) {
      maxTextureSize = Math.max(maxTextureSize, dims.width, dims.height);
    } else {
      unknownTextureFormats += 1;
    }
  }

  const namingViolations = collectNameViolations(nodeNames);
  const meshNamingViolations = collectNameViolations(meshNames);
  const namingCandidates = opts.checkMeshNames
    ? [...new Set([...namingViolations, ...meshNamingViolations])]
    : namingViolations;
  const originOk = hasGeometry && Math.abs(bboxMin[1]) <= limits.originTolerance;
  const namingOk = namingCandidates.length === 0;
  const heightOk = hasGeometry && height >= limits.heightMin && height <= limits.heightMax;

  // 性能类门禁（硬阻断，任何资产都过）：几何存在 / 面数 / 节点 / 贴图张数与尺寸
  const violations = [];
  if (!hasGeometry) {
    violations.push('模型无可渲染几何（无 POSITION 数据）');
  }
  if (triangles > limits.maxTriangles) {
    violations.push(`面数超限: ${Math.round(triangles)} > ${limits.maxTriangles}`);
  }
  if (reachable.size > limits.maxNodes) {
    violations.push(`节点数超限: ${reachable.size} > ${limits.maxNodes}`);
  }
  if (images.length > limits.maxTextures) {
    violations.push(`贴图张数超限: ${images.length} > ${limits.maxTextures}`);
  }
  if (maxTextureSize > limits.maxTextureSize) {
    violations.push(`贴图尺寸超限: ${maxTextureSize} > ${limits.maxTextureSize}`);
  }

  // 约定类（命名/原点/高度）：默认告警（美术资产档），--strict 升为阻断（AI 生成资产档）
  const conventions = [];
  if (hasGeometry && !originOk) {
    conventions.push(`原点不符: bbox.min.y=${bboxMin[1].toFixed(4)}（应为 0，容差 ${limits.originTolerance}）`);
  }
  if (hasGeometry && !heightOk) {
    conventions.push(`高度不合理: ${height.toFixed(4)}m（应在 ${limits.heightMin}~${limits.heightMax}）`);
  }
  if (!namingOk) {
    conventions.push(`命名违规（应 ^[a-z][a-z0-9_]*$）: ${namingCandidates.join(', ')}`);
  }
  if (enforceConventions) {
    violations.push(...conventions);
  } else {
    warnings.push(...conventions.map((c) => `[约定·告警] ${c}`));
  }

  if (unknownTextureFormats > 0) {
    warnings.push(`${unknownTextureFormats} 张贴图尺寸未知（KTX2/Basis/未解析格式），未纳入尺寸门禁`);
  }
  if (meshNamingViolations.length > 0 && !opts.checkMeshNames) {
    warnings.push(`网格名违规（默认不参与门禁，--check-mesh-names 启用）: ${meshNamingViolations.join(', ')}`);
  }

  return {
    assetId,
    format: model.format ?? (bin ? 'glb' : 'gltf'),
    tier,
    triangles: Math.round(triangles),
    nodeCount: reachable.size,
    textureCount: images.length,
    maxTextureSize,
    bbox: { min: bboxMin, max: bboxMax, height },
    originOk,
    namingOk,
    namingViolations: namingCandidates,
    heightOk,
    conventionsOk: originOk && namingOk && heightOk,
    passed: violations.length === 0,
    violations,
    warnings,
    uvMissing,
    limits,
  };
};

/** 便捷入口：文件 → 报告。 */
export const validateModelFile = (filePath, opts = {}) => {
  const model = loadModel(filePath);
  return inspectModel(model, opts);
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node validate-model.mjs <model.glb|gltf> [选项]

门禁分两档（2026-10-09 裁决）：
  默认 art 档   —— 第三方美术资产：性能类（面数/贴图/节点/几何）阻断，阈值放宽；
                   命名/原点/高度属"约定类"，默认告警不阻断。
  --strict 档   —— AI 生成资产（降级阶梯第 4/5 层）：§4.2 紧阈值；约定类升为阻断。

选项:
  --strict                 切到 strict 档（紧阈值 + 约定类阻断）
  --profile main|prop      面数档位（art 50k/5k，strict 10k/2k；默认 main）
  --max-triangles N        覆盖面数上限
  --max-nodes N            覆盖节点上限
  --max-texture-size N     覆盖单张贴图边长上限
  --max-textures N         覆盖贴图张数上限
  --origin-tolerance F     覆盖原点容差
  --height-min F           覆盖高度下限（米）
  --height-max F           覆盖高度上限（米）
  --check-mesh-names       网格名违规也计入门禁（默认仅告警）
  --json                   输出完整报告 JSON
  --quiet                  仅退出码`;

const parseArgs = (argv) => {
  const opts = { limits: {} };
  const files = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--profile') {
      opts.profile = next();
    } else if (a === '--strict') {
      opts.strict = true;
    } else if (a === '--max-triangles') {
      opts.limits.maxTriangles = Number(next());
    } else if (a === '--max-nodes') {
      opts.limits.maxNodes = Number(next());
    } else if (a === '--max-texture-size') {
      opts.limits.maxTextureSize = Number(next());
    } else if (a === '--max-textures') {
      opts.limits.maxTextures = Number(next());
    } else if (a === '--origin-tolerance') {
      opts.limits.originTolerance = Number(next());
    } else if (a === '--height-min') {
      opts.limits.heightMin = Number(next());
    } else if (a === '--height-max') {
      opts.limits.heightMax = Number(next());
    } else if (a === '--check-mesh-names') {
      opts.checkMeshNames = true;
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--quiet') {
      opts.quiet = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (!a.startsWith('--')) {
      files.push(a);
    } else {
      throw new Error(`未知选项: ${a}`);
    }
  }
  return { opts, files };
};

const main = () => {
  const { opts, files } = parseArgs(process.argv.slice(2));
  if (opts.help || files.length === 0) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  let failed = 0;
  for (const file of files) {
    let report;
    try {
      report = validateModelFile(file, opts);
    } catch (err) {
      console.error(`[validate-model] 解析失败 ${file}: ${err.message}`);
      process.exit(2);
    }
    report.assetId = report.assetId === 'model' ? file : report.assetId;
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else if (!opts.quiet) {
      const mark = report.passed ? 'PASS' : 'FAIL';
      console.log(`[${mark}/${report.tier}] ${file}  三角面=${report.triangles} 节点=${report.nodeCount} 贴图=${report.textureCount} 最大贴图=${report.maxTextureSize} 高=${report.bbox.height.toFixed(3)}m 约定=${report.conventionsOk ? 'ok' : '偏离'}`);
      for (const v of report.violations) {
        console.log(`  ✗ ${v}`);
      }
      for (const w of report.warnings) {
        console.log(`  ⚠ ${w}`);
      }
    }
    if (!report.passed) {
      failed += 1;
    }
  }
  process.exit(failed > 0 ? 1 : 0);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
