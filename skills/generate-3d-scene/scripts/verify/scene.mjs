/* eslint-disable no-console -- CLI 输出接口 */
/**
 * Basic scene verification, shared by CLI and fixtures.
 * node scene.mjs [url] [--edit|--both] [--expect path] [--json]
 *                 [--profile preview|standard|release] [--no-cache] [--project <dir>]
 *                 [--change <file>]... [--keep-report <path>]
 * Exit: 0 PASS or explicitly INCONCLUSIVE, 1 correctness failure, 2 environment unavailable.
 *
 * P5.1 + P5-R1: complete-input content-hash cache.
 *   Cache key covers: scene-data / asset-manifest / **public/assets closure** (model
 *   bytes, bins, textures) / index.html / src split core-vs-edit (run never reuses
 *   edit conclusions) / lock / vendor / config files / check version / mode / profile /
 *   viewport / **url / expect content hash / session fingerprint**. Unreadable inputs
 *   yield an unstable key that never hits and never stores. Entries persist their
 *   keyInputs snapshot; lookup requires the full snapshot match.
 *   --change <file> (repeatable) feeds changeSet-based targeted invalidation before
 *   lookup: known-change files drop only the affected entries; any unknown file drops
 *   everything (conservative).
 *
 * P5.1 + P5-R4: profile orchestration (default standard).
 *   preview   — the basic live checks below (browser only).
 *   standard  — preview + production build (`npm run build` in the project) unless a
 *               cached build PASS is reusable; build failure is a hard FAIL of the
 *               profile verdict (report distinguishes basicChecks vs profilePass).
 *   release   — standard + strict budget gate on build (build.mjs --strict) +
 *               perf observation hook (skipped in headless swiftshader, marked SKIP).
 *   Tool dedup: a passing `build` result is recorded in the same cache; re-running
 *   standard with unchanged inputs reuses it instead of re-running npm build.
 *   Reports carry `profileChecks` listing each scheduled tool with
 *   PASS/FAIL/SKIP/cached so "basic checks passed" is never conflated with
 *   "profile satisfied".
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync, cpSync, renameSync, mkdtempSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { openBrowserSession, positionalArg, CdpEnvironmentError } from '../lib/cdp.mjs';
import { computeCacheKey, lookup, record, affectsFromChanges, invalidate } from '../lib/verification-cache.mjs';
import {
  compareGroups, intersectsFrustumBox, inspectSubject, inspectCanvas,
} from './scene-checks.mjs';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCENE_KEYS = new Set(['lights', 'camera', 'controls', 'renderer', 'environment', 'remove']);
export const PROFILES = new Set(['preview', 'standard', 'release']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const readExpect = (path) => {
  const text = readFileSync(path, 'utf8');
  const data = JSON.parse(text);
  const idByGroup = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && !SCENE_KEYS.has(key) && !key.startsWith('__')) {
      idByGroup[key] = value.map((node) => node.id);
    }
  }
  return { idByGroup, hash: createHash('sha256').update(text).digest('hex') };
};

/**
 * P5-RR1：断言内容指纹——从**实际参与断言的数据**（idByGroup）派生，不信任
 * 外部传入的 expect.hash。两个 idByGroup 不同的 expect 即使 hash 相同（调用方
 * 伪造/复用旧 hash）也不得复用缓存。文件文本 hash 仍作 sceneData 键成分
 * （scene-data.json 整体变了 verify 重跑），但断言语义绑定走本指纹。
 */
export const expectFingerprint = (expect) => createHash('sha256')
  .update(JSON.stringify(expect?.idByGroup ?? null))
  .digest('hex');

export const waitReady = async (evaluate, timeoutMs = 15000) => {
  if (!await evaluate('typeof window.__gts3d?.whenReady === "function"')) {
    return { status: 'SKIP', detail: 'legacy template has no strict ready API; manual verification required' };
  }
  const result = await evaluate(`window.__gts3d.whenReady({timeoutMs:${ timeoutMs }})`
    + '.then(d=>({ok:true,d})).catch(e=>({ok:false,message:String(e?.message??e)}))');
  return result.ok && result.d.pending === 0 && result.d.failedAssets.length === 0
    ? { status: 'PASS', detail: JSON.stringify(result.d) }
    : { status: 'FAIL', detail: result.message ?? JSON.stringify(result.d) };
};

export const summarize = (checks) => checks.some((c) => c.status === 'FAIL') ? 'FAIL'
  : checks.some((c) => c.status === 'SKIP') ? 'INCONCLUSIVE' : 'PASS';

export const verifyPage = async (page, {
  mode, expect, mountTimeoutMs = 7000, readyTimeoutMs = 15000,
}) => {
  const checks = [];
  let last = performance.now();
  const pushCheck = (id, status, evidence) => {
    const now = performance.now();
    checks.push({
      id,
      status,
      pass: status === 'PASS',
      evidence,
      duration: now - last,
      hash: expect.hash,
      source: 'live',
      mode,
    });
    last = now;
  };
  const { evaluate } = page;
  const deadline = Date.now() + mountTimeoutMs;
  let mounted = false;
  do {
    mounted = await evaluate(`!!window.__gts3d${ mode === 'edit' ? ' && !!window.__gts3dEdit' : ''}`);
    if (mounted) {
      break;
    }
    await sleep(Math.min(100, Math.max(1, deadline - Date.now())));
  } while (Date.now() < deadline);
  pushCheck('mounted', mounted ? 'PASS' : 'FAIL', mounted ? 'ok' : 'mount deadline exceeded');
  if (mounted) {
    const ready = await waitReady(evaluate, readyTimeoutMs);
    pushCheck('ready', ready.status, ready.detail);
    const graph = await evaluate('(()=>{const s=window.__gts3d.internals.sceneEngine; const groups={};'
      + 'for(const id of s.getAllIds()){(groups[s.getNodeType(id)]??=[]).push(id);}return groups;})()');
    const groups = compareGroups(expect.idByGroup, graph);
    pushCheck('groups', groups.ok ? 'PASS' : 'FAIL', JSON.stringify(groups.mismatches));
    const camera = await evaluate('!!window.__gts3d.internals.camera');
    pushCheck('camera', camera ? 'PASS' : 'FAIL', String(camera));
    const canvas = await evaluate(`(${ inspectCanvas.toString() })()`);
    pushCheck('canvas', canvas.ok ? 'PASS' : 'FAIL', JSON.stringify(canvas));
    const subject = await evaluate(`(${ inspectSubject.toString() })(window.__gts3d,${
      intersectsFrustumBox.toString() })`);
    pushCheck('subject', subject.ok ? 'PASS' : 'FAIL', JSON.stringify(subject));
    // Require a fresh successful frame, not stale nonzero statistics from a stopped loop.
    const renderDeadline = Date.now() + 1500;
    const before = await evaluate('window.__gts3d.internals.renderLoop.getStats()');
    let stats; let active = false;
    do {
      await sleep(50);
      stats = await evaluate('window.__gts3d.internals.renderLoop.getStats()');
      active = stats.fps > 0 && stats.calls > 0 && stats.elapsed > before.elapsed;
      if (active) {
        break;
      }
    } while (Date.now() < renderDeadline);
    pushCheck('render', active ? 'PASS' : 'FAIL', JSON.stringify(stats));
  }
  const diagErrors = mounted ? await evaluate('window.__gts3d.getDiagnostics?.().pageErrors ?? []') : [];
  const errors = [...new Set([...page.pageErrors, ...diagErrors])];
  pushCheck('errors', errors.length ? 'FAIL' : 'PASS', errors);
  const misses = page.netMisses.filter((m) => !/\/favicon\.ico(?:[?#\s]|$)/i.test(m));
  pushCheck('assets', misses.length ? 'FAIL' : 'PASS', misses);
  return {
    mode, verdict: summarize(checks), checks, pageErrors: errors, netMisses: misses,
  };
};

/* ── P5-R4：profile 编排的构建工具（注入缝：测试传 fake 不跑真 npm） ───────── */

/**
 * 跑（或复用缓存的）production build。
 * @param {object} deps 注入缝 { runBuild(projectRoot): {ok, status, output?} }——生产跑
 *   npm run build 并捕获 stdout（RRR4：结构化 typecheck 证据绑定到本次 build 产物，
 *   不再依赖调用方注入未绑定字符串）。
 * @returns {{ status: 'PASS'|'FAIL'|'SKIP'|'cached', detail: string, output?: string, evidence?: object }}
 */
export const runProfileBuild = (project, { cache = true, runBuild } = {}) => {
  const keyInfo = computeCacheKey(project, { check: 'build', mode: 'run', profile: 'standard' });
  if (cache && keyInfo.stable) {
    const hit = lookup(project, keyInfo.key, keyInfo.inputs);
    if (hit.hit) {
      return { status: 'cached', detail: 'production build PASS reused (inputs unchanged)' };
    }
  }
  const run = (runBuild ?? defaultRunBuild)(project);
  if (run.ok) {
    if (cache && keyInfo.stable) {
      record(project, keyInfo.key, { verdict: 'PASS', mode: 'run', profile: 'standard', checks: [] }, {
        check: 'build', keyInputs: keyInfo.inputs, affects: ['scene', 'code', 'edit', 'deps', 'config'],
      });
    }
    return {
      status: 'PASS', detail: `exit=${ run.status}`,
      output: run.output,
      // RRR4：结构化成功证据——exit=0 + 本次 stdout（vue-tsc 判定须来自这份输出，
      // 与本次产物绑定；不含 vite-only 冒充）
      evidence: run.output != null ? { exit: run.status, outputHash: createHash('sha256').update(run.output).digest('hex') } : null,
    };
  }
  return { status: 'FAIL', detail: `exit=${ run.status}`, output: run.output };
};

const defaultRunBuild = (projectRoot) => {
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: projectRoot, encoding: 'utf8', shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

/** release 档的 strict 预算门禁（build.mjs --strict；注入缝供测试）。 */
const defaultRunStrictBudget = (projectRoot) => {
  const r = spawnSync('node', [join(SKILL_ROOT, 'scripts', 'build.mjs'), projectRoot, '--strict', '--quiet'], { encoding: 'utf8' });
  return { ok: r.status === 0, status: r.status };
};

/**
 * P5-RR3 + P5-RRR4：production build 内的 typecheck 证据提取（§3.5「npm build
 * 自带 vue-tsc 时按 epoch 复用准确证据」）。
 *
 * RRR4 修复：证据 = **本次 build 的 exit=0 + 输出含 vue-tsc/tsc 执行痕迹 + 无
 * TS error**。三者缺一 → 'unknown'（不得复用，须独立跑）：
 * - 只有 vite 输出没有 tsc 痕迹（build 脚本被改成纯 vite / 只跑 vite 的桩）→
 *   unknown——不以 vite 成功冒充类型检查通过（review 反例：`vite v6 built` 单独
 *   出现被判 vue-tsc 通过）；
 * - 输出为空/非字符串（未捕获、注入桩无 output）→ unknown；
 * - 含 `error TS` → FAIL（build exit 非 0 的情况不会到这，但防御性保留）。
 * 绑定保证：buildOutput 必须来自**本次** build 调用返回的 output（verifyScene
 * 编排层从 runProfileBuild 结果透传），不接受任意字符串。
 */
export const typecheckEvidenceFromBuild = (buildOutput, buildExit = 0) => {
  if (buildExit !== 0) {
    return { status: 'unknown', detail: 'build not successful — no reusable typecheck evidence' };
  }
  if (typeof buildOutput !== 'string' || buildOutput.length === 0) {
    return { status: 'unknown', detail: 'no build output captured' };
  }
  if (/\berror TS\d+/.test(buildOutput)) {
    return { status: 'FAIL', detail: 'build output contains TS errors' };
  }
  // 必须有 tsc 执行痕迹（npm run build = vue-tsc -b && vite build 的标准链路输出
  // 两者都有；纯 vite 输出不算）
  if (/vue-tsc|(?<![a-z-])tsc\b/i.test(buildOutput)) {
    return { status: 'build', detail: 'vue-tsc passed within this build (exit=0 + tsc markers + no TS errors)' };
  }
  return { status: 'unknown', detail: 'build output has vite-only markers — tsc execution not evidenced' };
};

/**
 * P5-RR3 + RRR4：标准档 typecheck/lint 工具（§3.5 preview/standard 合同）。均走缓存去重：
 * - typecheck 优先复用 production build 的 vue-tsc 证据——buildEvidence 是
 *   runProfileBuild 本次返回的 {exit, output}（结构化绑定，不接受任意字符串）；
 *   无有效证据才独立跑 vue-tsc --noEmit；
 * - lint 跑 eslint（warn 不阻断——0 error 即 PASS，既有口径）。
 */
export const runTypecheck = (project, { cache = true, runTypecheck: runTypecheckImpl, buildEvidence } = {}) => {
  const keyInfo = computeCacheKey(project, { check: 'typecheck', mode: 'run', profile: 'standard' });
  if (cache && keyInfo.stable) {
    const hit = lookup(project, keyInfo.key, keyInfo.inputs);
    if (hit.hit) {
      return { status: 'cached', detail: 'typecheck PASS reused' };
    }
  }
  // build 证据复用（RRR4：证据来自本次 build 的结构化结果）
  const fromBuild = typecheckEvidenceFromBuild(buildEvidence?.output, buildEvidence?.exit ?? -1);
  if (fromBuild.status === 'build') {
    if (cache && keyInfo.stable) {
      record(project, keyInfo.key, { verdict: 'PASS', mode: 'run', profile: 'standard', checks: [] }, { check: 'typecheck', keyInputs: keyInfo.inputs });
    }
    return fromBuild;
  }
  if (fromBuild.status === 'FAIL') {
    return fromBuild;
  }
  const run = (runTypecheckImpl ?? defaultRunTypecheck)(project);
  if (run.ok && cache && keyInfo.stable) {
    record(project, keyInfo.key, { verdict: 'PASS', mode: 'run', profile: 'standard', checks: [] }, { check: 'typecheck', keyInputs: keyInfo.inputs });
  }
  return run.ok ? { status: 'PASS', detail: `exit=${run.status}` } : { status: 'FAIL', detail: `exit=${run.status}` };
};

const defaultRunTypecheck = (projectRoot) => {
  const r = spawnSync('npm', ['run', 'typecheck'], {
    cwd: projectRoot, encoding: 'utf8', shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, status: r.status };
};

export const runLint = (project, { cache = true, runLint: runLintImpl } = {}) => {
  const keyInfo = computeCacheKey(project, { check: 'lint', mode: 'run', profile: 'standard' });
  if (cache && keyInfo.stable) {
    const hit = lookup(project, keyInfo.key, keyInfo.inputs);
    if (hit.hit) {
      return { status: 'cached', detail: 'lint PASS reused' };
    }
  }
  const run = (runLintImpl ?? defaultRunLint)(project);
  if (run.ok && cache && keyInfo.stable) {
    record(project, keyInfo.key, { verdict: 'PASS', mode: 'run', profile: 'standard', checks: [] }, { check: 'lint', keyInputs: keyInfo.inputs });
  }
  return run.ok ? { status: 'PASS', detail: `exit=${run.status}` } : { status: 'FAIL', detail: `exit=${run.status}` };
};

const defaultRunLint = (projectRoot) => {
  const r = spawnSync('npm', ['run', 'lint'], {
    cwd: projectRoot, encoding: 'utf8', shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, status: r.status };
};

/**
 * P5-RR3 + P5-RRR2：导出运行包构建（standard「已请求运行包则导出并build一次」）。
 *
 * RRR2 修复——真实构建独立 artifact：
 *   1. strip-edit → `<project>-dist/`（**产物目录固定且保留**，不删待交付物——
 *      review 反例「rmSync(out) 删除了待交付产物」关闭）；
 *   2. 依赖准备：源工程有 node_modules 则拷贝（排除缓存目录——init --deps copy
 *      同款口径），否则 npm install；
 *   3. **npm run build**（vue-tsc + vite——运行包独有 TS/打包错误在此 FAIL，
 *      review 反例「只跑静态门禁却报 exportBuild PASS」关闭）；
 *   4. build.mjs --stripped 静态门禁作为**额外**检查保留。
 * 产物路径写进 detail（交付物可见）；缓存命中时核实 dist 存在且含构建产物
 * （dist/index.html）——不存在视为未命中重跑。
 */
export const runExportBuild = (project, { cache = true, runExport } = {}) => {
  const keyInfo = computeCacheKey(project, { check: 'exportBuild', mode: 'run', profile: 'standard' });
  const outDir = `${ project.replace(/[\\/]+$/, '') }-dist`;
  if (cache && keyInfo.stable) {
    const hit = lookup(project, keyInfo.key, keyInfo.inputs);
    // RRR2：缓存命中须核实产物存在（dist/index.html + assets）——被删的产物不可复用
    if (hit.hit && existsSync(join(outDir, 'dist', 'index.html'))) {
      return { status: 'cached', detail: `export build PASS reused — artifact at ${outDir}` };
    }
  }
  const run = (runExport ?? defaultRunExport)(project, outDir);
  if (run.ok && cache && keyInfo.stable) {
    record(project, keyInfo.key, { verdict: 'PASS', mode: 'run', profile: 'standard', checks: [] }, { check: 'exportBuild', keyInputs: keyInfo.inputs, affects: ['scene', 'code', 'deps', 'config'] });
  }
  return run.ok ? { status: 'PASS', detail: run.detail ?? 'ok' } : { status: 'FAIL', detail: run.detail ?? 'export failed' };
};

/**
 * P5-RRRR3：exportBuild 的全程 staging + 事务发布核心（可测抽取——生产步骤
 * spawnSync 真跑，测试经 hooks 注入桩）。步骤序：
 *   strip→stagePrepare（staging 目录就绪：strip 产物/依赖）→buildStep（npm build
 *   +静态门禁+产物核验）→事务发布（旧包移备份→staging 上位→删备份；失败回滚）。
 * 任一步失败：staging 清理 + 旧交付目录原位保留（分毫不动）+ 不返回 ok。
 */
export const defaultRunExportForTest = (projectRoot, outDir, hooks = {}) => {
  const oldBackup = `${outDir}.old`;
  const lock = `${outDir}.publish-lock`;
  let fd;
  try { fd = openSync(lock, 'wx'); }
  catch (error) { return { ok: false, detail: `发布被锁定：${lock}: ${error.message}` }; }
  let staging;
  try {
  if (existsSync(oldBackup)) return { ok: false, detail: `存在未恢复备份 ${oldBackup}，拒绝覆盖；请先恢复` };
  staging = mkdtempSync(`${outDir}.staging-`);
  const fail = (detail) => {
    // 失败清理：staging 弃；旧交付目录（若有）原位保留——分毫不动
    rmSync(staging, { recursive: true, force: true });
    return { ok: false, detail };
  };

  // 步骤 1：staging 就绪（生产：strip-edit → staging + 依赖准备）
  const stage = hooks.stagePrepare
    ? hooks.stagePrepare(staging)
    : productionStagePrepare(projectRoot, staging);
  if (stage && stage.ok === false) {
    return fail(`${stage.detail}（旧交付包保留）`);
  }

  // 步骤 2：build + 静态门禁 + 产物核验（生产：npm run build → build.mjs --stripped → dist/index.html）
  const build = hooks.buildStep
    ? hooks.buildStep(staging)
    : productionBuildStep(staging);
  if (build && build.ok === false) {
    return fail(`${build.detail}（旧交付包保留）`);
  }

  // 步骤 3：事务发布（staging 全部通过才动交付目录）
  const hadOld = existsSync(outDir);
  if (hadOld) {
    try {
      renameSync(outDir, oldBackup);
    } catch (err) {
      return fail(`发布失败：旧交付包移备份出错 ${err.message}（旧包原位保留）`);
    }
  }
  try {
    renameSync(staging, outDir);
  } catch (err) {
    // 回滚：备份还原
    if (hadOld) {
      try {
        renameSync(oldBackup, outDir);
      } catch (rbErr) {
        return { ok: false, detail: `发布失败且回滚失败：staging 上位出错 ${err.message}，旧包备份在 ${oldBackup} 待人工恢复（${rbErr.message}）` };
      }
    }
    return fail(`发布失败：staging 上位出错 ${err.message}（旧交付包原位保留）`);
  }
  rmSync(oldBackup, { recursive: true, force: true });
  return { ok: true, detail: `runtime package built & preserved at ${outDir}` };
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true });
    closeSync(fd);
    rmSync(lock, { force: true });
  }
};

/** 生产步骤 1：strip-edit → staging + 依赖准备（源 node_modules 拷贝 / npm install）。 */
const productionStagePrepare = (projectRoot, staging) => {
  const strip = spawnSync('node', [join(SKILL_ROOT, 'scripts', 'strip-edit.mjs'), projectRoot, '--out', staging, '--force'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (strip.status !== 0) {
    return { ok: false, detail: `strip-edit exit=${strip.status}` };
  }
  const srcModules = join(projectRoot, 'node_modules');
  if (existsSync(srcModules)) {
    const CACHE = new Set(['.tmp', '.vite', '.vite-temp', '.package-lock.json']);
    try {
      cpSync(srcModules, join(staging, 'node_modules'), { recursive: true, filter: (s) => !CACHE.has(basenameOf(s)) });
    } catch (err) {
      return { ok: false, detail: `依赖拷贝失败：${err.message}` };
    }
  } else {
    const inst = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: staging, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
    if (inst.status !== 0) {
      return { ok: false, detail: `dependency install exit=${inst.status}（剥离产物依赖准备失败）` };
    }
  }
  return { ok: true };
};

/** 生产步骤 2：真实 production build + 静态门禁 + 产物核验。 */
const productionBuildStep = (staging) => {
  const build = spawnSync('npm', ['run', 'build'], { cwd: staging, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  if (build.status !== 0) {
    return { ok: false, detail: `runtime package build exit=${build.status}（vue-tsc/vite 在剥离产物上失败）` };
  }
  const check = spawnSync('node', [join(SKILL_ROOT, 'scripts', 'build.mjs'), staging, '--stripped', '--quiet'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (check.status !== 0) {
    return { ok: false, detail: `stripped static gate exit=${check.status}` };
  }
  if (!existsSync(join(staging, 'dist', 'index.html'))) {
    return { ok: false, detail: 'runtime package build reported success but dist/index.html missing' };
  }
  return { ok: true };
};

const defaultRunExport = (projectRoot, outDir) => defaultRunExportForTest(projectRoot, outDir);

const basenameOf = (p) => p.split(/[\\/]/).pop();

const tmpdirPath = () => tmpdir();

/**
 * P5-RRR3：release 编辑回归——两段：
 *   ① smoke-structural --edit **传 --expect**（工程自身 scene-data.json——
 *      review 反例「子工具默认读母版 scene-data 导致自定义场景误判」关闭）；
 *   ② 编辑行为契约（§3.5「受影响的编辑契约检查」）：对**生成场景**执行编辑操作
 *      往返——经 handle API 做一次 patchVisual + params update + serialize 对照
 *      （针对当前场景的节点，不是库全回归）。注入缝 runEditRegression 可覆盖
 *      行为级；生产实现覆盖结构面 + 编辑往返核心契约。
 */
const defaultRunEditRegression = async (projectRoot, url, expectPath) => {
  const r = spawnSync('node', [
    join(SKILL_ROOT, 'scripts', 'verify', 'smoke-structural.mjs'), url, '--edit',
    ...(expectPath ? ['--expect', expectPath] : []),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    return { status: 'FAIL', detail: `smoke-structural --edit exit=${r.status}` };
  }
  // 编辑行为契约：对运行中场景做编辑往返（经 verifyScene 的 session 在上层做更自然；
  // 子进程内无法复用 session——这里以 CDP 独立页执行最小编辑往返）
  const editRoundTrip = spawnSync('node', [
    join(SKILL_ROOT, 'scripts', 'verify', 'edit-contract.mjs'), url,
    ...(expectPath ? ['--expect', expectPath] : []),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (editRoundTrip.status === 2) {
    // 环境不可用（CDP 起不来等）→ SKIP（INCOMPLETE 语义），不冒充 PASS
    return { status: 'SKIP', detail: `edit contract env unavailable: ${editRoundTrip.stderr?.slice(0, 120)}` };
  }
  return editRoundTrip.status === 0
    ? { status: 'PASS', detail: 'smoke-structural --edit + edit round-trip PASS' }
    : { status: 'FAIL', detail: `edit round-trip exit=${editRoundTrip.status}: ${editRoundTrip.stdout?.slice(-200)}` };
};

/**
 * P5-RRR3：release 运行包保真比较——**实际比较**编辑态与导出产物：
 *   ① strip-edit 导出（结构层）；
 *   ② 比较：编辑态 serialize 的节点/视觉/材质库 与 导出包编译的
 *      generated/appearance.ts + scene-data.json 的**结构化对照**（节点集合/
 *      槽位视觉条目/材质库条目逐项 diff——非只重跑 strip 冒充比较）。
 * 视觉级（同相机像素对照）属 P6 浏览器集成验收（既有边界）；本实现覆盖
 * 数据级保真合同。注入缝 runFidelity 覆盖。
 */
export const defaultRunFidelity = async (projectRoot) => {
  const out = `${projectRoot.replace(/[\\/]+$/, '')}-dist`;
  const cmp = spawnSync('node', [join(SKILL_ROOT, 'scripts', 'verify', 'fidelity-compare.mjs'), projectRoot, out], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: cmp.status === 0 ? 'PASS' : 'FAIL', detail: `delivery fidelity exit=${cmp.status}: ${(cmp.stdout || cmp.stderr || '').slice(-500)}` };
};

/**
 * P5-R4 + P5-RR3：档位矩阵（对齐 §3.5 合同）。
 * - preview：浏览器基础检查（verify）+ typecheck/lint 证据（§3.5 preview 行：
 *   「typecheck+生成侧lint」）。
 * - standard：preview 全部 + production build（typecheck 优先复用其证据）+
 *   已请求运行包时导出并独立 build（options.wantExport / CLI --with-export）。
 * - release：standard 全部 + strict 预算门禁 + 完整编辑回归（edit 回归矩阵）+
 *   运行包保真比较 + GPU 性能基线（headless 环境不可用时 SKIP——但总 verdict
 *   表达 INCOMPLETE，不 PASS 冒充完整 release）。
 */
export const PROFILE_TOOLS = {
  preview: ['verify', 'typecheck', 'lint'],
  standard: ['verify', 'typecheck', 'lint', 'build', 'exportBuild?'],
  release: ['verify', 'typecheck', 'lint', 'build', 'exportBuild', 'strictBudget', 'editRegression', 'fidelity', 'perf'],
};

// 注入 session 的指纹（WeakMap 按对象身份派生：同一 session 对象的多次调用
// 复用结论；不同 session 对象不复用。options.sessionFingerprint 可显式覆盖）。
const sessionFingerprints = new WeakMap();
let injectedSessionSeq = 0;
const fingerprintOf = (session, explicit) => {
  if (explicit) {
    return `injected:${explicit}`;
  }
  if (!sessionFingerprints.has(session)) {
    sessionFingerprints.set(session, `call-${++injectedSessionSeq}`);
  }
  return `injected:${sessionFingerprints.get(session)}`;
};

/** No global argv or process.exit in the reusable API. Caller may supply an already-owned session. */
export const verifyScene = async (options = {}) => {
  const {
    url = 'http://localhost:5199/', mode = 'run', project = join(SKILL_ROOT, 'template'),
    viewport = { width: 1280, height: 800 }, profile = 'standard',
  } = options;
  if (!['run', 'edit', 'both'].includes(mode)) {
    throw new Error(`Unsupported mode: ${ mode}`);
  }
  if (!PROFILES.has(profile)) {
    throw new Error(`Unsupported profile: ${ profile} (preview|standard|release)`);
  }
  const expect = options.expect ?? readExpect(options.expectPath ?? join(project, 'public', 'scene-data.json'));
  const useCache = options.cache !== false;

  // P5-R1：changeSet 接入运行路径——已知变更定向失效，未知变更全失效
  if (useCache && options.changeSet?.length) {
    invalidate(project, affectsFromChanges(options.changeSet));
  }

  const tools = PROFILE_TOOLS[profile];

  // P5-R1：完整键输入——url/expectHash/sessionFingerprint 全进键。
  // session 指纹：注入 session 的结论只在同一 session 对象的调用间复用
  // （WeakMap 对象身份派生；sessionFingerprint 显式覆盖）；自起 session（owned）
  // 无此限制（输入 hash 已完整刻画目标）。
  // P5-RR1：expectHash 用**断言内容指纹**（expectFingerprint 从 idByGroup 派生），
  // 不信任外部 expect.hash——同 hash 不同断言不复用。
  const sessionFingerprint = options.session
    ? fingerprintOf(options.session, options.sessionFingerprint)
    : 'owned';
  const assertionFingerprint = expectFingerprint(expect);
  const cacheKeyOf = (m) => computeCacheKey(project, {
    check: `verify:${ m}`, mode: m, profile,
    viewport: `${viewport.width}x${viewport.height}`,
    browser: 'edge-headless', gpu: 'swiftshader',
    url, expectHash: assertionFingerprint, sessionFingerprint,
  });

  const profileChecks = [];
  const modes = mode === 'both' ? ['run', 'edit'] : [mode];
  let allModesCached = false;

  // P5-R1：逐 mode 查缓存——任一 mode 未命中则该 mode 真跑（另一 mode 命中仍复用）
  const cachedByMode = new Map();
  if (useCache) {
    for (const m of modes) {
      const info = cacheKeyOf(m);
      if (info.stable) {
        const hit = lookup(project, info.key, info.inputs);
        if (hit.hit) {
          cachedByMode.set(m, hit.report);
        }
      }
    }
    if (modes.every((m) => cachedByMode.has(m))) {
      profileChecks.push({ tool: 'verify', status: 'cached', detail: 'all modes reused' });
      // P5-RR3：preview 全缓存命中也不直接返回——typecheck/lint 工具段照跑
      // （§3.5 preview 合同含「typecheck+生成侧lint」；缓存去重在工具层各自实现）。
      allModesCached = true;
    }
  }

  const session = options.session ?? await openBrowserSession({ port: options.port ?? 9271, windowSize: `${viewport.width },${viewport.height}` });
  const reports = [];
  const started = performance.now();
  try {
    for (const current of modes) {
      // P5-R1：该 mode 已命中缓存 → 跳过浏览器 page（另一 mode 仍真跑）
      if (cachedByMode.has(current)) {
        reports.push({ mode: current, verdict: 'PASS', checks: cachedByMode.get(current).checks, cached: true });
        continue;
      }
      const target = new URL(url);
      if (current === 'edit') {
        target.searchParams.set('edit', '1');
      } else {
        target.searchParams.delete('edit');
      }
      const page = await session.newPage();
      try {
        await page.navigateTo(target.href);
        const report = await verifyPage(page, { ...options, mode: current, expect });
        reports.push(report);
        // Cache each mode's PASS conclusion as it completes (partial progress survives later failures).
        if (useCache && report.verdict === 'PASS') {
          const info = cacheKeyOf(current);
          if (info.stable) {
            record(project, info.key, report, {
              check: `verify:${ current}`, keyInputs: info.inputs, affects: ['scene', 'code', 'deps', 'config', ...(current === 'edit' ? ['edit'] : [])],
            });
          }
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    if (!options.session) {
      await session.close();
    }
  }

  const checks = reports.flatMap((r) => r.checks);
  const basicVerdict = summarize(checks);
  profileChecks.push({
    tool: 'verify',
    status: basicVerdict === 'PASS' ? 'PASS' : basicVerdict,
    detail: `${reports.filter((r) => !r.cached).length } live / ${ reports.filter((r) => r.cached).length } cached`,
  });

  // P5-RR3：standard/release 的工具段。基础检查 FAIL → 档位直接 FAIL（不跑后续工具）。
  if (basicVerdict === 'FAIL') {
    return {
      verdict: 'FAIL', profile, scope: `profile:${ profile}`, checks, reports,
      duration: performance.now() - started, cache: allModesCached ? 'hit' : cachedByMode.size ? 'partial' : 'miss',
      profileChecks, changeSet: options.changeSet ?? null,
      basicChecks: basicVerdict,
    };
  }

  /** 通用工具执行器：status FAIL → 档位 FAIL 短路返回；SKIP 记入（末尾汇总 INCOMPLETE）。 */
  const runTool = (name, status, detail) => {
    profileChecks.push({ tool: name, status, detail });
    if (status === 'FAIL') {
      return {
        verdict: 'FAIL', profile, scope: `profile:${ profile}`, checks, reports,
        duration: performance.now() - started, cache: allModesCached ? 'hit' : cachedByMode.size ? 'partial' : 'miss',
        profileChecks, changeSet: options.changeSet ?? null,
        basicChecks: basicVerdict,
      };
    }
    return null;
  };

  // §3.5 preview/standard：typecheck + lint（typecheck 优先复用 build 证据）
  // RRR4：build 先行——typecheck 复用其结构化证据（证据绑定本次 build 的 exit+output，
  // 不再先跑 typecheck 再 build 造成冷启动重复类型检查）。preview 无 build 工具
  // → typecheck 独立跑（buildEvidence 为空 → unknown → 真跑）。
  let buildResult = null;
  if (tools.includes('build')) {
    buildResult = runProfileBuild(project, { cache: useCache, runBuild: options.runBuild });
    const failed = runTool('build', buildResult.status, buildResult.detail);
    if (failed) {
      return failed;
    }
  }

  if (tools.includes('typecheck')) {
    const tc = runTypecheck(project, {
      cache: useCache,
      runTypecheck: options.runTypecheck,
      // RRR4：buildEvidence 只来自本次 runProfileBuild 结果（{exit, output}）；
      // options.buildOutput（调用方注入字符串）不再被接受为证据
      buildEvidence: buildResult?.status === 'PASS' && buildResult.evidence
        ? { exit: buildResult.evidence.exit, output: buildResult.output }
        : null,
    });
    const failed = runTool('typecheck', tc.status, tc.detail);
    if (failed) {
      return failed;
    }
  }
  if (tools.includes('lint')) {
    const lint = runLint(project, { cache: useCache, runLint: options.runLint });
    const failed = runTool('lint', lint.status, lint.detail);
    if (failed) {
      return failed;
    }
  }

  // standard「已请求运行包则导出并build一次」（options.wantExport / CLI --with-export）
  if (tools.includes('exportBuild') || (tools.includes('exportBuild?') && options.wantExport)) {
    const exp = runExportBuild(project, { cache: useCache, runExport: options.runExport });
    const failed = runTool('exportBuild', exp.status, exp.detail);
    if (failed) {
      return failed;
    }
  }

  if (tools.includes('strictBudget')) {
    // release 附加：build.mjs --strict（预算超限升阻断）。runStrictBudget 注入缝供测试。
    const run = options.runStrictBudget ?? defaultRunStrictBudget;
    const r = run(project);
    const failed = runTool('strictBudget', r.ok ? 'PASS' : 'FAIL', `exit=${ r.status}`);
    if (failed) {
      return failed;
    }
  }

  // P5-RRR3：release 编辑回归——smoke-structural --edit **传工程自身 expect** +
  // edit-contract 行为契约（patchVisual/update/serialize 往返）。注入缝可覆盖。
  if (tools.includes('editRegression')) {
    const run = options.runEditRegression ?? defaultRunEditRegression;
    const r = await run(project, url, options.expectPath ?? join(project, 'public', 'scene-data.json'));
    const failed = runTool('editRegression', r.status, r.detail);
    if (failed) {
      return failed;
    }
  }

  // P5-RRR3：release 运行包保真比较——fidelity-compare **实际对照**编辑态与导出包
  // （节点/transform/视觉/材质库数据级 diff），非重跑 strip 冒充。注入缝可覆盖。
  if (tools.includes('fidelity')) {
    const run = options.runFidelity ?? defaultRunFidelity;
    const r = await run(project, url);
    const failed = runTool('fidelity', r.status, r.detail);
    if (failed) {
      return failed;
    }
  }

  // P5-RR3：release GPU 性能基线。环境不可用 → SKIP + 人工清单，**总 verdict
  // 表达 INCOMPLETE**（不能 PASS 冒充完整 release——§6 重审反例）。CLI --gpu
  // 时接真机采样（runPerf 注入缝）。
  if (tools.includes('perf')) {
    if (options.runPerf) {
      const perf = await options.runPerf(project, url);
      const failed = runTool('perf', perf.status, perf.detail);
      if (failed) {
        return failed;
      }
    } else {
      profileChecks.push({
        tool: 'perf', status: 'SKIP',
        detail: 'GPU perf baseline not run in this environment — run perf-fps --gpu on real GPU; release incomplete until sampled',
      });
    }
  }

  // P5-RR3：SKIP 汇总 → INCOMPLETE（有 SKIP 的档位不宣称完整 PASS）
  const hasSkip = profileChecks.some((p) => p.status === 'SKIP');
  return {
    verdict: hasSkip ? 'INCOMPLETE' : summarize(checks),
    profile,
    scope: `profile:${ profile}`,
    checks,
    reports,
    duration: performance.now() - started,
    cache: allModesCached ? 'hit' : cachedByMode.size ? 'partial' : 'miss',
    profileChecks,
    changeSet: options.changeSet ?? null,
    basicChecks: basicVerdict,
  };
};

const main = async () => {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf('--expect');
  const flag = (name) => argv.includes(name);
  const value = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const profileArg = value('--profile') ?? 'standard';
  if (!PROFILES.has(profileArg)) {
    console.error(`SCENE ERROR: unsupported profile ${profileArg} (preview|standard|release)`);
    process.exitCode = 2;
    return;
  }
  const project = value('--project') ? resolve(value('--project')) : join(SKILL_ROOT, 'template');
  const changeSet = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--change') {
      changeSet.push(argv[i + 1]);
      i += 1;
    }
  }
  const report = await verifyScene({
    url: positionalArg(argv) ?? 'http://localhost:5199/',
    mode: flag('--both') ? 'both' : flag('--edit') ? 'edit' : 'run',
    expectPath: idx >= 0 ? argv[idx + 1] : undefined,
    profile: profileArg,
    project,
    cache: !flag('--no-cache'),
    changeSet,
    // P5-RR3：standard 已请求运行包 → 导出并独立 build；--gpu 接真机 perf 采样
    wantExport: flag('--with-export'),
    runPerf: flag('--gpu')
      ? async (projectRoot, targetUrl) => {
        const r = spawnSync('node', [join(SKILL_ROOT, 'scripts', 'verify', 'perf-fps.mjs'), targetUrl, '--gpu', '--duration', '20', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        // RRR3：perf-fps 退出码语义（脚本头部合同）——
        //   0 = 无坏项（性能 WARN 不改退出码）；1 = 坏项硬 FAIL（未挂载/未就绪/异常——
        //   正确性/采样执行失败，不能吞成 WARN）；2 = CDP 环境不可用。
        if (r.status === 2) {
          return { status: 'SKIP', detail: 'GPU 环境不可用（perf-fps exit=2）——转人工清单' };
        }
        if (r.status === 1) {
          return { status: 'FAIL', detail: `perf-fps exit=1（正确性/采样执行失败）：${(r.stdout ?? r.stderr ?? '').slice(-160)}` };
        }
        return r.status === 0
          ? { status: 'PASS', detail: `perf-fps --gpu PASS（${(r.stdout ?? '').includes('"warnings":null') ? '零性能告警' : '含性能 WARN 观测值——须在验证报告回应'}）` }
          : { status: 'FAIL', detail: `perf-fps 异常退出 exit=${r.status}` };
      }
      : undefined,
  });
  if (flag('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const cacheTag = report.cache === 'hit' ? '（缓存命中——输入未变，复用上轮 PASS）'
      : report.cache === 'partial' ? '（部分缓存命中）' : '';
    for (const c of report.checks) {
      console.log(`${c.mode } ${ c.status } ${ c.id } — ${ JSON.stringify(c.evidence)}`);
    }
    for (const pc of report.profileChecks ?? []) {
      console.log(`profile ${ pc.status } ${ pc.tool } — ${ pc.detail }`);
    }
    const incompleteNote = report.verdict === 'INCOMPLETE'
      ? '（档位含 SKIP 项——release 未完整完成，不冒充 PASS）' : '';
    console.log(`SCENE ${ report.verdict } [profile=${ report.profile }, scope=${ report.scope }]${ cacheTag }${ incompleteNote }`);
  }
  // P5-RR3：INCOMPLETE 不算失败（已完成的检查都过），但退出码区分（3）——
  // 调度方/用户能看到「未完整」而不与干净 PASS 混淆
  process.exitCode = report.verdict === 'FAIL' ? 1 : report.verdict === 'INCOMPLETE' ? 3 : 0;
};
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error('SCENE ERROR:', error.message);
    process.exitCode = error instanceof CdpEnvironmentError ? 2 : 1;
  });
}
