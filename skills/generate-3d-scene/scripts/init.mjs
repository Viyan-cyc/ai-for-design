/**
 * init.mjs — 工程脚手架（母版复制 → 场景选择 → 资产库注入 → 占位替换 → 首次构建校验）
 *
 * 场景生成：把 skill 的母版工程（template/）复制成目标工程，
 * 按 profile/--scene 决定起步场景，经资产目录（manifests 真相源）注入
 * 本次要用到的资产，替换占位，然后跑构建门禁做首次校验。
 *
 * 做六件事：
 *   ① 复制 template/ → <target>/（剔除 node_modules / dist / .smoke-* / .git 等残留）
 *   ② 场景选择：--profile empty（默认，空起步）/ --profile demo（示例场景）/
 *      --scene <file>（业务场景数据：资产闭包按其引用注入）
 *   ③ 占位替换：package.json name → 工程名（kebab）
 *   ④ 资产注入：经 asset-catalog（manifests）解析真实 modelPath 与依赖闭包
 *      （glTF 多文件整目录、多状态贴图集），按场景引用（默认）/全部/指定 id
 *   ⑤ --with-components：拷 vendor/*.tgz 进产物工程 + package.json 写 file: 依赖
 *      （多 tgz 时 --components-version 显式选择；缺省报错列出可选版本，不猜字典序）
 *   ⑥ 首次构建校验：跑 build.mjs 结构门禁（必须 PASS）；--deps 可选装依赖并跑 npm run build
 *
 * CLI：
 *   node init.mjs <target-dir> [--name <proj-name>] [--profile empty|demo] [--scene <file>]
 *        [--assets referenced|all|<id,id>] [--with-components [--components-version <ver>]]
 *        [--deps shared|skip|copy|install] [--force] [--json]
 *   退出码：0 成功 / 1 校验失败 / 2 用法错误
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inject } from './lib/designer-assets.mjs';
import { checkProject } from './build.mjs';
import { checkEnvironment, npmEntry } from './lib/environment.mjs';
import { buildAssetCatalog, resolveAsset, referencedAssetIds } from './lib/asset-catalog.mjs';
import { validateSceneData, factoryRegistryFromProfile } from './lib/scene-schema.mjs';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = join(SKILL_ROOT, 'template');
const ASSETS_DIR = join(SKILL_ROOT, 'assets');
const VENDOR_DIR = join(SKILL_ROOT, 'vendor');

const EXCLUDE = new Set(['node_modules', '.cache', 'dist', 'offline', '.git', '.smoke-r', '.smoke-vendor', '.tmp-a3d-verify']);
const copyFilter = (src) => !EXCLUDE.has(basename(src)) && !basename(src).startsWith('.offline-')
  && !/^smoke.*\.png$/.test(basename(src)); // 冒烟上传产物不进生成工程

/**
 * 清理母版残留的 demo 模型：最终场景未引用的 public/assets/models/<id>.glb|gltf 删除。
 * 母版自带 demo 资产是为母版自身冒烟；生成工程按最终场景保留闭包（F09：空工程不带 Demo）。
 * draco/（解码器）与 textures 顶层贴图（materials 状态视觉常驻）不属模型闭包，保留。
 */
const pruneUnreferencedModels = (out, data) => {
  const referenced = new Set(referencedAssetIds(data));
  const modelsDir = join(out, 'public', 'assets', 'models');
  if (!existsSync(modelsDir)) {
    return { removed: [], kept: [] };
  }
  const removed = [];
  const kept = [];
  // 多文件 glTF 目录（models/<id>/）按目录名判定引用
  const entries = readdirSync(modelsDir, { withFileTypes: true });
  const dirIds = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (!referenced.has(ent.name)) {
        rmSync(join(modelsDir, ent.name), { recursive: true, force: true });
        removed.push(`${ent.name}/`);
      } else {
        kept.push(ent.name);
      }
    } else {
      const id = ent.name.replace(/\.(glb|gltf)$/i, '');
      if (!referenced.has(id)) {
        rmSync(join(modelsDir, ent.name));
        removed.push(ent.name);
      } else {
        kept.push(ent.name);
      }
    }
  }
  return { removed, kept };
};

/**
 * 子进程 cwd 规范形：Windows 上把盘符/目录名整成磁盘上的真实大小写。
 * 手打的 `d:\...` 会原样成为子进程 cwd，Vite 的 html-proxy 键与解析出的 id 前缀
 * 因此不一致，构建报 `Could not load <abs>/index.html?html-proxy&index=0.js`
 * （bash 自己的 cd 会规范化，所以人手跑没事，只有本脚本 spawn 时踩）。
 */
const spawnCwd = (p) => {
  if (process.platform !== 'win32') {
    return p;
  }
  try {
    // UNC 网络盘（\\server\share\…）的 native 形是 \\?\UNC\server\share\…，
    // 剥 \\?\ 后要还原 \\ 前缀，否则 npm 拿到非法路径
    return realpathSync.native(p).replace(/^\\\\\?\\UNC\\/, '\\\\').replace(/^\\\\\?\\/, '');
  } catch {
    return p.replace(/^([a-z]):/, (m, d) => `${d.toUpperCase()}:`);
  }
};

const GITIGNORE = `node_modules/
.cache/
offline/
dist/
.smoke*/
*.local
*.log
`;

/** 工程名 sanitize → kebab-case ascii。 */
const toSlug = (s) => s
  .trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || '3d-scene';

/**
 * 初始化工程。
 * @param {string} target 目标目录
 * @param {object} opts { name, profile, scene, assets, withComponents, componentsVersion, deps, force }
 */
export const initProject = (target, opts = {}) => {
  const started = performance.now();
  const timings = {};
  const out = resolve(target);
  const errors = [];
  const warnings = [];
  const deps = opts.deps ?? 'shared';
  if (!['shared', 'copy', 'install', 'skip'].includes(deps)) return { ok: false, out, errors: [`Unknown deps mode: ${deps}`], warnings };
  let env;
  try { env = checkEnvironment(); }
  catch (e) { return { ok: false, out, errors: [`${e.code}: ${e.message}`, `HINT: ${e.hint}`], warnings }; }


  if (!existsSync(TEMPLATE_DIR)) {
    return { ok: false, out, errors: [`skill 母版缺失：${TEMPLATE_DIR}`], warnings };
  }
  timings.environment = Math.round(performance.now() - started);
  if (existsSync(out) && readdirSync(out).length > 0) {
    if (!opts.force) {
      return { ok: false, out, errors: [`目标目录已存在且非空（用 --force 覆盖）：${out}`], warnings };
    }
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });

  /* ① 复制母版 */
  cpSync(TEMPLATE_DIR, out, { recursive: true, filter: copyFilter });

  if (!opts.scene && (opts.profile ?? 'empty') === 'empty') {
    cpSync(join(SKILL_ROOT, 'scripts/scaffolds/empty-profile.ts'), join(out, 'src/scene-profile.ts'));
    const materialsPath = join(out, 'src/scene-core/materials.ts');
    const materials = readFileSync(materialsPath, 'utf8');
    const begin = materials.indexOf('export const stateMaterials:');
    const end = materials.indexOf('\n};', begin);
    if (begin < 0 || end < 0) throw new Error('Template stateMaterials shape changed');
    writeFileSync(materialsPath, materials.slice(0, begin) + 'export const stateMaterials: Record<string, Record<string, StateVisual>> = {};'
      + materials.slice(end + 3), 'utf8');
    const handlers = join(out, 'src/scene-core/handlers/index.ts');
    writeFileSync(handlers, readFileSync(handlers, 'utf8').replace(/^export .*registerExampleHandler.*\r?\n/m, ''), 'utf8');
    const coreIndex = join(out, 'src/scene-core/index.ts');
    writeFileSync(coreIndex, readFileSync(coreIndex, 'utf8').replace(/^export .*?(?:registerExampleHandler|ExampleCard).*\r?\n/gm, ''), 'utf8');
    // These paths belong to the fresh copy above, never an existing user's source tree.
    for (const rel of ['src/scene-core/handlers/example', 'src/scene-core/cards/ExampleCard.vue', 'public/assets/textures/example.jpg']) {
      rmSync(join(out, rel), { recursive: true, force: true });
    }
  }

  /* ② 场景选择：--scene > --profile（empty 默认 / demo） */
  const profile = opts.profile ?? 'empty';
  let sceneSource = null;
  if (opts.scene) {
    sceneSource = resolve(opts.scene);
    if (!existsSync(sceneSource)) {
      return { ok: false, out, errors: [`--scene 文件不存在：${sceneSource}`], warnings };
    }
  } else if (profile === 'demo') {
    sceneSource = join(TEMPLATE_DIR, 'scenes', 'demo.json');
  } else if (profile !== 'empty') {
    return { ok: false, out, errors: [`未知 profile：${profile}（empty|demo，或用 --scene <file>）`], warnings };
  }

  let data = {};
  const dataPath = join(out, 'public', 'scene-data.json');
  if (sceneSource) {
    try {
      data = JSON.parse(readFileSync(sceneSource, 'utf8'));
    } catch (err) {
      return { ok: false, out, errors: [`场景数据解析失败（${sceneSource}）：${err.message}`], warnings };
    }
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  } else {
    // empty profile：母版自带 scenes/empty.json 装配（模板已含，public 里已是空场景则保持）
    try {
      data = JSON.parse(readFileSync(join(out, 'scenes', 'empty.json'), 'utf8'));
    } catch (err) {
      return { ok: false, out, errors: [`母版 scenes/empty.json 解析失败：${err.message}`], warnings };
    }
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  }

  // 母版 demo 资产按最终场景闭包清理（F09：空工程不带未引用 Demo 模型）
  const pruned = pruneUnreferencedModels(out, data);

  // 场景 schema 校验（P2.3/V08）：确定性结构错误在脚手架期拦截，不带病进工程
  const validateLevel = opts.validate ?? 'preview';
  if (!['preview', 'standard', 'off'].includes(validateLevel)) {
    return { ok: false, out, errors: [`--validate 取值非法：${validateLevel}（preview|standard|off）`], warnings };
  }
  let schema = null;
  if (validateLevel !== 'off') {
    // 工厂注册表从模板业务 profile 提取（P2-R3 单一来源，不维护镜像）
    const profileSrc = readFileSync(join(TEMPLATE_DIR, 'src', 'scene-profile.ts'), 'utf8');
    schema = validateSceneData(data, factoryRegistryFromProfile(profileSrc));
    for (const e of schema.errors) {
      errors.push(`场景 schema 违规 [${e.code}] ${e.path}: ${e.message}`);
    }
  }

  /* ③ 占位替换 + .gitignore */
  const name = toSlug(opts.name ?? basename(out));
  const pkgPath = join(out, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    return { ok: false, out, errors: [`母版 package.json 解析失败：${err.message}`], warnings };
  }
  pkg.name = name;
  writeFileSync(join(out, '.gitignore'), GITIGNORE);

  /* ④ 资产注入（manifests 真相源：真实 modelPath + glTF 依赖闭包 + 状态贴图）
     assetsRoot 测试缝：gates 用假资产库验证目录闭包，生产恒为 SKILL_ROOT */
  const assetsRoot = opts.assetsRoot ?? process.env.SCENE3D_LEGACY_ASSET_ROOT ?? SKILL_ROOT;
  const catalog = buildAssetCatalog(assetsRoot);
  const selector = opts.assets ?? 'referenced';
  let wanted;
  if (selector === 'all') {
    wanted = [...catalog.byId.keys()];
  } else if (selector === 'referenced') {
    wanted = referencedAssetIds(data);
  } else {
    wanted = selector.split(',').map((s) => s.trim()).filter(Boolean);
  }

  const copied = [];
  const missingAssets = [];
  const manifestOut = {}; // id → { model, format, textures? }（运行时/构建共用的资产映射）
  for (const id of wanted) {
    const resolved = resolveAsset(id, catalog);
    if (!resolved.ok) {
      missingAssets.push(`${id}（${resolved.error}）`);
      continue;
    }
    for (const rel of resolved.files) {
      // catalog files 相对 skill 根，形态恒为 assets/…；越出 assets/ 的解析结果拒绝落盘
      if (!rel.startsWith('assets/')) {
        missingAssets.push(`${id}（解析文件越出资产目录：${rel}）`);
        continue;
      }
      const dest = join(out, 'public', rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(assetsRoot, rel), dest);
    }
    // 映射条目：model 相对 public/assets/（剥 assets/ 前缀）；glTF 目录资产指到 .gltf 文件
    manifestOut[id] = {
      model: resolved.entry.modelPath.replace(/^assets\//, ''),
      format: resolved.format,
      ...(resolved.textures
        ? {
          textures: Object.fromEntries(
            Object.entries(resolved.textures).map(([k, rel]) => [k, rel.replace(/^assets\//, '')]),
          ),
        }
        : {}),
    };
    copied.push(id);
  }
  if (opts.assetPackage) {
    // New packages are copied below after the legacy manifest is written.
    missingAssets.length = 0;
  }
  if (missingAssets.length) {
    errors.push(`skill 资产库无法解析以下资产（catalog manifests 为真相源）：${missingAssets.join('; ')}`);
  }

  // 母版残留且被最终场景引用的资产也进映射（prune 保留的文件需要可解析）
  const referencedIds = new Set(referencedAssetIds(data));
  const modelsDir = join(out, 'public', 'assets', 'models');
  if (existsSync(modelsDir)) {
    for (const ent of readdirSync(modelsDir, { withFileTypes: true })) {
      const id = ent.isDirectory() ? ent.name : ent.name.replace(/\.(glb|gltf)$/i, '');
      if (manifestOut[id] || !referencedIds.has(id)) {
        continue;
      }
      if (ent.isDirectory()) {
        // glTF 目录：找 .gltf 主文件
        const main = readdirSync(join(modelsDir, ent.name)).find((f) => /\.gltf$/i.test(f));
        if (main) {
          manifestOut[id] = { model: `models/${ent.name}/${main}`, format: 'gltf' };
        }
      } else {
        manifestOut[id] = {
          model: `models/${ent.name}`,
          format: /\.gltf$/i.test(ent.name) ? 'gltf' : 'glb',
        };
      }
    }
  }
  // 落资产映射（P2-R1：build 与运行时 loader 的同一真相源；旧工程无此文件走 legacy）
  mkdirSync(join(out, 'public', 'assets'), { recursive: true });
  writeFileSync(join(out, 'public', 'assets', 'asset-manifest.json'), `${JSON.stringify(manifestOut, null, 2)}\n`);

  if (opts.assetPackage) {
    try { if(selector === 'all' || wanted.length) inject(opts.assetPackage, out, selector === 'all' ? undefined : wanted); }
    catch(e) { errors.push(`Package injection: ${e.message}`); }
  }

  /* ⑤ 组件库（可选；多 tgz 须显式选版本，不按字典序猜最新） */
  const components = { included: false };
  if (opts.withComponents) {
    const available = existsSync(VENDOR_DIR)
      ? readdirSync(VENDOR_DIR).filter((f) => f.endsWith('.tgz'))
      : [];
    let tgz = null;
    if (available.length === 0) {
      warnings.push('--with-components 但 skill vendor/ 无 tgz（跳过组件库注入）');
    } else if (available.length === 1) {
      tgz = available[0];
    } else if (opts.componentsVersion) {
      const hit = available.filter((f) => f.includes(opts.componentsVersion));
      if (hit.length !== 1) {
        errors.push(`--components-version "${opts.componentsVersion}" 匹配 ${hit.length} 个 tgz（须唯一）：${available.join(', ')}`);
      } else {
        tgz = hit[0];
      }
    } else {
      errors.push(`vendor/ 有多个 tgz，须 --components-version 显式选择：${available.join(', ')}`);
    }
    if (tgz) {
      const vendorOut = join(out, 'vendor');
      mkdirSync(vendorOut, { recursive: true });
      cpSync(join(VENDOR_DIR, tgz), join(vendorOut, tgz));
      pkg.dependencies = { ...pkg.dependencies, '@a3d/a3d-components': `file:./vendor/${tgz}` };
      components.included = true;
      components.tgz = tgz;
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  /* ⑥ 首次构建校验（结构门禁） */
  const check = checkProject(out);

  /* ⑥b 可选装依赖并跑 npm run build */
  timings.scaffold = Math.round(performance.now() - started) - timings.environment;
  const depsStarted = performance.now();
  let buildRun = null;
  const cwd = spawnCwd(out);
  if (deps !== 'skip') {
    try {
      if (deps === 'install' || components.included || deps === 'copy') {
        // Component projects own their dependency tree; never npm-install into a shared link.
        const CACHE = new Set(['.tmp', '.vite', '.vite-temp', '.package-lock.json']);
        if (deps !== 'install') cpSync(env.modules, join(out, 'node_modules'), { recursive: true, filter: (s) => !CACHE.has(basename(s)) });
        if (deps === 'install' || components.included) {
          const args = [components.included ? 'install' : 'ci', '--no-audit', '--no-fund', '--registry', env.registry];
          const r = spawnSync(env.node, [npmEntry(env.node), ...args], { cwd, stdio: 'inherit' });
          if (r.status !== 0) throw new Error(`Dependency installation failed: ${r.error?.message ?? r.status}`);
          if (components.included) {
            const lock = JSON.parse(readFileSync(join(out, 'package-lock.json'), 'utf8'));
            if (!existsSync(join(out, 'node_modules/@a3d/a3d-components')) || !lock.packages?.['']?.dependencies?.['@a3d/a3d-components']) {
              throw new Error('Component install or lock synchronization failed');
            }
          }
        }
      } else {
        symlinkSync(env.modules, join(out, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
      }
      if (!(opts.deferBuild ?? deps === 'shared')) {
        const r = spawnSync(env.node, [npmEntry(env.node), 'run', 'build'], { cwd, stdio: 'inherit' });
        buildRun = { ok: r.status === 0, status: r.status };
      }
    } catch (e) { errors.push(e.message); }
  }

  timings.dependenciesAndOptionalBuild = Math.round(performance.now() - depsStarted);
  const ok = check.ok && buildRun?.ok !== false && errors.length === 0;
  return {
    ok,
    out,
    name,
    profile: opts.scene ? 'scene' : profile,
    scene: opts.scene ? resolve(opts.scene) : null,
    errors: [...errors, ...check.errors],
    warnings: [...warnings, ...check.warnings],
    assets: { copied, missing: missingAssets, prunedDemo: pruned.removed },
    components,
    gate: check.report,
    buildRun,
    timings,
  };
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node init.mjs <target-dir> [选项]

选项:
  --name <proj>            工程名（kebab；默认取目标目录名）
  --profile empty          空起步场景（默认：舞台配置齐备，零业务节点）
  --profile demo           示例场景（trees/cars/examples 业务分组）
  --scene <file>           业务场景数据 JSON（优先于 profile；资产按其引用注入）
  --assets referenced      只注入场景引用的资产（默认）
  --assets all             注入 skill 资产库全部模型
  --assets id1,id2         注入指定资产
  --with-components        注入 3d-components（vendor tgz + file: 依赖）
  --components-version <v> 多 tgz 时显式选择版本（含 v 的文件名须唯一匹配）
  --deps shared            连接外部共享依赖（默认）；组件工程使用独立依赖
  --deps skip              只做结构门禁
  --defer-build            安装依赖后暂不编译，待场景完成后统一离线构建
  --deps copy              从共享环境复制独立 node_modules（兼容选项）并跑 npm run build
  --deps install           npm install（--registry 或环境变量 SCENE3D_REGISTRY）并跑 npm run build
  --validate preview       场景 schema 校验档位（默认 preview；standard 同级严格；off 跳过）
  --force                  目标目录非空时覆盖
  --json / --quiet`;

const parseArgs = (argv) => {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--name') {
      opts.name = next();
    } else if (a === '--profile') {
      opts.profile = next();
    } else if (a === '--scene') {
      opts.scene = next();
    } else if (a === '--asset-package') {
      opts.assetPackage = next();
    } else if (a === '--assets-root') {
      opts.assetsRoot = next();
    } else if (a === '--assets') {
      opts.assets = next();
    } else if (a === '--with-components') {
      opts.withComponents = true;
    } else if (a === '--components-version') {
      opts.componentsVersion = next();
    } else if (a === '--defer-build') {
      opts.deferBuild = true;
    } else if (a === '--deps') {
      opts.deps = next();
    } else if (a === '--validate') {
      opts.validate = next();
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
    console.error(`[init] ${err.message}`);
    process.exit(2);
  }
  const { opts, positional } = parsed;
  if (opts.help || positional.length !== 1) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  const result = initProject(positional[0], opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!opts.quiet) {
    console.log(`RESULT: ${result.ok ? 'OK' : 'FAIL'}`);
    if (result.timings) console.log(`INIT_TIMING_MS: ${JSON.stringify(result.timings)}`);
    const mark = result.ok ? 'PASS' : 'FAIL';
    console.log(`[init/${mark}] ${result.out}  (name=${result.name ?? '-'}, profile=${result.profile})`);
    if (result.assets) {
      console.log(`  资产注入: ${result.assets.copied.length} 个 [${result.assets.copied.join(', ')}]`);
    }
    if (result.components?.included) {
      console.log(`  组件库: ${result.components.tgz}`);
    }
    if (result.buildRun) {
      console.log(`  npm run build: ${result.buildRun.ok ? 'PASS' : 'FAIL'}`);
    }
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
