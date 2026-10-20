/* eslint-disable no-console */
/**
 * p6-asset-heavy.mjs — P6-R4 补缺：asset-heavy 场景端到端（§4.4 fixture 合同）
 *
 * 复用既有设施（不新造大型场景）：demo 场景含 4 个 GLB 节点（example×3 同资产
 * 多实例 + person 蒙皮）。本脚本在浏览器级补三项此前仅 Node 级覆盖的断言：
 *   ① V12 多实例隔离：example_01/car_01 同资产（example.glb）——给 car_01 打内联
 *      改色后 example_01 材质不变（缓存根共享但克隆隔离）；蒙皮 person_01 的
 *      SkeletonUtils.clone 尺度正常（S48 已有 Node 级，此处读实例高度交叉验证）；
 *   ② V04 浏览器级失败注入：对运行中场景喂一个 assetId=missing 的节点 →
 *      whenReady/诊断出现 failedAssets（ready=failed 语义），随后 remove 收敛；
 *   ③ 100 次增删稳定性（V14 前半）：连续 100 轮 add+update+remove 一个 Box 节点，
 *      每轮后引擎 id 计数稳定、无页面错误（GPU memory 无界增长观测属 --gpu 长时
 *      采样，此处只做 JS 侧稳定性——GPU 侧保持未验证边界）。
 */
import { openBrowserSession, CdpEnvironmentError } from "../lib/cdp.mjs";

const URL = process.argv[2] ?? "http://localhost:5183/?edit=1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const session = await openBrowserSession({ url: URL, port: 9287, windowSize: "1280,800" });
  try {
    const { evaluate } = session;
    let mounted = false;
    for (let i = 0; i < 30; i += 1) {
      mounted = await evaluate("!!window.__gts3d && !!window.__gts3dEdit");
      if (mounted) {
        break;
      }
      await sleep(500);
    }
    if (!mounted) {
      throw new Error("__gts3dEdit 未挂载");
    }
    await evaluate("window.__gts3d.whenReady({timeoutMs:20000})").catch(() => {});

    // ① V12 多实例隔离 + 蒙皮尺度
    const isolation = await evaluate(`(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      const before = {};
      for (const id of ['example_01', 'car_01']) {
        const obj = se.getObject(id);
        let n = 0; let color = null; let meshes = 0;
        obj?.traverse((c) => { if (c.isMesh) { meshes += 1; } n += 1; });
        color = (() => { let cc = null; obj?.traverse((c) => { if (!cc && c.isMesh && c.material?.color) cc = '#' + c.material.color.getHexString(); }); return cc; })();
        before[id] = { children: n, meshes, color };
      }
      // 蒙皮实例尺度（person_01 scale=0.0056 归一化后高度应≈1——S48 口径）
      const p = se.getObject('person_01');
      const box = new THREE.Box3().setFromObject(p);
      const height = box.max.y - box.min.y;
      before.personHeight = Math.round(height * 1000) / 1000;
      return before;
    })()`);
    console.log("isolation-before:", JSON.stringify(isolation));

    const afterEdit = await evaluate(`(() => {
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      // car_01 打内联改色（扁平字段——UI 生产链路形态）
      se.applyVisual('car_01', { materialType: 'MeshStandardMaterial', color: '#8b1d1d', roughness: 0.4 });
      const read = (id) => {
        let cc = null;
        se.getObject(id)?.traverse((c) => { if (!cc && c.isMesh && c.material?.color) cc = '#' + c.material.color.getHexString(); });
        return cc;
      };
      return { car01: read('car_01'), example01: read('example_01') };
    })()`);
    console.log("isolation-after:", JSON.stringify(afterEdit));

    const isolationOk =
      afterEdit.car01 === "#8b1d1d" &&
      afterEdit.example01 === isolation.example_01.color &&
      isolation.personHeight > 0.5 &&
      isolation.personHeight < 1.5;

    // ② V04 浏览器级失败注入：assetId 缺失节点 → failed
    const failureInject = await evaluate(`(async () => {
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      h.update({ examples: [{ id: 'p6_missing_asset', position: [3, 0.5, 3], params: { assetId: 'p6_no_such_asset' } }] });
      const d = await h.whenReady({ timeoutMs: 10000 }).then(x => ({ ok: true, d: x })).catch(e => ({ ok: false, m: String(e?.message ?? e) }));
      const failed = !d.ok || (d.d?.failedAssets?.length ?? 0) > 0;
      // remove 收敛（删除后 tracker 回到无 pending）
      h.update({ remove: ['p6_missing_asset'] });
      const d2 = await h.whenReady({ timeoutMs: 10000 }).then(x => ({ ok: true, d: x })).catch(e => ({ ok: false, m: String(e?.message ?? e) }));
      const recovered = d2.ok && d2.d.pending === 0;
      return { failed, failedAssets: d.d?.failedAssets ?? d.m, recovered, pendingAfterRemove: d2.d?.pending };
    })()`);
    console.log("failure-inject:", JSON.stringify(failureInject));
    const failureOk = failureInject.failed && failureInject.recovered;

    // ③ V14 前半：100 轮增删稳定性
    const stability = await evaluate(`(async () => {
      const h = window.__gts3d;
      let last = null;
      for (let i = 0; i < 100; i += 1) {
        h.update({ Box: [{ id: 'p6_stress_box', position: [i * 0.01, 0.5, 0], scale: 1 + (i % 7) * 0.1 }] });
        h.update({ remove: ['p6_stress_box'] });
        last = h.internals.sceneEngine.getAllIds().length;
      }
      const d = await h.whenReady({ timeoutMs: 10000 }).then(x => ({ ok: true, pending: x.pending })).catch(e => ({ ok: false, m: String(e?.message ?? e) }));
      return { rounds: 100, idsAfter: last, settled: d.ok && d.pending === 0 };
    })()`);
    console.log("stability-100:", JSON.stringify(stability));
    const stabilityOk = stability.settled && stability.idsAfter === 14 && session.pageErrors.length === 0;

    console.log(
      isolationOk && failureOk && stabilityOk
        ? "P6-ASSET-HEAVY PASS: 多实例隔离(V12)+失败注入(V04)+100轮增删稳定(V14前半)"
        : `P6-ASSET-HEAVY FAIL: isolation=${isolationOk} failure=${failureOk} stability=${stabilityOk} pageErrors=${JSON.stringify(session.pageErrors)}`,
    );
    if (!(isolationOk && failureOk && stabilityOk)) {
      process.exitCode = 1;
    }
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  if (e instanceof CdpEnvironmentError) {
    console.error("P6-ASSET-HEAVY SKIP: CDP 环境不可用 —", e.message);
    process.exitCode = 2;
  } else {
    console.error("P6-ASSET-HEAVY FAIL:", e.message);
    process.exitCode = 1;
  }
});
