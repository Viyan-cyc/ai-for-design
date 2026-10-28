import { seedLibrary, seedProject } from './asset-fixture-data.mjs';
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
 * 用法: node ../../tests/generate-3d-scene/gates.mjs [--with-build] [--keep] [--quiet]
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

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
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

const FIXTURE_LIB = seedLibrary(join(ROOT, 'external-library'));
process.env.SCENE3D_LEGACY_ASSET_ROOT = FIXTURE_LIB;
const F = (n) => join(ROOT, n);
const firstFail = (out) => out.split('\n').find((l) => l.includes('✗')) ?? '';

/* ── 夹具 ──────────────────────────────────────────────────────────────────── */
copy(TEMPLATE, F('tpl')); seedProject(F('tpl'));                       // 编辑态工程（含 src/edit）
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
  const entry = readFileSync(join(out, 'src/entry.ts'), 'utf8');
  check('strip-edit: App.vue 去链接且无死 CSS 残留', !/\?edit=1/.test(app) && !/\.app-root__hint a\s*\{/.test(app));
  check('strip-edit: 固定入口单态化', !/\?edit=1|edit-main/.test(html)
    && /src\/entry\.ts/.test(html)
    && /import\('\.\/main'\)/.test(entry) && !/edit/.test(entry));
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
  // 预算超限默认 WARN 放行（重类不阻塞），--strict 升阻断
  const rWarn = run('build.mjs', [d], true);
  check('build: 预算超限 WARN 放行（重类不阻塞）', rWarn.ok && /场景预算超限/.test(rWarn.out), `status=${rWarn.status} ${firstFail(rWarn.out)}`);
  const rStrict = run('build.mjs', [d, '--strict'], false);
  check('build: 预算超限 --strict 阻断', rStrict.ok && /场景预算超限/.test(rStrict.out), `status=${rStrict.status} ${firstFail(rStrict.out)}`);
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
  // V19 路径守卫补充：大小写变体 / out 嵌在源内 / 旧产物在失败时完好
  const d = F('fx-p4-guard');
  copy(F('tpl'), d);
  // 大小写变体（Windows 大小写不敏感盘）：out 与 src 同路径仅大小写不同 → 拒绝
  const lower = d.replace(/([A-Z]:\\|\\)/g, (m) => m).toLowerCase();
  const rCase = run('strip-edit.mjs', [d, '--out', lower, '--force'], false);
  const srcIntactCase = existsSync(join(d, 'src', 'edit', 'Bridge.ts'));
  check(
    'strip-edit: --out 大小写变体==源 拒绝且源完好（V19）',
    rCase.ok && /不能是源工程/.test(rCase.out) && srcIntactCase,
    `status=${rCase.status} srcIntact=${srcIntactCase} out=${lower}`,
  );
  // out 嵌在源工程内部 → 拒绝（产物会污染源工程）
  const rNested = run('strip-edit.mjs', [d, '--out', join(d, 'nested-out'), '--force'], false);
  const srcIntactNested = existsSync(join(d, 'src', 'edit', 'Bridge.ts')) && !existsSync(join(d, 'nested-out'));
  check(
    'strip-edit: --out 嵌在源工程内部 拒绝（V19）',
    rNested.ok && /嵌在源工程内部/.test(rNested.out) && srcIntactNested,
    `status=${rNested.status} srcIntact=${srcIntactNested}`,
  );
  // 失败不毁旧产物：先产出一个合法 out，再对坏源（陈旧引用）导出到同 out → out 完好
  const out = F('fx-p4-guard-out');
  const rOk = run('strip-edit.mjs', [d, '--out', out, '--force'], true);
  const marker = existsSync(join(out, 'src', 'main.ts'));
  const pData = JSON.parse(readFileSync(join(d, 'public/scene-data.json'), 'utf8'));
  pData.__visuals = { ghost_404: { color: '#000000' } };
  writeFileSync(join(d, 'public/scene-data.json'), JSON.stringify(pData, null, 2));
  const rBad = run('strip-edit.mjs', [d, '--out', out, '--force'], false);
  const outStillIntact = existsSync(join(out, 'src', 'main.ts')) && existsSync(join(out, 'public/scene-data.json'));
  check(
    'strip-edit: 编译失败不毁旧产物（V19 原子发布）',
    rOk.ok && marker && rBad.ok && /ghost_404/.test(rBad.out) && outStillIntact,
    `ok=${rOk.ok} bad=${rBad.status} intact=${outStillIntact}`,
  );
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
  // P4 契约更新：陈旧视觉条目（节点不存在）从 warn 升级为硬 FAIL（Spec §3.4——
  // 真实未支持覆盖报具体路径，不删掉后 PASS）
  const r = run('strip-edit.mjs', [d, '--out', out, '--force'], false);
  check(
    'strip-edit: 陈旧视觉条目硬 FAIL 且报具体路径（P4）',
    r.ok && /__visuals\[\"ghost_99\"\]/.test(r.out) && !existsSync(join(out, 'public', 'scene-data.json')),
    `status=${r.status} ${firstFail(r.out)}`,
  );
  check(
    'strip-edit: 陈旧失败不产生部分产物（原子性）',
    !existsSync(out) || readdirSync(out).length === 0,
  );

  // 清理陈旧条目 → PASS：自动编译 + 审计摘要
  delete data.__visuals.ghost_99;
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  const r2 = run('strip-edit.mjs', [d, '--out', out, '--force'], true);
  const md = existsSync(join(out, 'TRANSCRIPTION.md')) ? readFileSync(join(out, 'TRANSCRIPTION.md'), 'utf8') : '';
  const cleaned = JSON.parse(readFileSync(join(out, 'public/scene-data.json'), 'utf8'));
  check('strip-edit: 转录清单生成 PASS（自动转换摘要模式）', r2.ok, `status=${r2.status} ${firstFail(r2.out)}`);
  check(
    'strip-edit: ① 视觉 override 逐字段成行',
    md.includes('`car_01`') && md.includes('`color`') && md.includes('`"#ff8800"`')
      && md.includes('`metalness`') && md.includes('`0.9`'),
  );
  check(
    'strip-edit: ① 容纳个体渲染差异（visible/castShadow/materialType）',
    md.includes('`visible`') && md.includes('`castShadow`') && md.includes('`materialType`'),
  );
  check('strip-edit: ① 排除编辑器私有键（locked）', !/\|\s*`[^`]*`\s*\|\s*`locked`/.test(md));
  check('strip-edit: ① libraryRef 不进物体视觉表', !/\|\s*`car_01`\s*\|\s*`libraryRef`/.test(md));
  check('strip-edit: ② 仅有被引用材质库条目', md.includes('`carpaint`') && !md.includes('`unused_seed`'));
  check('strip-edit: ③ 引用表 nodeId→mat_id', md.includes('| `car_01` | `carpaint` |'));
  check('strip-edit: 私有区已剥离（双下划线族整体）',
    cleaned.__visuals === undefined && cleaned.__materialLib === undefined && cleaned.__futureEditorKey === undefined
      && Object.keys(cleaned).every((k) => !k.startsWith('__')));

  // P4.1：编译外观产物（代码模块）内容断言
  const appearanceCode = existsSync(join(out, 'src/scene-core/generated/appearance.ts'))
    ? readFileSync(join(out, 'src/scene-core/generated/appearance.ts'), 'utf8') : '';
  check(
    'strip-edit: generated/appearance.ts 编译条目（视觉 + 材质库 + locked 剥离）',
    appearanceCode.includes('"car_01"') && appearanceCode.includes('"#ff8800"')
      && appearanceCode.includes('"car_02"') && appearanceCode.includes('"carpaint"')
      && !/"locked"\s*:/.test(appearanceCode) && !appearanceCode.includes('ghost_99')
      && !appearanceCode.includes('unused_seed'),
  );
  check(
    'strip-edit: appearance.ts 不 import edit + 双常量导出（V18 可审计）',
    !/from\s+['"].*edit/.test(appearanceCode)
      && /export const compiledVisuals/.test(appearanceCode)
      && /export const compiledMaterialLib/.test(appearanceCode),
  );
  check(
    'strip-edit: TRANSCRIPTION.md 标注自动编译（非人工转录指令）',
    md.includes('自动编译') && md.includes('appearance.ts'),
  );
  // 原子发布：产物在 out（staging 已 rename 走）
  check('strip-edit: 原子发布产物落位', existsSync(join(out, 'src', 'main.ts')) && existsSync(join(out, 'TRANSCRIPTION.md')));
}

/* ── init.mjs ─────────────────────────────────────────────────────────────── */
{
  const out = F('init-ok');
  const r = run('init.mjs', [out, '--name', 'Factory Monitor', '--assets', 'referenced', '--deps', 'skip'], true);
  const pkg = existsSync(join(out, 'package.json')) ? JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')) : {};
  const refModels = existsSync(join(out, 'public/assets/models'))
    ? readdirSync(join(out, 'public/assets/models'))
    : [];
  const scene = existsSync(join(out, 'public/scene-data.json'))
    ? JSON.parse(readFileSync(join(out, 'public/scene-data.json'), 'utf8'))
    : {};
  const RESERVED = new Set(['version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove', '__visuals', '__materialLib']);
  const groupKeys = Object.keys(scene).filter((k) => Array.isArray(scene[k]) && !RESERVED.has(k) && !k.startsWith('__'));
  check('init: 首次 build 门禁 PASS（默认 empty profile）', r.ok && /\[init\/PASS\]/.test(r.out), `status=${r.status}`);
  check('init: 占位替换 name=kebab', pkg.name === 'factory-monitor', `name=${pkg.name}`);
  check('init: 编辑态工程（含 src/edit）', existsSync(join(out, 'src/edit')));
  check('init: 空起步场景（零业务分组）', groupKeys.length === 0, `groups=[${groupKeys.join(',')}]`);
  check('init: 空工程不带未引用 Demo 模型（F09）', refModels.length === 0, `[${refModels.join(',')}]`);
  check('init: .gitignore 已写', existsSync(join(out, '.gitignore')));
  check('init: 母版残留未拷入（无 dist/node_modules）', !existsSync(join(out, 'dist')) && !existsSync(join(out, 'node_modules')));
}
{
  const r = run('init.mjs', [F('init-ok')], false);
  check('init: 目标非空且无 --force 拒绝', r.ok && /已存在且非空/.test(r.out), `status=${r.status}`);
}
{
  const out = F('init-demo');
  const r = run('init.mjs', [out, '--name', 'demo-proj', '--profile', 'demo'], true);
  const models = existsSync(join(out, 'public/assets/models')) ? readdirSync(join(out, 'public/assets/models')) : [];
  check(
    'init: --profile demo 注入 纯几何 demo 不注入业务模型',
    r.ok && models.length === 0,
    `status=${r.status} [${models.join(',')}] ${firstFail(r.out)}`,
  );
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
  check(
    'init: --assets all 注入全部库内模型（catalog manifests 全集）',
    r.ok && models.length === 3 && ['example.glb', 'person.glb', 'rack.glb'].every((f) => models.includes(f)),
    `[${models.length} 个] ${firstFail(r.out)}`,
  );
}

/* ── 端到端（--with-build）：小写盘符 spawn + 首次 npm run build ───────────── */
if (withBuild) {
  const out = F('lc-init').replace(/^([A-Za-z]):/, (m, d) => `${d.toLowerCase()}:`);
  const r = run('init.mjs', [out, '--name', 'lower-case', '--deps', 'copy'], true);
  const built = existsSync(join(F('lc-init'), 'dist', 'index.html'));
  check('init: 小写盘符目标 + --deps copy 端到端构建 PASS', r.ok && built && /npm run build: PASS/.test(r.out), `status=${r.status}`);
}

/* ── 消费端加载门禁（validate-model 内嵌 three GLTFLoader 真实 parse）──────── */
{
  // 负例：库内资产复制后破坏其贴图 bufferView 的 buffer 字段（复现 56 资产当年缺陷形态）
  // ——规格检查会过（自解析默认 buffer=0），但 three 加载必须 FAIL
  const srcGlb = readdirSync(join(FIXTURE_LIB, 'assets', 'models')).find((f) => f.endsWith('.glb'));
  const badDir = F('gate-bad');
  mkdirSync(badDir, { recursive: true });
  const glbBuf = readFileSync(join(FIXTURE_LIB, 'assets', 'models', srcGlb));
  const jsonLen = glbBuf.readUInt32LE(12);
  const json = JSON.parse(glbBuf.slice(20, 20 + jsonLen).toString('utf8'));
  // 挑一个无 target 的 view（贴图类）剥掉 buffer 字段；全有 target 时剥第一个
  const target = json.bufferViews.find((v) => v.target === undefined) ?? json.bufferViews[0];
  delete target.buffer;
  const jsonBuf2 = Buffer.from(JSON.stringify(json), 'utf8');
  const binLen = glbBuf.readUInt32LE(20 + jsonLen);
  const binData = glbBuf.slice(20 + jsonLen + 8, 20 + jsonLen + 8 + binLen);
  const pad = (n) => (4 - (n % 4)) % 4;
  const jp = Buffer.alloc(pad(jsonBuf2.length), 0x20);
  const jsonChunk = jsonBuf2.length + jp.length;
  const out = Buffer.alloc(12 + 8 + jsonChunk + 8 + binData.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonChunk, 12); out.write('JSON', 16, 'ascii');
  jsonBuf2.copy(out, 20); jp.copy(out, 20 + jsonBuf2.length);
  out.writeUInt32LE(binData.length, 20 + jsonChunk); out.write('BIN\0', 20 + jsonChunk + 4, 'ascii');
  binData.copy(out, 20 + jsonChunk + 8);
  writeFileSync(join(badDir, 'bad-buffer.glb'), out);

  const rBad = run('validate-model.mjs', [join(badDir, 'bad-buffer.glb')], false);
  check('validate: 贴图 bufferView 缺 buffer 字段 → 消费端门禁阻断', rBad.ok && (/消费端加载失败|缺 buffer 字段/.test(rBad.out)), `status=${rBad.status} ${firstFail(rBad.out)}`);

  // 正例：库内真实资产（含 Draco person 的规格豁免路径只取门禁项——person 因面数基线 FAIL
  // 不适合当正例，用非 Draco 资产走完整 validate 含 three parse）
  const okGlb = readdirSync(join(FIXTURE_LIB, 'assets', 'models'))
    .filter((f) => f.endsWith('.glb') && !['person.glb'].includes(f))[0];
  const rOk = run('validate-model.mjs', [join(FIXTURE_LIB, 'assets', 'models', okGlb)], true);
  check('validate: 库内资产过消费端加载门禁（three 真实 parse）', rOk.ok, `status=${rOk.status} ${firstFail(rOk.out)}`);
}

/* ── 场景 schema（P2.3/V08 + P2-R3/R4）：负例硬失败 + 正例干净 ─────────────── */
{
  const { validateSceneData, factoryRegistryFromProfile } = await import('../../skills/generate-3d-scene/scripts/lib/scene-schema.mjs');
  const reg = factoryRegistryFromProfile(readFileSync(join(TEMPLATE, 'src', 'scene-profile.ts'), 'utf8'));
  const base = { version: '1', meta: {}, scene: {}, camera: {}, lights: [], controls: {}, renderer: {} };
  const cases = [
    ['重复 ID', { ...base, cars: [{ id: 'a' }, { id: 'a' }] }, ['duplicate-id']],
    ['parent 环（互指）', { ...base, cars: [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }] }, ['parent-cycle']],
    ['parent 自环', { ...base, cars: [{ id: 'a', parentId: 'a' }] }, ['parent-cycle']],
    ['缺父', { ...base, cars: [{ id: 'a', parentId: 'ghost' }] }, ['missing-parent']],
    ['NaN position', { ...base, cars: [{ id: 'a', position: [0, NaN, 0] }] }, ['bad-vec3']],
    ['Infinity rotation', { ...base, cars: [{ id: 'a', rotation: [0, Infinity, 0] }] }, ['bad-vec3']],
    ['零缩放', { ...base, cars: [{ id: 'a', scale: 0 }] }, ['zero-scale']],
    ['向量零分量缩放 [1,0,1]', { ...base, cars: [{ id: 'a', scale: [1, 0, 1] }] }, ['zero-scale']],
    ['非法 scale 类型', { ...base, cars: [{ id: 'a', scale: 'big' }] }, ['bad-scale']],
    ['未知 factory 分组', { ...base, robots: [{ id: 'a' }] }, ['unknown-factory']],
    ['内建 asset 分组缺 params.assetId', { ...base, asset: [{ id: 'a' }] }, ['missing-asset-id']],
  ];
  for (const [name, data, expectCodes] of cases) {
    const r = validateSceneData(data, reg);
    const codes = r.errors.map((e) => e.code);
    check(`schema 负例：${name} 硬失败`, !r.ok && expectCodes.every((c) => codes.includes(c)),
      `codes=[${codes.join(',')}]`);
  }
  const demo = JSON.parse(readFileSync(join(TEMPLATE, 'public', 'scene-data.json'), 'utf8'));
  const empty = JSON.parse(readFileSync(join(TEMPLATE, 'scenes', 'empty.json'), 'utf8'));
  const rDemo = validateSceneData(demo, reg);
  const rEmpty = validateSceneData(empty, reg);
  check('schema 正例：母版 demo 场景干净', rDemo.ok && rDemo.stats.nodes > 0,
    JSON.stringify(rDemo.errors));
  check('schema 正例：empty 场景干净（零节点非错误）', rEmpty.ok && rEmpty.stats.nodes === 0,
    JSON.stringify(rEmpty.errors));
  // 路径可定位性：错误条目必须带 path（V08「输出明确失败路径」）
  const rPath = validateSceneData({ ...base, cars: [{ id: 'a' }, { id: 'a' }] }, reg);
  check('schema 错误条目带路径', rPath.errors.every((e) => typeof e.path === 'string' && e.path.length > 0));
}

/* ── schema 接入 build：坏数据工程被结构门禁拦截 ─────────────────────────── */
{
  const d = F('fx-schema-bad');
  copy(F('tpl'), d);
  const data = JSON.parse(readFileSync(join(d, 'public', 'scene-data.json'), 'utf8'));
  data.cars.push({ ...data.cars[0] }); // 复制首节点 → 重复 ID
  writeFileSync(join(d, 'public', 'scene-data.json'), JSON.stringify(data, null, 2));
  const r = run('build.mjs', [d], false);
  check('build: 场景 schema 违规（重复 ID）→ 门禁 FAIL', r.ok && /场景 schema 违规.*duplicate-id/.test(r.out), `status=${r.status} ${firstFail(r.out)}`);
}

/* ── P2-R3/R4 生产入口：未注册分组 / 缺 assetId / 向量零缩放经 build 硬失败 ── */
{
  // 未注册分组（robots 不在 scene-profile 登记表）——旧实现仅预算告警假绿
  const d = F('fx-unknown-factory');
  copy(F('tpl'), d);
  const data = JSON.parse(readFileSync(join(d, 'public', 'scene-data.json'), 'utf8'));
  data.robots = [{ id: 'robot_01' }];
  writeFileSync(join(d, 'public', 'scene-data.json'), JSON.stringify(data, null, 2));
  const r = run('build.mjs', [d], false);
  check('build: 未注册 factory 分组（robots）→ 硬 FAIL（P2-R3）',
    r.ok && /场景 schema 违规.*unknown-factory/.test(r.out) && !/\[build\/PASS\]/.test(r.out),
    `status=${r.status} ${firstFail(r.out)}`);
}
{
  // 内建 asset 分组缺 params.assetId——旧实现建空 Group 无失败记录
  const d = F('fx-asset-noid');
  copy(F('tpl'), d);
  const data = JSON.parse(readFileSync(join(d, 'public', 'scene-data.json'), 'utf8'));
  data.asset = [{ id: 'bare_asset' }];
  writeFileSync(join(d, 'public', 'scene-data.json'), JSON.stringify(data, null, 2));
  const r = run('build.mjs', [d], false);
  check('build: asset 分组缺 params.assetId → 硬 FAIL（P2-R4）',
    r.ok && /场景 schema 违规.*missing-asset-id/.test(r.out), `status=${r.status} ${firstFail(r.out)}`);
}
{
  // 向量零分量缩放 [1,0,1]——旧实现 ok=true
  const d = F('fx-zero-vec');
  copy(F('tpl'), d);
  const data = JSON.parse(readFileSync(join(d, 'public', 'scene-data.json'), 'utf8'));
  data.Box[0] = { ...data.Box[0], scale: [1, 0, 1] };
  writeFileSync(join(d, 'public', 'scene-data.json'), JSON.stringify(data, null, 2));
  const r = run('build.mjs', [d], false);
  check('build: 向量零分量 scale [1,0,1] → 硬 FAIL（P2-R4）',
    r.ok && /场景 schema 违规.*zero-scale/.test(r.out), `status=${r.status} ${firstFail(r.out)}`);
}

/* ── glTF 多文件 fixture：manifest 目录闭包复制（F10/V20）─────────────────── */
{
  // 在临时资产库造一个 glTF 多文件资产（.gltf + .bin + 贴图），经 init --scene 注入
  // 验证整目录复制（不是只拷 .gltf 单文件）
  const gltfJson = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }], extras: { targetVertexCount: 3 } }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{ uri: 'tex.png' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    buffers: [{ uri: 'data.bin', byteLength: 42 }],
  });
  const fakeLib = F('fake-skill-lib');
  mkdirSync(join(fakeLib, 'assets', 'models', 'multifile_gltf'), { recursive: true });
  mkdirSync(join(fakeLib, 'assets', 'manifests'), { recursive: true });
  writeFileSync(join(fakeLib, 'assets', 'models', 'multifile_gltf', 'model.gltf'), gltfJson);
  writeFileSync(join(fakeLib, 'assets', 'models', 'multifile_gltf', 'data.bin'), Buffer.alloc(42));
  writeFileSync(join(fakeLib, 'assets', 'models', 'multifile_gltf', 'tex.png'), Buffer.from([0x89, 0x50]));
  writeFileSync(join(fakeLib, 'assets', 'manifests', 'fixture.json'), JSON.stringify({
    package: 'fixture',
    entries: [{
      id: 'multifile_gltf',
      name: '多文件 glTF fixture',
      file: 'model.gltf',
      format: 'gltf',
      modelPath: 'assets/models/multifile_gltf/model.gltf',
    }],
  }));
  const { buildAssetCatalog, resolveAsset } = await import('../../skills/generate-3d-scene/scripts/lib/asset-catalog.mjs');
  const catalog = buildAssetCatalog(fakeLib);
  const resolved = resolveAsset('multifile_gltf', catalog);
  const sorted = (resolved.ok ? resolved.files : []).map((f) => f.split('/').pop()).sort();
  check(
    'asset-catalog: glTF 多文件目录闭包展开（gltf+bin+贴图全进 files）',
    resolved.ok && ['data.bin', 'model.gltf', 'tex.png'].every((f) => sorted.includes(f)),
    `ok=${resolved.ok} files=[${sorted.join(',')}] ${resolved.ok ? '' : resolved.error}`,
  );

  // 端到端（P2-R1）：init（假资产库）→ 落 asset-manifest.json → build 按映射找文件
  const sceneData = JSON.parse(readFileSync(join(TEMPLATE, 'public', 'scene-data.json'), 'utf8'));
  delete sceneData.trees; delete sceneData.cars; delete sceneData.examples;
  delete sceneData.codecars; delete sceneData.codeworkers; delete sceneData.coderacks;
  sceneData.asset = [{ id: 'mf_01', params: { assetId: 'multifile_gltf' } }];
  const sceneFile = join(fakeLib, 'scene.json');
  writeFileSync(sceneFile, JSON.stringify(sceneData, null, 2));
  const { initProject } = await import('../../skills/generate-3d-scene/scripts/init.mjs');
  const proj = F('fx-gltf-e2e');
  const rInit = initProject(proj, { name: 'gltf-e2e', scene: sceneFile, assetsRoot: fakeLib, force: true });
  const projManifestPath = join(proj, 'public', 'assets', 'asset-manifest.json');
  const projManifest = existsSync(projManifestPath) ? JSON.parse(readFileSync(projManifestPath, 'utf8')) : null;
  check(
    'init: glTF 资产落 asset-manifest.json（真实目录路径）',
    rInit.ok && projManifest?.multifile_gltf?.model === 'models/multifile_gltf/model.gltf',
    `initOk=${rInit.ok} manifest=${JSON.stringify(projManifest?.multifile_gltf ?? null)} errs=${JSON.stringify(rInit.errors)}`,
  );
  // build 正常闭包 PASS（manifest 命中 + bin/贴图齐全）
  const rBuildOk = run('build.mjs', [proj], true);
  check(
    'build: glTF 目录资产经 asset-manifest 解析 + 闭包齐全 → PASS（P2-R1）',
    rBuildOk.ok && /\[build\/PASS\]/.test(rBuildOk.out) && !/缺文件/.test(rBuildOk.out),
    `status=${rBuildOk.status} ${firstFail(rBuildOk.out)}`,
  );
  // 负例：抽掉 data.bin → build 闭包校验 FAIL
  rmSync(join(proj, 'public', 'assets', 'models', 'multifile_gltf', 'data.bin'));
  const rBuildBad = run('build.mjs', [proj], false);
  check(
    'build: glTF 声明 data.bin 但文件缺失 → 闭包校验 FAIL（P2-R1）',
    rBuildBad.ok && /glTF 外部依赖缺失.*data\.bin/.test(rBuildBad.out),
    `status=${rBuildBad.status} ${firstFail(rBuildBad.out)}`,
  );
}

/* ── P2-RR1：工厂登记与实际注册共用真实来源（登记表删项/加项两侧）────────── */
{
  const { initProject } = await import('../../skills/generate-3d-scene/scripts/init.mjs');
  const { extractBusinessFactoryTypes } = await import('../../skills/generate-3d-scene/scripts/lib/scene-schema.mjs');

  // 负例：删掉 trees 注册条目（scene-data 仍用 trees 分组）→ build FAIL（旧实现 PASS）
  const neg = F('fx-rr1-unregistered');
  initProject(neg, { name: 'rr1-neg', profile: 'demo', force: true });
  const negProfile = join(neg, 'src', 'scene-profile.ts');
  writeFileSync(negProfile, readFileSync(negProfile, 'utf8')
    .replace(/\r?\n\s*trees: \(\{ sceneEngine \}\) => registerTreeHandler\(sceneEngine\),/, ''));
  const rNeg = run('build.mjs', [neg], false);
  check(
    'P2-RR1: 删除 trees 注册条目（数据仍用 trees）→ build FAIL',
    rNeg.ok && /unknown-factory.*trees/.test(rNeg.out) && !/\[build\/PASS\]/.test(rNeg.out),
    `status=${rNeg.status} ${firstFail(rNeg.out)}`,
  );

  // 正例：真实新增业务分组（登记条目 + 注册实现 + 数据）→ build PASS
  const pos = F('fx-rr1-newfactory');
  initProject(pos, { name: 'rr1-pos', profile: 'demo', force: true });
  const posProfile = join(pos, 'src', 'scene-profile.ts');
  writeFileSync(posProfile, readFileSync(posProfile, 'utf8').replace(
    'coderacks: ({ sceneEngine }) => registerRackHandler(sceneEngine),',
    'coderacks: ({ sceneEngine }) => registerRackHandler(sceneEngine),\n'
      + '  crates: ({ sceneEngine }) => {\n'
      + '    sceneEngine.registerFactory(\'crates\', (node) => ({ name: node.id }));\n'
      + '  },',
  ));
  const posData = JSON.parse(readFileSync(join(pos, 'public', 'scene-data.json'), 'utf8'));
  posData.crates = [{ id: 'crate_01' }];
  writeFileSync(join(pos, 'public', 'scene-data.json'), JSON.stringify(posData, null, 2));
  const rPos = run('build.mjs', [pos], true);
  check(
    'P2-RR1: 新增业务分组（登记+注册实现+数据）→ build PASS',
    rPos.ok && /\[build\/PASS\]/.test(rPos.out),
    `status=${rPos.status} ${firstFail(rPos.out)}`,
  );

  // 登记表提取器三态：真实 profile 全量 / 空对象合法 / 缺失抛错
  const realTypes = extractBusinessFactoryTypes(readFileSync(join(TEMPLATE, 'src', 'scene-profile.ts'), 'utf8'));
  check(
    'P2-RR1: 登记表提取 = 实际注册来源（全量 6 分组）',
    JSON.stringify(realTypes) === JSON.stringify(['examples', 'cars', 'trees', 'codecars', 'codeworkers', 'coderacks']),
    JSON.stringify(realTypes),
  );
  let emptyOk = false;
  try {
    emptyOk = extractBusinessFactoryTypes('export const BUSINESS_REGISTRARS: Record<string, (ctx) => void> = {\n};').length === 0;
  } catch { emptyOk = false; }
  check('P2-RR2: 空业务登记表合法（提取器返回空表）', emptyOk);
  let missingThrows = false;
  try {
    extractBusinessFactoryTypes('export const OTHER = 1;');
  } catch { missingThrows = true; }
  check('P2-RR2: 登记表缺失/形态坏 → 抛错（不静默放行）', missingThrows);

  // P2-RRR2：顶层 key 语法级提取（不再用行首正则冒充对象解析）
  const wrapBody = (body) => `export const BUSINESS_REGISTRARS: Record<string, (ctx) => void> = {\n${ body }\n};`;
  const rrr2Cases = [
    // 单行多 key（旧行正则只提第一个）
    ['单行多 key 全提取', wrapBody('trees: registerTreeHandler, crates: registerCrates'), ['trees', 'crates']],
    // 值内嵌套对象的 key 不上浮（旧行正则把 ghost 当工厂）
    ['嵌套对象 key 不上浮', wrapBody('crates: ({ sceneEngine }) => {\n  const defaults = { ghost: 1 };\n  sceneEngine.registerFactory(\'crates\', () => null);\n}'), ['crates']],
    // 行/块注释里的假 key 不提取
    ['注释 key 不提取', wrapBody('// robots: fake\n  /* shelves: also-fake */\n  trees: reg,'), ['trees']],
    // 字符串里的假 key 不提取
    ['字符串假 key 不提取', wrapBody("trees: () => { const s = 'phantom: not-a-key'; return s; }"), ['trees']],
    // 引号 key（含空格分组名）
    ['引号 key（含空格）', wrapBody("'my type': reg"), ['my type']],
    // 尾逗号
    ['尾逗号容错', wrapBody('trees: reg, codecars: reg2,'), ['trees', 'codecars']],
  ];
  // P2-RRR2 四审：注释内的括号不得截断对象/漏 key（手写扫描器三处复现；AST 词法天然正确）
  rrr2Cases.push(
    ['行注释含 } 后续 key 保留', wrapBody('trees: f, // }\n  crates: g'), ['trees', 'crates']],
    ['块注释含 { 前缀', wrapBody('/* { */ trees: f'), ['trees']],
    ['函数体内行注释含 }', wrapBody('crates: ({ sceneEngine }) => {\n  // }\n  sceneEngine.registerFactory(\'crates\', () => null);\n}'), ['crates']],
  );
  for (const [name, src, expected] of rrr2Cases) {
    let got = null; let err = null;
    try { got = extractBusinessFactoryTypes(src); } catch (e) { err = e.message; }
    check(
      `P2-RRR2: ${ name }`,
      !err && JSON.stringify(got) === JSON.stringify(expected),
      err ?? `got=${JSON.stringify(got)} want=${JSON.stringify(expected)}`,
    );
  }
}

/* ── P2-RR2：纯内建图元工程（空业务表）init/build 正例 ────────────────────── */
{
  const { initProject } = await import('../../skills/generate-3d-scene/scripts/init.mjs');
  const out = F('fx-rr2-builtin-only');
  initProject(out, { name: 'rr2-builtin', force: true });
  // 清空业务登记表（empty profile 场景只有 Box 地面等内建分组）
  const profilePath = join(out, 'src', 'scene-profile.ts');
  writeFileSync(profilePath, readFileSync(profilePath, 'utf8').replace(
    /export const BUSINESS_REGISTRARS[\s\S]*?\r?\n\};/,
    'export const BUSINESS_REGISTRARS: Record<string, (ctx: BusinessRegistrarContext) => void> = {\n};',
  ));
  const data = JSON.parse(readFileSync(join(out, 'public', 'scene-data.json'), 'utf8'));
  const RESERVED = new Set(['version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove']);
  const groupKeys = Object.keys(data).filter((k) => Array.isArray(data[k]) && !RESERVED.has(k) && !k.startsWith('__'));
  const r = run('build.mjs', [out], true);
  check(
    'P2-RR2: 空业务登记表 + 纯内建分组工程 → build PASS',
    r.ok && /\[build\/PASS\]/.test(r.out) && groupKeys.every((k) => ['Box', 'Sphere', 'Cylinder', 'Plane', 'Cone', 'Torus', 'asset'].includes(k)),
    `status=${r.status} groups=[${groupKeys.join(',')}] ${firstFail(r.out)}`,
  );
}

/* ── P2-RR3：glTF 外部 URI 按规则解码（含空格/非 ASCII 文件名）────────────── */
{
  const { initProject } = await import('../../skills/generate-3d-scene/scripts/init.mjs');
  const lib = F('fx-rr3-lib');
  mkdirSync(join(lib, 'assets', 'models', 'encoded'), { recursive: true });
  mkdirSync(join(lib, 'assets', 'manifests'), { recursive: true });
  // 磁盘文件名含空格/非 ASCII；glTF 声明用百分号编码 URI（与浏览器 fetch 行为一致）
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  writeFileSync(join(lib, 'assets', 'models', 'encoded', '贴 图.png'), png);
  const pos = Buffer.alloc(36);
  for (let i = 0; i < 9; i += 1) {
    pos.writeFloatLE([0, 0, 0, 1, 0, 0, 0, 1, 0][i], i * 4);
  }
  const idx = Buffer.alloc(6);
  idx.writeUInt16LE(0, 0); idx.writeUInt16LE(1, 2); idx.writeUInt16LE(2, 4);
  writeFileSync(join(lib, 'assets', 'models', 'encoded', 'data mesh.bin'), Buffer.concat([pos, idx]));
  const gltf = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }], extras: { targetVertexCount: 3 } }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }], images: [{ uri: '%E8%B4%B4%20%E5%9B%BE.png' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    buffers: [{ uri: 'data%20mesh.bin', byteLength: 42 }],
  };
  writeFileSync(join(lib, 'assets', 'models', 'encoded', 'model.gltf'), JSON.stringify(gltf));
  writeFileSync(join(lib, 'assets', 'manifests', 'rr3.json'), JSON.stringify({
    package: 'rr3',
    entries: [{ id: 'encoded', name: '编码 URI fixture', file: 'model.gltf', format: 'gltf', modelPath: 'assets/models/encoded/model.gltf' }],
  }));
  const scene = JSON.parse(readFileSync(join(TEMPLATE, 'public', 'scene-data.json'), 'utf8'));
  delete scene.trees; delete scene.cars; delete scene.examples;
  delete scene.codecars; delete scene.codeworkers; delete scene.coderacks;
  scene.asset = [{ id: 'enc_01', params: { assetId: 'encoded' } }];
  const sceneFile = join(lib, 'scene.json');
  writeFileSync(sceneFile, JSON.stringify(scene, null, 2));
  const proj = F('fx-rr3-proj');
  const rInit = initProject(proj, { name: 'rr3', scene: sceneFile, assetsRoot: lib, force: true });
  const rBuild = run('build.mjs', [proj], true);
  check(
    'P2-RR3: 编码 URI（data%20mesh.bin / 非 ASCII 贴图名）init→build PASS',
    rInit.ok && rBuild.ok && /\[build\/PASS\]/.test(rBuild.out),
    `init=${rInit.ok} status=${rBuild.status} ${firstFail(rBuild.out)} ${firstFail(rInit.errors.join('\n') ?? '')}`,
  );
  // 边界保留负例：URI 指向工程外（../ 越界）→ FAIL
  const evilGltf = { ...gltf, buffers: [{ uri: '..%2F..%2Fescape.bin', byteLength: 4 }] };
  writeFileSync(join(proj, 'public', 'assets', 'models', 'encoded', 'model.gltf'), JSON.stringify(evilGltf));
  const rEscape = run('build.mjs', [proj], false);
  check(
    'P2-RR3: URI 解码后越出工程根（..%2F..%2F）→ 闭包边界 FAIL',
    rEscape.ok && /glTF 外部依赖缺失|不支持/.test(rEscape.out),
    `status=${rEscape.status} ${firstFail(rEscape.out)}`,
  );
}

/* ── 汇总 ─────────────────────────────────────────────────────────────────── */
console.log(`\n=== ${results.length - results.filter((r) => !r.ok).length}/${results.length} PASS ===`);
if (failed) {
  console.log(`夹具目录（--keep 复现）：${ROOT}`);
} else if (!keep) {
  rmSync(ROOT, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
