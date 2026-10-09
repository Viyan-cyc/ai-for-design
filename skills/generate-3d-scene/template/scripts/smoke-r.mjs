/**
 * smoke-r.mjs — 批次 R（v3 重构）headless 冒烟（CDP 直连 Edge；Node ≥22 原生 WebSocket）
 *
 * 断言（Spec §4.7 R.8）：
 *   S1  v3 starter 场景渲染（引擎物体数 > 0 + canvas 像素非空白）
 *   S2  卡片跟随（trigger=always → CSS2D DOM 存在）
 *   S3  update 片段幂等 upsert（同片段喂两遍：第二遍 created 空 / updated 非空）+ remove
 *   S4  applyState 贴图换装（car_01 经 stateMaterials.cars.normal mapUrl 加载后材质 map 非空）
 *
 * 用法：node scripts/smoke-r.mjs <url> [--edit]
 */
import { spawn } from 'node:child_process';

const URL_ARG = process.argv[2] ?? 'http://localhost:5199/';
const EDIT_MODE = process.argv.includes('--edit');
const PAGE = EDIT_MODE ? `${URL_ARG}?edit=1` : URL_ARG;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9223;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  // 1. 起 headless Edge（独立 user-data-dir，不干扰用户浏览器）
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${CDP_PORT}`, '--no-first-run',
    `--user-data-dir=${process.env.TEMP}\\gts-smoke-r`,
    '--window-size=1280,800', PAGE,
  ], { stdio: 'ignore' });

  try {
    // 2. 等 CDP page target
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
      throw new Error('CDP target 不可用');
    }

    // 3. 原生 WebSocket 连 CDP
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('WebSocket 连接失败'));
    });
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
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
      }, 20000);
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) {
        throw new Error(`页面异常: ${r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)}`);
      }
      return r.result?.result?.value;
    };

    await sleep(5000); // 场景初始化 + GLB 加载余量

    // ── S1：场景渲染（先轮询 __gts3d 挂载） ──
    let mounted = false;
    for (let i = 0; i < 10; i += 1) {
      mounted = await evaluate('!!window.__gts3d');
      if (mounted) {
        break;
      }
      await sleep(700);
    }
    const s1 = await evaluate(`(async () => {
      const h = window.__gts3d;
      if (!h) return { ok: false, why: '__gts3d 未挂载（非 DEV 或脚本早于 boot）' };
      const ids = h.internals.sceneEngine.getAllIds();
      const canvas = document.getElementById('scene-canvas');
      if (!canvas) return { ok: false, why: 'canvas 不存在' };
      await new Promise(r => setTimeout(r, 1500));
      // 渲染循环活性（swiftshader 下 drawImage 拿不到 WebGL 前缓冲，像素法不可靠；
      // 改用 fps 统计——循环在跑且 fps>0 即在真实渲染）
      const stats = h.internals.renderLoop.getStats();
      const trees = ['tree_01', 'tree_02', 'tree_03', 'tree_04', 'tree_05']
        .filter(id => h.internals.sceneEngine.getObject(id));
      return { ok: ids.length > 0 && stats.fps > 0 && trees.length === 5, objCount: ids.length, fps: stats.fps,
        trees: trees.length, groups: h.internals.sceneEngine.getGroupNames() };
    })()`);
    console.log('S1 场景渲染:', JSON.stringify(s1));

    // ── S2：卡片 DOM + 内容（params 注入 → 卡片有实际业务字段渲染） ──
    const s2 = await evaluate(`(() => {
      const all = [...document.querySelectorAll('[data-card-id]')];
      const texts = all.map(e => (e.textContent ?? '').replace(/\\s+/g, ' ').trim());
      const titled = texts.some(t => t.includes('巡逻车'));
      return { count: all.length, texts, titled };
    })()`);
    console.log('S2 卡片DOM:', JSON.stringify(s2));

    // ── S3：update 幂等 upsert + remove ──
    const s3 = await evaluate(`(() => {
      const h = window.__gts3d;
      if (!h) return { idemOk: false, rmOk: false, why: 'no handle' };
      const before = h.internals.sceneEngine.getAllIds().length;
      const frag = { Box: [{ id: 'smoke_box_a', position: [6, 0.5, 0] }, { id: 'smoke_box_b', position: [7, 0.5, 0] }] };
      const r1 = h.update(frag);
      const r2 = h.update(frag);
      const rm = h.update({ remove: ['smoke_box_a', 'smoke_box_b'] });
      const after = h.internals.sceneEngine.getAllIds().length;
      const idemOk = r1.created.length === 2 && r2.created.length === 0 && r2.updated.length === 2;
      const rmOk = rm.removed.length === 2 && after === before;
      return { idemOk, rmOk, r1: r1.created, r2u: r2.updated, r2c: r2.created, rm: rm.removed, before, after };
    })()`);
    console.log('S3 幂等upsert+remove:', JSON.stringify(s3));

    // ── S4：applyState 贴图换装（car_01 → stateMaterials.cars.normal mapUrl）──
    const s4 = await evaluate(`(async () => {
      const h = window.__gts3d;
      if (!h) return { ok: false, why: 'no handle' };
      let mesh = null;
      const grab = () => {
        const obj = h.internals.sceneEngine.getObject('car_01');
        if (obj) obj.traverse(c => { if (!mesh && c.isMesh) mesh = c; });
      };
      for (let i = 0; i < 10; i++) {
        grab();
        if (mesh && mesh.material && mesh.material.map) break;
        await new Promise(r => setTimeout(r, 300));
      }
      grab();
      if (!mesh) return { ok: false, why: 'car_01 mesh 未就绪' };
      const m = mesh.material;
      return { ok: !!(m && m.map), matType: m?.type ?? null,
        hasMap: !!(m && m.map), mapSrc: (m?.map?.image?.src ?? '').slice(-40) };
    })()`);
    console.log('S4 applyState贴图:', JSON.stringify(s4));

    // ── S5：serialize 分组字典 & __visuals 通道 ──
    const s5 = await evaluate(`(() => {
      const h = window.__gts3d;
      const ser = h.serialize();
      return { keys: Object.keys(ser).slice(0, 12),
        hasBoxGroup: Array.isArray(ser.Box), hasCars: Array.isArray(ser.cars),
        hasTrees: Array.isArray(ser.trees) };
    })()`);
    console.log('S5 serialize分组:', JSON.stringify(s5));

    // ── S6：片段更新保留字段（P0 回归断言：transform-only 片段不得抹 params/card） ──
    const s6 = await evaluate(`(() => {
      const h = window.__gts3d;
      const before = h.internals.sceneEngine.getNode('car_01');
      h.update({ cars: [{ id: 'car_01', position: [-3.5, 0.5, 0] }] });
      const after = h.internals.sceneEngine.getNode('car_01');
      const paramsKept = !!after?.params && after.params.assetId === before?.params?.assetId
        && after.params.status === before?.params?.status;
      const cardKept = !!after?.card && after.card.type === before?.card?.type;
      // 还原位置（不污染后续断言）
      h.update({ cars: [{ id: 'car_01', position: [-3, 0.5, 0] }] });
      return { paramsKept, cardKept, params: after?.params, card: after?.card };
    })()`);
    console.log('S6 片段保留字段:', JSON.stringify(s6));

    const pass = s1.ok === true && s3.idemOk === true && s3.rmOk === true
      && s2.count >= 2 && s2.titled === true
      && s4.ok === true && s5.hasCars === true && s5.hasTrees === true
      && s6.paramsKept === true && s6.cardKept === true;
    console.log(pass ? 'SMOKE PASS' : 'SMOKE FAIL');
    process.exitCode = pass ? 0 : 1;
  } finally {
    proc.kill();
  }
};

main().catch((e) => {
  console.error('SMOKE ERROR:', e.message);
  process.exit(1);
});
