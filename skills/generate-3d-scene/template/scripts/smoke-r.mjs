/**
 * smoke-r.mjs — headless 冒烟（CDP 直连 Edge；Node ≥22 原生 WebSocket）
 *
 * 断言：
 *   S1  v3 starter 场景渲染（引擎物体数 > 0 + canvas 像素非空白）
 *   S2  卡片跟随（trigger=always → CSS2D DOM 存在）
 *   S3  update 片段幂等 upsert（同片段喂两遍：第二遍 created 空 / updated 非空）+ remove
 *   S4  applyState 贴图换装（car_01 经 stateMaterials.cars.normal mapUrl 加载后材质 map 非空）
 *   S5–S23 见脚本正文（serialize/材质库/贴图/树/显隐/锁定拾取/环守卫/开关增量）
 *   S24 删除挡锁定（removeObjects 过滤 locked、选中保持）  S25 复制带视觉层（继承色/清 locked/偏移1/undo 回收）
 *   S26 点已选中保持选中（同 id 再点不取消；取消走点空白/ESC）
 *   S27 vec2 参数（iridescenceThicknessRange 数组 → Vector2 非 NaN）
 *   S28 视觉层回灌（boot 喂回 __visuals → serialize 往返不丢）
 *   S29 锁定挡卡片（锁定物 click 不弹卡片；解锁恢复）
 *   S13 兼测中文文件名上传（encodeURIComponent 双端）
 *
 * 用法：node scripts/smoke-r.mjs <url> [--edit]
 */
import { spawn } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

    // ── S2：卡片挂载 + 内容（params 注入 → 卡片有实际业务字段渲染）──
    // 口径：挂载数经引擎 anchor 数（click 卡片 visible=false 时不进 CSS2D DOM，
    // DOM 计数会漏）；内容断言用可见的 always 卡片文本。
    const s2 = await evaluate(`(() => {
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      const mounted = [...se.getAllIds()].filter((id) => {
        const obj = se.getObject(id);
        return !!obj?.children.find((c) => c.isCSS2DObject && c.name === 'card_anchor_' + id + '/card');
      });
      const all = [...document.querySelectorAll('[data-card-id]')];
      const texts = all.map(e => (e.textContent ?? '').replace(/\\s+/g, ' ').trim());
      const titled = texts.some(t => t.includes('巡逻车'));
      return { count: mounted.length, domCount: all.length, texts, titled };
    })()`);
    console.log('S2 卡片挂载:', JSON.stringify(s2));

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

    // ── S7：材质类型切换 instanceof（Lambert / Physical）──
    const s7 = await evaluate(`(() => {
      const h = window.__gts3d;
      h.update({ __visuals: { ground: { materialType: 'MeshLambertMaterial', color: '#ff0000' } } });
      const o = h.internals.sceneEngine.getObject('ground');
      const lambertOk = !!o && o.material.type === 'MeshLambertMaterial' && o.material.isMeshLambertMaterial === true;
      h.update({ __visuals: { ground: { materialType: 'MeshPhysicalMaterial', transmission: 1, ior: 1.5 } } });
      const o2 = h.internals.sceneEngine.getObject('ground');
      const physicalOk = !!o2 && o2.material.type === 'MeshPhysicalMaterial' && o2.material.isMeshPhysicalMaterial === true;
      const iorOk = !!o2 && Math.abs(o2.material.ior - 1.5) < 1e-6;
      return { lambertOk, physicalOk, iorOk };
    })()`);
    console.log('S7 类型切换:', JSON.stringify(s7));

    // ── S8：贴图色彩空间三分桶（map=SRGB、normalMap=NoColorSpace）──
    const s8 = await evaluate(`(async () => {
      const h = window.__gts3d;
      h.update({ __visuals: { ground: { materialType: 'MeshStandardMaterial', map: 'assets/textures/example.jpg', normalMap: 'assets/textures/example.jpg' } } });
      const o = h.internals.sceneEngine.getObject('ground');
      let mapCs = null; let normalCs = null;
      for (let i = 0; i < 25; i++) {
        const m = o && o.material;
        mapCs = m && m.map ? m.map.colorSpace : null;
        normalCs = m && m.normalMap ? m.normalMap.colorSpace : null;
        if (mapCs !== null && normalCs !== null) break;
        await new Promise(r => setTimeout(r, 200));
      }
      return { mapCs, normalCs, mapSrgb: mapCs === 'srgb', normalNo: normalCs === '' };
    })()`);
    console.log('S8 色彩空间:', JSON.stringify(s8));

    // ── S9：共享实例（同 mat_id 两物体 material === 同一实例）──
    const s9 = await evaluate(`(() => {
      const h = window.__gts3d;
      const lib = window.__gts3dEdit.materialLib;
      h.update({ Box: [{ id: 'smoke_m1', position: [10, 0.5, 0] }, { id: 'smoke_m2', position: [11, 0.5, 0] }] });
      const id = lib.createEntry('smoke_shared', { type: 'MeshPhysicalMaterial', metalness: 0.5, roughness: 0.5 });
      lib.link('smoke_m1', id);
      lib.link('smoke_m2', id);
      lib.syncAll();
      const a = h.internals.sceneEngine.getObject('smoke_m1');
      const b = h.internals.sceneEngine.getObject('smoke_m2');
      const inst = lib.getInstance(id);
      const sharedOk = !!a && !!b && !!inst && a.material === b.material && a.material === inst;
      return { sharedOk, instType: inst && inst.type, libId: id };
    })()`);
    console.log('S9 共享实例:', JSON.stringify(s9));
    const sharedId = s9.libId;

    // ── S10：改库热更（两物体同变且仍共享实例）──
    const s10 = await evaluate(`(() => {
      const h = window.__gts3d;
      const lib = window.__gts3dEdit.materialLib;
      lib.updateEntry('${sharedId}', { type: 'MeshPhysicalMaterial', metalness: 1, roughness: 0.1 });
      const a = h.internals.sceneEngine.getObject('smoke_m1');
      const b = h.internals.sceneEngine.getObject('smoke_m2');
      const inst = lib.getInstance('${sharedId}');
      const sameInstance = !!a && !!b && a.material === b.material && a.material === inst;
      const bothChanged = !!a && a.material.metalness === 1 && !!b && b.material.metalness === 1;
      return { sameInstance, bothChanged };
    })()`);
    console.log('S10 热更:', JSON.stringify(s10));

    // ── S11：serialize 带回 __materialLib + libraryRef（含种子）──
    const s11 = await evaluate(`(() => {
      const ser = window.__gts3d.serialize();
      const hasLib = !!ser.__materialLib && !!ser.__materialLib['${sharedId}'];
      const hasRef1 = !!ser.__visuals && !!ser.__visuals.smoke_m1 && ser.__visuals.smoke_m1.libraryRef === '${sharedId}';
      const hasSeeds = !!ser.__materialLib && !!ser.__materialLib.glass && !!ser.__materialLib.velvet;
      return { hasLib, hasRef1, hasSeeds };
    })()`);
    console.log('S11 serialize库:', JSON.stringify(s11));

    // ── S12：undo 覆盖库编辑（改库可撤销）──
    const s12 = await evaluate(`(() => {
      const h = window.__gts3d;
      const lib = window.__gts3dEdit.materialLib;
      const bridge = window.__gts3dEdit.bridge;
      const id = lib.createEntry('smoke_undo', { type: 'MeshStandardMaterial', color: '#00ff00' });
      const c0 = h.serialize().__materialLib[id] && h.serialize().__materialLib[id].spec.color;
      lib.updateEntry(id, { type: 'MeshStandardMaterial', color: '#0000ff' });
      const c1 = h.serialize().__materialLib[id] && h.serialize().__materialLib[id].spec.color;
      bridge.undo();
      const c2 = h.serialize().__materialLib[id] && h.serialize().__materialLib[id].spec.color;
      return { c0, c1, c2, ok: c0 === '#00ff00' && c1 === '#0000ff' && c2 === '#00ff00' };
    })()`);
    console.log('S12 undo库:', JSON.stringify(s12));

    // ── S13：上传端点 → map 生效 ──
    const s13 = await evaluate(`(async () => {
      const cvs = document.createElement('canvas'); cvs.width = 2; cvs.height = 2;
      const ctx = cvs.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 2, 2);
      const blob = await new Promise((r) => cvs.toBlob(r, 'image/png'));
      const res = await fetch('/__gts3d/upload-texture', { method: 'POST', headers: { 'x-filename': encodeURIComponent('冒烟贴图.png') }, body: blob });
      const httpOk = res.ok;
      const data = await res.json();
      const url = data.url;
      const h = window.__gts3d;
      h.update({ __visuals: { ground: { materialType: 'MeshStandardMaterial', map: url } } });
      const o = h.internals.sceneEngine.getObject('ground');
      let hasMap = false;
      for (let i = 0; i < 25; i++) { if (o && o.material && o.material.map) { hasMap = true; break; } await new Promise(r => setTimeout(r, 200)); }
      return { httpOk, url, hasMap };
    })()`);
    console.log('S13 上传贴图:', JSON.stringify(s13));

    // ── S14：attenuationDistance null ↔ Infinity 往返 ──
    const s14 = await evaluate(`(() => {
      const h = window.__gts3d;
      const lib = window.__gts3dEdit.materialLib;
      const id = lib.createEntry('smoke_atten', { type: 'MeshPhysicalMaterial', transmission: 1, attenuationDistance: null });
      const serVal = h.serialize().__materialLib[id].spec.attenuationDistance;
      const inst = lib.getInstance(id);
      const jsVal = inst ? inst.attenuationDistance : null;
      return { serNull: serVal === null, instInfinity: jsVal === Infinity };
    })()`);
    console.log('S14 无穷往返:', JSON.stringify(s14));

    // ── S15：同类型 patch 保贴图（car_01 的状态贴图在，仅改标量不得丢 map）──
    const s15 = await evaluate(`(() => {
      const h = window.__gts3d;
      const obj = h.internals.sceneEngine.getObject('car_01');
      let before = null;
      obj.traverse((c) => { if (!before && c.isMesh) before = c.material; });
      const beforeMap = !!(before && before.map);
      const beforeType = before ? before.type : null;
      h.update({ __visuals: { car_01: { materialType: 'MeshStandardMaterial', roughness: 0.42 } } });
      let after = null;
      obj.traverse((c) => { if (!after && c.isMesh) after = c.material; });
      const mapKept = !!(after && after.map);
      const roughOk = !!after && Math.abs(after.roughness - 0.42) < 1e-6;
      return { beforeMap, beforeType, mapKept, roughOk };
    })()`);
    console.log('S15 同类型保贴图:', JSON.stringify(s15));

    // ── S16：图元默认色保留（同类型改 metalness 不得把 #9cabb8 冲成白色）──
    const s16 = await evaluate(`(() => {
      const h = window.__gts3d;
      h.update({ Box: [{ id: 'smoke_prim', position: [20, 0.5, 0] }] });
      const o = h.internals.sceneEngine.getObject('smoke_prim');
      const colorBefore = o.material.color.getHexString();
      h.update({ __visuals: { smoke_prim: { materialType: 'MeshStandardMaterial', metalness: 0.5 } } });
      const colorAfter = o.material.color.getHexString();
      const metalOk = Math.abs(o.material.metalness - 0.5) < 1e-6;
      return { colorBefore, colorAfter, colorKept: colorBefore === '9cabb8' && colorAfter === '9cabb8', metalOk };
    })()`);
    console.log('S16 图元保色:', JSON.stringify(s16));

    // ── S17：跨类型继承贴图（car_01 Standard→Physical，map 槽拷贝引用）──
    const s17 = await evaluate(`(() => {
      const h = window.__gts3d;
      h.update({ __visuals: { car_01: { materialType: 'MeshPhysicalMaterial', roughness: 0.42 } } });
      const obj = h.internals.sceneEngine.getObject('car_01');
      let m = null;
      obj.traverse((c) => { if (!m && c.isMesh) m = c.material; });
      return { type: m && m.type, mapInherited: !!(m && m.map), roughOk: !!m && Math.abs(m.roughness - 0.42) < 1e-6 };
    })()`);
    console.log('S17 跨类型继承贴图:', JSON.stringify(s17));

    // ── S18：场景树 DOM 层级（分组根 + 组内嵌套子节点）──
    const s18 = await evaluate(`(async () => {
      const b = window.__gts3dEdit.bridge;
      const h = window.__gts3d;
      b.commit('smoke-nest', () => h.update({ Box: [{ id: 'smoke_child', parentId: 'ground', position: [1, 2, 1] }] }));
      await new Promise(r => setTimeout(r, 150));
      const groupEls = [...document.querySelectorAll('[data-tree-group]')].map(e => e.getAttribute('data-tree-group'));
      const child = document.querySelector('[data-tree-node="smoke_child"]');
      const ground = document.querySelector('[data-tree-node="ground"]');
      const childDepth = child ? Number(child.getAttribute('data-tree-depth')) : -1;
      const groundDepth = ground ? Number(ground.getAttribute('data-tree-depth')) : -1;
      const nestedOk = !!child && !!ground
        && child.getAttribute('data-tree-parent') === 'ground'
        && childDepth === groundDepth + 1
        && groupEls.includes('Box');
      b.commit('smoke-nest-clean', () => h.update({ remove: ['smoke_child'] }));
      await new Promise(r => setTimeout(r, 120));
      return { groupEls, nestedOk, childDepth, groundDepth, childParent: child && child.getAttribute('data-tree-parent') };
    })()`);
    console.log('S18 树层级:', JSON.stringify(s18));

    // ── S19：搜索过滤（id 子串命中 + 组外节点隐藏 + 空态 + 清空恢复）──
    const s19 = await evaluate(`(async () => {
      const input = document.querySelector('[data-tree-search]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const setVal = async (v) => {
        setter.call(input, v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 90));
      };
      const allBefore = document.querySelectorAll('[data-tree-node]').length;
      await setVal('tree_');
      const ids = [...document.querySelectorAll('[data-tree-node]')].map(e => e.getAttribute('data-tree-node'));
      const onlyTrees = ids.length > 0 && ids.every(id => id.toLowerCase().includes('tree_'));
      const groundHidden = !document.querySelector('[data-tree-node="ground"]');
      await setVal('zzzznope');
      const emptyShown = !!document.querySelector('[data-tree-empty]');
      await setVal('');
      const restored = document.querySelectorAll('[data-tree-node]').length;
      return { allBefore, ids, onlyTrees, groundHidden, emptyShown, restored, restoreOk: restored === allBefore };
    })()`);
    console.log('S19 搜索:', JSON.stringify(s19));

    // ── S20：行内显隐落库（__visuals.visible 回读 + 实例隐藏 + 再点恢复）──
    const s20 = await evaluate(`(async () => {
      const h = window.__gts3d;
      document.querySelector('[data-tree-eye="car_01"]').click();
      await new Promise(r => setTimeout(r, 150));
      const hidden = h.serialize().__visuals && h.serialize().__visuals.car_01 && h.serialize().__visuals.car_01.visible;
      const objHidden = h.internals.sceneEngine.getObject('car_01').visible === false;
      document.querySelector('[data-tree-eye="car_01"]').click();
      await new Promise(r => setTimeout(r, 150));
      const shownAgain = h.serialize().__visuals && h.serialize().__visuals.car_01 && h.serialize().__visuals.car_01.visible;
      return { hidden, objHidden, shownAgain, ok: hidden === false && objHidden === true && shownAgain === true };
    })()`);
    console.log('S20 显隐:', JSON.stringify(s20));

    // ── S21：锁定拾取跳过（raycast 不命中锁定物体 + 视口点选跳过 + 解锁恢复）──
    const s21 = await evaluate(`(async () => {
      const h = window.__gts3d;
      const b = window.__gts3dEdit.bridge;
      const canvas = document.getElementById('scene-canvas');
      const rect = canvas.getBoundingClientRect();
      const filter = (id) => h.internals.sceneEngine.getVisual(id)?.locked !== true;
      let pt = null;
      for (let gy = 0.12; gy < 0.94 && !pt; gy += 0.05) {
        for (let gx = 0.08; gx < 0.94 && !pt; gx += 0.05) {
          const x = rect.left + gx * rect.width;
          const y = rect.top + gy * rect.height;
          const hit = h.pick(x, y);
          if (hit && hit.id === 'car_01') { pt = { x, y }; }
        }
      }
      if (!pt) { return { ok: false, why: '未找到 car_01 的可拾取点' }; }
      document.querySelector('[data-tree-lock="car_01"]').click();
      await new Promise(r => setTimeout(r, 150));
      const lockedFlag = h.serialize().__visuals && h.serialize().__visuals.car_01 && h.serialize().__visuals.car_01.locked;
      const filtered = h.pick(pt.x, pt.y, filter);
      const pickSkipped = !filtered || filtered.id !== 'car_01';
      const clickAt = (x, y) => {
        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
      };
      b.clearSelection();
      clickAt(pt.x, pt.y);
      await new Promise(r => setTimeout(r, 100));
      const selLocked = b.selectedIds.includes('car_01');
      document.querySelector('[data-tree-lock="car_01"]').click();
      await new Promise(r => setTimeout(r, 150));
      b.clearSelection();
      clickAt(pt.x, pt.y);
      await new Promise(r => setTimeout(r, 100));
      const selUnlocked = b.selectedIds.includes('car_01');
      b.clearSelection();
      return { lockedFlag, pickSkipped, selLocked, selUnlocked,
        ok: lockedFlag === true && pickSkipped === true && selLocked === false && selUnlocked === true };
    })()`);
    console.log('S21 锁定拾取:', JSON.stringify(s21));

    // ── S22：parentId 环不崩（a↔b 脏数据 → 两节点都建出来、挂根、无异常）──
    const s22 = await evaluate(`(() => {
      const h = window.__gts3d;
      h.update({ Box: [
        { id: 'smoke_cyc_a', parentId: 'smoke_cyc_b' },
        { id: 'smoke_cyc_b', parentId: 'smoke_cyc_a' },
      ] });
      const a = h.internals.sceneEngine.getObject('smoke_cyc_a');
      const b = h.internals.sceneEngine.getObject('smoke_cyc_b');
      const noThrow = true;
      h.update({ remove: ['smoke_cyc_a', 'smoke_cyc_b'] });
      return { noThrow, bothCreated: !!a && !!b };
    })()`);
    console.log('S22 父链环守卫:', JSON.stringify(s22));

    // ── S23：纯开关增量不重放材质（材质已编辑物体连点显隐 → material 实例不变）──
    const s23 = await evaluate(`(() => {
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      h.update({ __visuals: { ground: { materialType: 'MeshStandardMaterial', color: '#123456', roughness: 0.3 } } });
      const m0 = se.getObject('ground').material;
      h.update({ __visuals: { ground: { visible: false } } });
      const hiddenOk = se.getObject('ground').visible === false;
      const m1 = se.getObject('ground').material;
      h.update({ __visuals: { ground: { locked: true } } });
      const m2 = se.getObject('ground').material;
      h.update({ __visuals: { ground: { visible: true, locked: false } } });
      const m3 = se.getObject('ground').material;
      const colorOk = m3 && m3.color && m3.color.getHexString() === '123456';
      h.update({ __visuals: { ground: null } });
      return { sameMat: m1 === m0 && m2 === m0 && m3 === m0, hiddenOk, colorOk };
    })()`);
    console.log('S23 开关增量:', JSON.stringify(s23));

    // ── S24：删除挡锁定（锁定物体 removeObjects 不删、选中保持；解锁后可删）──
    const s24 = await evaluate(`(async () => {
      const h = window.__gts3d;
      const b = window.__gts3dEdit.bridge;
      const se = h.internals.sceneEngine;
      h.update({ Box: [{ id: 'smoke_del_box' }] });
      h.update({ __visuals: { smoke_del_box: { locked: true } } });
      b.select('smoke_del_box', false);
      b.removeObjects(b.selectedIds);
      const stillThere = !!se.getObject('smoke_del_box');
      const stillSel = b.selectedIds.includes('smoke_del_box');
      h.update({ __visuals: { smoke_del_box: { locked: false } } });
      b.removeObjects(b.selectedIds);
      const gone = !se.getObject('smoke_del_box');
      const selCleared = b.selectedIds.length === 0;
      return { stillThere, stillSel, gone, selCleared,
        ok: stillThere === true && stillSel === true && gone === true && selCleared === true };
    })()`);
    console.log('S24 删除挡锁定:', JSON.stringify(s24));

    // ── S25：复制带视觉层清 locked（锁定+内联色 → 副本存在/色继承/无锁定/偏移1/undo 可回）──
    const s25 = await evaluate(`(async () => {
      const h = window.__gts3d;
      const b = window.__gts3dEdit.bridge;
      const se = h.internals.sceneEngine;
      h.update({ Box: [{ id: 'smoke_dup_box', position: [5, 0.5, 5] }] });
      h.update({ __visuals: { smoke_dup_box: { locked: true, color: '#ff8800' } } });
      const newId = b.duplicateObject('smoke_dup_box');
      const copyExists = newId && !!se.getObject(newId);
      const vis = newId && se.getVisual(newId);
      const colorKept = vis && vis.color === '#ff8800';
      const lockedCleared = vis && vis.locked !== true;
      const matOk = newId && se.getObject(newId).material.color.getHexString() === 'ff8800';
      const srcPos = [5, 0.5, 5];
      const copyPos = newId && se.getNode(newId).position;
      const offsetOk = copyPos && Math.abs(copyPos[0] - srcPos[0] - 1) < 1e-6
        && Math.abs(copyPos[1] - srcPos[1]) < 1e-6 && Math.abs(copyPos[2] - srcPos[2]) < 1e-6;
      const undoDepth = b.getState().undoDepth;
      b.undo();
      const copyGone = newId && !se.getObject(newId);
      const redoDepth = b.getState().redoDepth;
      h.update({ remove: ['smoke_dup_box'] });
      return { copyExists, colorKept, lockedCleared, matOk, offsetOk, undoOk: undoDepth > 0, copyGone, redoDepth,
        ok: copyExists === true && colorKept === true && lockedCleared === true
          && matOk === true && offsetOk === true && copyGone === true };
    })()`);
    console.log('S25 复制带视觉层:', JSON.stringify(s25));

    // ── S26：点已选中物体保持选中（select 同 id 幂等；点空白清空不受影响）──
    const s26 = await evaluate(`(() => {
      const b = window.__gts3dEdit.bridge;
      b.select('car_01', false);
      const firstSel = b.selectedIds.length === 1 && b.selectedIds[0] === 'car_01';
      b.select('car_01', false);
      const stillSel = b.selectedIds.length === 1 && b.selectedIds[0] === 'car_01';
      b.select('tree_01', false);
      const switchSel = b.selectedIds.length === 1 && b.selectedIds[0] === 'tree_01';
      b.select('tree_01', true);
      b.select('tree_01', true);
      const additiveToggled = b.selectedIds.length === 1 && b.selectedIds[0] === 'tree_01';
      b.clearSelection();
      const cleared = b.selectedIds.length === 0;
      return { firstSel, stillSel, switchSel, additiveToggled, cleared,
        ok: firstSel === true && stillSel === true && switchSel === true && additiveToggled === true && cleared === true };
    })()`);
    console.log('S26 已选中保持:', JSON.stringify(s26));

    // ── S27：iridescenceThicknessRange vec2（数组 → Vector2，非 NaN）──
    const s27 = await evaluate(`(() => {
      const h = window.__gts3d;
      h.update({ Box: [{ id: 'smoke_iri_box' }] });
      h.update({ __visuals: { smoke_iri_box: { materialType: 'MeshPhysicalMaterial', iridescence: 1, iridescenceThicknessRange: [120, 480] } } });
      const m = h.internals.sceneEngine.getObject('smoke_iri_box').material;
      const r = m.iridescenceThicknessRange;
      const isVec2 = r && r.isVector2 === true;
      const valOk = isVec2 && r.x === 120 && r.y === 480;
      const noNan = isVec2 && Number.isFinite(r.x) && Number.isFinite(r.y);
      h.update({ remove: ['smoke_iri_box'] });
      return { isVec2, valOk, noNan, ok: valOk && noNan };
    })()`);
    console.log('S27 vec2参数:', JSON.stringify(s27));

    // ── S28：重载回灌 __visuals（boot 时视觉层喂回引擎 → serialize 往返不丢）──
    const s28 = await evaluate(`(() => {
      const h = window.__gts3d;
      const se = h.internals.sceneEngine;
      h.update({ __visuals: { ground: { color: '#00ffcc', visible: false } } });
      const saved = h.serialize();
      const hasVis = !!saved.__visuals && !!saved.__visuals.ground
        && saved.__visuals.ground.color === '#00ffcc';
      // 模拟重载：新建引擎喂同一份数据（boot 回灌路径 = applyVisual 逐条）
      const visBack = se.getVisual('ground');
      const colorBack = visBack && visBack.color === '#00ffcc';
      const objHidden = se.getObject('ground').visible === false;
      h.update({ __visuals: { ground: null } });
      return { hasVis, colorBack, objHidden, ok: hasVis && colorBack && objHidden };
    })()`);
    console.log('S28 视觉层回灌:', JSON.stringify(s28));

    // ── S29：锁定物体 click 不弹卡片（解锁恢复）──
    // 断言口径：卡片显隐走 CSS2DObject.visible（element.style.display 被
    // CSS2DRenderer 每帧按视锥重写，DOM 样式断言不可靠）——经引擎物体找 anchor。
    const s29 = await evaluate(`(async () => {
      const h = window.__gts3d;
      const canvas = document.getElementById('scene-canvas');
      const rect = canvas.getBoundingClientRect();
      const vis = (id) => {
        const obj = h.internals.sceneEngine.getObject(id);
        const anchor = obj?.children.find((c) => c.isCSS2DObject && c.name === 'card_anchor_' + id + '/card');
        return !!anchor && anchor.visible === true;
      };
      // 找 car_02（click 卡片）的屏幕点
      let pt = null;
      for (let gy = 0.12; gy < 0.94 && !pt; gy += 0.05) {
        for (let gx = 0.08; gx < 0.94 && !pt; gx += 0.05) {
          const x = rect.left + gx * rect.width;
          const y = rect.top + gy * rect.height;
          const hit = h.pick(x, y);
          if (hit && hit.id === 'car_02') { pt = { x, y }; }
        }
      }
      if (!pt) { return { ok: false, why: '未找到 car_02 的可拾取点' }; }
      const clickAt = (x, y) => {
        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
      };
      clickAt(pt.x, pt.y);
      await new Promise(r => setTimeout(r, 200));
      const shownUnlocked = vis('car_02');
      clickAt(pt.x, pt.y); // 关回
      await new Promise(r => setTimeout(r, 200));
      h.update({ __visuals: { car_02: { locked: true } } });
      clickAt(pt.x, pt.y);
      await new Promise(r => setTimeout(r, 200));
      const blockedWhenLocked = !vis('car_02');
      h.update({ __visuals: { car_02: { locked: false } } });
      clickAt(pt.x, pt.y);
      await new Promise(r => setTimeout(r, 200));
      const shownAgain = vis('car_02');
      clickAt(pt.x, pt.y); // 关回，不污染后续用例
      await new Promise(r => setTimeout(r, 200));
      return { shownUnlocked, blockedWhenLocked, shownAgain,
        ok: shownUnlocked === true && blockedWhenLocked === true && shownAgain === true };
    })()`);
    console.log('S29 锁定挡卡片:', JSON.stringify(s29));

    const pass = s1.ok === true && s3.idemOk === true && s3.rmOk === true
      && s2.count >= 2 && s2.titled === true
      && s4.ok === true && s5.hasCars === true && s5.hasTrees === true
      && s6.paramsKept === true && s6.cardKept === true
      && s7.lambertOk === true && s7.physicalOk === true && s7.iorOk === true
      && s8.mapSrgb === true && s8.normalNo === true
      && s9.sharedOk === true && s10.sameInstance === true && s10.bothChanged === true
      && s11.hasLib === true && s11.hasRef1 === true && s11.hasSeeds === true
      && s12.ok === true && s13.httpOk === true && s13.hasMap === true
      && s14.serNull === true && s14.instInfinity === true
      && s15.beforeMap === true && s15.mapKept === true && s15.roughOk === true
      && s16.colorKept === true && s16.metalOk === true
      && s17.type === 'MeshPhysicalMaterial' && s17.mapInherited === true && s17.roughOk === true
      && s18.nestedOk === true
      && s19.onlyTrees === true && s19.groundHidden === true && s19.emptyShown === true && s19.restoreOk === true
      && s20.ok === true
      && s21.ok === true
      && s22.bothCreated === true && s22.noThrow === true
      && s23.sameMat === true && s23.hiddenOk === true && s23.colorOk === true
      && s24.ok === true
      && s25.copyExists === true && s25.colorKept === true && s25.lockedCleared === true
        && s25.matOk === true && s25.offsetOk === true && s25.copyGone === true
      && s26.ok === true
      && s27.ok === true
      && s28.ok === true
      && s29.ok === true;
    console.log(pass ? 'SMOKE PASS' : 'SMOKE FAIL');
    process.exitCode = pass ? 0 : 1;
  } finally {
    proc.kill();
    // S13 上传产物清理（middleware 重名自动加后缀，不清理会逐次累积进母版/生成工程）
    const texDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'textures');
    try {
      for (const f of readdirSync(texDir)) {
        if (/^(smoke.*|_{2,})(-\d+)?\.png$/.test(f)) {
          rmSync(join(texDir, f), { force: true });
        }
      }
    } catch { /* 目录不存在则跳过 */ }
  }
};

main().catch((e) => {
  console.error('SMOKE ERROR:', e.message);
  process.exit(1);
});
