/**
 * perf-fps.mjs — 运行期性能观测（三层分类口径）
 *
 * 三层断言：
 *   坏 = 唯一硬 FAIL：报错/白屏/无法渲染/场景图不符/加载失败（smoke-structural 管，本脚本管 __gts3d 挂载）
 *   重 = WARN：calls/triangles/programs 超预算——预算数值机器相关 + 需求相关（60 块岩石=合法 3M 三角形），
 *        不阻塞交付；LLM 必须在验证报告回应（优化或说明理由）
 *   卡 = WARN：fps 观测值（真机 GPU 模式采样），用户反馈「卡」→ LLM 参考基线修复 → 复测对比
 *
 * P5.2（F12）指标修正：
 *   - frame-time 分布（p50/p95/p99，毫秒）替代单一 fps 点值——fps 采样每秒一帧
 *     丢失了帧间抖动；p95 frame time 才是「卡顿感」的正确口径
 *   - programs（着色器数）与 materials（场景材质数）分开统计——
 *     programs 当 materials 用会漏报材质超限（同 shader 多材质合法）
 *   - GPU resources（info.memory.geometries/textures）独立上报——资源泄漏观测
 *
 * `--strict` 恢复严格判定（超预算/帧率不足升 FAIL，validate-model 同款先例）。
 * 软渲染环境（swiftshader）只做预算观测不计 fps（fps 天然偏低无意义）。
 *
 * P5.1：固定 sleep 换事件驱动——whenReady 终态（pending=0 或失败）即收敛，
 *   不再 sleep(3000) 等 GLB；预算采样仍是稳定态连采 5 帧取最大值。
 *
 * 连接层已迁移 scripts/lib/cdp.mjs（P1）。CLI 与退出码不变。
 *
 * 用法：node perf-fps.mjs [url] [--duration 20] [--gpu] [--strict] [--json]
 *          [--max-calls N] [--max-triangles N] [--max-materials N]
 *   --gpu  真机 GPU 模式（不注入 swiftshader）→ 采样 fps/frame-time
 *   退出码：0 无坏项（WARN 不改退出码；--strict 下超限升 1）/ 1 FAIL / 2 CDP 环境不可用
 */
import { openBrowserSession, positionalArg, CdpEnvironmentError } from '../lib/cdp.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const URL_ARG = positionalArg(argv) ?? 'http://localhost:5199/';
const numArg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const DURATION = numArg('--duration', 20);
const MAX_CALLS = numArg('--max-calls', 400);
const MAX_TRIANGLES = numArg('--max-triangles', 1_000_000);
const MAX_MATERIALS = numArg('--max-materials', 32);
const GPU_MODE = argv.includes('--gpu');
const STRICT = argv.includes('--strict');
const AS_JSON = argv.includes('--json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 升序样本 → 分位值（nearest-rank）。samples 须已排序。 */
const percentile = (sorted, p) => {
  if (!sorted.length) {
    return null;
  }
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

/**
 * P5-R2：frame-time 统计（纯函数，导出供确定性单测）。
 * 输入是真实逐帧时间戳序列（rAF 时间戳），输出帧间隔毫秒 + 分位数。
 * 帧间隔 = timestamps[i] - timestamps[i-1]（首帧无前帧，不产间隔——不丢样本）。
 */
export const frameTimesFrom = (timestamps) => {
  const times = [];
  for (let i = 1; i < timestamps.length; i += 1) {
    const dt = timestamps[i] - timestamps[i - 1];
    if (Number.isFinite(dt) && dt > 0) {
      times.push(dt);
    }
  }
  return times;
};

/**
 * P5-R2：低分位 FPS 判据。合同口径是「低分位 FPS」（§4.4 V23：低分位）——
 * 用 frame-time 分位数反推：fps(q) = 1000 / q 分位帧时长，含义「最差 (100-q)% 帧的
 * 等效帧率」。默认 q=95（持续慢帧判卡）；单次长停顿看 p99（一次 500ms 停顿在 60
 * 帧样本里占 ~1.6%，只推高 p99——两档分位一起报告，长停顿与持续慢区分呈现）。
 */
export const fpsFromFrameTimes = (frameTimesMs, quantile = 95) => {
  const q = percentile([...frameTimesMs].sort((a, b) => a - b), quantile);
  return q != null && q > 0 ? 1000 / q : null;
};

const main = async () => {
  let session;
  try {
    session = await openBrowserSession({
      url: URL_ARG,
      port: 9233,
      gpu: GPU_MODE,
    });
  } catch (e) {
    if (e instanceof CdpEnvironmentError) {
      console.error('CDP 不可用（环境预检不过）→ 性能门禁转人工/真机环境');
      process.exit(2);
    }
    throw e;
  }

  try {
    const { evaluate } = session;

    // 等场景挂载（轮询 deadline 兜底；正常几十毫秒）
    const mountDeadline = Date.now() + 10000;
    let mounted = false;
    do {
      mounted = await evaluate('!!window.__gts3d');
      if (mounted) {
        break;
      }
      await sleep(100);
    } while (Date.now() < mountDeadline);
    if (!mounted) {
      console.log('PERF FAIL: __gts3d 未挂载');
      process.exitCode = 1;
      return;
    }

    // P5.1：whenReady 终态驱动（新模板）；旧模板回退轻量轮询——不再固定 sleep(3000)
    const hasReady = await evaluate('typeof window.__gts3d?.whenReady === "function"');
    if (hasReady) {
      const ready = await evaluate('window.__gts3d.whenReady({timeoutMs:15000})'
        + '.then(d=>({ok:true,pending:d.pending})).catch(e=>({ok:false,message:String(e?.message??e)}))');
      if (!ready.ok) {
        console.log(`PERF FAIL: 场景未就绪（${ready.message}）`);
        process.exitCode = 1;
        return;
      }
    } else {
      await sleep(1500); // 旧模板无 ready API：保守短等待
    }

    // ① 预算断言（稳定态采样：连采 5 帧取最大值，避免瞬时抖动误判）
    //    P5.2：materials 与 programs 分开——scene 遍历数材质实例，programs 只数着色器
    let budget = null;
    for (let i = 0; i < 5; i += 1) {
      const s = await evaluate(`(() => {
        const h = window.__gts3d;
        const stats = h.internals.renderLoop.getStats();
        let materials = 0;
        const seen = new Set();
        h.internals.scene.traverse((c) => {
          if (!c.material) return;
          for (const m of (Array.isArray(c.material) ? c.material : [c.material])) {
            if (!seen.has(m)) { seen.add(m); materials += 1; }
          }
        });
        const mem = h.internals.rendererEngine.renderer.info.memory;
        return { calls: stats.calls, triangles: stats.triangles,
          programs: h.internals.rendererEngine.renderer.info.programs.length,
          materials, geometries: mem.geometries, textures: mem.textures };
      })()`);
      budget = budget === null ? s : {
        calls: Math.max(budget.calls, s.calls),
        triangles: Math.max(budget.triangles, s.triangles),
        programs: Math.max(budget.programs, s.programs),
        materials: Math.max(budget.materials, s.materials),
        geometries: Math.max(budget.geometries ?? 0, s.geometries ?? 0),
        textures: Math.max(budget.textures ?? 0, s.textures ?? 0),
      };
      await sleep(300);
    }
    const callsOk = budget.calls <= MAX_CALLS;
    const trisOk = budget.triangles <= MAX_TRIANGLES;
    const matsOk = budget.materials <= MAX_MATERIALS;
    const budgetOver = !callsOk || !trisOk || !matsOk; // 重：WARN（--strict 升 FAIL）

    // ② fps 观测（真机 GPU 模式）：P5-R2 改**真实逐帧时间戳**采集——
    //    页面内注入 rAF 记录器收集 DURATION 秒的 performance.now() 时间戳，
    //    帧间隔 = 相邻时间戳差（不排序、不丢最慢样本）；p95 帧时长反推低分位 FPS。
    let fpsOk = null;
    let p95 = null;
    let fpsLow = null;
    const samples = [];
    let frameTimesMs = [];
    const frameTime = { p50: null, p95: null, p99: null };
    if (GPU_MODE) {
      // 注入记录器（自隔离：采样窗口后自清除，不污染页面）
      await evaluate(`(() => {
        window.__gts3dPerf = { stamps: [], raf: 0 };
        const tick = (t) => {
          window.__gts3dPerf.stamps.push(t);
          if (window.__gts3dPerf.raf) { window.__gts3dPerf.raf = requestAnimationFrame(tick); }
        };
        window.__gts3dPerf.raf = requestAnimationFrame(tick);
      })()`);
      await sleep(DURATION * 1000);
      const stamps = await evaluate('window.__gts3dPerf.stamps');
      await evaluate('cancelAnimationFrame(window.__gts3dPerf.raf); delete window.__gts3dPerf');
      frameTimesMs = frameTimesFrom(stamps ?? []);
      samples.push(...frameTimesMs);
      const sorted = [...frameTimesMs].sort((a, b) => a - b);
      frameTime.p50 = percentile(sorted, 50);
      frameTime.p95 = percentile(sorted, 95);
      frameTime.p99 = percentile(sorted, 99);
      p95 = frameTime.p95;
      // 低分位 FPS 判据（样本 <10 帧 → null 不判卡）：
      //   判卡主口径 fps(p95) = 1000/p95 帧时长（持续慢帧）；
      //   p99 帧时长独立报告（单次长停顿在 60 帧样本只占 ~1.6%，推高 p99 不推 p95——
      //   两档分开呈现，长停顿与持续慢不被同一数字掩盖）。
      fpsLow = frameTimesMs.length >= 10 ? fpsFromFrameTimes(frameTimesMs, 95) : null;
      fpsOk = fpsLow != null ? fpsLow >= 40 : null; // 卡：WARN 观测值（--strict 升 FAIL）
    }

    if (AS_JSON) {
      console.log(JSON.stringify({
        ok: !STRICT || (!budgetOver && (fpsOk ?? true)),
        hardFail: false,
        warnings: {
          budget: budgetOver ? { calls: budget.calls, triangles: budget.triangles, materials: budget.materials } : null,
          fps: fpsOk === false ? { fpsLowPercentile: fpsLow, p95FrameTimeMs: p95 } : null,
        },
        mode: GPU_MODE ? 'gpu' : 'swiftshader',
        budget,
        fpsLowPercentile: fpsLow,
        p95FrameTimeMs: p95,
        frameTime,
        frameSamples: samples.length,
        resources: { geometries: budget.geometries, textures: budget.textures },
        limits: { calls: MAX_CALLS, triangles: MAX_TRIANGLES, materials: MAX_MATERIALS },
        strict: STRICT,
      }, null, 2));
    } else {
      console.log(`环境: ${GPU_MODE ? '真机 GPU（逐帧时间戳采样）' : 'swiftshader 软渲染（只做预算观测，不计 fps）'}${STRICT ? ' / strict（超限升 FAIL）' : ''}`);
      const budgetVerdict = budgetOver ? (STRICT ? 'FAIL' : 'WARN') : 'PASS';
      console.log(`重（预算）: calls=${budget.calls}/${MAX_CALLS} / triangles=${budget.triangles}/${MAX_TRIANGLES} / materials=${budget.materials}/${MAX_MATERIALS}（着色器 programs=${budget.programs} 独立计）→ ${budgetVerdict}${budgetOver && !STRICT ? '（LLM 须在验证报告回应：优化或说明理由）' : ''}`);
      console.log(`资源: geometries=${budget.geometries} / textures=${budget.textures}（GPU memory 观测，泄漏趋势对照用）`);
      if (GPU_MODE) {
        const fpsVerdict = fpsOk === null ? 'SKIP' : fpsOk === false ? (STRICT ? 'FAIL' : 'WARN') : 'PASS';
        const ft = frameTime.p50 != null
          ? ` / frame-time p50=${frameTime.p50.toFixed(1)}ms p95=${frameTime.p95.toFixed(1)}ms p99=${frameTime.p99.toFixed(1)}ms`
          : '';
        console.log(`卡（fps 低分位）: fps(p95)=${fpsLow != null ? fpsLow.toFixed(1) : 'N/A'}（p95 帧时长 ${p95 != null ? p95.toFixed(1) : 'N/A'}ms，${samples.length} 帧样本 / ${DURATION}s${ft}）→ ${fpsVerdict}${fpsOk === false && !STRICT ? '（观测值；用户反馈卡 → 修复 → 复测对比）' : ''}`);
      }
      const fail = (budgetOver && STRICT) || (fpsOk === false && STRICT);
      console.log(fail ? 'PERF FAIL（strict）' : 'PERF OK（性能项为 WARN 观测，坏项硬 FAIL 归 smoke-structural）');
      process.exitCode = fail ? 1 : 0;
    }
  } finally {
    await session.close();
  }
};

// CLI 入口守卫：被 import（取纯函数）时不执行 main
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error('PERF ERROR:', e.message);
    process.exit(1);
  });
}
