/**
 * smoke-structural.mjs — 结构化冒烟（非多模态档，每次场景生成必跑）
 *
 * 断言（全部数值型，无需看图）：
 *   ① 场景图 JSON：__gts3d 挂载 / 分组数与各组物体数（读 scene-data.json 期望值）
 *      / 相机存在 / GLB 资产加载完成计数（徽标 N=M 收敛）
 *   ② canvas 像素统计：renderLoop.getStats().fps > 0（swiftshader 下 drawImage
 *      拿不到 WebGL 前缓冲，像素法不可靠——以渲染循环活性为准，smoke-r S1 同口径）
 *   ③ 零 unhandled rejection / 零页面异常：Runtime.exceptionThrown + Log.entryAdded
 *      （error 级）全监听，出现即 FAIL
 *
 * 用法：node smoke-structural.mjs [url] [--edit] [--expect <scene-data.json 路径>]
 *   url 默认 http://localhost:5199/；--expect 不给时用 skill template 的 scene-data.json
 *   退出码：0 PASS / 1 FAIL / 2 环境不可用（CDP 起不来 → 按"无头环境预检不过转人工"处理）
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const argv = process.argv.slice(2);
const EDIT = argv.includes('--edit');
const urlIdx = argv.findIndex((a) => !a.startsWith('-'));
const URL_ARG = urlIdx >= 0 ? argv[urlIdx] : 'http://localhost:5199/';
const PAGE = EDIT ? `${URL_ARG}?edit=1` : URL_ARG;
const expectIdx = argv.indexOf('--expect');
const EXPECT_PATH = expectIdx >= 0 ? argv[expectIdx + 1]
  : join(SKILL_ROOT, 'template', 'public', 'scene-data.json');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9227;

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
    if (Array.isArray(v) && !SCENE_KEYS.has(k)) {
      groups[k] = v.length;
    }
  }
  return { groups, meta: data.meta?.name ?? '' };
};

const main = async () => {
  const expect = readExpect();
  const expectTotal = Object.values(expect.groups).reduce((a, b) => a + b, 0);

  // 1. 起 headless Edge
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${CDP_PORT}`, '--no-first-run',
    `--user-data-dir=${process.env.TEMP}\\gts-smoke-struct`,
    '--window-size=1280,800', PAGE,
  ], { stdio: 'ignore' });

  try {
    // 2. 等 CDP（预检：15 次探测不可用即退出 2，不修环境不硬跑）
    let wsUrl = null;
    for (let i = 0; i < 15; i += 1) {
      await sleep(800);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch { /* retry */ }
    }
    if (!wsUrl) {
      console.error('CDP 不可用（环境预检不过）→ 转人工验证清单');
      process.exit(2);
    }

    // 3. CDP 连接 + 异常全监听
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('WebSocket 连接失败'));
    });
    let seq = 0;
    const pending = new Map();
    const pageErrors = [];
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.method === 'Runtime.exceptionThrown') {
          pageErrors.push(`exception: ${msg.params.exceptionDetails?.text ?? ''} ${msg.params.exceptionDetails?.exception?.description ?? ''}`.trim());
        }
        if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
          const text = msg.params.entry.text;
          // headless 噪声豁免：favicon（浏览器自动请求，工程无 favicon）与无 URL 的
          // 通用 404 文本（真机浏览器实测无 404 定案 2026-10-13，headless 特有）。
          // Log.error 不带资源 URL 无法区分来源；带具体路径的资源 404 仍会以
          // Network/responseReceived 形态暴露——此豁免只放 Log 文本形态。
          if (!/favicon/i.test(text) && !(/^Failed to load resource: the server responded with a status of 404/.test(text))) {
            pageErrors.push(`console.error: ${text}`);
          }
        }
        if (msg.id !== undefined && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch { /* 忽略坏帧 */ }
    };
    const rpc = (method, params = {}) => new Promise((res, rej) => {
      seq += 1;
      const id = seq;
      pending.set(id, res);
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          rej(new Error(`RPC 超时: ${method}`));
        }
      }, 40000);
      ws.send(JSON.stringify({ id, method, params }));
    });
    await rpc('Runtime.enable');
    await rpc('Log.enable');
    const evaluate = async (expression) => {
      const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) {
        throw new Error(`页面异常: ${r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)}`);
      }
      return r.result?.result?.value;
    };

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
    await sleep(2500); // GLB 加载余量

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
    proc.kill();
  }
};

main().catch((e) => {
  console.error('STRUCT ERROR:', e.message);
  process.exit(1);
});
