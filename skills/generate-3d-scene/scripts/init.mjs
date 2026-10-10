/**
 * init.mjs — 工程脚手架（母版复制 → 资产库注入 → 占位替换 → 首次构建校验）
 *
 * 场景生成：把 skill 的母版工程（template/）复制成目标工程，
 * 注入本次要用到的资产（skill assets/ → 目标 public/assets/，R2-5），替换占位，
 * 然后跑构建门禁做首次校验——LLM 拿到一个"能开局"的编辑态工程。
 *
 * 做五件事：
 *   ① 复制 template/ → <target>/（剔除 node_modules / dist / .smoke-* / .git 等残留）
 *   ② 占位替换：package.json name → 工程名（kebab）
 *   ③ 资产注入：按 scene-data.json 引用（默认）或全部/指定 id，拷 assets/models + assets/textures
 *   ④ --with-components：拷 vendor/*.tgz 进产物工程 + package.json 写 file: 依赖
 *   ⑤ 首次构建校验：跑 build.mjs 结构门禁（必须 PASS）；--deps 可选装依赖并跑 npm run build
 *
 * CLI：
 *   node init.mjs <target-dir> [--name <proj-name>] [--assets referenced|all|<id,id>]
 *        [--with-components] [--deps skip|copy|install] [--force] [--json]
 *   退出码：0 成功 / 1 校验失败 / 2 用法错误
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkProject } from './build.mjs';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = join(SKILL_ROOT, 'template');
const ASSETS_DIR = join(SKILL_ROOT, 'assets');
const VENDOR_DIR = join(SKILL_ROOT, 'vendor');

const EXCLUDE = new Set(['node_modules', 'dist', '.git', '.smoke-r', '.smoke-vendor', '.tmp-a3d-verify']);
const copyFilter = (src) => !EXCLUDE.has(basename(src))
  && !/^smoke.*\.png$/.test(basename(src)); // 冒烟上传产物不进生成工程

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
  .slice(0, 60) || 'gts-3d-scene';

/** 从 scene-data.json 收集被引用的资产 id。 */
const referencedAssets = (data) => {
  const ids = new Set();
  for (const [key, group] of Object.entries(data ?? {})) {
    if (!Array.isArray(group)) {
      continue;
    }
    for (const node of group) {
      if (node?.params?.assetId) {
        ids.add(node.params.assetId);
      }
    }
  }
  return ids;
};

/**
 * 初始化工程。
 * @param {string} target 目标目录
 * @param {object} opts { name, assets, withComponents, deps, force }
 */
export const initProject = (target, opts = {}) => {
  const out = resolve(target);
  const errors = [];
  const warnings = [];

  if (!existsSync(TEMPLATE_DIR)) {
    return { ok: false, out, errors: [`skill 母版缺失：${TEMPLATE_DIR}`], warnings };
  }
  if (existsSync(out) && readdirSync(out).length > 0) {
    if (!opts.force) {
      return { ok: false, out, errors: [`目标目录已存在且非空（用 --force 覆盖）：${out}`], warnings };
    }
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });

  /* ① 复制母版 */
  cpSync(TEMPLATE_DIR, out, { recursive: true, filter: copyFilter });

  /* ② 占位替换 + .gitignore */
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

  /* ③ 资产注入 */
  const dataPath = join(out, 'public', 'scene-data.json');
  let data = {};
  if (existsSync(dataPath)) {
    try {
      data = JSON.parse(readFileSync(dataPath, 'utf8'));
    } catch (err) {
      return { ok: false, out, errors: [`母版 public/scene-data.json 解析失败：${err.message}`], warnings };
    }
  }
  const selector = opts.assets ?? 'referenced';
  let wanted;
  if (selector === 'all') {
    wanted = existsSync(join(ASSETS_DIR, 'models'))
      ? readdirSync(join(ASSETS_DIR, 'models')).map((f) => f.replace(/\.(glb|gltf)$/, ''))
      : [];
  } else if (selector === 'referenced') {
    wanted = [...referencedAssets(data)];
  } else {
    wanted = selector.split(',').map((s) => s.trim()).filter(Boolean);
  }

  const modelsOut = join(out, 'public', 'assets', 'models');
  const texturesOut = join(out, 'public', 'assets', 'textures');
  mkdirSync(modelsOut, { recursive: true });
  const copied = [];
  const missingAssets = [];
  for (const id of wanted) {
    const glb = ['glb', 'gltf'].map((e) => join(ASSETS_DIR, 'models', `${id}.${e}`)).find((p) => existsSync(p));
    if (!glb) {
      missingAssets.push(id);
      continue;
    }
    cpSync(glb, join(modelsOut, basename(glb)));
    // 多状态资产的贴图集（assets/textures/<id>/）
    const texDir = join(ASSETS_DIR, 'textures', id);
    if (existsSync(texDir)) {
      mkdirSync(texturesOut, { recursive: true });
      cpSync(texDir, join(texturesOut, id), { recursive: true });
    }
    copied.push(id);
  }
  if (missingAssets.length) {
    errors.push(`skill 资产库缺以下模型（无法注入）：${missingAssets.join(', ')}`);
  }
  // 目标工程 public/assets/textures 顶层散图（图元/GLB 引用）保留模板自带（已在母版里）

  /* ④ 组件库（可选；vendor 多 tgz 时按文件名排序取最新，选择确定性） */
  const components = { included: false };
  if (opts.withComponents) {
    const tgz = existsSync(VENDOR_DIR)
      ? readdirSync(VENDOR_DIR).filter((f) => f.endsWith('.tgz')).sort().at(-1) ?? null
      : null;
    if (!tgz) {
      warnings.push('--with-components 但 skill vendor/ 无 tgz（跳过组件库注入）');
    } else {
      const vendorOut = join(out, 'vendor');
      mkdirSync(vendorOut, { recursive: true });
      cpSync(join(VENDOR_DIR, tgz), join(vendorOut, tgz));
      pkg.dependencies = { ...pkg.dependencies, '@a3d/a3d-components': `file:./vendor/${tgz}` };
      components.included = true;
      components.tgz = tgz;
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  /* ⑤ 首次构建校验（结构门禁） */
  const check = checkProject(out);

  /* ⑤b 可选装依赖并跑 npm run build */
  let buildRun = null;
  const cwd = spawnCwd(out);
  if (opts.deps === 'copy') {
    const srcModules = join(TEMPLATE_DIR, 'node_modules');
    if (existsSync(srcModules)) {
      // 排除增量缓存（.tmp 的 tsbuildinfo 按路径键控，拷贝会污染目标工程首次构建；
      // .vite/.vite-temp 为预打包缓存，目标首次构建自行重建）
      const CACHE = new Set(['.tmp', '.vite', '.vite-temp', '.package-lock.json']);
      cpSync(srcModules, join(out, 'node_modules'), { recursive: true, filter: (s) => !CACHE.has(basename(s)) });
    } else {
      warnings.push('--deps copy 但母版无 node_modules（退回 skip）');
    }
  } else if (opts.deps === 'install') {
    const registry = process.env.GTS3D_REGISTRY;
    const args = ['install', '--no-audit', '--no-fund'];
    if (registry) {
      args.push('--registry', registry);
    }
    const r = spawnSync('npm', args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) {
      warnings.push('npm install 失败（离线/镜像问题）——依赖未装，后续需手动安装');
    }
  }
  if (['copy', 'install'].includes(opts.deps) && existsSync(join(out, 'node_modules'))) {
    const r = spawnSync('npm', ['run', 'build'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    buildRun = { ok: r.status === 0, status: r.status };
  }

  const ok = check.ok && buildRun?.ok !== false;
  return {
    ok,
    out,
    name,
    errors: [...errors, ...check.errors],
    warnings: [...warnings, ...check.warnings],
    assets: { copied, missing: missingAssets },
    components,
    gate: check.report,
    buildRun,
  };
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node init.mjs <target-dir> [选项]

选项:
  --name <proj>            工程名（kebab；默认取目标目录名）
  --assets referenced      只注入 scene-data 引用的资产（默认）
  --assets all             注入 skill 资产库全部模型
  --assets id1,id2         注入指定资产
  --with-components        注入 3d-components（vendor tgz + file: 依赖）
  --deps skip              只做结构门禁（默认）
  --deps copy              从母版复制 node_modules（离线）并跑 npm run build
  --deps install           npm install（--registry 或环境变量 GTS3D_REGISTRY）并跑 npm run build
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
    } else if (a === '--assets') {
      opts.assets = next();
    } else if (a === '--with-components') {
      opts.withComponents = true;
    } else if (a === '--deps') {
      opts.deps = next();
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
    const mark = result.ok ? 'PASS' : 'FAIL';
    console.log(`[init/${mark}] ${result.out}  (name=${result.name ?? '-'})`);
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
