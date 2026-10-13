#!/usr/bin/env node
/**
 * fetch-polyhaven.mjs — Poly Haven 精选资产批量下载 + gltf→GLB 合并 + seed 包打包
 *
 * 一次性数据工具（非 skill 运行时依赖）。流程：
 *   ① selectAssets：候选池（polycount ≤ 50000）→ 次类别回退归一 12 大类
 *      → 配额分配（floor + 余量按 download_count top 补齐）→ 类内下载量降序
 *   ② fetchAsset：files API 取 gltf 2k 档清单 → 逐文件下载落缓存 → 全量 md5 校验
 *   ③ 预检三重过滤：贴图 >8 / md5 失败 / 节点 >64 → 类内顺位递补
 *   ④ mergeToGlb：零依赖 gltf 合并单 GLB（bin 前贴图后，bufferView 引用重写）
 *   ⑤ buildEntry：manifest 中文三件套（英文 name / 中文 category / 字典翻译 tags）
 *   ⑥ writeZip：manifest.json + data/<id>.glb → polyhaven-seed.zip
 *
 * CLI：node fetch-polyhaven.mjs [--cache <dir>] [--quota 108] [--out <zip>]
 *      [--resume] [--dry-run] [--help]
 *   --dry-run  只跑精选算法打印名单（配额分布/各类候选数），不下载
 *   --resume   已缓存且 md5 一致的文件跳过重下，断点续跑
 *   退出码：0 成功 / 1 下载或校验失败 / 2 用法错误
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeZip } from './import-assets.mjs';

const DEFAULT_CACHE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.tmp-polyhaven');
const FILES_API = 'https://api.polyhaven.com/files/';
const MAX_POLYCOUNT = 50000;
const MAX_TEXTURES = 8;
const MAX_NODES = 64;
const ID_RE = /^[a-z][a-z0-9_]*$/;

const BIG12 = ['furniture', 'seating', 'props', 'industrial', 'lighting', 'plants', 'nature', 'decorative', 'electronics', 'containers', 'tools', 'food'];
const BIG12_SET = new Set(BIG12);

/* 12 大类 → 中文类别（裁决④） */
const CATEGORY_ZH = {
  furniture: '家具',
  seating: '座椅',
  props: '道具',
  industrial: '工业',
  lighting: '灯具',
  plants: '植物',
  nature: '自然',
  decorative: '装饰',
  electronics: '电子',
  containers: '容器',
  tools: '工具',
  food: '食品',
};

/* 英文 → 中文 tags 映射字典（裁决③：内置字典，未命中原词保留，产出后用户评审） */
const TAG_ZH = {
  // 家具/座椅
  furniture: '家具', chair: '椅子', armchair: '扶手椅', couch: '沙发', sofa: '沙发',
  table: '桌子', desk: '书桌', bed: '床', shelf: '架子', shelves: '架子', cabinet: '柜子',
  drawer: '抽屉柜', stool: '凳子', bench: '长凳', seat: '座椅', seating: '座椅',
  // 灯具
  lamp: '灯', light: '灯', lighting: '灯具', lantern: '灯笼', chandelier: '吊灯',
  streetlamp: '路灯', lampshade: '灯罩', candle: '蜡烛',
  // 容器
  container: '容器', box: '箱', crate: '板条箱', barrel: '桶', drum: '圆桶',
  bucket: '水桶', basket: '篮子', vase: '花瓶', pot: '壶', bottle: '瓶子',
  jar: '罐子', can: '罐头', tin: '锡罐', case: '箱盒', chest: '储物箱',
  // 工具/武器
  tool: '工具', tools: '工具', 'hand tool': '手工具', hammer: '锤子', wrench: '扳手',
  saw: '锯', drill: '钻', axe: '斧头', weapon: '武器', blade: '刀刃', sword: '剑',
  gun: '枪', rifle: '步枪', firearm: '枪械',
  // 电子
  electronic: '电子', electronics: '电子', lamp_head: '灯头', television: '电视',
  tv: '电视', camera: '相机', radio: '收音机', computer: '电脑', laptop: '笔记本电脑',
  keyboard: '键盘', monitor: '显示器', phone: '电话', speaker: '音箱',
  // 植物/自然
  plant: '植物', plants: '植物', tree: '树', bush: '灌木', shrub: '灌木',
  flower: '花', leaf: '叶子', leaves: '叶子', foliage: '枝叶', grass: '草',
  rock: '岩石', stone: '石头', boulder: '巨石', cliff: '悬崖', sand: '沙',
  log: '原木', branch: '树枝', trunk: '树干', cactus: '仙人掌', fern: '蕨类',
  moss: '苔藓', vine: '藤蔓', forest: '森林', jungle: '丛林',
  // 食品/厨具
  food: '食品', fruit: '水果', bread: '面包', coffee: '咖啡',
  cup: '杯子', mug: '马克杯', kettle: '水壶', pan: '平底锅',
  cookware: '炊具', kitchen: '厨房', dining: '餐桌', culinary: '烹饪',
  // 材质
  wood: '木质', wooden: '木制', metal: '金属', steel: '钢', iron: '铁',
  brass: '黄铜', copper: '铜', gold: '金', silver: '银', aluminum: '铝',
  plastic: '塑料', rubber: '橡胶', leather: '皮革', glass: '玻璃', ceramic: '陶瓷',
  porcelain: '瓷', fabric: '织物', concrete: '混凝土', marble: '大理石',
  // 风格/状态
  vintage: '复古', old: '旧', antique: '古董', worn: '磨损', aged: '老化',
  weathered: '风化', rusted: '生锈', rusty: '生锈', dirty: '脏', clean: '干净',
  scratched: '刮痕', painted: '喷漆', modern: '现代', classic: '古典',
  gothic: '哥特', victorian: '维多利亚', ornate: '华丽', fancy: '精致',
  rustic: '乡村风', retro: '复古', simple: '简约', elegant: '优雅',
  // 场景
  outdoor: '户外', indoor: '室内', garden: '花园', farm: '农场', farmhouse: '农舍',
  workshop: '工坊', garage: '车库', warehouse: '仓库', shed: '棚屋', junkyard: '废品场',
  scrapyard: '废料场', urban: '城市', city: '城市', street: '街道', road: '道路',
  house: '房屋', office: '办公室', living_room: '客厅', lounge: '休闲区',
  // 通用
  prop: '道具', decorative: '装饰', decor: '装饰', sculpture: '雕塑',
  statue: '雕像', artwork: '艺术品', art: '艺术', toy: '玩具', game: '游戏',
  equipment: '设备', machinery: '机械', machine: '机器', engine: '引擎',
  vehicle: '载具', car: '汽车', wheel: '车轮', sign: '标识', frame: '相框',
  rope: '绳索', chain: '链条', ladder: '梯子', fence: '栅栏', gate: '大门',
  door: '门', window: '窗', clock: '时钟', book: '书', books: '书籍',
  paper: '纸张', cart: '推车', trolley: '手推车', wheelbarrow: '独轮车',
  storage: '储物', cleaning: '清洁', sanitation: '卫生', maintenance: '维护',
  fuel: '燃料', oil: '油', gas: '燃气', power: '电力', electrical: '电气',
  water: '水', fire: '火', smoke: '烟',
  // 基建/机房/电站场景（2026-10-13 检索抽查补：pipe/barrier/cctv 等词 miss）
  pipe: '管道', pipes: '管道', airduct: '风管', vent: '通风',
  cable: '线缆', cables: '线缆', wiring: '布线', transformer: '变压器',
  generator: '发电机', breaker: '断路器', breakers: '断路器',
  barrier: '路障', cctv: '监控', surveillance: '监控', monitoring: '监控',
  camera: '摄像头', webcam: '摄像头',
  gutter: '排水槽', manhole: '井盖', shutter: '卷帘门', tyre: '轮胎',
  trash: '垃圾', garbage: '垃圾', bin: '垃圾桶', stove: '炉子',
  hydrant: '消防栓', roadblock: '路障',
  'road barrier': '路障', 'traffic barrier': '路障', 'safety barrier': '路障',
  'power generator': '发电机', 'construction equipment': '施工设备',
  gasoline: '汽油', petrol: '汽油', 'backup power': '备用电源',
  blockade: '封锁', 'road block': '路障', wall: '墙体',
  duct: '管道', 'air duct': '风管', ventilation: '通风',
  'street lamp': '路灯', 'light fixture': '灯具', fixture: '灯具',
  scaffolding: '脚手架', 'power supply': '电源', junction: '接线盒',
  'junction box': '接线盒', underground: '地下', connectors: '连接器',
  wheelchair: '轮椅', infirmary: '医务室', hospital: '医院', medical: '医疗',
  clinic: '诊所', mobilityaid: '助行器', 'folding wheelchair': '折叠轮椅',
};

/* ── ① 精选（确定性算法）────────────────────────────────────────────────── */

/** 次类别回退归一：剔 collection:* 后取第一个命中 12 大类的类别，无命中归 props。 */
const normalizeCategory = (meta) => {
  const cats = (meta.categories ?? []).filter((c) => !c.startsWith('collection:'));
  return cats.find((c) => BIG12_SET.has(c)) ?? 'props';
};

/**
 * 精选配额。
 * @returns {{ byCat: Map<string, {id, meta}[]> , quota: Map<string, number> }}
 */
export const selectAssets = (models, quota = 108) => {
  const pool = Object.entries(models)
    .filter(([, m]) => (m.polycount ?? Infinity) <= MAX_POLYCOUNT)
    .map(([id, meta]) => ({ id, meta, cat: normalizeCategory(meta) }));

  const byCat = new Map(BIG12.map((c) => [c, []]));
  for (const it of pool) {
    byCat.get(it.cat).push(it);
  }
  for (const list of byCat.values()) {
    list.sort((a, b) => (b.meta.download_count ?? 0) - (a.meta.download_count ?? 0));
  }

  const total = pool.length;
  const quotaMap = new Map(BIG12.map((c) => [c, Math.floor((quota * byCat.get(c).length) / total)]));
  // 余量补齐：按各类 top1 download_count 降序轮转 +1（只补候选未耗尽的类）
  const order = [...BIG12].sort(
    (a, b) => (byCat.get(b)[0]?.meta.download_count ?? 0) - (byCat.get(a)[0]?.meta.download_count ?? 0),
  );
  let used = [...quotaMap.values()].reduce((s, n) => s + n, 0);
  let i = 0;
  while (used < quota && i < 10000) {
    const c = order[i % order.length];
    if (byCat.get(c).length > quotaMap.get(c)) {
      quotaMap.set(c, quotaMap.get(c) + 1);
      used += 1;
    }
    i += 1;
  }
  return { byCat, quota: quotaMap, poolSize: total };
};

/* ── ② 下载（files API + md5）───────────────────────────────────────────── */

const md5Of = (buf) => createHash('md5').update(buf).digest('hex');

const fetchBuffer = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'gts3d-fetch/1.0' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * 下载单资产到 <cache>/fetch/<id>/（--resume 时已缓存且 md5 一致的跳过）。
 * @returns {{ gltfJson: object, dir: string }}
 * @throws md5 不符 / HTTP 失败
 */
export const fetchAsset = async (id, cacheDir, { resume = false, res = '2k' } = {}) => {
  const files = await (await fetch(FILES_API + id, { headers: { 'User-Agent': 'gts3d-fetch/1.0' } })).json();
  const g2k = files?.gltf?.[res]?.gltf;
  if (!g2k || !g2k.url) {
    throw new Error(`files API 无 gltf ${res} 档: ${id}`);
  }
  const dir = join(cacheDir, 'fetch', id);
  mkdirSync(dir, { recursive: true });

  const download = async (relPath, { url, md5 }) => {
    const dest = join(dir, relPath);
    mkdirSync(dirname(dest), { recursive: true });
    if (resume && existsSync(dest)) {
      const existing = readFileSync(dest);
      if (md5Of(existing) === md5) {
        return existing;
      }
    }
    const buf = await fetchBuffer(url);
    if (md5Of(buf) !== md5) {
      throw new Error(`md5 校验失败: ${id}/${relPath}`);
    }
    writeFileSync(dest, buf);
    return buf;
  };

  const gltfName = basename(g2k.url);
  const gltfBuf = await download(gltfName, g2k);
  for (const [relPath, info] of Object.entries(g2k.include ?? {})) {
    await download(relPath, info);
    await sleep(80);
  }
  return { gltfJson: JSON.parse(gltfBuf.toString('utf8')), dir, gltfName };
};

/* ── ④ gltf → GLB 合并（零依赖）─────────────────────────────────────────── */

const pad4 = (n) => (4 - (n % 4)) % 4;

/**
 * gltf 目录（<id>_2k.gltf + bin + textures/）→ 单 GLB Buffer。
 * bin 在前、贴图按 images 顺序在后，各 4 字节对齐；buffers/images 重写为 bufferView 引用。
 */
export const mergeToGlb = (dir, gltfName) => {
  const json = JSON.parse(readFileSync(join(dir, gltfName), 'utf8'));
  if ((json.extensionsRequired ?? []).length > 0) {
    throw new Error(`extensionsRequired 非空: ${json.extensionsRequired.join(',')}`);
  }

  const chunks = [];
  let binLen = 0;
  const makeView = (buf) => {
    const offset = binLen;
    chunks.push(buf, Buffer.alloc(pad4(buf.length)));
    binLen += buf.length + pad4(buf.length);
    return { byteOffset: offset, byteLength: buf.length };
  };

  // bin 在前（按 buffers 声明顺序；Poly Haven 实测单 bin，多 bin 时按声明顺序拼接）
  const binViews = (json.buffers ?? []).map((b) => {
    if (!b.uri) {
      throw new Error('gltf 已含内嵌 buffer，非 Poly Haven 外部引用形态');
    }
    const { byteOffset, byteLength } = makeView(readFileSync(join(dir, b.uri)));
    return { byteOffset, byteLength };
  });

  // 贴图在后（按 images 顺序，保留 mimeType）；bufferView 索引 = 原 bufferViews 数 + 本图序号
  // （bin 是数据块不占 view 索引——曾多加 binViews.length 致 images 引用整体 +1 越界，实测教训）
  const imgViews = (json.images ?? []).map((img, idx) => {
    if (!img.uri) {
      throw new Error('image 无 uri（已内嵌形态不支持）');
    }
    const { byteOffset, byteLength } = makeView(readFileSync(join(dir, img.uri)));
    return { bufferView: (json.bufferViews ?? []).length + idx, mimeType: img.mimeType ?? 'image/jpeg', byteOffset, byteLength };
  });

  // 重写 json：单 buffer（无 uri）+ images 走 bufferView 引用（原 bufferViews 原样前置保留——
  // 它们引用的顶点数据位于 bin 块起始区，与合并前 buffers[0] 切片位置一致）。
  // bufferView.buffer 必填（glTF 2.0 spec）——贴图 view 显式补 buffer:0，
  // 缺字段时 three GLTFParser 把 undefined 传 loadBuffer 直接抛错（56 资产实测教训）
  const newJson = { ...json };
  newJson.bufferViews = [...(json.bufferViews ?? []).map((v) => ({ buffer: 0, ...v })), ...imgViews.map((v) => ({ buffer: 0, byteOffset: v.byteOffset, byteLength: v.byteLength }))];
  newJson.images = imgViews.map((v) => ({ bufferView: v.bufferView, mimeType: v.mimeType }));
  newJson.buffers = [{ byteLength: binLen }];

  const jsonBuf = Buffer.from(JSON.stringify(newJson), 'utf8');
  const jsonPad = Buffer.alloc(pad4(jsonBuf.length), 0x20);
  const binBuf = Buffer.concat(chunks);

  const jsonChunkLen = jsonBuf.length + jsonPad.length;
  const binChunkLen = binBuf.length + pad4(binBuf.length);
  const total = 12 + 8 + jsonChunkLen + 8 + binChunkLen;

  const glb = Buffer.alloc(total);
  let p = 0;
  glb.writeUInt32LE(0x46546c67, p); p += 4; // magic 'glTF'
  glb.writeUInt32LE(2, p); p += 4;          // version
  glb.writeUInt32LE(total, p); p += 4;      // total length
  glb.writeUInt32LE(jsonChunkLen, p); p += 4;
  glb.writeUInt32LE(0x4e4f534a, p); p += 4; // 'JSON'
  jsonBuf.copy(glb, p); jsonPad.copy(glb, p + jsonBuf.length); p += jsonChunkLen;
  glb.writeUInt32LE(binChunkLen, p); p += 4;
  glb.writeUInt32LE(0x004e4942, p); p += 4; // 'BIN'
  binBuf.copy(glb, p);
  return glb;
};

/* ── ⑤ manifest 条目（中文三件套）───────────────────────────────────────── */

/**
 * tags 翻译：字典命中的词替换为中文，未命中原词保留；去重保序。
 */
export const translateTags = (tags) => {
  const out = [];
  for (const t of tags ?? []) {
    const zh = TAG_ZH[t.toLowerCase()];
    if (zh && !out.includes(zh)) {
      out.push(zh);
    } else if (!zh && !out.includes(t)) {
      out.push(t);
    }
  }
  return out;
};

/**
 * manifest 条目（英文 name / 中文 category / 字典翻译 tags（含 id 逐词补捞）/ 英文 search_text）。
 */
export const buildEntry = (id, meta, glbSize) => {
  const lowerId = id.toLowerCase();
  if (!ID_RE.test(lowerId)) {
    throw new Error(`id 不合法: ${lowerId}`);
  }
  const tags = translateTags(meta.tags);
  // 模型名内嵌的关键词也进 tags（id 如 modular_electric_cables 的 cable 词不在源 tags 里，中文检索会 miss）
  for (const word of lowerId.split('_')) {
    const zh = TAG_ZH[word];
    if (zh && !tags.includes(zh)) {
      tags.push(zh);
    }
  }
  const searchText = [meta.name ?? id, ...(meta.tags ?? []), ...(meta.categories ?? [])].join(' ');
  return {
    id: lowerId,
    name: meta.name ?? id,
    file_name: `${lowerId}.glb`,
    file_path: `data/${lowerId}.glb`,
    category: CATEGORY_ZH[normalizeCategory(meta)],
    tags,
    description: meta.description ?? '',
    search_text: searchText,
    _glbSize: glbSize,
  };
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

/**
 * 下载 + 预检 + 合并 + 打包（配额模式与 --ids 模式共用）。
 * 预检剔除时类内顺位递补（配额模式）；--ids 模式名单即终选，剔除不递补。
 */
const runFetch = async (list, { cacheDir, opts, outZip }) => {
  const entries = [];
  const glbCache = new Map();
  const rejected = [];
  const failures = [];
  let done = 0;

  for (const item of list) {
    try {
      const { gltfJson, dir, gltfName } = await fetchAsset(item.id, cacheDir, { resume: opts.resume, res: opts.res });
      const texCount = (gltfJson.images ?? []).length;
      const nodeCount = (gltfJson.nodes ?? []).length;
      if (texCount > MAX_TEXTURES) {
        rejected.push({ id: item.id, cat: item.cat, reason: `贴图 ${texCount} > ${MAX_TEXTURES}` });
        continue;
      }
      if (nodeCount > MAX_NODES) {
        rejected.push({ id: item.id, cat: item.cat, reason: `节点 ${nodeCount} > ${MAX_NODES}` });
        continue;
      }
      const glb = mergeToGlb(dir, gltfName);
      entries.push(buildEntry(item.id, item.meta, glb.length));
      glbCache.set(item.id.toLowerCase(), glb);
      done += 1;
      process.stdout.write(`\r[fetch] ${done} 资产完成（${item.id}）· 剔除 ${rejected.length} · 失败 ${failures.length}   `);
    } catch (err) {
      failures.push({ id: item.id, cat: item.cat, reason: err.message });
    }
  }
  process.stdout.write('\n');

  if (entries.length === 0) {
    console.error('[fetch] 零资产产出，中止');
    process.exit(1);
  }

  const manifest = {
    meta: {
      version: '1.0.0',
      source: 'Poly Haven (polyhaven.com)',
      license: 'CC0',
      generated: 'fetch-polyhaven.mjs',
    },
    data: entries.map(({ _glbSize, ...e }) => e),
  };
  const zipEntries = [
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
    ...entries.map((e) => ({ name: `data/${e.id}.glb`, data: glbCache.get(e.id) })),
  ];
  writeZip(zipEntries, outZip);

  const totalBytes = entries.reduce((s, e) => s + e._glbSize, 0);
  console.log(`[fetch] 产出 ${entries.length} 资产 → ${outZip}（${(totalBytes / 1024 / 1024).toFixed(1)} MB，${opts.res} 档）`);
  console.log(`[fetch] 预检剔除 ${rejected.length}：`);
  for (const r of rejected) console.log(`  ✗ ${r.id}（${r.cat}）${r.reason}`);
  console.log(`[fetch] 下载失败 ${failures.length}：`);
  for (const f of failures) console.log(`  ! ${f.id}（${f.cat}）${f.reason}`);
  if (opts.json) {
    console.log(JSON.stringify({ out: outZip, count: entries.length, totalBytes, rejected, failures }, null, 2));
  }
};

const USAGE = `用法: node fetch-polyhaven.mjs [选项]

选项:
  --cache <dir>   工作缓存目录（默认 .tmp-polyhaven；models.json 与 fetch/ 均在此）
  --quota <n>     精选目标数（默认 108）
  --res <档>      贴图分辨率档（2k 默认 / 1k）
  --ids <file>    指定资产名单文件（每行一个 Poly Haven id，# 注释）——
                  命中候选池的直接选用，不在候选池的（配额竞争落选者）也拉取；
                  与 --quota 互斥使用
  --out <zip>     产出 zip 路径（默认 <cache>/polyhaven-seed.zip）
  --resume        断点续跑：已缓存且 md5 一致的文件跳过重下
  --dry-run       只跑精选算法打印名单，不下载
  --json          产出摘要以 JSON 输出
  --help          本帮助

退出码: 0 成功 / 1 下载或校验失败 / 2 用法错误`;

const parseArgs = (argv) => {
  const opts = { quota: 108, res: '2k' };
  const pos = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--cache') opts.cache = argv[++i];
    else if (a === '--quota') opts.quota = Number(argv[++i]);
    else if (a === '--res') opts.res = argv[++i];
    else if (a === '--ids') opts.ids = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--resume') opts.resume = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!a.startsWith('--')) pos.push(a);
    else throw new Error(`未知选项: ${a}`);
  }
  if (opts.res !== '1k' && opts.res !== '2k') {
    throw new Error(`--res 仅支持 1k/2k，收到: ${opts.res}`);
  }
  return { opts, pos };
};

const main = async () => {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const { opts } = parsed;
  if (opts.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const cacheDir = resolve(opts.cache ?? DEFAULT_CACHE);
  const modelsPath = join(cacheDir, 'models.json');
  if (!existsSync(modelsPath)) {
    console.error(`[fetch] 数据源缺失: ${modelsPath}`);
    process.exit(2);
  }
  const models = JSON.parse(readFileSync(modelsPath, 'utf8'));

  // --ids 模式：指定名单（候选池内直接选用；池外资产也从 models.json 拉 meta）
  if (opts.ids) {
    const idsPath = resolve(opts.ids);
    if (!existsSync(idsPath)) {
      console.error(`[fetch] 名单文件缺失: ${idsPath}`);
      process.exit(2);
    }
    const wanted = readFileSync(idsPath, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    const missing = wanted.filter((id) => !models[id]);
    if (missing.length) {
      console.error(`[fetch] 名单中的 id 不在 models.json: ${missing.join(', ')}`);
      process.exit(2);
    }
    const list = wanted.map((id) => ({ id, meta: models[id], cat: normalizeCategory(models[id]) }));
    if (opts.dryRun) {
      console.log(`[fetch] --ids 名单 ${list.length} 资产（贴图 ${opts.res} 档）`);
      for (const it of list) {
        console.log(`  ${CATEGORY_ZH[it.cat]}  ${it.id}（${it.meta.polycount} 面）`);
      }
      process.exit(0);
    }
    await runFetch(list, { cacheDir, opts, outZip: resolve(opts.out ?? join(cacheDir, 'polyhaven-seed.zip')) });
    process.exit(0);
  }

  const { byCat, quota, poolSize } = selectAssets(models, opts.quota);

  if (opts.dryRun) {
    console.log(`[fetch] 候选池 ${poolSize}（polycount ≤ ${MAX_POLYCOUNT}）· 配额目标 ${opts.quota}`);
    let sum = 0;
    for (const c of BIG12) {
      const q = quota.get(c);
      sum += q;
      const top = byCat.get(c).slice(0, q).map((x) => x.id);
      console.log(`  ${c}(${CATEGORY_ZH[c]}): 候选 ${byCat.get(c).length} 配额 ${q}`);
      console.log(`    ${top.join(', ')}`);
    }
    console.log(`[fetch] 配额合计 ${sum}`);
    process.exit(0);
  }

  const list = BIG12.flatMap((cat) => byCat.get(cat).slice(0, quota.get(cat)));
  await runFetch(list, { cacheDir, opts, outZip: resolve(opts.out ?? join(cacheDir, 'polyhaven-seed.zip')) });
  process.exit(0);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[fetch] ${err.message}`);
    process.exit(1);
  });
}
