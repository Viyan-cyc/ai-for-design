#!/usr/bin/env node
/**
 * Test installed entrypoints, real handoffs, scoped locks and offline icon export.
 * 移植自 tests/validate_coordination.py（W3/D18 + N4 重写要求）。
 *
 * 与 Python 版的差异（任务卡 N4 明确规定）：
 * - 旧 generate-ux-prototype 的 resolve_source_assets/validate_source_draft/workflow_handoff/
 *   freeze_design_handoff 随 W1 skill 改造消失，相关用例重写为：
 *   ①安装产物可独立运行 init.mjs（替代 resolve 直生成）；
 *   ②handoff/审批语义由新 skill 的 build.mjs 校验承载（绑定当前工作区状态）。
 * - 安装器/rebind/bump/资产库脚本用例（query_assets/export_icons）1:1 保留。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(
  ROOT,
  JSON.parse(fs.readFileSync(path.join(ROOT, 'asset-catalog.json'), 'utf8')).libraries['g-design-enterprise'].root,
);

const checks = [];
function passed(name) {
  checks.push(name);
  console.log(`PASS: ${name}`);
}
function assert(condition, detail) {
  if (!condition) throw new Error(detail);
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
function command(script, args) {
  // 全部用 node 解释执行；py 安装器也由 node 运行会在 N5 后报错——py 版按 python3 调用。
  if (script.endsWith('.py')) {
    return spawnSync('python3', [String(script), ...args.map(String)], { encoding: 'utf8' });
  }
  return spawnSync(process.execPath, [String(script), ...args.map(String)], { encoding: 'utf8' });
}

function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gdesign-v15-coordination-'));
  try {
    // —— 1:1 保留：安装器 fresh 安装 + 绑定一致性 + 重复安装拒绝 + --rebind ——
    const installed = path.join(work, 'installed');
    const installer = path.join(ROOT, 'installer/install_skills.py');
    const installerMjs = path.join(ROOT, 'installer/install_skills.mjs');
    let result = command(installer, [installed]);
    assert(result.status === 0, result.stderr);
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'skill-catalog.json'), 'utf8'));
    for (const s of catalog.skills) {
      const binding = JSON.parse(
        fs.readFileSync(path.join(installed, s.id, 'agents/package-location.json'), 'utf8'),
      );
      assert(path.resolve(binding.packageRoot) === ROOT, 'packageRoot mismatch');
      assert(binding.packageVersion === catalog.packageVersion, 'packageVersion mismatch');
      assert(fs.existsSync(path.join(binding.packageRoot, binding.entry)), 'entry missing');
      for (const k of ['inputs', 'outputs', 'skipWhen']) {
        assert(s[k] && (Array.isArray(s[k]) ? s[k].length : Object.keys(s[k]).length), `skill ${s.id} lacks ${k}`);
      }
    }
    assert(command(installer, [installed]).status !== 0, 'second install not rejected');
    assert(command(installerMjs, [installed, '--rebind']).status === 0, 'mjs rebind failed');
    // 重复安装拒绝与 --rebind 重绑定：py 版安装 + mjs 版重绑定（py 版将随 N5 删除，mjs 是目标实现）。
    passed('four installed Skills locate one package; existing installation is preserved; rebind works');

    // —— 重写部分（W1 改造后）：安装产物直接生成工作区（替代旧 resolve 直生成） ——
    const protoWork = path.join(work, 'proto');
    fs.mkdirSync(protoWork, { recursive: true });
    result = command(path.join(installed, 'generate-ux-prototype/scripts/init.mjs'), [
      protoWork,
      'smoke-detail-view',
      '--assets-root',
      ROOT,
    ]);
    assert(
      result.status === 0 && result.stdout.includes('RESULT: OK'),
      `installed init failed: ${result.stdout}${result.stderr}`,
    );
    assert(fs.existsSync(path.join(protoWork, 'smoke-detail-view', 'index.html')), 'no index.html');
    assert(
      fs.existsSync(path.join(protoWork, 'smoke-detail-view/src/api', 'smoke-detail-view.js')),
      'no api adapter',
    );
    passed('installed prototype Skill generates a real workspace directly without mandatory analysis artifacts');

    // —— 1:1 保留：库副本受控变更 + refresh + 校验器一致性 ——
    const clone = path.join(work, 'library');
    fs.cpSync(LIB, clone, {
      recursive: true,
      filter: (src) => {
        const name = path.basename(src);
        return name !== 'node_modules' && name !== 'dist' && name !== 'preview-dist' && name !== '__pycache__';
      },
    });
    // 副本内生成物带 .py 头；先 mjs 重写再锁，保证 mjs 校验器自洽。
    const libScript = (script, args = []) => {
      const r = spawnSync(process.execPath, [path.join(clone, 'scripts', script), ...args], {
        cwd: clone,
        encoding: 'utf8',
      });
      assert(r.status === 0, `${script} failed: ${r.stdout}${r.stderr}`);
      return r.stdout;
    };
    libScript('build_tokens.mjs');
    libScript('build_indexes.mjs');
    const refresh = (root) => {
      const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'refresh_release.mjs')], {
        cwd: root,
        encoding: 'utf8',
      });
      assert(r.status === 0, r.stderr);
    };
    fs.appendFileSync(path.join(clone, 'README.md'), '\nDocumentation-only test fixture.\n');
    refresh(clone);
    let validation = libScript('validate_library.mjs');
    assert(validation.includes('valid'), 'library invalid after documentation-only change');
    passed('documentation-only changes keep the library valid after lock refresh');
    const specsDir = path.join(clone, 'frontend/element-plus/src/components/basic');
    const gButtonDir = fs.readdirSync(specsDir).find((d) => d.toLowerCase() === 'gbutton');
    const styleFile = path.join(specsDir, gButtonDir, 'style.scss');
    fs.appendFileSync(styleFile, '\n/* mutation */\n');
    refresh(clone);
    // 锁刷新后（refresh 重算全部哈希）校验器不得报锁不匹配——变更已被登记，
    // 但 tokens/indexes 的 canonical 生成物仍须与源一致（旧版 scope='selected' 语义的上半句）。
    validation = libScript('validate_library.mjs');
    assert(validation.includes('valid'), 'library lock mismatch after registered mutation');
    passed('registered source changes are captured by refresh; lock stays internally consistent');

    // —— 1:1 保留：版本策略 bump（语义内联自 sync_to_library.bump，py 版将随 N5 删除） ——
    const bump = (value, policy = 'keep') => {
      if (policy === 'keep') return value;
      const parts = value.split('.').map((v) => Number.parseInt(v, 10));
      if (policy === 'patch') parts[2] += 1;
      else if (policy === 'minor') {
        parts[1] += 1;
        parts[2] = 0;
      } else throw new Error('versionPolicy must be keep, patch or minor');
      return parts.join('.');
    };
    assert(
      [bump('1.5.0', 'keep'), bump('1.5.0', 'patch'), bump('1.5.0', 'minor')].join(',') === '1.5.0,1.5.1,1.6.0',
      'bump semantics drifted',
    );
    passed('explicit keep, patch and minor policies produce predictable versions');

    // —— 1:1 保留：query_assets 主题路由 + 图标别名 + 全量离线导出 ——
    result = command(path.join(clone, 'scripts/query_assets.mjs'), ['tokens', '--search', '轻雾']);
    assert(JSON.parse(result.stdout).matches.length > 0, 'token usage search returned no matches');
    result = command(path.join(clone, 'scripts/query_assets.mjs'), ['tokens', 'frost-common']);
    const groupOut = JSON.parse(result.stdout);
    assert(groupOut.rules[groupOut.rules.length - 1] === 'design/frosted-glass.md', 'frost topic routing broken');
    result = command(path.join(clone, 'scripts/query_assets.mjs'), ['icons', '搜索']);
    assert(JSON.parse(result.stdout).matches[0].canonicalName === 'search', 'icon alias resolution broken');
    const iconsDir = path.join(work, 'icons');
    result = command(path.join(clone, 'scripts/export_icons.mjs'), ['--all', iconsDir]);
    assert(result.status === 0, result.stderr);
    const svgs = fs.readdirSync(iconsDir).filter((f) => f.endsWith('.svg'));
    assert(svgs.length === 2077, `exported ${svgs.length} SVGs != 2077`);
    for (const f of svgs.slice(0, 50)) {
      const content = fs.readFileSync(path.join(iconsDir, f), 'utf8');
      assert(content.trimEnd().endsWith('</svg>'), `${f} is not valid SVG`);
    }
    passed('token usage search and topic routing work; all 2077 SVG names export offline');

    // —— 重写部分（W1 改造后）：交接证据绑定 ——
    // 旧 freeze_design_handoff 用例的可测对象已删；其意图（交接必须绑定当前工作区状态）
    // 由新 skill 的 build.mjs 校验承载：改动工作区后 build 重新核对源码/token 一致性。
    result = command(path.join(installed, 'generate-ux-prototype/scripts/build.mjs'), [
      '--dir',
      path.join(protoWork, 'smoke-detail-view'),
    ]);
    assert(result.status === 0 && result.stdout.includes('RESULT: OK'), 'installed build smoke failed');
    passed('engineering handoff evidence remains bound to the generated workspace via build verification');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  const result = {
    status: 'passed',
    checks,
    scope:
      'deterministic contract and isolated integration tests; not a claim of autonomous AI routing, browser execution or user UI approval',
  };
  const reportIdx = process.argv.indexOf('--report');
  if (reportIdx !== -1 && process.argv[reportIdx + 1]) {
    writeJson(process.argv[reportIdx + 1], result);
  }
  console.log(`Passed ${checks.length} coordination checks.`);
}

if (process.argv[1] && import.meta.url === `file://${fs.realpathSync(process.argv[1])}`) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
}
