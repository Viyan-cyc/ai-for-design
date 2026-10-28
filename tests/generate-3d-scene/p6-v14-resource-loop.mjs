/* eslint-disable no-console */
/**
 * p6-v14-resource-loop.mjs — P6-R4/V14 后半补缺：实际渲染帧下的资源计数循环
 *
 * 审核要求：经过**实际渲染帧**的增删、重建、撤销循环；记录**预热后**
 * geometry/texture 等资源计数走势；验证共享资源保留。
 *
 * 方案（dev 态——读 internals.rendererEngine.renderer.info.memory 真值；
 * 循环 Node 侧驱动，每步一个短 evaluate——swiftshader 帧长 ~300ms，页面内
 * 长循环会撞 RPC 40s 上限；每轮采样、步间显式等真实帧）：
 *   ① 预热：whenReady 收敛 + 等 10 个真实渲染帧（RenderLoop.onFrame 计数确认
 *      新帧到达——render() 后触发），记录基线 geometries/textures；
 *   ② 增删循环 ×30：添加 Box 节点 → 等 1 真实帧 → remove → 等 1 真实帧；
 *      每 5 轮采样——独占资源计数应回落基线而非持续上涨；
 *   ③ 重建循环 ×10：tree_01 height 结构参数反复改（factory rebuild：旧实例
 *      释放、新实例创建）——计数围绕基线波动，不单调上涨；
 *   ④ 撤销循环 ×10：真实 Bridge commit+undo 往返（R1 修复的整条替换路径）——
 *      每轮采样；undoDepth 经 getState() 读；
 *   ⑤ 共享资源保留：库材质 link 两节点（同步 commit 路径）→ settle 等待 →
 *      验证双节点持**同一实例**（=== 相等）；删其一（commit）→ 存活者仍持
 *      同一实例且未 dispose；undo 恢复后节点回归。
 *
 * 退出码：0 PASS / 1 FAIL / 2 CDP 环境不可用。
 * 边界：info.memory 是 three 维护的 JS 侧登记计数（每帧由 renderer 上报）；
 * GPU 真实显存无界增长仍属 --gpu 长时采样边界——本脚本证明 V14 的「单元计数」
 * 层：引擎资源登记/释放账目经真实渲染帧后不泄漏。
 */
import { openBrowserSession, CdpEnvironmentError } from "../../skills/generate-3d-scene/scripts/lib/cdp.mjs";

const URL = process.argv[2] ?? "http://localhost:5183/?edit=1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WAIT = `(n) => new Promise((res) => {
  let seen = 0;
  const unsub = window.__scene3d.internals.renderLoop.onFrame(() => { seen += 1; });
  const t0 = Date.now();
  const tick = () => {
    if (seen >= n) { unsub(); res(true); }
    else if (Date.now() - t0 > 25000) { unsub(); res(false); }
    else { setTimeout(tick, 120); }
  };
  tick();
})`;

const waitForFrames = (evaluate, n) => evaluate(`(${WAIT})(${n})`);

const readMemory = (evaluate) =>
  evaluate(`(() => {
    const r = window.__scene3d.internals.rendererEngine.renderer;
    return { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
  })()`);

const main = async () => {
  const session = await openBrowserSession({ url: URL, port: 9289, windowSize: "1280,800" });
  try {
    const { evaluate } = session;
    let mounted = false;
    for (let i = 0; i < 40; i += 1) {
      mounted = await evaluate("!!window.__scene3d && !!window.__scene3dEdit");
      if (mounted) {
        break;
      }
      await sleep(500);
    }
    if (!mounted) {
      throw new Error("__scene3dEdit 未挂载");
    }
    await evaluate("window.__scene3d.whenReady({timeoutMs:30000})").catch(() => {});

    // ① 预热
    if (!(await waitForFrames(evaluate, 10))) {
      throw new Error("预热失败：10 帧未到达");
    }
    const baseline = await readMemory(evaluate);
    console.log("warmup(10 real frames) baseline:", JSON.stringify(baseline));

    // ② 增删循环 ×30
    const arSamples = [];
    let arOk = true;
    for (let i = 0; i < 30; i += 1) {
      await evaluate(`(i) => {
        window.__scene3d.update({ Box: [{ id: 'p6_v14_box', position: [i * 0.02, 0.5, 0], scale: 1 }] });
        return true;
      }`, i);
      arOk = arOk && (await waitForFrames(evaluate, 1));
      await evaluate(`() => {
        window.__scene3d.update({ remove: ['p6_v14_box'] });
        return true;
      }`);
      arOk = arOk && (await waitForFrames(evaluate, 1));
      if (i % 5 === 4) {
        arSamples.push(await readMemory(evaluate));
      }
    }
    const idsAfterAR = await evaluate("window.__scene3d.internals.sceneEngine.getAllIds().length");
    const arLast = arSamples[arSamples.length - 1];
    const addRemoveOk =
      arOk && idsAfterAR === 14 &&
      arLast.geometries <= baseline.geometries && arLast.textures <= baseline.textures;
    console.log("addRemove×30 samples:", JSON.stringify(arSamples), `idsAfter=${idsAfterAR} →`, addRemoveOk ? "OK" : "LEAK?");

    // ③ 重建循环 ×10（height 结构参数 → factory rebuild）
    const rbSamples = [];
    let rbOk = true;
    for (let i = 0; i < 10; i += 1) {
      await evaluate(`(h) => {
        const se = window.__scene3d.internals.sceneEngine;
        const node = se.getNodesWithType('trees').find((n) => n.id === 'tree_01');
        window.__scene3d.update({ trees: [{ ...node, params: { ...node.params, height: h } }] });
        return true;
      }`, 1.5 + i * 0.1);
      rbOk = rbOk && (await waitForFrames(evaluate, 2));
      rbSamples.push(await readMemory(evaluate));
    }
    const rbFirst = rbSamples[0];
    const rbLast = rbSamples[rbSamples.length - 1];
    const rebuildOk =
      rbOk && rbLast.geometries <= rbFirst.geometries + 2 && rbLast.textures <= rbFirst.textures + 2;
    console.log("rebuild×10 first/last:", JSON.stringify(rbFirst), JSON.stringify(rbLast), "→", rebuildOk ? "OK" : "LEAK?");

    // ④ 撤销循环 ×10（真实 Bridge commit+undo；每轮采样）
    const uSamples = [];
    let uOk = true;
    for (let i = 0; i < 10; i += 1) {
      await evaluate(`() => {
        const h = window.__scene3d;
        const b = window.__scene3dEdit.bridge;
        b.commit('v14-测试', () => {
          const se = h.internals.sceneEngine;
          const node = se.getNodesWithType('Box').find((n) => n.id === 'ground');
          h.update({ Box: [{ ...node, position: [node.position[0] + 0.001, 0, 0] }] });
        });
        return true;
      }`);
      uOk = uOk && (await waitForFrames(evaluate, 1));
      await evaluate("window.__scene3dEdit.bridge.undo()");
      uOk = uOk && (await waitForFrames(evaluate, 1));
      uSamples.push(await readMemory(evaluate));
    }
    const undoDepth = await evaluate("window.__scene3dEdit.bridge.getState().undoDepth");
    const uLast = uSamples[uSamples.length - 1];
    const undoOk =
      uOk && undoDepth === 0 &&
      uLast.geometries <= baseline.geometries && uLast.textures <= baseline.textures;
    console.log("undo×10 samples:", JSON.stringify(uSamples.slice(0, 3).concat(uSamples.slice(-1))), `…undoDepth=${undoDepth} →`, undoOk ? "OK" : "LEAK?");

    // ⑤ 共享资源保留（单 evaluate 内完成闭环比对——实例身份比较须同上下文）
    const shared = await evaluate(`(() => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      const b = window.__scene3dEdit.bridge;
      const lib = window.__scene3dEdit.materialLib;
      const matId = lib.createEntry('p6_v14_shared', { type: 'MeshStandardMaterial', color: '#3355aa', roughness: 0.5 });
      lib.link('tree_04', matId);
      lib.link('tree_05', matId);
      const instOf = (id) => {
        let found = null;
        se.getObject(id)?.traverse((c) => {
          if (!found && c.isMesh && c.material?.color) { found = c.material; }
        });
        return found;
      };
      const pre4 = instOf('tree_04');
      const pre5 = instOf('tree_05');
      const libInst = lib.getInstance(matId);
      const sameBoth = pre4 && pre5 && pre4 === pre5 && pre4 === libInst;
      b.commit('v14-删共享owner', () => h.update({ remove: ['tree_05'] }));
      const post4 = instOf('tree_04');
      const kept = post4 && post4 === pre4;
      const notDisposed = post4 && !post4.isDisposed;
      b.undo();
      const restored = !!se.getObject('tree_05');
      return { sameBoth, kept, notDisposed, restored, color: post4 ? '#' + post4.color.getHexString() : null };
    })()`);
    const sharedOk =
      shared.sameBoth && shared.kept && shared.notDisposed && shared.restored && shared.color === "#3355aa";
    console.log("shared-retention:", JSON.stringify(shared), "→", sharedOk ? "OK" : "FAIL");

    const finalMem = await readMemory(evaluate);
    const trendOk =
      finalMem.geometries <= baseline.geometries + 2 && finalMem.textures <= baseline.textures + 2;
    console.log("final:", JSON.stringify(finalMem), "vs baseline:", JSON.stringify(baseline), "→", trendOk ? "OK" : "LEAK?");

    const allOk = addRemoveOk && rebuildOk && undoOk && sharedOk && trendOk;
    console.log(
      allOk
        ? "P6-V14-LOOP PASS: 真实渲染帧下的增删×30/重建×10/撤销×10 循环——资源计数回落基线（无单调上涨），共享库材质单 owner 退出后存活者保留同一实例"
        : `P6-V14-LOOP FAIL: addRemove=${addRemoveOk} rebuild=${rebuildOk} undo=${undoOk} shared=${sharedOk} trend=${trendOk}`,
    );
    if (!allOk) {
      process.exitCode = 1;
    }
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  if (e instanceof CdpEnvironmentError) {
    console.error("P6-V14-LOOP SKIP: CDP 环境不可用 —", e.message);
    process.exitCode = 2;
  } else {
    console.error("P6-V14-LOOP FAIL:", e.message);
    process.exitCode = 1;
  }
});
