/**
 * smoke-structural.mjs — 结构化冒烟（仅维护或明确请求诊断时运行）
 *
 * 断言（全部数值型，无需看图）：
 *   ① 场景图 JSON：__gts3d 挂载 / 分组数与各组物体数（读 scene-data.json 期望值）
 *      / 相机存在 / GLB 资产加载完成计数（徽标 N=M 收敛）
 *   ② canvas 像素统计：renderLoop.getStats().fps > 0（swiftshader 下 drawImage
 *      拿不到 WebGL 前缓冲，像素法不可靠——以渲染循环活性为准，smoke-r S1 同口径）
 *   ③ 零 unhandled rejection / 零页面异常：Runtime.exceptionThrown + Log.entryAdded
 *      （error 级）全监听，出现即 FAIL
 *
 * 连接层已迁移 scripts/lib/cdp.mjs（P1）：预检 5s 硬 deadline、RPC timer 成功即清、
 * finally 先关 ws 再杀进程。CLI 与退出码不变。
 *
 * 用法：node smoke-structural.mjs [url] [--edit] [--expect <scene-data.json 路径>]
 *   url 默认 http://localhost:5199/；--expect 不给时用 skill template 的 scene-data.json
 *   退出码：0 PASS / 1 FAIL / 2 环境不可用（CDP 起不来 → 按"无头环境预检不过转人工"处理）
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowserSession, positionalArg, collectPageErrors, CdpEnvironmentError } from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');

const argv = process.argv.slice(2);
const EDIT = argv.includes('--edit');
const URL_ARG = positionalArg(argv) ?? 'http://localhost:5199/';
const PAGE = EDIT ? `${URL_ARG}?edit=1` : URL_ARG;
const expectIdx = argv.indexOf('--expect');
const EXPECT_PATH = expectIdx >= 0 ? argv[expectIdx + 1]
  : join(SKILL_ROOT, 'template', 'public', 'scene-data.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 期望分组物体数（数据层期望，非场景渲染期望——GLB 节点是 1 场景节点对 1 数据节点）
// lights/camera/controls/renderer 等保留 key 是舞台配置不进场景图（SceneEngine 只收物体节点）
const SCENE_KEYS = new Set(['lights', 'camera', 'controls', 'renderer', 'environment', 'remove']);
const readExpect = () => {
  if (!existsSync(EXPECT_PATH)) {
    throw new Error(`expect 文件不存在: ${EXPECT_PATH}`);
  }
  const data = JSON.parse(readFileSync(EXPECT_PATH, 'utf8'));
  const groups = {};
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v) && !SCENE_KEYS.has(k) && !k.startsWith('__')) {
      groups[k] = v.length;
    }
  }
  return { groups, meta: data.meta?.name ?? '' };
};

const main = async () => {
  const expect = readExpect();
  const expectTotal = Object.values(expect.groups).reduce((a, b) => a + b, 0);

  let session;
  try {
    session = await openBrowserSession({
      url: PAGE,
      port: 9227,
    });
  } catch (e) {
    if (e instanceof CdpEnvironmentError) {
      console.error('CDP 不可用（环境预检不过）→ 转人工验证清单');
      process.exit(2);
    }
    throw e;
  }

  const pageErrors = collectPageErrors(session);
  try {
    await session.rpc('Runtime.enable');
    await session.rpc('Log.enable');
    const { evaluate } = session;

    // 4. 等场景初始化（__gts3d 挂载轮询）
    let mounted = false;
    for (let i = 0; i < 10; i += 1) {
      mounted = await evaluate('!!window.__gts3d');
      if (mounted) {
        break;
      }
      await sleep(700);
    }
    if (!mounted) {
      console.log('STRUCT FAIL: __gts3d 未挂载');
      process.exitCode = 1;
      return;
    }
    // P5.1：GLB 收敛改 whenReady 终态驱动（新模板）；旧模板回退徽标轮询
    //   ——固定 sleep(2500) 在快加载场景白等、慢加载场景不够，两头都不是正确口径
    const hasReady = await evaluate('typeof window.__gts3d?.whenReady === "function"');
    if (hasReady) {
      const ready = await evaluate('window.__gts3d.whenReady({timeoutMs:15000})'
        + '.then(d=>({ok:true,pending:d.pending,failed:d.failedAssets.length})).catch(e=>({ok:false,message:String(e?.message??e)}))');
      if (!ready.ok || ready.pending > 0 || ready.failed > 0) {
        console.log(`STRUCT FAIL: 加载未收敛（${ready.message ?? `pending=${ready.pending} failed=${ready.failed}`}）`);
        process.exitCode = 1;
        return;
      }
    }

    // ① 场景图 JSON 断言
    const graph = await evaluate(`(() => {
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      const ids = se.getAllIds();
      const groups = {};
      for (const id of ids) {
        const t = se.getNodeType(id);
        groups[t] = (groups[t] ?? 0) + 1;
      }
      return { total: ids.length, groups, camera: !!h.internals.camera };
    })()`);

    const expectedGroups = Object.keys(expect.groups);
    const groupMatch = expectedGroups.every((g) => (graph.groups[g] ?? 0) === expect.groups[g])
      && graph.total === expectTotal;

    // GLB 加载收敛（轮询徽标终态：无徽标或隐藏 = N=M）
    let badgeDone = false;
    for (let i = 0; i < 15; i += 1) {
      badgeDone = await evaluate(`(() => {
        const badge = document.querySelector('.gts3d-load-badge');
        return !badge || badge.style.display === 'none';
      })()`);
      if (badgeDone) {
        break;
      }
      await sleep(600);
    }
    const glbLoaded = { badgeDone };

    // ② 渲染循环活性（fps > 0 即在真实渲染）
    const stats = await evaluate('window.__gts3d.internals.renderLoop.getStats()');

    // 7. ③ 零 rejection 断言（全监听窗口内）
    const noRejection = pageErrors.length === 0;

    // 8. 判定
    const r1 = groupMatch;
    const r2 = graph.camera === true;
    const r3 = glbLoaded.badgeDone === true;
    const r4 = stats.fps > 0;
    const r5 = noRejection;
    console.log(`① 场景图: total=${graph.total}/${expectTotal} groups=${JSON.stringify(graph.groups)} expect=${JSON.stringify(expect.groups)} → ${r1 ? 'PASS' : 'FAIL'}`);
    console.log(`   相机存在: ${r2 ? 'PASS' : 'FAIL'} / GLB 加载收敛: ${r3 ? 'PASS' : 'FAIL'}`);
    console.log(`② 渲染活性: fps=${stats.fps} calls=${stats.calls} triangles=${stats.triangles} → ${r4 ? 'PASS' : 'FAIL'}`);
    console.log(`③ 零 rejection: ${r5 ? 'PASS' : 'FAIL'}${r5 ? '' : `（${pageErrors.length} 条：${pageErrors.slice(0, 3).join(' | ')}）`}`);
    const pass = r1 && r2 && r3 && r4 && r5;
    console.log(pass ? 'STRUCT PASS' : 'STRUCT FAIL');
    process.exitCode = pass ? 0 : 1;
  } finally {
    await session.close();
  }
};

main().catch((e) => {
  console.error('STRUCT ERROR:', e.message);
  process.exit(1);
});
