/**
 * build.mjs — 工程构建门禁（结构扫描 + 三条铁律 + import 白名单 + 场景预算静态估算）
 *
 * 这是"验证回路"第 ① 道门禁：在启动 dev server / 冒烟之前，
 * 用机器扫描把结构性错误、双模式隔离破坏、依赖越权、资源缺失、性能预算超限拦下。
 * 它**不跑** vite build（那是 `npm run build`）；它是构建前的静态契约检查。
 *
 * 检查项：
 *   1. 结构完整性  必需的工程文件/目录齐备；three/vue 版本符合锁（0.185.1 / ^3）
 *   2. 铁律 1      scene-core/**（+ 二开态入口 main.ts/App.vue）不得 import edit/
 *   3. 铁律 2      edit/** 只经 core 公开入口触达（@/scene-core 等白名单），
 *                  禁 `@/scene-core/engine/**` 等深层 import（引擎实例经 handle.internals 访问）
 *   4. import 白名单  src/** 的裸模块导入只能来自 {vue, three, three/examples/jsm/*, @a3d/a3d-components}
 *   5. 资产引用     scene-data.json 里 params.assetId 指向的模型文件必须真实存在于 public/assets/models/
 *   6. 场景预算     draw call ≤400 / 三角面 ≤1M / 材质数 ≤32（读 scene-data + GLB/GLTF 解析 + 图元面数表）
 *   7. --stripped   附加断言二开交付物不残留 edit（铁律 3 复检：src/edit 不存在 / 无 edit 引用 / 无私有区）
 *
 * CLI：
 *   node build.mjs <project-dir> [--stripped] [--json]
 *        [--max-calls N] [--max-triangles N] [--max-materials N]
 *   退出码：0 通过（可有警告）/ 1 门禁违规 / 2 用法错误
 *
 * 预算数值来源：构建期静态估算（运行期 perf-fps.mjs 为权威）。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadModel, reachableNodes, primitiveTriangles } from './validate-model.mjs';

/* ── 契约常量（阈值与白名单）──────────────────────────────── */

/** 场景预算默认值（R1-3：构建期静态估算上限，可 CLI 覆盖） */
export const DEFAULT_BUDGET = {
  maxCalls: 400,
  maxTriangles: 1_000_000,
  maxMaterials: 32,
};

/**
 * 图元面数表——由 template/src/scene-core/primitives.ts 的分段常量推导（SEGMENTS w=16,h=8）。
 * 改动 primitives.ts 分段常量时必须同步本表（构建期只看静态常量，不加载 three）。
 * 推导（three.js 几何索引公式）：
 *   Box(1,1,1)              6 面 × 2           = 12
 *   Sphere(0.5, 16, 8)      2·w·(h−1)          = 224
 *   Cylinder(0.5,0.5,1,16)  侧面 2·w + 两盖 2·w = 64
 *   Plane(1,1)                                 = 2
 *   Cone(0.5,1,16)          侧面 2·w + 底盖 w   = 48
 *   Torus(0.5,0.2,8,16)     2·radial·tubular   = 256
 */
export const PRIMITIVE_TRIANGLES = {
  Box: 12,
  Sphere: 224,
  Cylinder: 64,
  Plane: 2,
  Cone: 48,
  Torus: 256,
};

/** 图元 kind 全集（= primitives.ts PRIMITIVE_KINDS） */
export const PRIMITIVE_KINDS = new Set(Object.keys(PRIMITIVE_TRIANGLES));

/**
 * 铁律 2 允许的 core 公开入口（edit/ 只能从这些入口触达 core）。
 * 说明：放宽为「公开入口白名单」——真正的铁律是**禁止深层 import 引擎内部文件**
 * （@/scene-core/engine/**），类型/createScene/handlers 是公开 API 面。
 * 值为解析后路径（resolveSpec 产物），相对/别名写法归一后判定。
 */
export const ALLOWED_CORE_ENTRIES = new Set([
  'src/scene-core',
  'src/scene-core/types',
  'src/scene-core/createScene',
  'src/scene-core/handlers',
]);

/**
 * 裸模块导入白名单（内网纪律 + 版本锁）。匹配带边界：`vue` 放行 `vue` 与 `vue/demi`，
 * 不放行 `vue-router`/`vuetify`；`three` 放行 `three` 与 `three/…` 子路径，不放行 `three-stdlib`。
 */
export const BARE_IMPORT_PREFIXES = [
  'vue',
  'three',
  'three/examples/jsm/',
  'three/addons/',
  '@a3d/a3d-components',
];

/** 白名单边界匹配：spec 等于前缀，或以前缀 + '/' 开头（scoped 包自带 @scope/ 结构，天然带边界）。 */
const matchesBareWhitelist = (spec) => BARE_IMPORT_PREFIXES.some(
  (p) => spec === p || spec.startsWith(`${p}/`),
);

/** 锁定的依赖版本（package.json dependencies 强校验） */
export const LOCKED_DEPS = {
  three: '0.185.1',
  vuePrefix: '^3',
};

/* ── 导入语句提取 ─────────────────────────────────────────────────────────── */

/**
 * 提取源码里的模块说明符（静态 from / 副作用 import / 动态 import()）。
 * 覆盖 .ts / .vue（.vue 的 <script> 与字符串里的 /?edit=1 不产生导出行，天然忽略）。
 * @returns {Array<{spec: string, line: number}>}
 */
export const extractImports = (code) => {
  const out = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g, // import x from '…' / export … from '…'
    /\bimport\s+['"]([^'"]+)['"]/g, // 副作用 import '…'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // 动态 import('…')
  ];
  for (const re of patterns) {
    let m = re.exec(code);
    while (m) {
      const line = code.slice(0, m.index).split('\n').length;
      out.push({ spec: m[1], line });
      m = re.exec(code);
    }
  }
  return out;
};

/* ── 文件遍历 ────────────────────────────────────────────────────────────── */

/**
 * 把 import 说明符解析为 src/ 下的工程内路径；裸模块（vue/three/…）返回 null。
 * 相对路径（./x、../x）以 fromFile 所在目录为基；`@/x` 映射 src/x。
 * 归一分隔符后输出 POSIX 风格（src/scene-core/…），供铁律判定。
 */
export const resolveSpec = (spec, fromFile, srcDir) => {
  if (!spec.startsWith('.') && !spec.startsWith('@/') && !spec.startsWith('/')) {
    return null;
  }
  let abs;
  if (spec === '@/') {
    abs = srcDir;
  } else if (spec.startsWith('@/')) {
    abs = join(srcDir, spec.slice(2));
  } else if (spec.startsWith('/')) {
    abs = join(srcDir, spec.slice(1));
  } else {
    abs = resolve(dirname(fromFile), spec);
  }
  const rel = relative(srcDir, abs).split(sep).join('/');
  if (rel.startsWith('..')) {
    return null; // 逃出 src/，不属工程内引用
  }
  return `src/${rel}`;
};

/** 递归收集 <root> 下扩展名匹配的文件（跳过 node_modules/dist/.git）。 */
const walk = (root, exts, skip = new Set(['node_modules', 'dist', '.git', '.smoke-r', '.smoke-vendor'])) => {
  const out = [];
  if (!existsSync(root)) {
    return out;
  }
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!skip.has(name)) {
          stack.push(full);
        }
      } else if (exts.some((e) => name.endsWith(e))) {
        out.push(full);
      }
    }
  }
  return out;
};

/* ── GLB/GLTF 场景统计（面数 / 网格实例数 / 材质数）────────────────────────── */

/**
 * 解析模型文件 → 场景级成本 { triangles, calls, materials }。
 * calls 计入多材质 primitive 的每个材质槽（每槽一次 draw call）。
 */
const modelStats = (filePath) => {
  const { json } = loadModel(filePath);
  const accessors = json.accessors ?? [];
  const meshes = json.meshes ?? [];
  const reachable = reachableNodes(json);
  let triangles = 0;
  let calls = 0;
  const materials = new Set();
  for (const i of reachable) {
    const mesh = meshes[json.nodes?.[i]?.mesh];
    if (!mesh) {
      continue;
    }
    for (const prim of mesh.primitives ?? []) {
      triangles += primitiveTriangles(prim, accessors);
      const mat = prim.material;
      const slots = Array.isArray(mat) ? mat : mat === undefined ? [] : [mat];
      calls += Math.max(1, slots.length);
      for (const s of slots) {
        materials.add(`glb:${s}`);
      }
    }
  }
  return { triangles: Math.round(triangles), calls, materials };
};

/* ── 主检查 ──────────────────────────────────────────────────────────────── */

/**
 * 对目标工程跑全部门禁。
 * @param {string} dir 工程根目录
 * @param {object} [opts] { stripped, budget:{maxCalls,maxTriangles,maxMaterials} }
 * @returns {{ ok, root, errors:string[], warnings:string[], report:object }}
 */
export const checkProject = (dir, opts = {}) => {
  const root = resolve(dir);
  const errors = [];
  const warnings = [];
  const budget = { ...DEFAULT_BUDGET, ...opts.budget };

  const srcDir = join(root, 'src');
  const coreDir = join(srcDir, 'scene-core');
  const editDir = join(srcDir, 'edit');
  const srcFiles = walk(srcDir, ['.ts', '.vue']);

  /* 0. 目录存在性 */
  if (!existsSync(srcDir)) {
    return { ok: false, root, errors: [`工程根目录缺 src/：${root}`], warnings, report: {} };
  }

  /* 1. 结构完整性 */
  const required = [
    'package.json', 'index.html', 'vite.config.ts', 'eslint.config.mjs',
    'tsconfig.json', 'tsconfig.app.json',
    'src/main.ts', 'src/App.vue', 'src/scene-core/createScene.ts',
    'src/scene-core/types.ts', 'src/scene-core/index.ts',
    'src/scene-core/handlers/registry.ts', 'src/scene-core/cards/registry.ts',
    'public/scene-data.json', 'docs/INTEGRATION_GUIDE.md',
  ];
  const missing = required.filter((p) => !existsSync(join(root, p)));
  if (missing.length) {
    errors.push(`结构缺失：${missing.join(' / ')}`);
  }

  /* 2. 依赖版本锁 */
  let versions = { three: null, vue: null, ok: false };
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const dep = pkg.dependencies ?? {};
    versions = {
      three: dep.three ?? null,
      vue: dep.vue ?? null,
      ok: dep.three === LOCKED_DEPS.three
        && typeof dep.vue === 'string' && dep.vue.startsWith(LOCKED_DEPS.vuePrefix),
    };
    if (!versions.ok) {
      errors.push(`依赖版本不符：three=${dep.three ?? '缺失'}（锁 ${LOCKED_DEPS.three}）/ vue=${dep.vue ?? '缺失'}（锁 ${LOCKED_DEPS.vuePrefix}）`);
    }
  } catch (err) {
    errors.push(`package.json 解析失败：${err.message}`);
  }

  /* 3. 铁律 1：core（+二开态入口）不得 import edit/（按解析后路径判，覆盖相对/别名两种写法） */
  const coreNoEdit = { ok: true, violations: [] };
  const coreScopeFiles = [
    ...srcFiles.filter((f) => f.startsWith(coreDir + sep)),
    join(srcDir, 'main.ts'),
    join(srcDir, 'App.vue'),
  ].filter((f) => existsSync(f));
  for (const file of coreScopeFiles) {
    for (const { spec, line } of extractImports(readFileSync(file, 'utf8'))) {
      const resolved = resolveSpec(spec, file, srcDir);
      if (resolved !== null && (resolved === 'src/edit' || resolved.startsWith('src/edit/'))) {
        coreNoEdit.ok = false;
        coreNoEdit.violations.push(`${relative(root, file)}:${line} → ${spec}`);
      }
    }
  }
  if (!coreNoEdit.ok) {
    errors.push(`铁律 1 破裂（core 不得 import edit/）：\n    ${coreNoEdit.violations.join('\n    ')}`);
  }

  /* 4. 铁律 2：edit/ 只经 core 公开入口（禁深层 import 引擎内部；相对路径同样按解析后判） */
  const editEntry = { ok: true, violations: [] };
  if (existsSync(editDir)) {
    for (const file of srcFiles.filter((f) => f.startsWith(editDir + sep))) {
      for (const { spec, line } of extractImports(readFileSync(file, 'utf8'))) {
        const resolved = resolveSpec(spec, file, srcDir);
        if (resolved === 'src/scene-core' || resolved?.startsWith('src/scene-core/')) {
          if (!ALLOWED_CORE_ENTRIES.has(resolved)) {
            editEntry.ok = false;
            editEntry.violations.push(`${relative(root, file)}:${line} → ${spec}（禁深层 import，引擎实例走 handle.internals）`);
          }
        }
      }
    }
    if (!editEntry.ok) {
      errors.push(`铁律 2 破裂（edit 只经 core 公开入口）：\n    ${editEntry.violations.join('\n    ')}`);
    }
  }

  /* 5. import 白名单：src/** 裸模块导入 */
  const imports = { ok: true, violations: [] };
  for (const file of srcFiles) {
    for (const { spec, line } of extractImports(readFileSync(file, 'utf8'))) {
      const isRelative = spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('/');
      if (isRelative) {
        continue;
      }
      if (!matchesBareWhitelist(spec)) {
        imports.ok = false;
        imports.violations.push(`${relative(root, file)}:${line} → ${spec}`);
      }
    }
  }
  if (!imports.ok) {
    errors.push(`import 白名单违规（非内网白名单裸模块）：\n    ${imports.violations.join('\n    ')}`);
  }

  /* 6. 场景数据 + 资产引用 + 预算估算 */
  const budgetReport = {
    calls: 0, triangles: 0, materials: 0, limits: budget,
    over: [], unknownGroups: [], assets: { referenced: [], missing: [] },
    estimates: [],
  };
  const dataPath = join(root, 'public', 'scene-data.json');
  if (existsSync(dataPath)) {
    let data;
    try {
      data = JSON.parse(readFileSync(dataPath, 'utf8'));
    } catch (err) {
      errors.push(`public/scene-data.json 解析失败：${err.message}`);
    }
    if (data) {
      const materialKeys = new Set();
      const modelCache = new Map();
      const modelsDir = join(root, 'public', 'assets', 'models');
      const reserved = new Set(['version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove', '__visuals', '__materialLib']);
      for (const [key, group] of Object.entries(data)) {
        if (reserved.has(key) || !Array.isArray(group)) {
          continue;
        }
        // 分组成本 = Σ 节点成本
        let groupTris = 0;
        let groupCalls = 0;
        let handlerNodes = 0;
        for (const node of group) {
          const assetId = node?.params?.assetId;
          const file = assetId
            ? ['glb', 'gltf'].map((e) => join(modelsDir, `${assetId}.${e}`)).find((p) => existsSync(p))
            : null;
          if (assetId) {
            if (!budgetReport.assets.referenced.includes(assetId)) {
              budgetReport.assets.referenced.push(assetId);
            }
            if (!file) {
              if (!budgetReport.assets.missing.includes(assetId)) {
                budgetReport.assets.missing.push(assetId);
              }
              continue;
            }
            if (!modelCache.has(assetId)) {
              try {
                modelCache.set(assetId, modelStats(file));
              } catch (err) {
                warnings.push(`资产 ${assetId} 解析失败（预算未计入）：${err.message}`);
                modelCache.set(assetId, null);
              }
            }
            const stat = modelCache.get(assetId);
            if (stat) {
              groupTris += stat.triangles;
              groupCalls += stat.calls;
              for (const k of stat.materials) {
                materialKeys.add(`${assetId}:${k}`);
              }
            }
          } else if (PRIMITIVE_KINDS.has(key)) {
            groupTris += PRIMITIVE_TRIANGLES[key];
            groupCalls += 1;
            materialKeys.add(`prim:${key}`);
          } else {
            // 无资产引用的 handler 分组（几何由代码生成）——静态不可估
            handlerNodes += 1;
          }
        }
        budgetReport.calls += groupCalls;
        budgetReport.triangles += groupTris;
        if (handlerNodes > 0) {
          budgetReport.unknownGroups.push(`${key}（${handlerNodes} 节点，代码生成几何，静态不可估）`);
        }
        budgetReport.estimates.push({ group: key, nodes: group.length, triangles: groupTris, calls: groupCalls, handlerNodes });
      }
      // 材质库条目也算材质实例
      const libCount = data.__materialLib ? Object.keys(data.__materialLib).length : 0;
      if (libCount > 0) {
        materialKeys.add('__lib:count');
        budgetReport.libMaterials = libCount;
      }
      budgetReport.materials = materialKeys.size + (libCount > 0 ? libCount - 1 : 0);

      if (budgetReport.assets.missing.length) {
        errors.push(`scene-data 引用的资产缺文件（public/assets/models/）：${budgetReport.assets.missing.join(', ')}`);
      }
      if (budgetReport.calls > budget.maxCalls) {
        budgetReport.over.push(`draw call ${budgetReport.calls} > ${budget.maxCalls}`);
      }
      if (budgetReport.triangles > budget.maxTriangles) {
        budgetReport.over.push(`三角面 ${budgetReport.triangles} > ${budget.maxTriangles}`);
      }
      if (budgetReport.materials > budget.maxMaterials) {
        budgetReport.over.push(`材质数 ${budgetReport.materials} > ${budget.maxMaterials}`);
      }
      if (budgetReport.over.length) {
        errors.push(`场景预算超限（静态估算）：${budgetReport.over.join('；')}`);
      }
      if (budgetReport.unknownGroups.length) {
        warnings.push(`以下分组几何由代码生成，静态估算未计入（以 runtime perf 门禁为准）：${budgetReport.unknownGroups.join('；')}`);
      }
    }
  }

  /* 7. --stripped：二开交付物复检（铁律 3） */
  const stripped = { ok: true, violations: [] };
  if (opts.stripped) {
    if (existsSync(editDir)) {
      stripped.ok = false;
      stripped.violations.push('src/edit/ 仍存在');
    }
    for (const file of srcFiles) {
      const code = readFileSync(file, 'utf8');
      for (const { spec, line } of extractImports(code)) {
        const resolved = resolveSpec(spec, file, srcDir);
        if (resolved !== null && (resolved === 'src/edit' || resolved.startsWith('src/edit/'))) {
          stripped.ok = false;
          stripped.violations.push(`${relative(root, file)}:${line} → ${spec}`);
        }
      }
      if (file === join(srcDir, 'App.vue') && /\/\?edit=1|edit-main/.test(code)) {
        stripped.ok = false;
        stripped.violations.push(`${relative(root, file)} 残留 edit 入口引用（?edit=1 / edit-main）`);
      }
    }
    const htmlPath = join(root, 'index.html');
    if (existsSync(htmlPath) && /edit-main|\?edit=1/.test(readFileSync(htmlPath, 'utf8'))) {
      stripped.ok = false;
      stripped.violations.push('index.html 残留 edit 入口分流');
    }
    if (existsSync(dataPath)) {
      try {
        const d = JSON.parse(readFileSync(dataPath, 'utf8'));
        // 双下划线族=编辑器私有区（契约级约定），逐键检查而非只认两个已知键
        const privateKeys = Object.keys(d ?? {}).filter((k) => k.startsWith('__'));
        for (const k of privateKeys) {
          stripped.ok = false;
          stripped.violations.push(`scene-data.json 残留编辑器私有区 ${k}`);
        }
      } catch { /* JSON 错已在上方报过 */ }
    }
    if (!stripped.ok) {
      errors.push(`铁律 3 破裂（二开交付物残留 edit）：\n    ${stripped.violations.join('\n    ')}`);
    }
  }

  return {
    ok: errors.length === 0,
    root,
    errors,
    warnings,
    report: {
      structure: { ok: missing.length === 0, missing },
      versions,
      ironRules: { coreNoEdit, editEntry },
      imports,
      budget: budgetReport,
      stripped: opts.stripped ? stripped : undefined,
    },
  };
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node build.mjs <project-dir> [选项]

选项:
  --stripped               附加铁律 3 复检（二开交付物不得残留 edit）
  --max-calls N            覆盖 draw call 上限（默认 400）
  --max-triangles N        覆盖场景三角面上限（默认 1000000）
  --max-materials N        覆盖材质数上限（默认 32）
  --json                   输出完整报告 JSON
  --quiet                  仅退出码`;

const parseArgs = (argv) => {
  const opts = { budget: {} };
  const positional = [];
  const nextNum = (flag, raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`${flag} 需要非负数字，收到: ${raw}`);
    }
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--stripped') {
      opts.stripped = true;
    } else if (a === '--max-calls') {
      opts.budget.maxCalls = nextNum(a, argv[++i]);
    } else if (a === '--max-triangles') {
      opts.budget.maxTriangles = nextNum(a, argv[++i]);
    } else if (a === '--max-materials') {
      opts.budget.maxMaterials = nextNum(a, argv[++i]);
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
    console.error(`[build] ${err.message}`);
    process.exit(2);
  }
  const { opts, positional } = parsed;
  if (opts.help || positional.length === 0) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  const result = checkProject(positional[0], opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!opts.quiet) {
    const b = result.report.budget ?? {};
    const mark = result.ok ? 'PASS' : 'FAIL';
    console.log(`[build/${mark}] ${result.root}`);
    console.log(`  版本: three=${result.report.versions?.three} vue=${result.report.versions?.vue}`);
    console.log(`  预算: calls=${b.calls ?? 0} 三角面=${b.triangles ?? 0} 材质=${b.materials ?? 0}` + `（上限 ${b.limits?.maxCalls}/${b.limits?.maxTriangles}/${b.limits?.maxMaterials}）`);
    for (const e of result.errors) {
      console.log(`  ✗ ${e}`);
    }
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
