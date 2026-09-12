#!/usr/bin/env node
/**
 * Exercise V1.5 against real temporary prototypes and isolated source mutations.
 * 移植自 tests/validate_package.py（W3/D18 + N4 重写要求）。
 *
 * 与 Python 版的差异（任务卡 N4 明确规定）：
 * - 旧 resolve_source_assets/validate_source_draft/asset_locator/compare_assets/sync_to_library
 *   随 W1 skill 改造消失，相关用例重写为：新 skill 结构存在性校验 + init.mjs 生成工作区
 *   + node build.mjs 冒烟。
 * - canonical 校验（check）、组件/模板计数、token 传播、环/未定义拒绝、颜色规则 1:1 保留。
 *
 * 用法：node tests/validate_package.mjs [--report <path>]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
function runNode(script, args, options = {}) {
  return spawnSync(process.execPath, [String(script), ...args.map(String)], { encoding: 'utf8', ...options });
}

function main() {
  // —— 1:1 保留：canonical 全量校验（仓库生成物需与 mjs 校验器自洽） ——
  // 仓库内生成物仍是 .py 头；mjs 校验器重算时先在沙箱基线里用 mjs 生成器重写生成物。
  const baseline = fs.mkdtempSync(path.join(os.tmpdir(), 'gdesign-v15-package-base-'));
  try {
    fs.cpSync(LIB, path.join(baseline, 'lib'), {
      recursive: true,
      filter: (src) => {
        const name = path.basename(src);
        return name !== 'node_modules' && name !== 'dist' && name !== 'preview-dist' && name !== '__pycache__';
      },
    });
    const lib = path.join(baseline, 'lib');
    for (const script of ['build_tokens.mjs', 'build_indexes.mjs', 'refresh_release.mjs']) {
      const r = runNode(path.join(lib, 'scripts', script), [], { cwd: lib });
      assert(r.status === 0, `${script} failed: ${r.stdout}${r.stderr}`);
    }
    const checkResult = runNode(path.join(lib, 'scripts', 'validate_library.mjs'), [], { cwd: lib });
    assert(checkResult.status === 0, checkResult.stdout + checkResult.stderr);
    passed('canonical tokens, generated outputs, indexes, dependencies and release hashes');

    // —— 1:1 保留：组件/模板计数 ——
    const manifest = JSON.parse(fs.readFileSync(path.join(LIB, 'asset-manifest.json'), 'utf8'));
    const components = JSON.parse(fs.readFileSync(path.join(LIB, 'components/index.json'), 'utf8')).components;
    const templates = JSON.parse(fs.readFileSync(path.join(LIB, 'components/templates.json'), 'utf8')).templates;
    assert(Object.keys(components).length === 61, `components != 61`);
    assert(Object.keys(templates).length === 6, `templates != 6`);
    passed('all 61 components/services and 6 templates retained');

    // —— 重写部分（W1 改造后）：新 skill 结构存在性 ——
    const skill = path.join(ROOT, 'skills/generate-ux-prototype');
    const required = [
      'SKILL.md',
      'agents/openai.yaml',
      'scripts/init.mjs',
      'scripts/build.mjs',
      'scripts/build-data.mjs',
      'scripts/serve.mjs',
      'scripts/preview/index.html',
      'scripts/verify/whitelists/element-plus',
      'references/usage.md',
    ];
    for (const rel of required) assert(fs.existsSync(path.join(skill, rel)), `missing skill file: ${rel}`);
    passed('new skill structure exists (SKILL.md, agents, scripts, whitelists, references, preview)');

    // —— 重写部分：init.mjs 生成工作区 + build.mjs 冒烟（替代旧 resolve/validate 链路） ——
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gdesign-v15-package-'));
    try {
      const protoRoot = path.join(work, 'smoke-list-page');
      let result = runNode(path.join(skill, 'scripts/init.mjs'), [work, 'smoke-list-page', '--assets-root', ROOT]);
      assert(result.status === 0 && result.stdout.includes('RESULT: OK'), `init failed: ${result.stdout}${result.stderr}`);
      assert(fs.existsSync(path.join(protoRoot, 'index.html')), 'init produced no index.html');
      assert(fs.existsSync(path.join(protoRoot, 'src/views/smoke-list-page')), 'init produced no view dir');
      passed('init.mjs generates a real workspace from the asset library');
      result = runNode(path.join(skill, 'scripts/build.mjs'), ['--dir', protoRoot]);
      assert(result.status === 0 && result.stdout.includes('RESULT: OK'), `build smoke failed: ${result.stdout}${result.stderr}`);
      passed('generated workspace passes build.mjs smoke (SFC compile, whitelists, token checks)');

      // —— 1:1 保留：token 编辑传播到 CSS/Sass/可读值 ——
      // 在沙箱副本上做（N3 教训：绝不污染真仓库）。副本内生成物带 .py 头，
      // 改 tokens.json 后重跑 mjs 生成器，断言新值进入生成物即可，与头注释无关。
      const tokenClone = path.join(work, 'token-clone');
      fs.cpSync(LIB, tokenClone, {
        recursive: true,
        filter: (src) => {
          const name = path.basename(src);
          return name !== 'node_modules' && name !== 'dist' && name !== 'preview-dist' && name !== '__pycache__';
        },
      });
      const cloneScript = (script) => {
        const r = runNode(path.join(tokenClone, 'scripts', script), [], { cwd: tokenClone });
        assert(r.status === 0, `${script} failed: ${r.stdout}${r.stderr}`);
        return r;
      };
      const tokenFile = path.join(tokenClone, 'design/tokens.json');
      const td = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      td.groups.foundation.tokens['--brand-50'].value = '#123456';
      td.groups.spacing.tokens['--space-16'].value = '18px';
      fs.writeFileSync(tokenFile, `${JSON.stringify(td, null, 2)}\n`, 'utf8');
      cloneScript('build_tokens.mjs');
      const primitiveCss = fs.readFileSync(path.join(tokenClone, 'frontend/element-plus/tokens/primitive.css'), 'utf8');
      const sassTokens = fs.readFileSync(path.join(tokenClone, 'frontend/element-plus/tokens/element-plus.scss'), 'utf8');
      const tokensMd = fs.readFileSync(path.join(tokenClone, 'design/tokens.md'), 'utf8');
      assert(primitiveCss.includes('--brand-50: #123456;'), 'brand-50 not in primitive.css');
      assert(primitiveCss.includes('--space-16: 18px;'), 'space-16 not in primitive.css');
      assert(sassTokens.includes('#123456'), 'brand-50 not in element-plus.scss');
      assert(tokensMd.includes('#123456'), 'brand-50 not in tokens.md');
      passed('one token edit propagates to CSS, Sass and readable values');

      // —— 1:1 保留：frosted token 传播 + legacy glass 别名 ——
      const td2 = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      td2.groups['frost-common'].tokens['--frost-blur-card'].value = '24px';
      fs.writeFileSync(tokenFile, `${JSON.stringify(td2, null, 2)}\n`, 'utf8');
      cloneScript('build_tokens.mjs');
      const frosted = fs.readFileSync(path.join(tokenClone, 'frontend/element-plus/tokens/frosted.css'), 'utf8');
      const glass = fs.readFileSync(path.join(tokenClone, 'frontend/element-plus/tokens/glass.css'), 'utf8');
      assert(frosted.includes('--frost-blur-card: 24px;'), 'frost token not in frosted.css');
      assert(glass.includes('--glass-blur: var(--frost-blur-card);'), 'glass alias broken');
      passed('frosted token changes propagate while legacy glass names remain aliases');

      // —— 1:1 保留：环引用 / 未定义引用拒绝（build_tokens 把 ERROR 写到 stdout） ——
      const td3 = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      td3.groups.foundation.tokens['--brand-50'].value = 'var(--brand-50)';
      fs.writeFileSync(tokenFile, `${JSON.stringify(td3, null, 2)}\n`, 'utf8');
      let failRun = runNode(path.join(tokenClone, 'scripts', 'build_tokens.mjs'), [], { cwd: tokenClone });
      assert(failRun.status !== 0 && `${failRun.stdout}${failRun.stderr}`.includes('Cyclic'), 'cyclic reference accepted');
      passed('cyclic token references rejected');

      const td4 = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      td4.groups.foundation.tokens['--brand-50'].value = 'var(--undefined-token)';
      fs.writeFileSync(tokenFile, `${JSON.stringify(td4, null, 2)}\n`, 'utf8');
      failRun = runNode(path.join(tokenClone, 'scripts', 'build_tokens.mjs'), [], { cwd: tokenClone });
      assert(failRun.status !== 0 && `${failRun.stdout}${failRun.stderr}`.includes('Undefined'), 'undefined token accepted');
      passed('undefined token references rejected');

      // —— 1:1 保留：颜色规则完备性（132 调色板 / 37 codeMapping / 无原始媒体） ——
      const colors = JSON.parse(fs.readFileSync(path.join(LIB, 'design/tokens.json'), 'utf8')).groups;
      const paletteRe = /--(?:rose|red|orange|yellow|green|mint|cyan|blue|indigo|purple|pink|brand)-(?:05|[1-9]0)|--gray-(?:0White|05|[1-9]0|100Black)/;
      const palette = Object.keys(colors.foundation.tokens).filter((n) => paletteRe.test(n) && new RegExp(`^${paletteRe.source}$`).test(n));
      assert(palette.length === 132, `palette entries ${palette.length} != 132`);
      for (const g of ['semantic-light', 'semantic-dark', 'code-light', 'code-dark']) {
        for (const t of Object.values(colors[g].tokens)) assert(t.usage, `${g} token lacks usage`);
      }
      const mappings = Object.values(colors['code-light'].tokens)
        .filter((t) => 'codeMapping' in t)
        .map((t) => t.codeMapping);
      assert(mappings.length === 37, `code mappings ${mappings.length} != 37`);
      assert(
        mappings.every((m) => m.rationale && m.example && m.hljsClass),
        'codeMapping fields incomplete',
      );
      assert(fs.existsSync(path.join(LIB, 'design/color-rules.md')), 'color-rules.md missing');
      assert(fs.existsSync(path.join(LIB, 'design/color-tokens.md')), 'color-tokens.md missing');
      const designFiles = [];
      const walkDesign = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const child = path.join(dir, entry.name);
          if (entry.isDirectory()) walkDesign(child);
          else designFiles.push(entry.name.toLowerCase());
        }
      };
      walkDesign(path.join(LIB, 'design'));
      assert(
        !designFiles.some((n) => n.endsWith('.docx') || n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg')),
        'original media found in design/',
      );
      passed('extracted color rules, all 132 palette entries and 37 code mappings available without original media');
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(baseline, { recursive: true, force: true });
  }

  const report = {
    status: 'passed',
    checks,
    frontendBuilds: 0,
    browserSmoke: 'not performed; compile and source checks do not prove visual fidelity',
    userUiApproval: 'not claimed',
    scope: 'isolated local fixtures; original V1.4 not changed',
  };
  const reportIdx = process.argv.indexOf('--report');
  if (reportIdx !== -1 && process.argv[reportIdx + 1]) {
    fs.mkdirSync(path.dirname(path.resolve(process.argv[reportIdx + 1])), { recursive: true });
    fs.writeFileSync(
      process.argv[reportIdx + 1],
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
  }
  console.log(`Passed ${checks.length} checks.`);
}

// Windows 下 fs.realpathSync 返回反斜杠路径，`file://${real}` 永远不等于
// import.meta.url（file:///D:/...），main() 会静默跳过 — 必须 pathToFileURL 规范化
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
}
