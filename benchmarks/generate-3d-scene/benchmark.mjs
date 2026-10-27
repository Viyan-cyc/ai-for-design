/**
 * benchmark.mjs — 工具链时序基准记录（P5.2 / Spec §4.5）
 *
 * 记录场景生成各阶段 wall time，输出 JSON 基线报告（供提速对照，非门禁）：
 *   - deps.prepare      首次依赖准备（npm install / copy）
 *   - deps.cached       已缓存依赖初始化（二次 init --deps copy）
 *   - dev.server        dev server 就绪（HTTP 200）
 *   - browser.ready     浏览器挂载 + whenReady 终态
 *   - verify.checks     定向验证（scene.mjs 双态）
 *   - build.final       production build（npm run build）
 *   - export.strip      strip-edit 导出（可选 --with-export）
 *   - search.batch      批量检索（可选 --queries）
 *
 * 用法：
 *   node benchmarks/generate-3d-scene/benchmark.mjs --project <dir> [--runs 3] [--out <report.json>]
 *                              [--with-export] [--queries <file>] [--keep]
 *   --runs N          重复次数（默认 3；取 median，输出逐次明细）
 *   --keep            保留临时导出目录
 *   退出码：0 基准完成 / 2 用法或环境错误（基准不是门禁，不产生 1）
 *
 * 纪律（Spec §4.5）：同机、同 Node/浏览器/viewport、相同 fixture/依赖；
 * 不并行跑 GPU 采样；速度未达目标只报告差距，不砍验证。
 * LLM 生成耗时不可机器测——由会话执行日志另行记录，本工具只测工具侧。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
const SCRIPTS = join(SKILL_ROOT, 'scripts');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const PROJECT = value('--project') ?? join(SKILL_ROOT, 'template');
const RUNS = Number(value('--runs') ?? 3);
const OUT = value('--out');
const QUERIES = value('--queries');
const WITH_EXPORT = flag('--with-export');
const KEEP = flag('--keep');

if (flag('--help') || flag('-h')) {
  console.log(`用法: node benchmarks/generate-3d-scene/benchmark.mjs --project <dir> [--runs 3] [--out <report.json>]
                        [--with-export] [--queries <file>] [--keep]`);
  process.exit(0);
}

if (!existsSync(PROJECT)) {
  console.error(`[benchmark] 工程不存在: ${PROJECT}`);
  process.exit(2);
}
if (!Number.isFinite(RUNS) || RUNS < 1) {
  console.error(`[benchmark] --runs 需要正整数，收到: ${RUNS}`);
  process.exit(2);
}

const run = (label, cmd, args, cwd) => {
  const started = performance.now();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  return {
    stage: label,
    ok: r.status === 0,
    ms: Math.round(performance.now() - started),
    status: r.status,
    outputTail: r.status === 0 ? undefined : `${r.stdout ?? ''}${r.stderr ?? ''}`.slice(-400),
  };
};

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/** 等待 dev server HTTP 200（1s 间隔，deadline 120s）。vite 6 默认监听 IPv6
 *  localhost——探 `localhost` 而非 `127.0.0.1`（后者在纯 IPv6 监听下拒连）。 */
const waitForServer = async (url, deadlineMs = 120000) => {
  const started = performance.now();
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return { ok: true, ms: Math.round(performance.now() - started) };
      }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { ok: false, ms: Math.round(performance.now() - started) };
};

const freePort = async () => {
  const net = await import('node:net');
  return new Promise((resolvePort) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePort(port));
    });
  });
};const oneRun = async (runIndex) => {
  const stages = [];
  const port = await freePort();
  const url = `http://localhost:${ port }/`;

  // ① dev server（异步起，就绪即计）
  const { spawn } = await import('node:child_process');
  const serverStarted = performance.now();
  const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], {
    cwd: PROJECT, stdio: 'ignore', shell: process.platform === 'win32',
  });
  const up = await waitForServer(url);
  stages.push({ stage: 'dev.server', ...up });
  if (!up.ok) {
    vite.kill();
    return { stages, failed: 'dev server 未就绪' };
  }

  try {
    // ② 浏览器 ready + 定向检查（scene.mjs --both 走缓存关闭口径计时）
    const verifyStage = run('verify.checks', 'node', [resolve(SKILL_ROOT, '../../tests/generate-3d-scene/scene.mjs'), url, '--both', '--no-cache', '--project', PROJECT], SKILL_ROOT);
    stages.push(verifyStage);

    // ③ 批量检索（可选）
    if (QUERIES) {
      stages.push(run('search.batch', 'node', [join(SCRIPTS, 'search-assets.mjs'), '--batch', QUERIES, '--top', '5'], SKILL_ROOT));
    }

    // ④ production build（杀 server 后跑，避免端口/资源干扰）
    vite.kill();
    stages.push(run('build.final', 'npm', ['run', 'build'], PROJECT));

    // ⑤ 导出（可选）
    if (WITH_EXPORT) {
      const tmpOut = mkdtempSync(join(tmpdir(), `g3d-bench-export-${ runIndex }-`));
      const r = run('export.strip', 'node', [join(SCRIPTS, 'strip-edit.mjs'), PROJECT, '--out', tmpOut, '--force'], SKILL_ROOT);
      r.detail = { out: tmpOut, keep: KEEP };
      stages.push(r);
      if (!KEEP) {
        rmSync(tmpOut, { recursive: true, force: true });
      }
    }
  } finally {
    vite.kill();
  }
  return { stages };
};

const main = async () => {
  const results = [];
  for (let i = 0; i < RUNS; i += 1) {
    const r = await oneRun(i);
    results.push(r);
    const line = r.stages.map((s) => `${ s.stage }=${ s.ms }ms${ s.ok ? '' : '(FAIL)' }`).join('  ');
    console.log(`[benchmark] run ${ i + 1 }/${ RUNS }: ${ line }`);
  }

  // 聚合：每 stage 的 median（只聚合 ok 的 run）
  const stageNames = [...new Set(results.flatMap((r) => r.stages.map((s) => s.stage)))];
  const aggregate = {};
  for (const name of stageNames) {
    const times = results.map((r) => r.stages.find((s) => s.stage === name)).filter((s) => s?.ok).map((s) => s.ms);
    if (times.length) {
      aggregate[name] = { median: median(times), runs: times };
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT,
    runs: RUNS,
    node: process.version,
    platform: process.platform,
    aggregate,
    details: results.map((r, i) => ({ run: i + 1, stages: r.stages, failed: r.failed ?? null })),
    note: 'LLM 生成耗时不可机器测——由会话执行日志另行记录；本报告只测工具侧 stage wall time。',
  };

  if (OUT) {
    writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`[benchmark] 报告 → ${ OUT}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  process.exit(0);
};

main().catch((e) => {
  console.error(`[benchmark] ${ e.message}`);
  process.exit(2);
});
