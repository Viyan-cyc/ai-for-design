/* eslint-disable no-console */
/**
 * p6-edit-save.mjs — P6-A 编辑定稿：在编辑态页面经真实编辑器服务做一组编辑
 * （改色入材质库 + 移动 + 显隐 + 复制），serialize 后落盘回写工程 scene-data.json。
 * 模拟用户「编辑调优 → 保存」的生产链路（SaveService.save 的数据同一来源：handle.serialize）。
 */
import { openBrowserSession, CdpEnvironmentError } from "../../skills/generate-3d-scene/scripts/lib/cdp.mjs";
import { writeFileSync } from "node:fs";

const URL = process.argv[2] ?? "http://localhost:5183/?edit=1";
const OUT = process.argv[3] ?? "C:/Users/Tony/Documents/Codex/2026-10-13/zuo/work/p6/p6-demo/public/scene-data.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const session = await openBrowserSession({ url: URL, port: 9281 });
  try {
    const { evaluate } = session;
    // 等挂载
    let mounted = false;
    for (let i = 0; i < 20; i += 1) {
      mounted = await evaluate("!!window.__scene3dEdit");
      if (mounted) {
        break;
      }
      await sleep(500);
    }
    if (!mounted) {
      console.log("P6-EDIT FAIL: __scene3dEdit 未挂载");
      process.exitCode = 1;
      return;
    }
    const ready = await evaluate(
      'window.__scene3d.whenReady({timeoutMs:15000}).then(d=>({ok:true,pending:d.pending})).catch(e=>({ok:false,m:String(e?.message??e)}))',
    );
    if (!ready.ok || ready.pending > 0) {
      console.log(`P6-EDIT FAIL: 场景未就绪 ${JSON.stringify(ready)}`);
      process.exitCode = 1;
      return;
    }

    // ① 编辑器服务真实操作：选中 tree_01 → 属性面板式改色（经 Bridge patchVisual/材质库）
    const r = await evaluate(`(() => {
      const { bridge, materialLib } = window.__scene3dEdit;
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      const out = {};

      // 1) tree_01 位置移动（编辑器 transform 语义：update fragment）
      const tree = se.getNodesWithType('trees').find(n => n.id === 'tree_01');
      out.treeBefore = { position: tree.position.slice() };
      h.update({ trees: [{ ...tree, position: [tree.position[0] + 1.5, tree.position[1], tree.position[2] + 1] }] });
      const treeAfter = se.getNodesWithType('trees').find(n => n.id === 'tree_01');
      out.treeAfter = { position: treeAfter.position.slice() };

      // 2) car_01 内联改色（UI 生产链路同款形状：EditMaterialModal → specToInline →
      //    replaceVisual 扁平字段；嵌套 material 非合同形态会被静默跳过）
      se.applyVisual('car_01', { materialType: 'MeshStandardMaterial', color: '#8b1d1d', roughness: 0.4 });
      const vis = se.getAllVisuals();
      out.carVisual = { color: vis.car_01?.color, roughness: vis.car_01?.roughness };

      // 3) car_02 隐藏（视觉层显隐）
      se.patchVisual('car_02', { visible: false });
      out.car02Visible = se.getAllVisuals().car_02?.visible ?? null;

      // 4) 材质库建条目并引用（UI 生产链路同款：createEntry + link）
      const matId = materialLib.createEntry('p6_green', { type: 'MeshStandardMaterial', color: '#1f7a4d', roughness: 0.6, metalness: 0.2 });
      materialLib.link('tree_02', matId);
      out.tree02Lib = se.getAllVisuals().tree_02?.libraryRef ?? null;

      // 5) 复制（编辑器 Ctrl+D 同链路 bridge.duplicateObject）
      bridge.select(['tree_03']);
      const dup = bridge.duplicateObject('tree_03');
      out.duplicated = dup ?? null;
      out.totalIds = se.getAllIds().length;

      // 6) 序列化（SaveService.save 同一数据源）
      const data = h.serialize();
      out.hasVisuals = Object.keys(data.__visuals ?? {}).length;
      out.hasMaterialLib = Object.keys(data.__materialLib ?? {}).length;
      out.treesCount = data.trees.length;
      out.serialized = data;
      return out;
    })()`);

    if (!r || typeof r !== "object") {
      console.log("P6-EDIT FAIL: evaluate 无返回");
      process.exitCode = 1;
      return;
    }
    const { serialized, ...summary } = r;
    console.log("P6-EDIT summary:", JSON.stringify(summary, null, 1));

    // 校验编辑效果核心断言
    const ok =
      summary.treeAfter.position[0] - summary.treeBefore.position[0] > 1 &&
      summary.carVisual?.color === "#8b1d1d" &&
      summary.carVisual?.roughness === 0.4 &&
      summary.car02Visible === false &&
      typeof summary.tree02Lib === "string" &&
      typeof summary.duplicated === "string" &&
      summary.hasVisuals >= 3 &&
      summary.hasMaterialLib >= 1 &&
      summary.treesCount === 6;
    if (!ok) {
      console.log("P6-EDIT FAIL: 编辑效果断言未全部满足");
      process.exitCode = 1;
      return;
    }

    // 回写工程（编辑保存定稿）
    writeFileSync(OUT, `${JSON.stringify(serialized, null, 2)}\n`);
    console.log(`P6-EDIT PASS: 编辑定稿已保存 → ${OUT}`);
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  if (e instanceof CdpEnvironmentError) {
    console.error("P6-EDIT SKIP: CDP 环境不可用 —", e.message);
    process.exitCode = 2;
  } else {
    console.error("P6-EDIT ERROR:", e.message);
    process.exitCode = 1;
  }
});
