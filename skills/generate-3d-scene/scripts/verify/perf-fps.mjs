/**
 * perf-fps.mjs — 运行期性能观测（三层分类口径）
 *
 * 三层断言：
 *   坏 = 唯一硬 FAIL：报错/白屏/无法渲染/场景图不符/加载失败（smoke-structural 管，本脚本管 __gts3d 挂载）
 *   重 = WARN：calls/triangles/programs 超预算——预算数值机器相关 + 需求相关（60 块岩石=合法 3M 三角形），
 *        不阻塞交付；LLM 必须在验证报告回应（优化或说明理由）
 *   卡 = WARN：fps 观测值（真机 GPU 模式采样），用户反馈「卡」→ LLM 参考基线修复 → 复测对比
 *
 * `--strict` 恢复严格判定（超预算/帧率不足升 FAIL，validate-model 同款先例）。
 * 软渲染环境（swiftshader）只做预算观测不计 fps（fps 天然偏低无意义）。
 * 采样：renderLoop.getStats()（每帧记录的 1s 窗口帧率，零侵入）。
 * 口径依据见 references/verification.md。
 *
 * 连接层已迁移 scripts/lib/cdp.mjs（P1）。CLI 与退出码不变。
 *
 * 用法：node perf-fps.mjs [url] [--duration 20] [--gpu] [--strict] [--json]
 *          [--max-calls N] [--max-triangles N] [--max-materials N]
 *   --gpu  真机 GPU 模式（不注入 swiftshader）→ 采样 fps
 *   退出码：0 无坏项（WARN 不改退出码；--strict 下超限升 1）/ 1 FAIL / 2 CDP 环境不可用
 */
import { openBrowserSession, positionalArg, CdpEnvironmentError } from '../lib/cdp.mjs';

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

    // 等场景挂载 + GLB 收敛
    let mounted = false;
    for (let i = 0; i < 10; i += 1) {
      mounted = await evaluate('!!window.__gts3d');
      if (mounted) {
        break;
      }
      await sleep(700);
    }
    if (!mounted) {
      console.log('PERF FAIL: __gts3d 未挂载');
      process.exitCode = 1;
      return;
    }
    await sleep(3000);

    // ① 预算断言（稳定态采样：连采 5 帧取最大值，避免瞬时抖动误判）
    let budget = null;
    for (let i = 0; i < 5; i += 1) {
      const s = await evaluate(`(() => {
        const h = window.__gts3d;
        const stats = h.internals.renderLoop.getStats();
        return { calls: stats.calls, triangles: stats.triangles,
          programs: h.internals.rendererEngine.renderer.info.programs.length };
      })()`);
      budget = budget === null ? s : {
        calls: Math.max(budget.calls, s.calls),
        triangles: Math.max(budget.triangles, s.triangles),
        programs: Math.max(budget.programs, s.programs),
      };
      await sleep(300);
    }
    const callsOk = budget.calls <= MAX_CALLS;
    const trisOk = budget.triangles <= MAX_TRIANGLES;
    const matsOk = budget.programs <= MAX_MATERIALS;
    const budgetOver = !callsOk || !trisOk || !matsOk; // 重：WARN（--strict 升 FAIL）

    // ② fps 观测（真机 GPU 模式）：采样 DURATION 秒，每秒取一帧统计，p95 参考值
    let fpsOk = null;
    let p95 = null;
    const samples = [];
    if (GPU_MODE) {
      for (let i = 0; i < DURATION; i += 1) {
        await sleep(1000);
        const fps = await evaluate('window.__gts3d.internals.renderLoop.getStats().fps');
        samples.push(fps);
      }
      samples.sort((a, b) => a - b);
      p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
      fpsOk = p95 >= 40; // 卡：WARN 观测值（--strict 升 FAIL）
    }

    if (AS_JSON) {
      console.log(JSON.stringify({
        ok: !STRICT || (!budgetOver && (fpsOk ?? true)),
        hardFail: false,
        warnings: {
          budget: budgetOver ? { calls: budget.calls, triangles: budget.triangles, programs: budget.programs } : null,
          fps: fpsOk === false ? { p95 } : null,
        },
        mode: GPU_MODE ? 'gpu' : 'swiftshader',
        budget, p95, samples: samples.length,
        limits: { calls: MAX_CALLS, triangles: MAX_TRIANGLES, materials: MAX_MATERIALS },
        strict: STRICT,
      }, null, 2));
    } else {
      console.log(`环境: ${GPU_MODE ? '真机 GPU（fps 观测）' : 'swiftshader 软渲染（只做预算观测，不计 fps）'}${STRICT ? ' / strict（超限升 FAIL）' : ''}`);
      const budgetVerdict = budgetOver ? (STRICT ? 'FAIL' : 'WARN') : 'PASS';
      console.log(`重（预算）: calls=${budget.calls}/${MAX_CALLS} / triangles=${budget.triangles}/${MAX_TRIANGLES} / programs=${budget.programs}/${MAX_MATERIALS} → ${budgetVerdict}${budgetOver && !STRICT ? '（LLM 须在验证报告回应：优化或说明理由）' : ''}`);
      if (GPU_MODE) {
        const fpsVerdict = fpsOk === false ? (STRICT ? 'FAIL' : 'WARN') : 'PASS';
        console.log(`卡（fps）: p95=${p95}（${samples.length} 样本 / ${DURATION}s）→ ${fpsVerdict}${fpsOk === false && !STRICT ? '（观测值；用户反馈卡 → 修复 → 复测对比）' : ''}`);
      }
      const fail = (budgetOver && STRICT) || (fpsOk === false && STRICT);
      console.log(fail ? 'PERF FAIL（strict）' : 'PERF OK（性能项为 WARN 观测，坏项硬 FAIL 归 smoke-structural）');
      process.exitCode = fail ? 1 : 0;
    }
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  console.error('PERF ERROR:', e.message);
  process.exit(1);
});
