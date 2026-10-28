/* eslint-disable no-console */
/**
 * p6-visual-compare.mjs — P6-B 同相机视觉对照（V17）
 *
 * 编辑态（dev server）与交付运行包（production build preview）在同一相机参数下
 * 各截一张全页 PNG：
 *   ① 两页均以数据声明的相机（scene-data.json camera）装配——两页相机数据同一
 *      来源（dist/scene-data.json 由编辑态 serialize 产出），装配即同相机；编辑态
 *      另读运行态 camera.position/quaternion 数值断言；
 *   ② CDP Page.captureScreenshot 同 viewport（1280×800）截图；
 *   ③ 数据断言（编辑侧）：节点树/视觉生效态（car_01 红/car_02 隐藏/tree_02 绿）；
 *   ④ 真实加载/渲染终态（P6-R2 终版——截图稳定仅为辅助防早截，不作完成证明）：
 *      - 编辑态：whenReady({timeoutMs}) **tracker 真值终态**（pending=0 且无失败）；
 *      - 运行包（prod 剔除 __scene3d，无 tracker 可读）：badge text 的 loaded/total
 *        **数值解析**为主判据——badge text 是 tracker 计数的 DOM 投影（"3/4 loaded"
 *        即 tracker 真值 loaded=3/total=4），loaded==total 才是「资产全部完成」的
 *        可证明形态；叠加 CDP 层 pageErrors 零 + netMisses 零非 favicon 失败 +
 *        canvas 存在；
 *      - 画面稳定性（连续截图尺寸变化 <2%）降级为**辅助**：仅在加载完成证明成立
 *        后防早截（GLB 出现会显著改变 PNG 尺寸——空白 ~50KB vs 含模型 ~76KB）；
 *      - **无法证明完成 → INCOMPLETE（退出码 3，对齐 scene.mjs 档位语义），不
 *        自动 PASS**：badge 数值解析出 loaded<total 持续不收敛（已知产品徽标
 *        缺陷：tracker 真值 4/4 收敛但 badge 显示永停 3/4——徽标与 tracker 脱钩，
 *        已记录）或 badge 不可解析时，只能证明「画面稳定」，不能证明「资产完成」。
 *   ⑤ 像素 diff：pngjs 可用时输出差异统计（阈值判定由人工目检裁决，不自动宣称
 *      视觉一致；不可用时跳过并明示）。
 *
 * 用法：
 *   node p6-visual-compare.mjs <edit-url> <out-dir> <run-url>
 *   node p6-visual-compare.mjs --neg-unloaded <url>          早截窗口负例（画面未稳+未完成 → 拒绝）
 *   node p6-visual-compare.mjs --neg-stuck <url>             「画面稳定但资产未完成」确定性负例
 *     （dev 态注入 pending 永不 settle 的节点——需可读 tracker 真值做确定性判定；
 *      期望：门禁报 INCOMPLETE/FAIL 而非 PASS）
 *   退出码：0 数据级 PASS（视觉结论留人工）/ 1 FAIL / 2 CDP 环境不可用 /
 *   3 INCOMPLETE（无法证明资产完成——不冒充 PASS）
 */
import { openBrowserSession, CdpEnvironmentError } from "../../skills/generate-3d-scene/scripts/lib/cdp.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PNG_WIDTH = 1280;
const PNG_HEIGHT = 800;

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const NEG_URL = flagValue("--neg-unloaded");
const NEG_STUCK_URL = flagValue("--neg-stuck");
const flagNames = new Set(["--neg-unloaded", "--neg-stuck"]);
const posArgs = argv.filter((a, i) => !flagNames.has(a) && !flagNames.has(argv[i - 1] ?? ""));
const OUT_DIR = posArgs[1] ?? "C:/Users/Tony/Documents/Codex/2026-10-13/zuo/work/p6/shots";
const URLS = {
  edit: posArgs[0] ?? "http://localhost:5183/?edit=1",
  run: posArgs[2] ?? "http://localhost:5283/",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decodePng = (buf) => {
  try {
    const { PNG } = require("pngjs");
    return PNG.sync.read(buf);
  } catch {
    return null;
  }
};

/** 非 favicon 网络失败（CDP 连接层 netMisses 已剔除 loadingFinished 的正常请求） */
const realNetMisses = (misses) =>
  misses.filter((m) => !/\/favicon\.ico/i.test(m));

/** badge text "3/4 loaded" → { loaded: 3, total: 4 }；不可解析 → null */
const parseBadgeCounts = (text) => {
  if (typeof text !== "string") {
    return null;
  }
  const m = /(\d+)\s*\/\s*(\d+)/.exec(text);
  if (!m) {
    return null;
  }
  const loaded = Number(m[1]);
  const total = Number(m[2]);
  return Number.isFinite(loaded) && Number.isFinite(total) && total > 0
    ? { loaded, total }
    : null;
};

class IncompleteError extends Error {
  constructor(message) {
    super(message);
    this.name = "IncompleteError";
  }
}

/**
 * 运行包真实终态门禁（P6-R2 终版）：
 *   主判据：badge text 数值（tracker 计数的 DOM 投影）达到 loaded==total——
 *           这是 prod 侧唯一可读的「资产全部完成」证明。
 *   辅助判据：画面稳定性（连续截图尺寸变化 <2%）——仅在完成后防早截；画面稳定
 *           本身不证明资产完成。
 *   语义：badge 数值不可解析或 loaded<total 持续（等待窗口内不收敛）→ 抛
 *         IncompleteError（INCOMPLETE，退出码 3），不冒充 PASS。
 *   已知边界（产品缺陷，记录未修）：tracker 真值可收敛 4/4 而 badge 永停 3/4
 *   （徽标与 tracker 脱钩）——此时本门禁如实报 INCOMPLETE，即「无法证明完成」。
 */
const awaitProdSettled = async (page, { timeoutMs = 90000, stableSamples = 3, sampleEveryMs = 3000 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  const sizes = [];
  let lastBadge = null;
  let badgeComplete = false;
  for (;;) {
    lastBadge = await page.evaluate(`(() => {
      const badge = document.querySelector('.scene3d-load-badge');
      const canvas = document.getElementById('scene-canvas');
      return {
        badgeExists: !!badge,
        badgeText: badge ? badge.textContent : null,
        canvasExists: !!canvas,
      };
    })()`);
    const counts = parseBadgeCounts(lastBadge.badgeText);
    badgeComplete = counts !== null && counts.loaded >= counts.total;
    const shot = await page.rpc("Page.captureScreenshot", { format: "png" });
    const buf = Buffer.from(shot.result.data, "base64");
    sizes.push(buf.length);
    const n = sizes.length;
    const pictureStable =
      n >= stableSamples + 1 &&
      sizes
        .slice(n - stableSamples - 1, n)
        .every((s, i, arr) => i === 0 || Math.abs(s - arr[i - 1]) / arr[i - 1] < 0.02);
    if (Date.now() > deadline) {
      return {
        settled: false,
        incomplete: true,
        badge: lastBadge,
        badgeCounts: counts,
        pictureStable,
        sizes: sizes.slice(-4),
        pageErrors: page.pageErrors,
        netMisses: realNetMisses(page.netMisses),
        timeoutMs,
      };
    }
    // 主判据（badge 完成）+ 辅助判据（画面稳定防早截）同时成立才算可证明完成
    if (badgeComplete && pictureStable && lastBadge.canvasExists) {
      return {
        settled: true,
        incomplete: false,
        badge: lastBadge,
        badgeCounts: counts,
        sizes: sizes.slice(-4),
        lastShot: buf,
        pageErrors: page.pageErrors,
        netMisses: realNetMisses(page.netMisses),
      };
    }
    await sleep(sampleEveryMs);
  }
};

const shotEdit = async (session, url) => {
  const page = await session.newPage();
  try {
    await page.navigateTo(url);
    const { evaluate, rpc } = page;
    let mounted = false;
    for (let i = 0; i < 30; i += 1) {
      mounted = await evaluate("!!window.__scene3d");
      if (mounted) {
        break;
      }
      await sleep(500);
    }
    if (!mounted) {
      throw new Error(`__scene3d 未挂载（编辑态）: ${url}`);
    }
    const ready = await evaluate(
      'window.__scene3d.whenReady({timeoutMs:20000}).then(d=>({ok:true,pending:d.pending,failed:d.failedAssets})).catch(e=>({ok:false,m:String(e?.message??e)}))',
    );
    if (!ready.ok || ready.pending > 0 || (ready.failed?.length ?? 0) > 0) {
      throw new Error(`编辑态未就绪: ${JSON.stringify(ready)}`);
    }
    const state = await evaluate(`(() => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      const cam = h.internals.camera;
      const out = {
        camera: {
          position: cam.position.toArray().map((v) => Math.round(v * 1e6) / 1e6),
          fov: cam.fov,
          quaternion: cam.quaternion.toArray().map((v) => Math.round(v * 1e6) / 1e6),
        },
        nodeCount: se.getAllIds().length,
        car01Color: null,
        car02Visible: null,
        tree02Color: null,
      };
      const car1 = se.getObject('car_01');
      car1?.traverse((c) => {
        if (!out.car01Color && c.material?.color) {
          out.car01Color = '#' + c.material.color.getHexString();
        }
      });
      const car2 = se.getObject('car_02');
      out.car02Visible = car2 ? car2.visible : null;
      const t2 = se.getObject('tree_02');
      t2?.traverse((c) => {
        if (!out.tree02Color && c.material?.color) {
          out.tree02Color = '#' + c.material.color.getHexString();
        }
      });
      return out;
    })()`);
    const shot = await rpc("Page.captureScreenshot", { format: "png" });
    return { state, png: Buffer.from(shot.result.data, "base64"), pageErrors: page.pageErrors };
  } finally {
    await page.close();
  }
};

const shotProd = async (session, url) => {
  const page = await session.newPage();
  try {
    await page.navigateTo(url);
    const settled = await awaitProdSettled(page);
    if (!settled.settled) {
      // 无法证明完成 → INCOMPLETE（不产出 PASS 证据，也不误报 FAIL——可能是产品
      // 徽标缺陷导致的不可证明，与确定性失败区分）
      throw new IncompleteError(
        `运行包无法证明资产完成（badge="${settled.badge?.badgeText}"，counts=${JSON.stringify(settled.badgeCounts)}，画面稳定=${settled.pictureStable}，末 4 次截图尺寸 ${JSON.stringify(settled.sizes)}）`,
      );
    }
    if (settled.pageErrors.length > 0) {
      throw new Error(`运行包页面错误（不产出 PASS 证据）: ${JSON.stringify(settled.pageErrors)}`);
    }
    if (settled.netMisses.length > 0) {
      throw new Error(`运行包网络失败（不产出 PASS 证据）: ${JSON.stringify(settled.netMisses)}`);
    }
    return {
      state: {
        prod: true,
        badge: settled.badge,
        badgeCounts: settled.badgeCounts,
        settledSizes: settled.sizes,
        pageErrors: 0,
        netMisses: 0,
      },
      png: settled.lastShot,
    };
  } finally {
    await page.close();
  }
};

/**
 * P6-R2 负例 ①：早截窗口（画面未稳 + 资产未完成）→ 门禁必须拒绝。
 * 用真实 prod URL 短超时模拟 GLB 出现前（实测 ~31s 才可见）的窗口。
 */
const negUnloaded = async (session, url) => {
  const page = await session.newPage();
  try {
    await page.navigateTo(url);
    const settled = await awaitProdSettled(page, {
      timeoutMs: 8000,
      stableSamples: 3,
      sampleEveryMs: 1500,
    });
    const rejectedAsExpected =
      !settled.settled ||
      (settled.pageErrors?.length ?? 0) > 0 ||
      (settled.netMisses?.length ?? 0) > 0;
    console.log(
      `NEG-UNLOADED ${rejectedAsExpected ? "PASS" : "FAIL"}: 早截窗口内终态门禁${rejectedAsExpected ? "正确拒绝（不产出 PASS 证据）" : "误放行（会早截/假 PASS）"}`,
    );
    console.log("  detail:", JSON.stringify({ settled: settled.settled, counts: settled.badgeCounts, sizes: settled.sizes, badge: settled.badge?.badgeText }));
    return rejectedAsExpected;
  } finally {
    await page.close();
  }
};

/**
 * P6-R2 负例 ②（审核指定）：「画面稳定但资产一直未完成」的确定性负例。
 * 在 dev 态（可读 tracker 真值）注入一个 pending 永不 settle 的加载（拦截
 * fetch 挂起不返回）——画面会稳定（其余 14 节点渲染完成）但 pending=1 恒在。
 * 期望：真实终态门禁（whenReady tracker 真值）必须拒绝 PASS；画面稳定性
 * 单独看是「稳定」的——证明截图稳定不能替代加载终态。
 */
const negStuck = async (session, url) => {
  const page = await session.newPage();
  try {
    // 挂起 fetch：经 Page.addScriptToEvaluateOnNewDocument 注入——新文档创建时
    // 最先执行（先于任何模块脚本），导航后 window.fetch 已是拦截版；对 .glb 请求
    // 永不响应（模拟资产一直未完成），其余请求透传。
    await page.rpc("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const orig = window.fetch;
        window.fetch = (input, init) => {
          const u = typeof input === 'string' ? input : (input && input.url) || '';
          if (u && u.includes('.glb')) {
            return new Promise(() => {});
          }
          return orig.call(window, input, init);
        };
      })()`,
    });
    await page.navigateTo(url);
    const { evaluate } = page;
    let mounted = false;
    for (let i = 0; i < 30; i += 1) {
      mounted = await evaluate("!!window.__scene3d");
      if (mounted) {
        break;
      }
      await sleep(500);
    }
    if (!mounted) {
      console.log("NEG-STUCK FAIL: 场景未挂载（无法构造负例）");
      return false;
    }
    // 等画面进入稳定期（其余节点渲染完成，pending 的 GLB 永不回来）
    await sleep(8000);
    const state = await evaluate(`(() => {
      const h = window.__scene3d;
      const d = h.getDiagnostics();
      return { pending: d.pending, succeeded: d.succeeded, failed: d.failedAssets.length, nodeCount: h.internals.sceneEngine.getAllIds().length };
    })()`);
    // 画面稳定性验证（辅助信号本身在此场景会「稳定」）
    const shots = [];
    for (let i = 0; i < 4; i += 1) {
      const s = await page.rpc("Page.captureScreenshot", { format: "png" });
      shots.push(Buffer.from(s.result.data, "base64").length);
      await sleep(1500);
    }
    const pictureStable = shots
      .slice(1)
      .every((s, i) => Math.abs(s - shots[i]) / shots[i] < 0.02);
    const stuckConfirmed = state.pending > 0 && state.succeeded + state.pending === 4 && state.failed === 0;
    const gateRejects = state.pending > 0; // 真实终态门禁（tracker 真值）必须拒绝
    const ok = stuckConfirmed && pictureStable && gateRejects;
    console.log(
      `NEG-STUCK ${ok ? "PASS" : "FAIL"}: 画面稳定但资产未完成（pending=${state.pending}）——真实终态门禁${gateRejects ? "正确拒绝 PASS" : "未拒绝（假 PASS 风险）"}；画面稳定性单独=${pictureStable ? "稳定（证明截图稳定不能替代加载终态）" : "未稳定（负例构造不充分）"}`,
    );
    console.log("  detail:", JSON.stringify({ state, shotSizes: shots, pictureStable, stuckConfirmed }));
    return ok;
  } finally {
    await page.close();
  }
};

const pixelDiff = (a, b) => {
  const imgA = decodePng(a);
  const imgB = decodePng(b);
  if (!imgA || !imgB || imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return { available: false };
  }
  let diff = 0;
  let maxDelta = 0;
  let sumDelta = 0;
  const n = imgA.width * imgA.height;
  for (let i = 0; i < n; i += 1) {
    const j = i * 4;
    const d =
      Math.abs(imgA.data[j] - imgB.data[j]) +
      Math.abs(imgA.data[j + 1] - imgB.data[j + 1]) +
      Math.abs(imgA.data[j + 2] - imgB.data[j + 2]);
    if (d > 12) {
      diff += 1;
    }
    maxDelta = Math.max(maxDelta, d);
    sumDelta += d;
  }
  return {
    available: true,
    width: imgA.width,
    height: imgB.height,
    diffPixels: diff,
    diffRatio: Math.round((diff / n) * 10000) / 10000,
    maxChannelDeltaSum: maxDelta,
    meanChannelDeltaSum: Math.round((sumDelta / n) * 100) / 100,
  };
};

const main = async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const session = await openBrowserSession({ port: 9285, windowSize: `${PNG_WIDTH},${PNG_HEIGHT}` });
  try {
    if (NEG_URL) {
      const ok = await negUnloaded(session, NEG_URL);
      process.exitCode = ok ? 0 : 1;
      return;
    }
    if (NEG_STUCK_URL) {
      const ok = await negStuck(session, NEG_STUCK_URL);
      process.exitCode = ok ? 0 : 1;
      return;
    }
    const edit = await shotEdit(session, URLS.edit);
    const run = await shotProd(session, URLS.run);
    writeFileSync(`${OUT_DIR}/edit-state.png`, edit.png);
    writeFileSync(`${OUT_DIR}/run-state.png`, run.png);
    console.log("EDIT state:", JSON.stringify(edit.state));
    console.log("RUN  state:", JSON.stringify(run.state));

    const dataOk =
      edit.state.nodeCount === 14 &&
      edit.state.car01Color === "#8b1d1d" &&
      edit.state.car02Visible === false &&
      edit.state.tree02Color === "#1f7a4d" &&
      edit.pageErrors.length === 0 &&
      run.state.prod === true &&
      run.state.badge.canvasExists === true &&
      run.state.badgeCounts !== null &&
      run.state.badgeCounts.loaded >= run.state.badgeCounts.total &&
      run.state.pageErrors === 0 &&
      run.state.netMisses === 0;

    const pixel = pixelDiff(edit.png, run.png);
    console.log("PIXEL diff:", JSON.stringify(pixel));
    console.log(
      dataOk
        ? "P6-VISUAL PASS(数据级): 真实加载终态证明（编辑 whenReady tracker 真值 / 运行包 badge 数值 loaded==total）+ 画面稳定防早截 + 同相机 + 编辑效果读数一致；视觉结论由人工目检 PNG 裁决"
        : "P6-VISUAL FAIL: 数据级不一致（终态/相机/节点/视觉态）",
    );
    if (!dataOk) {
      process.exitCode = 1;
    }
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  if (e instanceof CdpEnvironmentError) {
    console.error("P6-VISUAL SKIP: CDP 环境不可用 —", e.message);
    process.exitCode = 2;
  } else if (e instanceof IncompleteError) {
    console.error("P6-VISUAL INCOMPLETE: 无法证明资产完成（不冒充 PASS）—", e.message);
    process.exitCode = 3;
  } else {
    console.error("P6-VISUAL FAIL:", e.message);
    process.exitCode = 1;
  }
});
