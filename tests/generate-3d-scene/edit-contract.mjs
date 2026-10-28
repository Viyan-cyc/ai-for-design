/* eslint-disable no-console -- CLI 输出接口 */
/**
 * edit-contract.mjs — 编辑行为契约回归（release 档 editRegression 的行为级段）
 *
 * P5-RRR3 + P5-RRRR2：**真实编辑往返**（验证操作效果，非只查计数）：
 *   ① 取场景首个业务节点的**当前原值**（visible 状态 + transform）；
 *   ② 经 SceneEngine 公开 API 做一次**与原值不同的修改**（patchVisual visible 取反
 *      + transform 平移一个非零 delta）；
 *   ③ **效果验证**：读回引擎状态确认修改生效（visible 翻转、position 变化），
 *      读实际对象属性（object.visible）交叉验证——no-op patch 在此暴露；
 *   ④ **序列化**：真实调用 handle.serialize()（编辑态保存链路），核对序列化结果
 *      含修改后的值（丢字段在此暴露）；
 *   ⑤ **恢复往返**：以序列化结果回灌（模拟保存/重载语义的核心——数据出引擎再
 *      进引擎），清空节点后回灌快照，核对节点与实际对象状态一致。
 * 失败不可吞掉：任一步异常/值不符 → exit 1（带哪一步失败的明细）。
 *
 * 用法：node edit-contract.mjs <url> [--expect <scene-data.json>]
 *   退出码：0 PASS / 1 契约失败 / 2 环境不可用（CDP/挂载）
 */
import { verifyEditRoundTrip } from "./edit-contract-core.mjs";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openBrowserSession,
  positionalArg,
  CdpEnvironmentError,
} from "../../skills/generate-3d-scene/scripts/lib/cdp.mjs";

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
const SCENE_KEYS = new Set([
  "lights",
  "camera",
  "controls",
  "renderer",
  "environment",
  "remove",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argv = process.argv.slice(2);
const URL_ARG = positionalArg(argv) ?? "http://localhost:5199/";
const expectIdx = argv.indexOf("--expect");
const EXPECT_PATH =
  expectIdx >= 0
    ? argv[expectIdx + 1]
    : join(SKILL_ROOT, "template", "public", 'scene3d', "scene-data.json");

const main = async () => {
  if (!existsSync(EXPECT_PATH)) {
    console.error(`[edit-contract] expect 文件不存在: ${EXPECT_PATH}`);
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(EXPECT_PATH, "utf8"));
  const groups = Object.entries(data).filter(
    ([k, v]) => Array.isArray(v) && !SCENE_KEYS.has(k) && !k.startsWith("__"),
  );
  if (groups.length === 0) {
    console.error("[edit-contract] 场景无业务分组（空场景无编辑契约可验）");
    process.exit(2);
  }

  let session;
  try {
    session = await openBrowserSession({
      url: `${URL_ARG}?edit=1`,
      port: 9237,
    });
  } catch (e) {
    if (e instanceof CdpEnvironmentError) {
      console.error("CDP 不可用 → 编辑契约转人工");
      process.exit(2);
    }
    throw e;
  }

  try {
    const { evaluate } = session;
    // 等挂载
    const deadline = Date.now() + 10000;
    let mounted = false;
    do {
      mounted = await evaluate("!!window.__scene3d && !!window.__scene3dEdit");
      if (mounted) {
        break;
      }
      await sleep(200);
    } while (Date.now() < deadline);
    if (!mounted) {
      console.log("EDIT-CONTRACT FAIL [mount]: 编辑态未挂载");
      process.exitCode = 1;
      return;
    }
    const result = await evaluate(
      `(${verifyEditRoundTrip.toString()})(window.__scene3d)`,
    );
    console.log(
      `EDIT-CONTRACT PASS: ${JSON.stringify(result)}; serialize/clear/reload verified`,
    );
    process.exitCode = 0;
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  console.error("EDIT-CONTRACT ERROR:", e.message);
  process.exit(1);
});
