/**
 * strip-edit.mjs — 二开态交付导出（编辑态剥离 + 私有区剥离 + 转录清单 + 自检）
 *
 * 双模式交付的第二步：
 *   编辑期工程（core + edit，能调参）→ strip-edit → 二开包（纯 core + 定稿数据 + 转录清单）
 *
 * 做四件事：
 *   ① 复制工程，剔除 edit 世界：src/edit/ 整目录；index.html 双入口改单入口；
 *      App.vue 去掉"打开编辑态"链接（二开者拿到的代码物理不含编辑态）
 *   ② 剥离编辑器私有区：scene-data.json 删 __visuals + __materialLib（双下划线族，交付不进）
 *   ③ 输出转录清单 TRANSCRIPTION.md：物体视觉 override 表 + 材质库表 + 引用表 + 转录指引
 *      （调参值不进数据、由 LLM 转录进 materials.ts / handler 默认值）
 *   ④ 自检铁律 3：对产物跑 build.mjs --stripped（src/edit 不存在 / 无 edit 引用 / 无私有区）
 *
 * CLI：
 *   node strip-edit.mjs <src-project> --out <out-dir> [--force] [--json]
 *   退出码：0 成功 / 1 自检失败或工程非法 / 2 用法错误
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, basename, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkProject } from './build.mjs';

/** 复制时剔除的目录/文件（编辑态 + 构建残留 + 依赖） */
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

/* ── index.html：双入口 → 单入口 ───────────────────────────────────────────── */

const INDEX_ENTRY = `<script type="module">
      // 二开态单入口（编辑态已随交付剥离）
      import('/src/main.ts');
    </script>`;

const rewriteIndex = (html) => html.replace(/<script type="module">[\s\S]*?<\/script>/, INDEX_ENTRY);

/* ── App.vue：去掉编辑态链接 ──────────────────────────────────────────────── */

const rewriteApp = (code) => code
  .replace(/\s*<a\s+href="\/\?edit=1"[^>]*>[^<]*<\/a>/g, '')
  // 兜底：任何残留的 edit=1 链接
  .replace(/\s*<a\s+href="[^"]*\?edit=1[^"]*"[^>]*>[^<]*<\/a>/g, '');

/* ── 转录清单生成 ─────────────────────────────────────────────────────────── */

/**
 * 不进 ① 物体视觉转录表的键：
 * - libraryRef：只进 ③ 引用表
 * - locked：编辑器交互态（Spline 同款锁定），不影响渲染，转录无意义
 * materialType/castShadow/receiveShadow/visible 属个体视觉差异，保留在 ① 表转录。
 */
const VISUAL_META_KEYS = new Set(['libraryRef', 'locked']);

/**
 * 从私有区生成转录清单 markdown。
 * @param {object} visuals scene-data.__visuals
 * @param {object} materialLib scene-data.__materialLib
 * @param {Set<string>} liveNodeIds 当前 scene-data 里的物体 id（识别陈旧条目）
 * @returns {{ md: string, refs: Array<{nodeId,matId}>, libUsed: string[] }}
 */
export const buildTranscription = (visuals, materialLib, liveNodeIds) => {
  const vis = visuals ?? {};
  const lib = materialLib ?? {};
  const lines = [];
  lines.push('# 转录清单（strip-edit 生成）');
  lines.push('');
  lines.push('> 本文件由 strip-edit.mjs 生成。编辑期用面板调出的视觉参数已从交付数据剥离，');
  lines.push('> 需由 LLM 按下方指引转录进**代码**（materials.ts / handler 默认值），转录后本文件可留档或删除。');
  lines.push('');

  // 引用表：nodeId → mat_id
  const refs = [];
  for (const [nodeId, v] of Object.entries(vis)) {
    if (v && typeof v.libraryRef === 'string') {
      refs.push({ nodeId, matId: v.libraryRef });
    }
  }
  const libUsed = [...new Set(refs.map((r) => r.matId))];

  // ① 物体视觉 override（排除 libraryRef）
  lines.push('## ① 物体视觉 override（→ 转录进该 type 的 stateMaterials 条目 / handler 默认值）');
  lines.push('');
  const visualRows = [];
  const stale = [];
  for (const [nodeId, v] of Object.entries(vis)) {
    if (liveNodeIds && !liveNodeIds.has(nodeId)) {
      stale.push(nodeId);
    }
    const fields = Object.entries(v ?? {}).filter(([k]) => !VISUAL_META_KEYS.has(k));
    for (const [k, val] of fields) {
      visualRows.push(`| \`${nodeId}\` | \`${k}\` | \`${JSON.stringify(val)}\` |`);
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

  // ② 材质库条目（仅被引用者）
  lines.push('## ② 材质库条目（仅列出被引用的）（→ 转录进 materials.ts 的 `libraryMaterials`）');
  lines.push('');
  if (libUsed.length) {
    for (const matId of libUsed) {
      const entry = lib[matId];
      if (!entry) {
        lines.push(`### \`${matId}\` · ⚠️ 引用缺失（__materialLib 无此条目）`);
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
  lines.push('## ③ 库引用表（→ 接线 `obj.material = libraryMaterials.<key>`）');
  lines.push('');
  if (refs.length) {
    lines.push('| nodeId | mat_id | name |');
    lines.push('|---|---|---|');
    for (const r of refs) {
      lines.push(`| \`${r.nodeId}\` | \`${r.matId}\` | ${lib[r.matId]?.name ?? '?'} |`);
    }
  } else {
    lines.push('_（无）_');
  }
  lines.push('');

  if (stale.length) {
    lines.push(`> ⚠️ 陈旧视觉条目（节点已不存在，已忽略）：${stale.join(', ')}`);
    lines.push('');
  }

  // 转录指引
  lines.push('## 转录指引');
  lines.push('');
  lines.push('1. **② 的每条** → `src/scene-core/materials.ts` 增 `export const libraryMaterials = { <snake_case 名>: { …spec } }`');
  lines.push('   （与 `stateMaterials` 并存不合并：stateMaterials 管"业务类型→状态→视觉"，libraryMaterials 管"名字→材质"跨物体复用）');
  lines.push('2. **③ 的每条** → 在对应 handler / 装配处接线 `mesh.material = libraryMaterials.<名>`');
  lines.push('3. **① 的每条** → 该物体所属 type 的 `stateMaterials` 条目（若属状态视觉），或 handler 的默认值');
  lines.push('');
  lines.push('> 详见 `docs/INTEGRATION_GUIDE.md` 的 `__visuals` / `__materialLib` 转录章节。');

  return { md: lines.join('\n'), refs, libUsed };
};

/* ── 主流程 ──────────────────────────────────────────────────────────────── */

/**
 * 导出二开包。
 * @param {string} srcProject 编辑态工程根
 * @param {string} outDir 输出目录
 * @param {object} [opts] { force }
 */
export const stripEdit = (srcProject, outDir, opts = {}) => {
  const src = resolve(srcProject);
  const out = resolve(outDir);
  const errors = [];

  if (!existsSync(join(src, 'src', 'edit'))) {
    return { ok: false, errors: [`源工程不含 src/edit/（编辑态工程？）：${src}`], out };
  }
  // 输出目录不得是源工程本身或其祖先（rmSync 清空时会毁掉源）
  const relOutToSrc = relative(out, src);
  if (relOutToSrc === '' || (!relOutToSrc.startsWith('..') && relOutToSrc !== '.')) {
    return {
      ok: false,
      errors: [`输出目录不能是源工程或其父目录（会清空源工程）：${out}`],
      out,
    };
  }
  if (existsSync(out) && readdirSync(out).length > 0) {
    if (!opts.force) {
      return { ok: false, errors: [`输出目录已存在且非空（用 --force 覆盖）：${out}`], out };
    }
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });

  // ① 复制（剔除 edit 世界 + 依赖 + 残留）
  cpSync(src, out, { recursive: true, filter: copyFilter });

  // index.html 单入口化 + App.vue 去链接
  const htmlPath = join(out, 'index.html');
  if (existsSync(htmlPath)) {
    writeFileSync(htmlPath, rewriteIndex(readFileSync(htmlPath, 'utf8')));
  }
  const appPath = join(out, 'src', 'App.vue');
  if (existsSync(appPath)) {
    writeFileSync(appPath, rewriteApp(readFileSync(appPath, 'utf8')));
  }

  // ② 剥离私有区（双下划线族整体不进交付；转录只认两个已知键）+ ③ 转录清单
  const dataPath = join(out, 'public', 'scene-data.json');
  let transcription = null;
  if (existsSync(dataPath)) {
    let data;
    try {
      data = JSON.parse(readFileSync(dataPath, 'utf8'));
    } catch (err) {
      return { ok: false, errors: [`public/scene-data.json 解析失败：${err.message}`], out };
    }
    const liveNodeIds = new Set();
    for (const group of Object.values(data)) {
      if (Array.isArray(group)) {
        for (const node of group) {
          if (node?.id) {
            liveNodeIds.add(node.id);
          }
        }
      }
    }
    transcription = buildTranscription(data.__visuals, data.__materialLib, liveNodeIds);
    for (const key of Object.keys(data)) {
      if (key.startsWith('__')) {
        delete data[key];
      }
    }
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
    writeFileSync(join(out, 'TRANSCRIPTION.md'), `${transcription.md}\n`);
  }

  // ④ 自检铁律 3：对产物跑 build.mjs --stripped
  const check = checkProject(out, { stripped: true });

  return {
    ok: check.ok,
    out,
    errors: [...errors, ...check.errors],
    warnings: check.warnings,
    transcription: transcription
      ? { refs: transcription.refs.length, libUsed: transcription.libUsed.length }
      : null,
    check: check.report,
  };
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node strip-edit.mjs <src-project> --out <out-dir> [选项]

选项:
  --out <dir>   输出目录（必填）
  --force       输出目录已存在时覆盖
  --json        输出完整报告 JSON
  --quiet       仅退出码`;

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

const main = () => {
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
  const result = stripEdit(positional[0], opts.out, opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!opts.quiet) {
    const mark = result.ok ? 'PASS' : 'FAIL';
    console.log(`[strip-edit/${mark}] ${result.out}`);
    if (result.transcription) {
      console.log(`  转录清单: TRANSCRIPTION.md（库引用 ${result.transcription.refs} 条 / 涉及材质 ${result.transcription.libUsed} 个）`);
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
  main();
}
