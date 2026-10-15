/**
 * strip-edit.mjs — 二开态交付导出（编辑态剥离 + 自动外观编译 + 原子发布 + 自检）
 *
 * 双模式交付的第二步：
 *   编辑期工程（core + edit，能调参）→ strip-edit → 二开包（纯 core + 定稿数据 + 编译外观）
 *
 * 做五件事（P4：F08 自动转录 → 自动编译；V19 原子发布）：
 *   ① 校验源快照：__visuals/__materialLib 的陈旧引用、缺失库条目报具体路径
 *      （真实未支持 = FAIL，不删掉后 PASS）
 *   ② 在临时目录完成全部产出：复制剔除 edit 世界 + 私有区剥离 + 编译
 *      src/scene-core/generated/appearance.ts（运行包装配期由 appearance-runtime 应用）
 *   ③ TRANSCRIPTION.md 改自动转换摘要（保留三类表作人类审计对照，不再是人工转录指令）
 *   ④ 原子发布：临时目录过 checkProject --stripped 后才 rename 到 out；
 *      失败清理临时目录——源工程与已存在的旧产物分毫不动
 *   ⑤ 自检铁律 3：build.mjs --stripped（src/edit 不存在 / 无 edit 引用 / 无私有区 /
 *      generated/appearance.ts 可审计）
 *
 * CLI：
 *   node strip-edit.mjs <src-project> --out <out-dir> [--force] [--json] [--legacy-transcription]
 *   退出码：0 成功 / 1 自检失败或工程非法 / 2 用法错误
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync, renameSync, realpathSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkProject } from './build.mjs';
import { compileAppearance } from './lib/compile-appearance.mjs';

/** 复制时剔除的目录/文件（编辑态 + 构建残留 + 依赖 + 临时目录族） */
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', '.smoke-r', '.smoke-vendor', '.tmp-a3d-verify']);
const EXCLUDE_FILE_RE = /\.(log|local)$/;

/** 复制过滤器：返回 false 表示跳过。 */
const copyFilter = (src) => {
  const name = basename(src);
  if (EXCLUDE_DIRS.has(name)) {
    return false;
  }
  if (EXCLUDE_FILE_RE.test(name)) {
    return false;
  }
  // 剔除编辑态世界（路径分隔符归一后判 src/edit 段）
  const norm = src.replace(/\\/g, '/');
  if (/\/src\/edit$/.test(norm) || norm.includes('/src/edit/')) {
    return false;
  }
  return true;
};

/* ── 路径守卫（V19：case / realpath / 祖先关系三口径） ────────────────────── */

/**
 * out 是否会毁掉 src（同目录或 out 是 src 的祖先——rmSync(out) 会清掉 src）。
 * 三层判定：字面相等 / realpath 相等（符号链接/大小写归一前）/ 前缀祖先。
 * Windows 大小写不敏感：比较前统一 lower。
 */
const outWouldDestroySrc = (srcAbs, outAbs) => {
  let srcReal = srcAbs;
  let outReal = outAbs;
  try {
    srcReal = realpathSync(srcAbs);
  } catch { /* src 存在性由调用方先验 */ }
  try {
    outReal = realpathSync(outAbs);
  } catch { /* out 可能不存在（首次导出）——用字面路径判 */ }
  const s = srcReal.toLowerCase();
  const o = outReal.toLowerCase();
  if (s === o) {
    return true;
  }
  // out 是 src 的祖先（含 realpath 变体）：rmSync(out, recursive) 会连 src 一起删
  if (s.startsWith(`${o}\\`) || s.startsWith(`${o}/`)) {
    return true;
  }
  // src 是 out 的祖先（out 嵌在 src 里）：清空 out 不会删 src 本体，但产物工程嵌在
  // 源工程内部（复制过滤器会漏掉它/dist 干扰自检），拒绝——要求导出到源外
  if (o.startsWith(`${s}\\`) || o.startsWith(`${s}/`)) {
    return 'nested';
  }
  return false;
};

/* ── entry.ts：双态分流 → 二开单入口（固定入口文件，P2.1）────────────────── */

const ENTRY_IF_RE = /if \(new URLSearchParams[\s\S]*?import\('\.\/edit\/edit-main'\);[\s\S]*?\}\s*else\s*\{[\s\S]*?import\('\.\/main'\);[\s\S]*?\}/;

/** 二开交付物的 entry.ts（整文件替换，确定性内容——不复用源文件的注释与形态） */
const ENTRY_RUNTIME = `/**
 * entry — 二开态单入口（编辑态已随交付剥离）
 */
void import('./main');
`;

/**
 * 重写 src/entry.ts 为二开单入口。
 * 源形态含 edit 分支时替换为固定内容；已是单入口（重复 strip / 二开工程）幂等放行；
 * 非 chunk import 形态报错（不静默产出坏入口）。
 */
const rewriteEntry = (code, errors) => {
  if (ENTRY_IF_RE.test(code) || /import\('\.\/main'\)/.test(code)) {
    return ENTRY_RUNTIME;
  }
  errors.push('src/entry.ts 形态非预期（既无 edit 分支也无 main 入口），拒绝改写');
  return code;
};

/* ── App.vue：去掉编辑态链接 ──────────────────────────────────────────────── */

const rewriteApp = (code) => code
  .replace(/\s*<a\s+href="\/\?edit=1"[^>]*>[^<]*<\/a>/g, '')
  // 兜底：任何残留的 edit=1 链接
  .replace(/\s*<a\s+href="[^"]*\?edit=1[^"]*"[^>]*>[^<]*<\/a>/g, '');

/* ── 自动转换摘要（P4：TRANSCRIPTION.md 从人工转录指令降级为审计对照） ─────── */

/**
 * 不进 ① 物体视觉表的键（与 compile-appearance 口径一致）：
 * - libraryRef：只进 ③ 引用表
 * - locked：编辑器交互态，编译期剥离（运行包无编辑器）
 * materialType/castShadow/receiveShadow/visible 属个体视觉差异，保留在 ① 表。
 */
const VISUAL_META_KEYS = new Set(['libraryRef', 'locked', 'slots']);

/** markdown 表格单元格转义：| 断列、反引号断代码段 */
const mdCell = (val) => `\`${String(val).replace(/\|/g, '\\|').replace(/`/g, '\\`')}\``;

/**
 * 从私有区生成自动转换摘要 markdown（P4：审计对照，不再是人工转录指令）。
 * 内容仍是三类表 + 陈旧告警，语义变化：这些数据已被自动编译进
 * generated/appearance.ts，本文件供人工逐字段审计。
 */
export const buildTranscription = (visuals, materialLib, liveNodeIds, opts = {}) => {
  const vis = visuals ?? {};
  const lib = materialLib ?? {};
  const lines = [];
  lines.push('# 转录清单（strip-edit 生成 — 自动转换摘要）');
  lines.push('');
  if (opts.autoCompiled) {
    lines.push('> 本文件由 strip-edit.mjs 生成。编辑期视觉已**自动编译**进');
    lines.push('> `src/scene-core/generated/appearance.ts`（运行包装配期由 appearance-runtime 应用），');
    lines.push('> **无需人工转录**——下方三类表是编译产物的审计对照，逐字段核对即可。');
  } else {
    lines.push('> 本文件由 strip-edit.mjs（--legacy-transcription 模式）生成。视觉参数未自动编译，');
    lines.push('> 需由 LLM 按下方指引转录进**代码**（materials.ts / handler 默认值）。');
  }
  lines.push('');

  // 引用表：nodeId → mat_id
  const refs = [];
  for (const [nodeId, v] of Object.entries(vis)) {
    if (v && typeof v.libraryRef === 'string') {
      refs.push({ nodeId, matId: v.libraryRef });
    }
  }
  const libUsed = [...new Set(refs.map((r) => r.matId))];

  // ① 物体视觉 override（排除 libraryRef/slots）
  lines.push('## ① 物体视觉 override（→ 已编译进 generated/appearance.ts）');
  lines.push('');
  const visualRows = [];
  for (const [nodeId, v] of Object.entries(vis)) {
    const fields = Object.entries(v ?? {}).filter(([k]) => !VISUAL_META_KEYS.has(k));
    for (const [k, val] of fields) {
      visualRows.push(`| ${mdCell(nodeId)} | ${mdCell(k)} | ${mdCell(JSON.stringify(val))} |`);
    }
  }
  if (visualRows.length) {
    lines.push('| nodeId | 字段 | 值 |');
    lines.push('|---|---|---|');
    lines.push(...visualRows);
  } else {
    lines.push('_（无）_');
  }
  lines.push('');

  // ①′ 槽位覆盖（GLB 子网格）：nodeId | slot | 字段 | 值
  const slotRows = [];
  for (const [nodeId, v] of Object.entries(vis)) {
    for (const [slotKey, slot] of Object.entries(v?.slots ?? {})) {
      for (const [k, val] of Object.entries(slot ?? {})) {
        if (k === 'libraryRef') {
          slotRows.push(`| ${mdCell(nodeId)} | ${mdCell(slotKey)} | libraryRef | ${mdCell(val)}（→ ② 对应条目） |`);
        } else {
          slotRows.push(`| ${mdCell(nodeId)} | ${mdCell(slotKey)} | ${mdCell(k)} | ${mdCell(JSON.stringify(val))} |`);
        }
      }
    }
  }
  if (slotRows.length) {
    lines.push('## ①′ 槽位覆盖（GLB 子网格）（→ 已编译进 generated/appearance.ts）');
    lines.push('');
    lines.push('| nodeId | slot（mesh 名称路径） | 字段 | 值 |');
    lines.push('|---|---|---|---|');
    lines.push(...slotRows);
    lines.push('');
  }

  // ② 材质库条目（仅被引用者）
  lines.push('## ② 材质库条目（仅列出被引用的）（→ 已编译进 generated/appearance.ts）');
  lines.push('');
  if (libUsed.length) {
    for (const matId of libUsed) {
      const entry = lib[matId];
      if (!entry) {
        lines.push(`### \`${matId}\` · ⚠️ 引用缺失（__materialLib 无此条目——编译会 FAIL）`);
        lines.push('');
        continue;
      }
      lines.push(`### \`${matId}\` · ${entry.name ?? matId}`);
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(entry.spec ?? {}, null, 2));
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('_（无被引用材质库条目）_');
    lines.push('');
  }

  // ③ 引用表
  lines.push('## ③ 库引用表（→ 运行时共享实例由 appearance-runtime 挂载）');
  lines.push('');
  if (refs.length) {
    lines.push('| nodeId | mat_id | name |');
    lines.push('|---|---|---|');
    for (const r of refs) {
      lines.push(`| ${mdCell(r.nodeId)} | ${mdCell(r.matId)} | ${mdCell(lib[r.matId]?.name ?? '?')} |`);
    }
  } else {
    lines.push('_（无）_');
  }
  lines.push('');

  // 编译剥离说明
  lines.push('> `locked`（编辑器交互态）未编译——运行包无编辑器，该字段无意义。');
  lines.push('');

  if (opts.staleList?.length) {
    lines.push(`> ⚠️ 陈旧视觉条目（节点不存在）：${opts.staleList.map((s) => mdCell(s)).join(', ')}——编译 FAIL，须在编辑器清理后重新导出。`);
    lines.push('');
  }

  return { md: lines.join('\n'), refs, libUsed };
};

/* ── 主流程 ──────────────────────────────────────────────────────────────── */

/**
 * 导出二开包（P4 原子发布）。
 * @param {string} srcProject 编辑态工程根
 * @param {string} outDir 输出目录
 * @param {object} [opts] { force, legacyTranscription, stagingRoot, slotContext }
 *   slotContext 可注入（测试缝：runtimeSlotKeys/assetManifest）——缺省自动构建
 * @returns {Promise<object>} 结果（async：P4-RR2 运行时槽位清单构建是异步 TS 转译）
 */
export const stripEdit = async (srcProject, outDir, opts = {}) => {
  const src = resolve(srcProject);
  const out = resolve(outDir);
  const errors = [];

  if (!existsSync(join(src, 'src', 'edit'))) {
    return { ok: false, errors: [`源工程不含 src/edit/（编辑态工程？）：${src}`], out };
  }
  // 路径守卫（V19）：out == src / out 是 src 祖先 → 拒绝（发布/清空会毁源）
  const guard = outWouldDestroySrc(src, out);
  if (guard === true) {
    return {
      ok: false,
      errors: [`输出目录不能是源工程或其父目录（会清空源工程）：${out}`],
      out,
    };
  }
  if (guard === 'nested') {
    return {
      ok: false,
      errors: [`输出目录不能嵌在源工程内部（产物会污染源工程与自检）：${out}（源：${src}）`],
      out,
    };
  }

  // ② 源快照读取 + 引用一致性校验（P4.1 前置——编译 FAIL 在动任何文件之前）
  const srcDataPath = join(src, 'public', 'scene-data.json');
  let snapshot = null;
  if (existsSync(srcDataPath)) {
    try {
      snapshot = JSON.parse(readFileSync(srcDataPath, 'utf8'));
    } catch (err) {
      return { ok: false, errors: [`public/scene-data.json 解析失败：${err.message}`], out };
    }
  }
  const liveNodeIds = new Set();
  if (snapshot) {
    for (const group of Object.values(snapshot)) {
      if (Array.isArray(group)) {
        for (const node of group) {
          if (node?.id) {
            liveNodeIds.add(node.id);
          }
        }
      }
    }
  }

  // 编译外观（V19：陈旧/缺失引用报具体路径 → errors 硬失败，不删掉后 PASS）
  // P4-R3：槽位存在性 fail-closed；RR2/RRR1：全量**运行时真值清单**——
  // 程序化/图元经 headless 建树 listSubMeshes；GLB/glTF 经工程 three 的
  // GLTFLoader 真实加载 + buildSlotKeysFromScene（无静态猜测）
  const legacyMode = opts.legacyTranscription === true;
  let compilation = null;
  if (snapshot && !legacyMode) {
    const nodeById = new Map();
    for (const group of Object.values(snapshot)) {
      if (Array.isArray(group)) {
        for (const node of group) {
          if (node?.id) {
            nodeById.set(node.id, node);
          }
        }
      }
    }
    // 运行时槽位清单（RR2/RRR1）。构建失败不静默——带 slots 的条目得到
    // 「无法验证」错误（fail-closed）；无 slots 工程零影响
    let runtimeSlotKeys = null;
    if (opts.slotContext?.runtimeSlotKeys) {
      runtimeSlotKeys = opts.slotContext.runtimeSlotKeys;
    } else {
      try {
        const { buildRuntimeSlotKeys } = await import('./lib/runtime-slots.mjs');
        runtimeSlotKeys = await buildRuntimeSlotKeys(src, snapshot);
      } catch (err) {
        runtimeSlotKeys = null; // 校验器对 slots 报「无法验证：无运行时清单」
        if (process.env.GTS3D_STRIP_DEBUG) {
          console.warn(`[strip-edit] 运行时槽位清单构建失败：${err.message}`);
        }
      }
    }
    compilation = compileAppearance(snapshot, {
      liveNodeIds,
      slotContext: {
        nodeById,
        runtimeSlotKeys,
      },
    });
    errors.push(...compilation.errors);
  }
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      out,
      // 编译失败时提供摘要预览（audit 用），但产物未发布
      compilation: compilation
        ? { stats: compilation.stats, errors: compilation.errors }
        : null,
    };
  }

  // ── 原子发布：全部产出先落临时目录，校验通过才 rename ─────────────────────
  const staging = opts.stagingRoot
    ? join(resolve(opts.stagingRoot), `.tmp-strip-${process.pid}`)
    : join(dirname(out), `.tmp-strip-${process.pid}-${Date.now()}`);
  try {
    if (existsSync(staging)) {
      rmSync(staging, { recursive: true, force: true });
    }
    mkdirSync(staging, { recursive: true });

    // ① 复制（剔除 edit 世界 + 依赖 + 残留）
    cpSync(src, staging, { recursive: true, filter: copyFilter });

    // entry.ts 单入口化 + App.vue 去链接
    const entryPath = join(staging, 'src', 'entry.ts');
    if (existsSync(entryPath)) {
      writeFileSync(entryPath, rewriteEntry(readFileSync(entryPath, 'utf8'), errors));
    } else {
      errors.push('缺 src/entry.ts（固定入口）');
    }
    const appPath = join(staging, 'src', 'App.vue');
    if (existsSync(appPath)) {
      writeFileSync(appPath, rewriteApp(readFileSync(appPath, 'utf8')));
    }

    // ② 私有区剥离 + ③ 自动转换摘要 + 编译外观落盘
    const dataPath = join(staging, 'public', 'scene-data.json');
    let transcription = null;
    if (existsSync(dataPath)) {
      const data = snapshot;
      const staleList = snapshot
        ? Object.keys(snapshot.__visuals ?? {}).filter((id) => !liveNodeIds.has(id))
        : [];
      transcription = buildTranscription(
        data?.__visuals, data?.__materialLib, liveNodeIds,
        { autoCompiled: !legacyMode, staleList },
      );
      for (const key of Object.keys(data)) {
        if (key.startsWith('__')) {
          delete data[key];
        }
      }
      writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
      writeFileSync(join(staging, 'TRANSCRIPTION.md'), `${transcription.md}\n`);
    }

    // ③ 编译外观 → src/scene-core/generated/appearance.ts（整文件覆盖母版占位）
    if (compilation) {
      const generatedDir = join(staging, 'src', 'scene-core', 'generated');
      mkdirSync(generatedDir, { recursive: true });
      writeFileSync(join(generatedDir, 'appearance.ts'), compilation.code);
    }

    // ④ 自检铁律 3：对临时产物跑 build.mjs --stripped
    const check = checkProject(staging, { stripped: true });

    if (!check.ok || errors.length > 0) {
      // 校验失败：清理临时目录，源与旧 out 分毫不动（V19）
      return {
        ok: false,
        out,
        errors: [...errors, ...check.errors],
        warnings: check.warnings,
        staged: staging,
        check: check.report,
      };
    }

    // ⑤ 发布：out 已存在则先移走旧产物，rename 临时目录到位（失败可回滚语义：
    //    rename 同盘原子；跨盘 throw 由 catch 清理临时目录，旧产物未被动过）
    if (existsSync(out)) {
      if (!opts.force) {
        return {
          ok: false,
          errors: [`输出目录已存在且非空（用 --force 覆盖）：${out}`],
          out,
          staged: staging,
        };
      }
      const backup = join(dirname(out), `.tmp-old-out-${process.pid}-${Date.now()}`);
      renameSync(out, backup);
      try {
        renameSync(staging, out);
      } catch (err) {
        // 发布失败：旧产物放回去，不丢用户已有交付物
        renameSync(backup, out);
        throw err;
      }
      rmSync(backup, { recursive: true, force: true });
    } else {
      mkdirSync(dirname(out), { recursive: true });
      renameSync(staging, out);
    }

    return {
      ok: true,
      out,
      errors: [],
      warnings: check.warnings,
      transcription: transcription
        ? { refs: transcription.refs.length, libUsed: transcription.libUsed.length }
        : null,
      exportedVisuals: compilation ? compilation.stats.visualEntries : 0,
      appearanceWritten: compilation ? compilation.stats : null,
      check: check.report,
    };
  } catch (err) {
    return {
      ok: false,
      out,
      errors: [`导出失败（源与旧产物未受影响）：${err.message}`],
      staged: staging,
    };
  } finally {
    if (existsSync(staging)) {
      // 发布成功：staging 已 rename 走（existsSync 为 false 时无操作）；
      // 失败/异常：清理临时目录——源与旧 out 分毫不动
      rmSync(staging, { recursive: true, force: true });
    }
  }
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node strip-edit.mjs <src-project> --out <out-dir> [选项]

选项:
  --out <dir>            输出目录（必填；不能是源工程/其父目录/嵌在源工程内）
  --force                输出目录已存在时覆盖（旧产物在发布成功后才删除）
  --legacy-transcription 旧模式：不编译 appearance，输出人工转录清单（声明未完成保真导出）
  --json                 输出完整报告 JSON
  --quiet                仅退出码`;

const parseArgs = (argv) => {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--out' || a === '-o') {
      opts.out = next();
    } else if (a === '--force') {
      opts.force = true;
    } else if (a === '--legacy-transcription') {
      opts.legacyTranscription = true;
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--quiet') {
      opts.quiet = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (!a.startsWith('--')) {
      positional.push(a);
    } else {
      throw new Error(`未知选项: ${a}`);
    }
  }
  return { opts, positional };
};

const main = async () => {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[strip-edit] ${err.message}`);
    process.exit(2);
  }
  const { opts, positional } = parsed;
  if (opts.help || positional.length !== 1 || !opts.out) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  const result = await stripEdit(positional[0], opts.out, opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!opts.quiet) {
    const mark = result.ok ? 'PASS' : 'FAIL';
    console.log(`[strip-edit/${mark}] ${result.out}`);
    if (result.transcription) {
      console.log(`  转录清单: TRANSCRIPTION.md（库引用 ${result.transcription.refs} 条 / 涉及材质 ${result.transcription.libUsed} 个）`);
    }
    if (result.appearanceWritten) {
      console.log(`  编译外观: generated/appearance.ts（视觉 ${result.appearanceWritten.visualEntries} 条 / 材质库 ${result.appearanceWritten.materialLibEntries} 条）`);
    }
    for (const e of result.errors) {
      console.log(`  ✗ ${e}`);
    }
    for (const w of result.warnings ?? []) {
      console.log(`  ⚠ ${w}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
