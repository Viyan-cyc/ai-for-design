/* eslint-disable no-console */
/**
 * p6-reload-check.mjs — P6-A 重载语义核验：编辑定稿保存后重新打开编辑态页面，
 * 核对全部编辑效果恢复（移动/改色/隐藏/库引用/复制节点），且序列化往返稳定。
 */
import { openBrowserSession, CdpEnvironmentError } from "../lib/cdp.mjs";

const URL = process.argv[2] ?? "http://localhost:5183/?edit=1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const session = await openBrowserSession({ url: URL, port: 9283 });
  try {
    const { evaluate } = session;
    let mounted = false;
    for (let i = 0; i < 20; i += 1) {
      mounted = await evaluate("!!window.__gts3dEdit");
      if (mounted) {
        break;
      }
      await sleep(500);
    }
    if (!mounted) {
      console.log("P6-RELOAD FAIL: __gts3dEdit 未挂载");
      process.exitCode = 1;
      return;
    }
    const ready = await evaluate(
      'window.__gts3d.whenReady({timeoutMs:15000}).then(d=>({ok:true,pending:d.pending})).catch(e=>({ok:false,m:String(e?.message??e)}))',
    );
    if (!ready.ok || ready.pending > 0) {
      console.log(`P6-RELOAD FAIL: 场景未就绪 ${JSON.stringify(ready)}`);
      process.exitCode = 1;
      return;
    }

    const r = await evaluate(`(() => {
      const { bridge, materialLib } = window.__gts3dEdit;
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      const out = {};
      // ① tree_01 移动后位置（期望 -5.5, 0, -4）
      const tree = se.getNodesWithType('trees').find(n => n.id === 'tree_01');
      out.tree01Position = tree ? tree.position.slice() : null;
      // ② 复制节点存在
      out.hasCopy = se.getAllIds().includes('tree_03_copy_001');
      out.treesCount = se.getNodesWithType('trees').length;
      // ③ car_01 改色实际生效（对象材质颜色）
      const carObj = se.getObject('car_01');
      let carColor = null;
      carObj?.traverse((c) => {
      if (!carColor && c.material?.color) {
        carColor = '#' + c.material.color.getHexString();
      }
    });
      out.car01Color = carColor;
      // ④ car_02 隐藏实际生效
      const car2 = se.getObject('car_02');
      out.car02Visible = car2 ? car2.visible : null;
      // ⑤ tree_02 库引用挂载（材质来自共享实例）
      const t2obj = se.getObject('tree_02');
      let t2color = null;
      t2obj?.traverse((c) => {
      if (!t2color && c.material?.color) {
        t2color = '#' + c.material.color.getHexString();
      }
    });
      out.tree02Color = t2color;
      out.tree02Lib = se.getVisual('tree_02')?.libraryRef ?? null;
      out.matLibHas001 = !!materialLib.getEntry('mat_001');
      // ⑥ 序列化往返稳定
      const data = h.serialize();
      out.roundTrip = {
        trees: data.trees.length,
        visuals: Object.keys(data.__visuals ?? {}).length,
        materialLib: Object.keys(data.__materialLib ?? {}).length,
      };
      return out;
    })()`);

    console.log("P6-RELOAD detail:", JSON.stringify(r, null, 1));
    const ok =
      JSON.stringify(r.tree01Position) === JSON.stringify([-5.5, 0, -4]) &&
      r.hasCopy === true &&
      r.treesCount === 6 &&
      r.car01Color === "#8b1d1d" &&
      r.car02Visible === false &&
      r.tree02Lib === "mat_001" &&
      r.matLibHas001 === true &&
      r.tree02Color === "#1f7a4d" &&
      r.roundTrip.trees === 6 &&
      r.roundTrip.visuals === 3 &&
      r.roundTrip.materialLib === 5;
    console.log(ok ? "P6-RELOAD PASS" : "P6-RELOAD FAIL");
    if (!ok) {
      process.exitCode = 1;
    }
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  if (e instanceof CdpEnvironmentError) {
    console.error("P6-RELOAD SKIP: CDP 环境不可用 —", e.message);
    process.exitCode = 2;
  } else {
    console.error("P6-RELOAD ERROR:", e.message);
    process.exitCode = 1;
  }
});
