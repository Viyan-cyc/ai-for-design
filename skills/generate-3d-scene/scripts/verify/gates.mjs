/**
 * gates.mjs — 构建门禁脚本的回归设施
 *
 * 对 build.mjs / strip-edit.mjs / init.mjs 跑正面与负面用例：
 *   ① build：结构门禁通过 + 三条铁律阻断（core↛edit / edit 只走 handle / 剥离后零 edit 引用）
 *      + import 白名单 + 资产缺文件 + 场景预算上下限 + 公开入口白名单放行
 *   ② strip-edit：剔除 edit 世界 + 剥离私有区 + 转录清单三类表内容 + 陈旧条目告警 + 产物自检
 *   ③ init：母版复制 + 占位替换 + 资产按引用/全部注入 + 组件库 + 非空目录拒绝
 *
 * 用例在系统临时目录里造夹具（不碰 skill 目录），跑完即删。
 *
 * 用法: node scripts/verify/gates.mjs [--with-build] [--keep] [--quiet]
 *   --with-build  追加端到端用例（init 复制依赖 + 首次 npm run build），耗时数分钟
 *   --keep        保留夹具目录（失败排查用；路径会打印）
 *   --quiet       只打印失败项与汇总
 * 退出码: 0 全部通过 / 1 有用例失败
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = join(SKILL, 'template');
const SKILL_SCRIPTS = join(SKILL, 'scripts');

const argv = new Set(process.argv.slice(2));
const withBuild = argv.has('--with-build');
const keep = argv.has('--keep');
const quiet = argv.has('--quiet');

if (!existsSync(TEMPLATE)) {
  console.error(`[gates] skill 母版缺失：${TEMPLATE}`);
  process.exit(2);
}

const ROOT = mkdtempSync(join(tmpdir(), 'g3d-gates-'));
const EXCLUDE = new Set(['node_modules', 'dist', '.git', '.smoke-r', '.smoke-vendor', '.tmp-a3d-verify']);

/** 复制母版（剔除依赖与构建残留）。 */
const copy = (src, dst) => cpSync(src, dst, { recursive: true, filter: (s) => !EXCLUDE.has(basename(s)) });

const results = [];
let failed = false;
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  if (!cond || !quiet) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
  if (!cond) {
    failed = true;
  }
};

/** 跑 skill 脚本，返回 { ok（期望的退出码是否成立）, status, out }。 */
const run = (script, args, expectZero = true) => {
  const r = spawnSync('node', [join(SKILL_SCRIPTS, script), ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: expectZero ? r.status === 0 : r.status !== 0, status: r.status, out };
};

const F = (n) => join(ROOT, n);
const firstFail = (out) => out.split('\n').find((l) => l.includes('✗')) ?? '';

/* ── 夹具 ──────────────────────────────────────────────────────────────────── */
copy(TEMPLATE, F('tpl'));                       // 编辑态工程（含 src/edit）
copy(F('tpl'), F('stripped'));
rmSync(join(F('stripped'), 'src', 'edit'), { recursive: true, force: true });

/* ── build.mjs：正面 ───────────────────────────────────────────────────────── */
{
  const r = run('build.mjs', [F('tpl')], true);
  check('build: 母版（编辑态）PASS', r.ok && /\[build\/PASS\]/.test(r.out), `status=${r.status}`);
}
{
  const out = F('fx-stripped-ok');
  run('strip-edit.mjs', [F('tpl'), '--out', out, '--force'], true);
  const r = run('build.mjs', [out, '--stripped'], true);
  check('build: 二开产物 --stripped PASS', r.ok && /\[build\/PASS\]/.test(r.out), `status=${r.status}`);
  const app = readFileSync(join(out, 'src/App.vue'), 'utf8');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  check('strip-edit: App.vue 去链接且无死 CSS 残留', !/\?edit=1/.test(app) && !/\.app-root__hint a\s*\{/.test(app));
  check('strip-edit: index.html 单入口', !/\?edit=1|edit-main/.test(html) && /import\('\/src\/main\.ts'\)/.test(html));
}

/* ── build.mjs：铁律 1（core → edit）───────────────────────────────────────── */
{
  const d = F('fx-core-edit');
  copy(F('tpl'), d);
  writeFileSync(join(d, 'src/scene-core/bad.ts'), 'import { Bridge } from "@/edit/Bridge";\nexport const x = Bridge;\n');
  const r = run('build.mjs', [d], false);
  check('build: 铁律1 core→edit 阻断', r.ok && /铁律 1 破裂/.test(r.out), `status=${r.status} ${firstFail(r.out)}`);
}

/* ── build.mjs：铁律 2（edit → 深层 engine；公开入口放行）──────────────────── */
{
  const d = F('fx-edit-deep');
  copy(F('tpl'), d);
  writeFileSync(join(d, 'src/edit/bad.ts'), 'import { SceneEngine } from "@/scene-core/engine/SceneEngine";\nexport const x = SceneEngine;\n');
  const r = run('build.mjs', [d], false);
  check('build: 铁律2 edit→深层 import 阻断', r.ok && /铁律 2 破裂/.test(r.out), `status=${r.status} ${firstFail(r.out)}`);
}
{
  const d = F('fx-edit-entry');
  copy(F('tpl'), d);
  writeFileSync(
    join(d, 'src/edit/ok.ts'),
    'import type { SceneHandle } from "@/scene-core";\nimport { createScene } from "@/scene-core/createScene";\nexport type X = SceneHandle;\nexport const y = createScene;\n',
  );
  const r = run('build.mjs', [d], true);
  check('build: 铁律2 公开入口白名单放行', r.ok, `status=${r.status}`);
}

/* ── build.mjs：import 白名单 ──────────────────────────────────────────────── */
{
  const d = F('fx-bare');
  copy(F('tpl'), d);
  writeFileSync(join(d, 'src/scene-core/bad.ts'), 'import lodash from "lodash";\nexport const x = lodash;\n');
  const r = run('build.mjs', [d], false);
  check('build: import 白名单阻断（lodash）', r.ok && /import 白名单违规/.test(r.out), `status=${r.status}`);
}
{
  const d = F('fx-bare-boundary');
  copy(F('tpl'), d);
  writeFileSync(join(d, 'src/scene-core/bad.ts'), 'import router from "vue-router";\nimport stdlib from "three-stdlib";\nexport const x = [router, stdlib];\n');
  const r = run('build.mjs', [d], false);
  check('build: 白名单边界（vue-router/three-stdlib 阻断）', r.ok && /vue-router/.test(r.out) && /three-stdlib/.test(r.out), `status=${r.status}`);
}
{
  const d = F('fx-bare-sub-ok');
  copy(F('tpl'), d);
  writeFileSync(join(d, 'src/scene-core/ok.ts'), 'import { ref } from "vue";\nimport "three/examples/jsm/renderers/CSS2DRenderer.js";\nexport const x = ref;\n');
  const r = run('build.mjs', [d], true);
  check('build: 白名单子路径放行（vue / three/examples/jsm/）', r.ok, `status=${r.status}`);
}

/* ── build.mjs：铁律 2 相对路径旁路（深层 import 用 ../ 写法）──────────────── */
{
  const d = F('fx-edit-rel-deep');
  copy(F('tpl'), d);
  writeFileSync(join(d, 'src/edit/bad.ts'), 'import { SceneEngine } from "../scene-core/engine/SceneEngine";\nexport const x = SceneEngine;\n');
  const r = run('build.mjs', [d], false);
  check('build: 铁律2 相对路径深层 import 阻断', r.ok && /铁律 2 破裂/.test(r.out), `status=${r.status} ${firstFail(r.out)}`);
}
{
  const d = F('fx-edit-rel-ok');
  copy(F('tpl'), d);
  writeFileSync(join(d, 'src/edit/ok.ts'), 'import type { SceneHandle } from "../scene-core";\nexport type X = SceneHandle;\n');
  const r = run('build.mjs', [d], true);
  check('build: 铁律2 相对路径公开入口放行', r.ok, `status=${r.status}`);
}

/* ── build.mjs：--max-* 值校验（NaN/负数 → 用法错误而非静默失效）─────────── */
{
  const d = F('tpl');
  const r = run('build.mjs', [d, '--max-calls', 'abc'], false);
  check('build: --max-calls 非数字拒绝', r.ok && /需要非负数字/.test(r.out), `status=${r.status}`);
  const r2 = run('build.mjs', [d, '--max-triangles', '-1'], false);
  check('build: --max-triangles 负数拒绝', r2.ok && /需要非负数字/.test(r2.out), `status=${r2.status}`);
}

/* ── build.mjs：资产引用 ───────────────────────────────────────────────────── */
{
  const d = F('fx-asset-missing');
  copy(F('tpl'), d);
  const p = join(d, 'public/scene-data.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  data.cars[0].params.assetId = 'nonexistent_model';
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  const r = run('build.mjs', [d], false);
  check('build: 资产缺文件阻断', r.ok && /资产缺文件/.test(r.out), `status=${r.status}`);
}

/* ── build.mjs：场景预算（draw call 上/下限）───────────────────────────────── */
{
  const d = F('fx-budget');
  copy(F('tpl'), d);
  const p = join(d, 'public/scene-data.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  data.Box = [...data.Box, ...Array.from({ length: 401 }, (_, i) => ({ id: `pad_${i}`, position: [i, 0, 0] }))];
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  const r = run('build.mjs', [d], false);
  check('build: 预算超限阻断（draw call）', r.ok && /场景预算超限/.test(r.out), `status=${r.status} ${firstFail(r.out)}`);
}
{
  const d = F('fx-budget-ok');
  copy(F('tpl'), d);
  const p = join(d, 'public/scene-data.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  data.Box = [...data.Box, ...Array.from({ length: 100 }, (_, i) => ({ id: `pad_${i}`, position: [i, 0, 0] }))];
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  const r = run('build.mjs', [d], true);
  check('build: 预算内放行（100 图元）', r.ok, `status=${r.status}`);
}

/* ── build.mjs：铁律 3（剥离后零 edit 引用 + 无私有区）────────────────────── */
{
  const d = F('fx-strip-violation');
  copy(F('stripped'), d);
  const p = join(d, 'public/scene-data.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  data.__visuals = { car_01: { color: '#ff0000' } };
  data.__materialLib = { glass: { name: 'glass', spec: { type: 'MeshPhysicalMaterial' } } };
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(join(d, 'src/main.ts'), `${readFileSync(join(d, 'src/main.ts'), 'utf8')}\nimport "@/edit/x";\n`);
  const r = run('build.mjs', [d, '--stripped'], false);
  check('build: 铁律3 私有区+edit引用 阻断', r.ok && /铁律 3 破裂/.test(r.out) && /__visuals/.test(r.out), `status=${r.status}`);
}
{
  // 未来编辑器私有键（非两个已知键）同样拦截——双下划线族契约
  const d = F('fx-strip-future-key');
  copy(F('stripped'), d);
  const p = join(d, 'public/scene-data.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  data.__futureEditorKey = { anything: true };
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  const r = run('build.mjs', [d, '--stripped'], false);
  check('build: 铁律3 未来 __ 键拦截', r.ok && /__futureEditorKey/.test(r.out), `status=${r.status}`);
}

/* ── strip-edit.mjs ───────────────────────────────────────────────────────── */
{
  const r = run('strip-edit.mjs', [F('stripped'), '--out', F('fx-out'), '--force'], false);
  check('strip-edit: 源无 src/edit 拒绝', r.ok && /不含 src\/edit/.test(r.out), `status=${r.status}`);
}
{
  // P0 回归：--out == 源工程（含 --force）必须拒绝且源不被清空
  const d = F('fx-p0-guard');
  copy(F('tpl'), d);
  const r = run('strip-edit.mjs', [d, '--out', d, '--force'], false);
  const srcIntact = existsSync(join(d, 'src', 'edit', 'Bridge.ts')) && existsSync(join(d, 'public', 'scene-data.json'));
  check('strip-edit: --out==源 拒绝且源完好', r.ok && /不能是源工程或其父目录/.test(r.out) && srcIntact, `status=${r.status} srcIntact=${srcIntact}`);
  // --out 为源父目录同样拒绝
  const parent = F('fx-p0-guard-parent');
  mkdirSync(parent, { recursive: true });
  copy(F('tpl'), join(parent, 'proj'));
  const r2 = run('strip-edit.mjs', [join(parent, 'proj'), '--out', parent, '--force'], false);
  const srcIntact2 = existsSync(join(parent, 'proj', 'src', 'edit', 'Bridge.ts'));
  check('strip-edit: --out=源父目录 拒绝且源完好', r2.ok && /不能是源工程或其父目录/.test(r2.out) && srcIntact2, `status=${r2.status} srcIntact=${srcIntact2}`);
}
{
  const d = F('fx-transcribe');
  copy(F('tpl'), d);
  const p = join(d, 'public/scene-data.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  data.__visuals = {
    car_01: { color: '#ff8800', metalness: 0.9, libraryRef: 'carpaint' },
    car_02: { metalness: 0.3, locked: true, visible: false, castShadow: false, materialType: 'MeshStandardMaterial' },
    ghost_99: { color: '#123456' },
  };
  data.__materialLib = {
    carpaint: { name: '车漆', spec: { type: 'MeshPhysicalMaterial', clearcoat: 1 } },
    unused_seed: { name: '未引用', spec: { type: 'MeshStandardMaterial' } },
  };
  data.__futureEditorKey = { secret: true };
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  const out = F('fx-transcribe-out');
  const r = run('strip-edit.mjs', [d, '--out', out, '--force'], true);
  const md = existsSync(join(out, 'TRANSCRIPTION.md')) ? readFileSync(join(out, 'TRANSCRIPTION.md'), 'utf8') : '';
  const cleaned = JSON.parse(readFileSync(join(out, 'public/scene-data.json'), 'utf8'));
  check('strip-edit: 转录清单生成 PASS', r.ok, `status=${r.status}`);
  check(
    'strip-edit: ① 视觉 override 逐字段成行',
    md.includes('`car_01`') && md.includes('`color`') && md.includes('`"#ff8800"`')
      && md.includes('`metalness`') && md.includes('`0.9`'),
  );
  check(
    'strip-edit: ① 容纳个体渲染差异（visible/castShadow/materialType）',
    md.includes('`visible`') && md.includes('`castShadow`') && md.includes('`materialType`'),
  );
  check('strip-edit: ① 排除编辑器私有键（locked）', !md.includes('`locked`'));
  check('strip-edit: ① libraryRef 不进物体视觉表', !/\|\s*`car_01`\s*\|\s*`libraryRef`/.test(md));
  check('strip-edit: ② 仅有被引用材质库条目', md.includes('`carpaint`') && !md.includes('`unused_seed`'));
  check('strip-edit: ③ 引用表 nodeId→mat_id', md.includes('| `car_01` | `carpaint` |'));
  check('strip-edit: 陈旧条目 warn', /陈旧视觉条目.*ghost_99/.test(md));
  check('strip-edit: 私有区已剥离（双下划线族整体）',
    cleaned.__visuals === undefined && cleaned.__materialLib === undefined && cleaned.__futureEditorKey === undefined
    && Object.keys(cleaned).every((k) => !k.startsWith('__')));
}

/* ── init.mjs ─────────────────────────────────────────────────────────────── */
{
  const out = F('init-ok');
  const r = run('init.mjs', [out, '--name', 'Factory Monitor', '--assets', 'referenced'], true);
  const pkg = existsSync(join(out, 'package.json')) ? JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')) : {};
  const refModels = existsSync(join(out, 'public/assets/models')) ? readdirSync(join(out, 'public/assets/models')) : [];
  check('init: 首次 build 门禁 PASS', r.ok && /\[init\/PASS\]/.test(r.out), `status=${r.status}`);
  check('init: 占位替换 name=kebab', pkg.name === 'factory-monitor', `name=${pkg.name}`);
  check('init: 编辑态工程（含 src/edit）', existsSync(join(out, 'src/edit')));
  check('init: 只注入被引用资产（example.glb）', refModels.length === 1 && refModels[0] === 'example.glb', `[${refModels.join(',')}]`);
  check('init: .gitignore 已写', existsSync(join(out, '.gitignore')));
  check('init: 母版残留未拷入（无 dist/node_modules）', !existsSync(join(out, 'dist')) && !existsSync(join(out, 'node_modules')));
}
{
  const r = run('init.mjs', [F('init-ok')], false);
  check('init: 目标非空且无 --force 拒绝', r.ok && /已存在且非空/.test(r.out), `status=${r.status}`);
}
{
  const out = F('init-withcomp');
  const r = run('init.mjs', [out, '--name', 'wcomp', '--with-components', '--assets', 'all'], true);
  const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8'));
  const models = readdirSync(join(out, 'public/assets/models'));
  check(
    'init: --with-components 写 file: 依赖 + tgz 落 vendor',
    r.ok && /file:\.\/vendor\/.+\.tgz/.test(pkg.dependencies?.['@a3d/a3d-components'] ?? '') && existsSync(join(out, 'vendor')),
  );
  check('init: --assets all 注入全部模型（example+rack）', models.length === 2, `[${models.join(',')}]`);
}

/* ── 端到端（--with-build）：小写盘符 spawn + 首次 npm run build ───────────── */
if (withBuild) {
  const out = F('lc-init').replace(/^([A-Za-z]):/, (m, d) => `${d.toLowerCase()}:`);
  const r = run('init.mjs', [out, '--name', 'lower-case', '--deps', 'copy'], true);
  const built = existsSync(join(F('lc-init'), 'dist', 'index.html'));
  check('init: 小写盘符目标 + --deps copy 端到端构建 PASS', r.ok && built && /npm run build: PASS/.test(r.out), `status=${r.status}`);
}

/* ── 汇总 ─────────────────────────────────────────────────────────────────── */
console.log(`\n=== ${results.length - results.filter((r) => !r.ok).length}/${results.length} PASS ===`);
if (failed) {
  console.log(`夹具目录（--keep 复现）：${ROOT}`);
} else if (!keep) {
  rmSync(ROOT, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
