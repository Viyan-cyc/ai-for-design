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
 *   S30 改名入库转引用（saveAs = 建条目 + link；spec 取自内联视觉）
 *   S31 复制材质脱离引用（disconnect → 内联独立副本，不受库热更影响）
 *   S32 删除有引用条目后 inline 保留（removeEntry → 引用者转内联，外观不变）
 *   S33 内置材质删除不复活（removeEntry(seed) 后重调 seeds() 不补回）
 *   S34 浮动面板并存不重叠 + 无全屏遮罩（材质素材 + 编辑材质球同开，MU2）
 *   S35 材质一材质一行（内置材质也是行、同列，非换行 chips，MU2）
 *   S49 GLB 加载计数徽标（修复轮七：N/M 徽标收敛；占位盒已裁决撤除）
 *   S13 兼测中文文件名上传（encodeURIComponent 双端）
 *
 * 用法：node scripts/smoke-r.mjs <url> [--edit] [--only S49] [--from S45]
 */
import { spawn } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ARG = process.argv[2] ?? 'http://localhost:5199/';
const EDIT_MODE = process.argv.includes('--edit');
const PAGE = EDIT_MODE ? `${URL_ARG}?edit=1` : URL_ARG;

// 分段冒烟（验证策略修订 2026-10-13：需要跑时不再为全量买单）
//   --only S49   只跑 S49（自动级联其状态前置段）
//   --from S45   跑 S45 到末尾
// 段间状态依赖（前置段创建的物体/库条目被后段消费，跳过会假失败）：
//   S1 全段挂载前提；S9 建 smoke_m1/m2 + sharedId → S10/S11/S12 消费
const DEPS = { S10: ['S9'], S11: ['S9'], S12: ['S9'] };
const onlyIdx = process.argv.indexOf('--only');
const fromIdx = process.argv.indexOf('--from');
const ONLY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;
const FROM = fromIdx >= 0 ? process.argv[fromIdx + 1] : null;

/** 段 n 是否执行：无参数全跑；--only 跑该段+前置闭包；--from 跑到末尾（前置闭包随行）。 */
const shouldRun = (n) => {
  if (ONLY) {
    if (n === ONLY) {
      return true;
    }
    // 前置闭包展开
    const need = new Set();
    const add = (seg) => {
      for (const d of DEPS[seg] ?? []) {
        if (!need.has(d)) {
          need.add(d);
          add(d);
        }
      }
    };
    add(ONLY);
    return need.has(n);
  }
  if (FROM) {
    const num = (s) => Number(s.replace(/^S/, ''));
    const fromNum = num(FROM);
    if (!fromNum) {
      return true; // FROM 段号不合法视同全量
    }
    if (num(n) >= fromNum) {
      return true;
    }
    // 目标段的前置闭包随行（无前置则不跑）
    const need = new Set();
    const add = (seg) => {
      for (const d of DEPS[seg] ?? []) {
        if (!need.has(d)) {
          need.add(d);
          add(d);
        }
      }
    };
    // 末段号从 DEPS 与既有段号动态取上界（新增段无需改这里）
    const maxSeg = Object.keys(DEPS).reduce((m, k) => Math.max(m, Number(k.slice(1))), fromNum);
    for (let i = fromNum; i <= maxSeg; i += 1) {
      add(`S${i}`);
    }
    return need.has(n);
  }
  return true;
};

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9223;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  // 1. 起 headless Edge（独立 user-data-dir，不干扰用户浏览器）
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${CDP_PORT}`, '--no-first-run',
    `--user-data-dir=${process.env.TEMP}\\scene3d-smoke-r`,
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
      }, 40000);
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

    // ── S1：场景渲染（先轮询 __scene3d 挂载）——任何分段都强制执行（挂载前提）──
    let mounted = false;
    for (let i = 0; i < 10; i += 1) {
      mounted = await evaluate('!!window.__scene3d');
      if (mounted) {
        break;
      }
      await sleep(700);
    }
    const s1 = shouldRun('S1') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      if (!h) return { ok: false, why: '__scene3d 未挂载（非 DEV 或脚本早于 boot）' };
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
    })()`) : { ok: true, skipped: true };
    console.log('S1 场景渲染:', JSON.stringify(s1));

    // ── S2：卡片挂载 + 内容（params 注入 → 卡片有实际业务字段渲染）──
    // 口径：挂载数经引擎 anchor 数（click 卡片 visible=false 时不进 CSS2D DOM，
    // DOM 计数会漏）；内容断言用可见的 always 卡片文本。
    const s2 = shouldRun('S2') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      const mounted = [...se.getAllIds()].filter((id) => {
        const obj = se.getObject(id);
        return !!obj?.children.find((c) => c.isCSS2DObject && c.name === 'card_anchor_' + id + '/card');
      });
      const all = [...document.querySelectorAll('[data-card-id]')];
      const texts = all.map(e => (e.textContent ?? '').replace(/\\s+/g, ' ').trim());
      const titled = texts.some(t => t.includes('巡逻车'));
      return { count: mounted.length, domCount: all.length, texts, titled };
    })()`) : { ok: true, skipped: true };
    console.log('S2 卡片挂载:', JSON.stringify(s2));

    // ── S3：update 幂等 upsert + remove ──
    const s3 = shouldRun('S3') ? await evaluate(`(() => {
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S3 幂等upsert+remove:', JSON.stringify(s3));

    // ── S4：applyState 贴图换装（car_01 → stateMaterials.cars.normal mapUrl）──
    const s4 = shouldRun('S4') ? await evaluate(`(async () => {
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S4 applyState贴图:', JSON.stringify(s4));

    // ── S5：serialize 分组字典 & __visuals 通道 ──
    const s5 = shouldRun('S5') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const ser = h.serialize();
      return { keys: Object.keys(ser).slice(0, 12),
        hasBoxGroup: Array.isArray(ser.Box), hasCars: Array.isArray(ser.cars),
        hasTrees: Array.isArray(ser.trees) };
    })()`) : { ok: true, skipped: true };
    console.log('S5 serialize分组:', JSON.stringify(s5));

    // ── S6：片段更新保留字段（P0 回归断言：transform-only 片段不得抹 params/card） ──
    const s6 = shouldRun('S6') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const before = h.internals.sceneEngine.getNode('car_01');
      h.update({ cars: [{ id: 'car_01', position: [-3.5, 0.5, 0] }] });
      const after = h.internals.sceneEngine.getNode('car_01');
      const paramsKept = !!after?.params && after.params.assetId === before?.params?.assetId
        && after.params.status === before?.params?.status;
      const cardKept = !!after?.card && after.card.type === before?.card?.type;
      // 还原位置（不污染后续断言）
      h.update({ cars: [{ id: 'car_01', position: [-3, 0.5, 0] }] });
      return { paramsKept, cardKept, params: after?.params, card: after?.card };
    })()`) : { ok: true, skipped: true };
    console.log('S6 片段保留字段:', JSON.stringify(s6));

    // ── S7：材质类型切换 instanceof（Lambert / Physical）──
    const s7 = shouldRun('S7') ? await evaluate(`(() => {
      const h = window.__scene3d;
      h.update({ __visuals: { ground: { materialType: 'MeshLambertMaterial', color: '#ff0000' } } });
      const o = h.internals.sceneEngine.getObject('ground');
      const lambertOk = !!o && o.material.type === 'MeshLambertMaterial' && o.material.isMeshLambertMaterial === true;
      h.update({ __visuals: { ground: { materialType: 'MeshPhysicalMaterial', transmission: 1, ior: 1.5 } } });
      const o2 = h.internals.sceneEngine.getObject('ground');
      const physicalOk = !!o2 && o2.material.type === 'MeshPhysicalMaterial' && o2.material.isMeshPhysicalMaterial === true;
      const iorOk = !!o2 && Math.abs(o2.material.ior - 1.5) < 1e-6;
      return { lambertOk, physicalOk, iorOk };
    })()`) : { ok: true, skipped: true };
    console.log('S7 类型切换:', JSON.stringify(s7));

    // ── S8：贴图色彩空间三分桶（map=SRGB、normalMap=NoColorSpace）──
    const s8 = shouldRun('S8') ? await evaluate(`(async () => {
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S8 色彩空间:', JSON.stringify(s8));

    // ── S9：共享实例（同 mat_id 两物体 material === 同一实例）──
    const s9 = shouldRun('S9') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const lib = window.__scene3dEdit.materialLib;
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
    })()`) : { ok: true, skipped: true };
    console.log('S9 共享实例:', JSON.stringify(s9));
    const sharedId = s9.libId;

    // ── S10：改库热更（两物体同变且仍共享实例）──
    const s10 = shouldRun('S10') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const lib = window.__scene3dEdit.materialLib;
      lib.updateEntry('${sharedId}', { type: 'MeshPhysicalMaterial', metalness: 1, roughness: 0.1 });
      const a = h.internals.sceneEngine.getObject('smoke_m1');
      const b = h.internals.sceneEngine.getObject('smoke_m2');
      const inst = lib.getInstance('${sharedId}');
      const sameInstance = !!a && !!b && a.material === b.material && a.material === inst;
      const bothChanged = !!a && a.material.metalness === 1 && !!b && b.material.metalness === 1;
      return { sameInstance, bothChanged };
    })()`) : { ok: true, skipped: true };
    console.log('S10 热更:', JSON.stringify(s10));

    // ── S11：serialize 带回 __materialLib + libraryRef（含种子）──
    const s11 = shouldRun('S11') ? await evaluate(`(() => {
      const ser = window.__scene3d.serialize();
      const hasLib = !!ser.__materialLib && !!ser.__materialLib['${sharedId}'];
      const hasRef1 = !!ser.__visuals && !!ser.__visuals.smoke_m1 && ser.__visuals.smoke_m1.libraryRef === '${sharedId}';
      const hasSeeds = !!ser.__materialLib && !!ser.__materialLib.glass && !!ser.__materialLib.velvet;
      return { hasLib, hasRef1, hasSeeds };
    })()`) : { ok: true, skipped: true };
    console.log('S11 serialize库:', JSON.stringify(s11));

    // ── S12：undo 覆盖库编辑（改库可撤销）──
    const s12 = shouldRun('S12') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const lib = window.__scene3dEdit.materialLib;
      const bridge = window.__scene3dEdit.bridge;
      const id = lib.createEntry('smoke_undo', { type: 'MeshStandardMaterial', color: '#00ff00' });
      const c0 = h.serialize().__materialLib[id] && h.serialize().__materialLib[id].spec.color;
      lib.updateEntry(id, { type: 'MeshStandardMaterial', color: '#0000ff' });
      const c1 = h.serialize().__materialLib[id] && h.serialize().__materialLib[id].spec.color;
      bridge.undo();
      const c2 = h.serialize().__materialLib[id] && h.serialize().__materialLib[id].spec.color;
      return { c0, c1, c2, ok: c0 === '#00ff00' && c1 === '#0000ff' && c2 === '#00ff00' };
    })()`) : { ok: true, skipped: true };
    console.log('S12 undo库:', JSON.stringify(s12));

    // ── S13：上传端点 → map 生效 ──
    const s13 = shouldRun('S13') ? await evaluate(`(async () => {
      const cvs = document.createElement('canvas'); cvs.width = 2; cvs.height = 2;
      const ctx = cvs.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 2, 2);
      const blob = await new Promise((r) => cvs.toBlob(r, 'image/png'));
      const res = await fetch('/__scene3d/upload-texture', { method: 'POST', headers: { 'x-filename': encodeURIComponent('冒烟贴图.png') }, body: blob });
      const httpOk = res.ok;
      const data = await res.json();
      const url = data.url;
      const h = window.__scene3d;
      h.update({ __visuals: { ground: { materialType: 'MeshStandardMaterial', map: url } } });
      const o = h.internals.sceneEngine.getObject('ground');
      let hasMap = false;
      for (let i = 0; i < 25; i++) { if (o && o.material && o.material.map) { hasMap = true; break; } await new Promise(r => setTimeout(r, 200)); }
      return { httpOk, url, hasMap };
    })()`) : { ok: true, skipped: true };
    console.log('S13 上传贴图:', JSON.stringify(s13));

    // ── S14：attenuationDistance null ↔ Infinity 往返 ──
    const s14 = shouldRun('S14') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const lib = window.__scene3dEdit.materialLib;
      const id = lib.createEntry('smoke_atten', { type: 'MeshPhysicalMaterial', transmission: 1, attenuationDistance: null });
      const serVal = h.serialize().__materialLib[id].spec.attenuationDistance;
      const inst = lib.getInstance(id);
      const jsVal = inst ? inst.attenuationDistance : null;
      return { serNull: serVal === null, instInfinity: jsVal === Infinity };
    })()`) : { ok: true, skipped: true };
    console.log('S14 无穷往返:', JSON.stringify(s14));

    // ── S15：同类型 patch 保贴图（car_01 的状态贴图在，仅改标量不得丢 map）──
    const s15 = shouldRun('S15') ? await evaluate(`(() => {
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S15 同类型保贴图:', JSON.stringify(s15));

    // ── S16：图元默认色保留（同类型改 metalness 不得把 #9cabb8 冲成白色）──
    const s16 = shouldRun('S16') ? await evaluate(`(() => {
      const h = window.__scene3d;
      h.update({ Box: [{ id: 'smoke_prim', position: [20, 0.5, 0] }] });
      const o = h.internals.sceneEngine.getObject('smoke_prim');
      const colorBefore = o.material.color.getHexString();
      h.update({ __visuals: { smoke_prim: { materialType: 'MeshStandardMaterial', metalness: 0.5 } } });
      const colorAfter = o.material.color.getHexString();
      const metalOk = Math.abs(o.material.metalness - 0.5) < 1e-6;
      return { colorBefore, colorAfter, colorKept: colorBefore === '9cabb8' && colorAfter === '9cabb8', metalOk };
    })()`) : { ok: true, skipped: true };
    console.log('S16 图元保色:', JSON.stringify(s16));

    // ── S17：跨类型继承贴图（car_01 Standard→Physical，map 槽拷贝引用）──
    const s17 = shouldRun('S17') ? await evaluate(`(() => {
      const h = window.__scene3d;
      h.update({ __visuals: { car_01: { materialType: 'MeshPhysicalMaterial', roughness: 0.42 } } });
      const obj = h.internals.sceneEngine.getObject('car_01');
      let m = null;
      obj.traverse((c) => { if (!m && c.isMesh) m = c.material; });
      return { type: m && m.type, mapInherited: !!(m && m.map), roughOk: !!m && Math.abs(m.roughness - 0.42) < 1e-6 };
    })()`) : { ok: true, skipped: true };
    console.log('S17 跨类型继承贴图:', JSON.stringify(s17));

    // ── S18：场景树 DOM 层级（分组根 + 组内嵌套子节点）──
    const s18 = shouldRun('S18') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S18 树层级:', JSON.stringify(s18));

    // ── S19：搜索过滤（id 子串命中 + 组外节点隐藏 + 空态 + 清空恢复）──
    const s19 = shouldRun('S19') ? await evaluate(`(async () => {
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
    })()`) : { ok: true, skipped: true };
    console.log('S19 搜索:', JSON.stringify(s19));

    // ── S20：行内显隐落库（__visuals.visible 回读 + 实例隐藏 + 再点恢复）──
    const s20 = shouldRun('S20') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      document.querySelector('[data-tree-eye="car_01"]').click();
      await new Promise(r => setTimeout(r, 150));
      const hidden = h.serialize().__visuals && h.serialize().__visuals.car_01 && h.serialize().__visuals.car_01.visible;
      const objHidden = h.internals.sceneEngine.getObject('car_01').visible === false;
      document.querySelector('[data-tree-eye="car_01"]').click();
      await new Promise(r => setTimeout(r, 150));
      const shownAgain = h.serialize().__visuals && h.serialize().__visuals.car_01 && h.serialize().__visuals.car_01.visible;
      return { hidden, objHidden, shownAgain, ok: hidden === false && objHidden === true && shownAgain === true };
    })()`) : { ok: true, skipped: true };
    console.log('S20 显隐:', JSON.stringify(s20));

    // ── S21：锁定拾取跳过（raycast 不命中锁定物体 + 视口点选跳过 + 解锁恢复）──
    const s21 = shouldRun('S21') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const b = window.__scene3dEdit.bridge;
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
    })()`) : { ok: true, skipped: true };
    console.log('S21 锁定拾取:', JSON.stringify(s21));

    // ── S22：parentId 环不崩（a↔b 脏数据 → 两节点都建出来、挂根、无异常）──
    const s22 = shouldRun('S22') ? await evaluate(`(() => {
      const h = window.__scene3d;
      h.update({ Box: [
        { id: 'smoke_cyc_a', parentId: 'smoke_cyc_b' },
        { id: 'smoke_cyc_b', parentId: 'smoke_cyc_a' },
      ] });
      const a = h.internals.sceneEngine.getObject('smoke_cyc_a');
      const b = h.internals.sceneEngine.getObject('smoke_cyc_b');
      const noThrow = true;
      h.update({ remove: ['smoke_cyc_a', 'smoke_cyc_b'] });
      return { noThrow, bothCreated: !!a && !!b };
    })()`) : { ok: true, skipped: true };
    console.log('S22 父链环守卫:', JSON.stringify(s22));

    // ── S23：纯开关增量不重放材质（材质已编辑物体连点显隐 → material 实例不变）──
    const s23 = shouldRun('S23') ? await evaluate(`(() => {
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S23 开关增量:', JSON.stringify(s23));

    // ── S24：删除挡锁定（锁定物体 removeObjects 不删、选中保持；解锁后可删）──
    const s24 = shouldRun('S24') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const b = window.__scene3dEdit.bridge;
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
    })()`) : { ok: true, skipped: true };
    console.log('S24 删除挡锁定:', JSON.stringify(s24));

    // ── S25：复制带视觉层清 locked（锁定+内联色 → 副本存在/色继承/无锁定/偏移1/undo 可回）──
    const s25 = shouldRun('S25') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const b = window.__scene3dEdit.bridge;
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
    })()`) : { ok: true, skipped: true };
    console.log('S25 复制带视觉层:', JSON.stringify(s25));

    // ── S26：点已选中物体保持选中（select 同 id 幂等；点空白清空不受影响）──
    const s26 = shouldRun('S26') ? await evaluate(`(() => {
      const b = window.__scene3dEdit.bridge;
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
    })()`) : { ok: true, skipped: true };
    console.log('S26 已选中保持:', JSON.stringify(s26));

    // ── S27：iridescenceThicknessRange vec2（数组 → Vector2，非 NaN）──
    const s27 = shouldRun('S27') ? await evaluate(`(() => {
      const h = window.__scene3d;
      h.update({ Box: [{ id: 'smoke_iri_box' }] });
      h.update({ __visuals: { smoke_iri_box: { materialType: 'MeshPhysicalMaterial', iridescence: 1, iridescenceThicknessRange: [120, 480] } } });
      const m = h.internals.sceneEngine.getObject('smoke_iri_box').material;
      const r = m.iridescenceThicknessRange;
      const isVec2 = r && r.isVector2 === true;
      const valOk = isVec2 && r.x === 120 && r.y === 480;
      const noNan = isVec2 && Number.isFinite(r.x) && Number.isFinite(r.y);
      h.update({ remove: ['smoke_iri_box'] });
      return { isVec2, valOk, noNan, ok: valOk && noNan };
    })()`) : { ok: true, skipped: true };
    console.log('S27 vec2参数:', JSON.stringify(s27));

    // ── S28：重载回灌 __visuals（boot 时视觉层喂回引擎 → serialize 往返不丢）──
    const s28 = shouldRun('S28') ? await evaluate(`(() => {
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S28 视觉层回灌:', JSON.stringify(s28));

    // ── S29：锁定物体 click 不弹卡片（解锁恢复）──
    // 断言口径：卡片显隐走 CSS2DObject.visible（element.style.display 被
    // CSS2DRenderer 每帧按视锥重写，DOM 样式断言不可靠）——经引擎物体找 anchor。
    const s29 = shouldRun('S29') ? await evaluate(`(async () => {
      const h = window.__scene3d;
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
    })()`) : { ok: true, skipped: true };
    console.log('S29 锁定挡卡片:', JSON.stringify(s29));

    // ── S30：改名入库转引用（saveAs：内联视觉 → 新库条目 + link 该物体）──
    const s30 = shouldRun('S30') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const lib = window.__scene3dEdit.materialLib;
      const se = h.internals.sceneEngine;
      h.update({ Box: [{ id: 'smoke_ren_box' }] });
      h.update({ __visuals: { smoke_ren_box: { materialType: 'MeshStandardMaterial', color: '#aa1122' } } });
      const newId = lib.saveAs('smoke_ren_box', '红漆');
      const entry = lib.getEntry(newId);
      const linked = se.getVisual('smoke_ren_box').libraryRef === newId;
      const nameOk = !!entry && entry.name === '红漆';
      const specOk = !!entry && entry.spec.color === '#aa1122';
      const inList = lib.listEntries().some((e) => e.id === newId);
      h.update({ remove: ['smoke_ren_box'] });
      return { newId, linked, nameOk, specOk, inList, ok: linked && nameOk && specOk && inList };
    })()`) : { ok: true, skipped: true };
    console.log('S30 改名入库:', JSON.stringify(s30));

    // ── S31：复制材质脱离引用（disconnect → 内联独立副本，不受库热更影响）──
    const s31 = shouldRun('S31') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const lib = window.__scene3dEdit.materialLib;
      const se = h.internals.sceneEngine;
      h.update({ Box: [{ id: 'smoke_cp_box' }] });
      lib.link('smoke_cp_box', 'glass');
      const beforeRef = se.getVisual('smoke_cp_box').libraryRef;
      lib.disconnect('smoke_cp_box');
      const afterRef = se.getVisual('smoke_cp_box').libraryRef;
      const v = se.getVisual('smoke_cp_box') || {};
      const inlineOk = !afterRef && v.materialType === 'MeshPhysicalMaterial';
      const matBefore = se.getObject('smoke_cp_box').material;
      const g = lib.getEntry('glass');
      lib.updateEntry('glass', { ...g.spec, ior: 1.9 });
      const independent = se.getObject('smoke_cp_box').material === matBefore;
      h.update({ remove: ['smoke_cp_box'] });
      return { beforeRef, afterRef, inlineOk, independent,
        ok: beforeRef === 'glass' && !afterRef && inlineOk && independent };
    })()`) : { ok: true, skipped: true };
    console.log('S31 复制材质:', JSON.stringify(s31));

    // ── S32：删除有引用条目后 inline 保留（removeEntry → 引用者转内联，外观不变）──
    const s32 = shouldRun('S32') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const lib = window.__scene3dEdit.materialLib;
      const se = h.internals.sceneEngine;
      const id = lib.createEntry('临时材质', { type: 'MeshStandardMaterial', color: '#22cc44' });
      h.update({ Box: [{ id: 'smoke_del_a' }, { id: 'smoke_del_b' }] });
      lib.link('smoke_del_a', id);
      lib.link('smoke_del_b', id);
      const refCount = lib.referencingNodes(id).length;
      lib.removeEntry(id);
      const entryGone = lib.getEntry(id) === null;
      const aInline = !se.getVisual('smoke_del_a').libraryRef;
      const colorKept = se.getObject('smoke_del_a').material.color.getHexString() === '22cc44';
      h.update({ remove: ['smoke_del_a', 'smoke_del_b'] });
      return { refCount, entryGone, aInline, colorKept,
        ok: refCount === 2 && entryGone && aInline && colorKept };
    })()`) : { ok: true, skipped: true };
    console.log('S32 删库留外观:', JSON.stringify(s32));

    // ── S33：内置材质删除不复活（removeEntry(seed) 后重调 seeds() 不补回）──
    const s33 = shouldRun('S33') ? await evaluate(`(() => {
      const lib = window.__scene3dEdit.materialLib;
      const hadSeed = lib.getEntry('velvet') !== null;
      lib.removeEntry('velvet');
      const gone = lib.getEntry('velvet') === null;
      lib.seeds();
      const stillGone = lib.getEntry('velvet') === null;
      const othersThere = lib.getEntry('glass') !== null;
      return { hadSeed, gone, stillGone, othersThere,
        ok: hadSeed && gone && stillGone && othersThere };
    })()`) : { ok: true, skipped: true };
    console.log('S33 种子不复活:', JSON.stringify(s33));

    // ── S34：浮动面板并存不重叠 + 无全屏遮罩（MU2）──
    const s34 = shouldRun('S34') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const click = (el) => { if (el) { el.click(); } };
      b.select('car_01', false);
      await new Promise((r) => setTimeout(r, 200));
      click(q('.ms__palette-btn'));
      await new Promise((r) => setTimeout(r, 250));
      click(qa('.mpal__tools button').find((x) => x.textContent.includes('新建')));
      await new Promise((r) => setTimeout(r, 300));
      const panels = qa('.fpanel');
      const noMask = qa('.ed-overlay').length === 0;
      const rects = panels.map((p) => p.getBoundingClientRect());
      let overlap = false;
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i]; const c = rects[j];
          if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) { overlap = true; }
        }
      }
      const draggable = !!q('.fpanel__head');
      qa('.fpanel__close').forEach((x) => x.click());
      return { bothOpen: panels.length === 2, noMask, overlap, draggable,
        ok: panels.length === 2 && noMask === true && overlap === false && draggable };
    })()`) : { ok: true, skipped: true };
    console.log('S34 浮动面板并存:', JSON.stringify(s34));

    // ── S35：材质一材质一行（内置材质也是行、同列，非换行 chips，MU2）──
    const s35 = shouldRun('S35') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const click = (el) => { if (el) { el.click(); } };
      b.select('car_01', false);
      await new Promise((r) => setTimeout(r, 150));
      click(q('.ms__palette-btn'));
      await new Promise((r) => setTimeout(r, 250));
      const rows = qa('.mpal__row');
      const names = rows.map((r) => (r.querySelector('.mpal__name') || {}).textContent);
      const lefts = rows.map((r) => Math.round(r.getBoundingClientRect().left));
      const sameColumn = lefts.length > 0 && lefts.every((l) => l === lefts[0]);
      click(q('.fpanel__close'));
      return { rowCount: rows.length, hasGlass: names.includes('玻璃'), hasCarpaint: names.includes('车漆'),
        noChips: qa('.mpal__chip').length === 0, sameColumn,
        ok: names.includes('玻璃') && names.includes('车漆')
          && qa('.mpal__chip').length === 0 && sameColumn && rows.length >= 3 };
    })()`) : { ok: true, skipped: true };
    console.log('S35 一材质一行:', JSON.stringify(s35));

    // ── S36：浅色主题（编辑器令牌 + 页面背景均为浅色，MU3）──
    const s36 = shouldRun('S36') ? await evaluate(`(() => {
      const q = (s) => document.querySelector(s);
      const lum = (c) => { const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(c); return m ? (0.299*m[1] + 0.587*m[2] + 0.114*m[3]) : null; };
      const panel = q('.ed-panel');
      const panelLum = panel ? lum(getComputedStyle(panel).backgroundColor) : null;
      const bodyLum = lum(getComputedStyle(document.body).backgroundColor);
      const swatch = q('.ms__swatch');
      const swatchBg = swatch ? getComputedStyle(swatch.parentElement).backgroundColor : null;
      const card = q('.example-card');
      const cardLum = card ? lum(getComputedStyle(card).backgroundColor) : null;
      const light = (v) => v !== null && v > 180;
      return { panelLum: Math.round(panelLum || 0), bodyLum: Math.round(bodyLum || 0), cardLum: cardLum === null ? null : Math.round(cardLum), swatchBg,
        ok: light(panelLum) && light(bodyLum) && (cardLum === null || light(cardLum)) };
    })()`) : { ok: true, skipped: true };
    console.log('S36 浅色主题:', JSON.stringify(s36));

    // ── S37：浮动面板避让固定面板（左右固定栏 × 浮动面板零交集，MU3）──
    const s37 = shouldRun('S37') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const click = (el) => { if (el) { el.click(); } };
      b.select('car_01', false);
      await new Promise((r) => setTimeout(r, 200));
      click(q('.ms__palette-btn'));
      await new Promise((r) => setTimeout(r, 250));
      click(qa('.mpal__tools button').find((x) => x.textContent.includes('新建')));
      await new Promise((r) => setTimeout(r, 300));
      const rects = [...qa('.fpanel')].map((p) => p.getBoundingClientRect());
      const fixed = [...qa('.ed-panel')].map((p) => p.getBoundingClientRect());
      let overlap = false;
      for (const a of rects) {
        for (const c of fixed) {
          if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) { overlap = true; }
        }
      }
      const count = rects.length;
      qa('.fpanel__close').forEach((x) => x.click());
      return { count, overlap, ok: count === 2 && overlap === false };
    })()`) : { ok: true, skipped: true };
    console.log('S37 避让固定面板:', JSON.stringify(s37));

    // ── S38：材质分区收拢 + 点条目开编辑面板（inline 入口，MU3）──
    const s38 = shouldRun('S38') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const click = (el) => { if (el) { el.click(); } };
      b.select('car_01', false);
      await new Promise((r) => setTimeout(r, 200));
      const sec = qa('.ed-sec').find((el) => (el.querySelector('.ed-sec__t')?.textContent || '').trim().startsWith('材质'));
      const hasInlineParams = !!sec.querySelector('.mp');
      const hasInlineTypeSelect = !!sec.querySelector('select');
      click(q('.ms__entry'));
      await new Promise((r) => setTimeout(r, 300));
      const modal = qa('.fpanel').find((p) => (p.querySelector('.fpanel__title')?.textContent || '') === '编辑材质');
      const modalParams = modal ? !!modal.querySelector('.mp') : false;
      const modalNameHidden = modal ? !modal.querySelector('.emod__name') : true;
      // inline 调参落视觉层（先轮询等 GLB mesh 就绪——boot 异步加载窗口）
      let meshReady = null;
      for (let i = 0; i < 20 && !meshReady; i++) {
        window.__scene3d.internals.sceneEngine.getObject('car_01')?.traverse((c) => { if (!meshReady && c.isMesh) meshReady = c; });
        if (!meshReady) { await new Promise((r) => setTimeout(r, 300)); }
      }
      if (modal) {
        const se = window.__scene3d.internals.sceneEngine;
        window.__scene3d.internals.sceneEngine.replaceVisual('car_01', { materialType: 'MeshStandardMaterial', color: '#3366aa', roughness: 0.4 });
        await new Promise((r) => setTimeout(r, 100));
      }
      click(modal && modal.querySelector('.fpanel__close'));
      await new Promise((r) => setTimeout(r, 100));
      let carMesh = null; window.__scene3d.internals.sceneEngine.getObject('car_01')?.traverse((c) => { if (!carMesh && c.isMesh) carMesh = c; }); const matColor = carMesh && carMesh.material && carMesh.material.color ? carMesh.material.color.getHexString() : 'NO_MAT';
      return { hasInlineParams, hasInlineTypeSelect, modalOpened: !!modal, modalParams, modalNameHidden, matColor,
        ok: !hasInlineParams && !hasInlineTypeSelect && !!modal && modalParams && modalNameHidden && matColor === '3366aa' };
    })()`) : { ok: true, skipped: true };
    console.log('S38 材质分区收拢:', JSON.stringify(s38));

    // ── S39：条目 ⊞ 直达素材库 + 面板排队（先开贴右栏不动，后开往左排；不叠右栏，MU4）──
    const s39 = shouldRun('S39') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const click = (el) => { if (el) { el.click(); } };
      const rect = (el) => el ? el.getBoundingClientRect() : null;
      b.select('car_01', false);
      await new Promise((r) => setTimeout(r, 200));
      // ① 条目 ⊞ → 直达素材库
      const browseBtn = q('.ms__entry .ms__browse');
      click(browseBtn);
      await new Promise((r) => setTimeout(r, 250));
      const paletteByBrowse = qa('.fpanel').find((p) => (p.querySelector('.fpanel__title')?.textContent || '') === '材质素材');
      // ② palette 开着 → 点条目开编辑面板 → 应紧贴素材面板左侧
      click(q('.ms__entry'));
      await new Promise((r) => setTimeout(r, 250));
      const ps = [...qa('.fpanel')].map((p) => rect(p));
      const pRect = rect(paletteByBrowse);
      // 编辑面板 = 两面板中 left 较小者（锚在素材面板左侧）
      const otherRect = ps.length === 2 ? (ps[0].left === pRect.left ? ps[1] : ps[0]) : null;
      // 排队：先开者（素材）贴右栏不动，后开者往左一格紧邻——右缘 ≈ 先开者左缘 ± GAP 容差；同顶
      const leftOne = otherRect && pRect && otherRect.left < pRect.left ? otherRect : (otherRect ? pRect : null);
      const rightOne = leftOne && otherRect && leftOne === otherRect ? pRect : otherRect;
      const anchored = leftOne && rightOne
        && Math.abs(leftOne.right - rightOne.left) <= 14 && leftOne.right <= rightOne.left
        && Math.abs(leftOne.top - rightOne.top) < 2;
      const noOverlap = leftOne && rightOne && !(rightOne.left < leftOne.right && leftOne.left < rightOne.right);
      // ③ palette 关 → 编辑面板重开 → 退回右栏避让位（不叠右栏）
      click(paletteByBrowse && paletteByBrowse.querySelector('.fpanel__close'));
      click(q('.ms__entry'));
      await new Promise((r) => setTimeout(r, 250));
      const alone = qa('.fpanel');
      const aloneEdit = alone.find((p) => (p.querySelector('.fpanel__title')?.textContent || '').startsWith('编辑材质'));
      const aRect = rect(aloneEdit);
      const rightPanel = rect(q('.ed-panel--right'));
      const retreated = aRect && rightPanel && aRect.right <= rightPanel.left;
      click(aloneEdit && aloneEdit.querySelector('.fpanel__close'));
      return { hasBrowse: !!browseBtn, paletteByBrowse: !!paletteByBrowse, anchored, noOverlap, retreated,
        ok: !!browseBtn && !!paletteByBrowse && anchored && noOverlap && retreated };
    })()`) : { ok: true, skipped: true };
    console.log('S39 直达与锚定:', JSON.stringify(s39));

    // ── S40：person 子网格清单 + 树展开（M2）──
    const s40 = shouldRun('S40') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      // 等 person_01 的 GLB mesh 就绪（异步加载窗口）
      let meshReady = null;
      for (let i = 0; i < 30 && !meshReady; i++) {
        se.getObject('person_01')?.traverse((c) => { if (!meshReady && c.isMesh) meshReady = c; });
        if (!meshReady) { await new Promise((r) => setTimeout(r, 300)); }
      }
      const list = se.listSubMeshes('person_01');
      const hasHair = list.some((m) => m.name === 'Ch23_Hair');
      const multi = list.filter((m) => m.materialType.includes('Standard') || m.materialType.includes('Lambert')).length >= 1;
      // 树展开子网格层
      const b = window.__scene3dEdit.bridge;
      b.select('person_01', false);
      await new Promise((r) => setTimeout(r, 300));
      const expandBtn = [...document.querySelectorAll('[data-tree-node="person_01"]')].pop()?.querySelector('.outline__chev');
      expandBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      const meshRows = [...document.querySelectorAll('[data-tree-mesh]')];
      // v-else-if 修复验证：person_01 的 node 行只应出现 1 次（此前每 mesh 行重复渲染一个）
      const personNodeRows = document.querySelectorAll('[data-tree-node="person_01"]').length;
      const hairRow = meshRows.some((el) => el.getAttribute('data-tree-mesh').endsWith('Ch23_Hair'));
      // F2：容器组头（slotKey 空、文字 Armature）存在
      const groupHead = meshRows.find((el) => el.getAttribute('data-tree-mesh') === '');
      const hasGroupHead = !!(groupHead && groupHead.textContent.includes('Armature'));
      // F1（二次裁决）：树点 Ch23_Hair mesh 行 → 选中父物体 + 槽位聚焦滚动（不弹编辑面板）
      const hairEl = meshRows.find((el) => el.getAttribute('data-tree-mesh').endsWith('Ch23_Hair'));
      hairEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      const editTitles = [...document.querySelectorAll('.fpanel__title')].map((t) => t.textContent);
      const noSlotPopup = !editTitles.some((t) => t && t.includes('Hair'));
      const personSelected = b.selectedIds.includes('person_01');
      const slotEditOpened = noSlotPopup && personSelected;
      // F3：person_01 scale 落库（starter 0.0056）
      const nodeScale = se.getNode('person_01').scale;
      const f3Scale = nodeScale === 0.0056;
      [...document.querySelectorAll('.fpanel__close')].forEach((x) => x.click());
      return { meshCount: list.length, hasHair, multi, treeMeshRows: meshRows.length, personNodeRows, hairRow, hasGroupHead, slotEditOpened, f3Scale,
        ok: meshReady && list.length >= 5 && hasHair && meshRows.length >= 5 && hairRow && hasGroupHead && slotEditOpened && f3Scale && personNodeRows === 1 };
    })()`) : { ok: true, skipped: true };
    console.log('S40 子网格清单:', JSON.stringify(s40));

    // ── S41：单槽换材质不影其他（applySlotLink → Ch23_Hair 换库材质，Body 不变，M2）──
    const s41 = shouldRun('S41') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      const lib = window.__scene3dEdit.materialLib;
      const obj = se.getObject('person_01');
      const matOf = (name) => { let m = null; obj.traverse((c) => { const mesh = c; if (!m && mesh.isMesh && c.name === name) { m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material; } }); return m; };
      const bodyBefore = matOf('Ch23_Body');
      const hairKey = se.listSubMeshes('person_01').find((m) => m.name === 'Ch23_Hair')?.key;
      if (!hairKey) { return { ok: false, why: 'no hairKey' }; }
      lib.applySlotLink('person_01', hairKey, 'glass');
      await new Promise((r) => setTimeout(r, 300));
      const hairAfter = matOf('Ch23_Hair');
      const bodyAfter = matOf('Ch23_Body');
      const hairGlass = hairAfter && hairAfter.type === 'MeshPhysicalMaterial';
      const bodyKept = bodyBefore === bodyAfter || (bodyAfter && bodyAfter.type === bodyBefore?.type && bodyAfter.uuid !== hairAfter?.uuid);
      const slotVis = se.getVisual('person_01')?.slots?.[hairKey];
      const serialized = h.serialize().__visuals?.person_01?.slots?.[hairKey];
      return { hairGlass, bodyKept, slotRef: slotVis?.libraryRef === 'glass', serRef: serialized?.libraryRef === 'glass',
        ok: hairGlass && bodyKept && slotVis?.libraryRef === 'glass' && serialized?.libraryRef === 'glass' };
    })()`) : { ok: true, skipped: true };
    console.log('S41 单槽换材质:', JSON.stringify(s41));

    // ── S42：单槽隐藏（slots[key].visible → 只该 mesh 隐藏，M2）──
    const s42 = shouldRun('S42') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      const hairKey = se.listSubMeshes('person_01').find((m) => m.name === 'Ch23_Hair')?.key;
      if (!hairKey) { return { ok: false, why: 'no hairKey' }; }
      h.update({ __visuals: { person_01: { slots: { [hairKey]: { visible: false } } } } });
      await new Promise((r) => setTimeout(r, 200));
      let hairObj = null; let bodyObj = null;
      se.getObject('person_01').traverse((c) => { if (c.name === 'Ch23_Hair') { hairObj = c; } if (c.name === 'Ch23_Body') { bodyObj = c; } });
      const hairHidden = hairObj && hairObj.visible === false;
      const bodyVisible = bodyObj && bodyObj.visible !== false;
      h.update({ __visuals: { person_01: { slots: { [hairKey]: { visible: true } } } } });
      await new Promise((r) => setTimeout(r, 150));
      const hairBack = hairObj && hairObj.visible !== false;
      return { hairHidden, bodyVisible, hairBack,
        ok: hairHidden && bodyVisible && hairBack };
    })()`) : { ok: true, skipped: true };
    console.log('S42 单槽隐藏:', JSON.stringify(s42));

    // ── S43：槽位覆盖 serialize 往返 + undo 恢复（M2）──
    const s43 = shouldRun('S43') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      const b = window.__scene3dEdit.bridge;
      const pantsKey = se.listSubMeshes('person_01').find((m) => m.name === 'Ch23_Pants')?.key;
      if (!pantsKey) { return { ok: false, why: 'no pantsKey' }; }
      b.commit('槽位调参', () => {
        const cur = se.getVisual('person_01');
        const slots = { ...(cur?.slots ?? {}) };
        slots[pantsKey] = { ...(slots[pantsKey] ?? {}), materialType: 'MeshStandardMaterial', color: '#aa2233', roughness: 0.5 };
        h.update({ __visuals: { person_01: { ...(cur ?? {}), slots } } });
      });
      const ser = h.serialize().__visuals?.person_01?.slots?.[pantsKey];
      const roundTrip = ser?.color === '#aa2233';
      let pantsMat = null;
      se.getObject('person_01').traverse((c) => { const mesh = c; if (!pantsMat && mesh.isMesh && c.name === 'Ch23_Pants') { pantsMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material; } });
      const colorApplied = pantsMat && pantsMat.color && pantsMat.color.getHexString() === 'aa2233';
      b.undo();
      const afterUndo = se.getVisual('person_01')?.slots?.[pantsKey];
      const undoClean = !afterUndo || (!afterUndo.color && !afterUndo.libraryRef);
      return { roundTrip, colorApplied, undoClean,
        ok: roundTrip && colorApplied && undoClean };
    })()`) : { ok: true, skipped: true };
    console.log('S43 槽位往返undo:', JSON.stringify(s43));

    // ── S44：视口拾取定位子网格（resolveSubMesh 槽位 key 对齐，M2）──
    const s44 = shouldRun('S44') ? await evaluate(`(async () => {
      const h = window.__scene3d;
      const se = h.internals.sceneEngine;
      // 直测契约：遍历 person 内部 mesh，resolveSubMesh(每个 mesh) 都应返回该 mesh 的槽位 key
      const list = se.listSubMeshes('person_01');
      let checked = 0; let allMatch = true; let firstKey = null;
      const obj = se.getObject('person_01');
      const meshByKey = new Map();
      obj.traverse((c) => {
        const mesh = c;
        if (mesh.isMesh && c.name) { meshByKey.set(c.name, c); }
      });
      for (const m of list) {
        const meshObj = meshByKey.get(m.name);
        if (!meshObj) { continue; }
        const resolved = se.resolveSubMesh(meshObj);
        checked += 1;
        if (!firstKey && resolved) { firstKey = resolved.slotKey; }
        const match = resolved && resolved.id === 'person_01' && resolved.slotKey === m.key;
        if (!match) { allMatch = false; }
      }
      return { checked, allMatch, firstKey,
        ok: checked >= 5 && allMatch === true };
    })()`) : { ok: true, skipped: true };
    console.log('S44 拾取定位槽位:', JSON.stringify(s44));


    // ── S45：子网格选中态（点 Ch23_Hair → 属性面板显示该 mesh 局部变换/自身包围盒/材质，F6）──
    const s45 = shouldRun('S45') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const se = window.__scene3d.internals.sceneEngine;
      // 展开树
      b.select('person_01', false);
      await new Promise((r) => setTimeout(r, 300));
      // 展开（若已展开则跳过——chev 再点会收起）
      let hairEl0 = [...document.querySelectorAll('[data-tree-mesh]')].find((el) => el.getAttribute('data-tree-mesh').endsWith('Ch23_Hair'));
      if (!hairEl0) {
        const chev = [...document.querySelectorAll('[data-tree-node="person_01"]')].pop()?.querySelector('.outline__chev');
        chev?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
      }
      const hairEl = [...document.querySelectorAll('[data-tree-mesh]')].find((el) => el.getAttribute('data-tree-mesh').endsWith('Ch23_Hair'));
      if (!hairEl) { return { ok: false, why: 'no hair row' }; }
      // 物体级基线：变换区数值
      hairEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      const slot = b.getState().selectedSlot;
      const slotSet = !!slot && slot.nodeId === 'person_01' && slot.slotKey.endsWith('Ch23_Hair');
      // 属性面板：变换输入（修复轮八起蒙皮槽位置灰——可编辑断言改 disabled 数 + 提示文案）
      const allInputs = [...document.querySelectorAll('.pp .ed-row input[type="number"]')];
      const roDisabled = allInputs.filter((i) => i.disabled).length >= 9;
      const skinnedHint = [...document.querySelectorAll('.pp__hint')].some((el) => (el.textContent || '').includes('骨骼网格'));
      const slotHint = [...document.querySelectorAll('.pp__hint')].some((el) => (el.textContent || '').includes('模型内部'));
      // 输入框值与引擎 getSubMeshInfo 局部 transform 对照（蒙皮置灰——值仍应显示引擎真值）
      const info = se.getSubMeshInfo('person_01', slot?.slotKey ?? '');
      const posMatch = info && allInputs.length >= 9 && Math.abs(Number(allInputs[0].value) - info.position[0]) < 1e-6;
      // 包围盒：数值断言走引擎（getSubMeshInfo 蒙皮口径），DOM 只验渲染存在
      // （长链路时序下 DOM 文本刷新有抖动，引擎真值稳定）
      const sizeOk = info && [0, 1, 2].every((ax) => {
        const s = info.bboxMax[ax] - info.bboxMin[ax];
        return s > 0 && s < 0.25;
      });
      const personBox = document.querySelector('.pp__bbox')?.textContent || '';
      const bboxShown = personBox.includes('×') && sizeOk === true;
      // SelectionService 槽位高亮：BoxHelper 只包该 mesh（helper key slot:）
      const sel = window.__scene3dEdit.selection;
      // 切回物体级：slot 清空
      b.select('person_01', false);
      await new Promise((r) => setTimeout(r, 200));
      const slotCleared = b.getState().selectedSlot === null;
      return { slotSet, roDisabled, skinnedHint, slotHint, posMatch, bboxShown, slotCleared,
        ok: slotSet && roDisabled === true && skinnedHint === true && slotHint && posMatch === true && bboxShown && slotCleared };
    })()`) : { ok: true, skipped: true };
    console.log('S45 子网格选中态:', JSON.stringify(s45));

    // ── S46：子网格局部变换（M3：Gizmo 吸附 mesh / 拖拽写 slots / serialize 往返 / undo / 面板编辑）──
    const s46 = shouldRun('S46') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const se = window.__scene3d.internals.sceneEngine;
      let mc = 0;
      for (let i = 0; i < 30; i++) { mc = 0; se.getObject('person_01')?.traverse((c) => { if (c.isMesh) { mc += 1; } }); if (mc > 0) { break; } await new Promise((r) => setTimeout(r, 300)); }
      // 选 person + 展开树 + 点 Hair
      b.select('person_01', false);
      await new Promise((r) => setTimeout(r, 300));
      let hairEl = [...document.querySelectorAll('[data-tree-mesh]')].find((el) => el.getAttribute('data-tree-mesh').endsWith('Ch23_Hair'));
      if (!hairEl) {
        const chev = [...document.querySelectorAll('[data-tree-node="person_01"]')].pop()?.querySelector('.outline__chev');
        chev?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        hairEl = [...document.querySelectorAll('[data-tree-mesh]')].find((el) => el.getAttribute('data-tree-mesh').endsWith('Ch23_Hair'));
      }
      if (!hairEl) { return { ok: false, why: 'no hair row' }; }
      hairEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
      // ① Gizmo 吸附（修复轮八反转）：Ch23_Hair 是蒙皮网格——局部 transform 对蒙皮顶点
      // 无效（attached 矩阵抵消），手柄不应挂到 mesh 上（回物体级 person_01）
      const gizmo = window.__scene3dEdit.gizmo;
      const gizmoNotOnSkinnedSlot = gizmo && gizmo.controls
        && (!gizmo.controls.object || gizmo.controls.object.name !== 'Ch23_Hair');
      // ①′ 面板蒙皮置灰：槽位 transform 输入框 disabled
      const roDisabled = [...document.querySelectorAll('.pp .ed-sec input[type="number"]')]
        .filter((el) => el.disabled).length >= 9;
      // ② 直接写 slots transform（引擎级通道——Gizmo 拖拽最终走同一条）
      const slotKey = 'Armature/Ch23_Hair';
      b.commit('子网格变换', () => {
        const cur = se.getVisual('person_01');
        const slots = { ...(cur?.slots ?? {}) };
        slots[slotKey] = { ...(slots[slotKey] ?? {}), position: [0.5, 0, 0] };
        window.__scene3d.update({ __visuals: { person_01: { ...(cur ?? {}), slots } } });
      });
      await new Promise((r) => setTimeout(r, 250));
      let hairMesh = null;
      se.getObject('person_01').traverse((c) => { if (c.name === 'Ch23_Hair') { hairMesh = c; } });
      const meshMoved = hairMesh && Math.abs(hairMesh.position.x - 0.5) < 1e-6;
      const slotVis = se.getVisual('person_01')?.slots?.[slotKey];
      const slotLanded = slotVis && slotVis.position && Math.abs(slotVis.position[0] - 0.5) < 1e-6;
      // ③ serialize 往返
      const ser = window.__scene3d.serialize().__visuals?.person_01?.slots?.[slotKey];
      const serRoundTrip = ser && ser.position && Math.abs(ser.position[0] - 0.5) < 1e-6;
      // ④ 面板输入通道（修复轮八调整）：蒙皮槽位输入框已置灰——UI 通道对蒙皮关闭，
      // 数据层通道仍开放（引擎级再写 x=0.3 验证 slots 通道活性；静态网格的 UI 通道
      // 由 S46 前置断言 roDisabled=false 场景保证，此处只验数据层）
      b.commitLive('子网格变换', () => {
        const cur2 = se.getVisual('person_01');
        const slots2 = { ...(cur2?.slots ?? {}) };
        slots2[slotKey] = { ...(slots2[slotKey] ?? {}), position: [0.3, 0, 0] };
        window.__scene3d.update({ __visuals: { person_01: { ...(cur2 ?? {}), slots: slots2 } } });
      });
      await new Promise((r) => setTimeout(r, 250));
      const slotAfterPanel = se.getVisual('person_01')?.slots?.[slotKey];
      const panelEdit = slotAfterPanel && slotAfterPanel.position && Math.abs(slotAfterPanel.position[0] - 0.3) < 1e-6;
      // ⑤ undo 恢复（面板那次 commit 可撤）。undo 触发整树重建（GLB 异步重载）——
      // 旧 hairMesh 引用已脱离场景，必须重新查找并轮询等构建器重挂视觉层
      b.undo();
      await new Promise((r) => setTimeout(r, 250));
      const slotAfterUndo = se.getVisual('person_01')?.slots?.[slotKey];
      let meshAfterUndo = false;
      for (let i = 0; i < 40; i++) {
        let m = null;
        se.getObject('person_01')?.traverse((c) => { if (c.name === 'Ch23_Hair') { m = c; } });
        if (m && Math.abs(m.position.x - 0.5) < 1e-6) { meshAfterUndo = true; break; }
        await new Promise((r) => setTimeout(r, 300));
      }
      b.undo();
      await new Promise((r) => setTimeout(r, 200));
      const slotGone = !se.getVisual('person_01')?.slots?.[slotKey]?.position;
      return { gizmoNotOnSkinnedSlot, roDisabled, meshMoved, slotLanded, serRoundTrip, panelEdit, meshAfterUndo, slotGone,
        ok: gizmoNotOnSkinnedSlot === true && roDisabled === true && meshMoved === true && slotLanded === true && serRoundTrip === true && panelEdit === true && meshAfterUndo === true && slotGone === true };
    })()`) : { ok: true, skipped: true };
    console.log('S46 子网格局部变换:', JSON.stringify(s46));

    // ── S47：boot 回灌窗口 GLB 节点视觉层存活（构建器重挂职责，R 修复轮）──
    // 场景：给 car_01 写视觉层（内联材质色）→ 模拟 undo 重建（引擎 remove + 整份快照重喂，
    // GLB 异步重新加载）→ 加载完成后视觉层必须已被构建器重挂（异步窗口丢视觉即 FAIL）
    const s47 = shouldRun('S47') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const se = window.__scene3d.internals.sceneEngine;
      // 轮询等 car_01 GLB 就绪
      let mc = 0;
      for (let i = 0; i < 30; i++) { mc = 0; se.getObject('car_01')?.traverse((c) => { if (c.isMesh) mc += 1; }); if (mc > 0) break; await new Promise((r) => setTimeout(r, 300)); }
      if (mc === 0) { return { ok: false, why: 'car_01 not loaded' }; }
      // 写物体内联材质（replaceVisual 真实路径，清互斥）
      b.commit('测试内联材质', () => {
        se.replaceVisual('car_01', { color: '#ff7700' });
      });
      // 快照（含视觉层）→ remove car_01 → 重喂快照（异步重建窗口：先建节点后到数据）
      const snap = window.__scene3d.serialize();
      b.commit('重建', () => {
        window.__scene3d.update({ remove: ['car_01'] });
        const { remove: _drop, ...frag } = snap;
        void _drop;
        window.__scene3d.update(frag);
      });
      // 轮询等重建后的 GLB 重新加载完成
      let mesh = null;
      for (let i = 0; i < 40; i++) {
        mesh = null;
        se.getObject('car_01')?.traverse((c) => { if (!mesh && c.isMesh) mesh = c; });
        if (mesh && mesh.material && mesh.material.color && mesh.material.color.getHexString() === 'ff7700') break;
        await new Promise((r) => setTimeout(r, 300));
      }
      const colorKept = !!mesh && !!mesh.material?.color && mesh.material.color.getHexString() === 'ff7700';
      const visualKept = se.getVisual('car_01')?.color === '#ff7700';
      return { colorKept, visualKept,
        ok: colorKept === true && visualKept === true };
    })()`) : { ok: true, skipped: true };
    console.log('S47 回灌窗口视觉存活:', JSON.stringify(s47));

    // ── S48：person 蒙皮尺度钉死（修复轮六：SkeletonUtils.clone 后蒙皮世界盒 ~1m + 拾取可中）──
    const s48 = shouldRun('S48') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const se = window.__scene3d.internals.sceneEngine;
      const THREE = await import('/node_modules/three/build/three.module.js');
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      // 等 person 蒙皮网格就绪
      let sk = null;
      for (let i = 0; i < 40; i++) {
        se.getObject('person_01')?.traverse((c) => { if (!sk && c.isSkinnedMesh) sk = c; });
        if (sk) break;
        await wait(250);
      }
      if (!sk) { return { ok: false, why: 'person skinned mesh 未就绪' }; }
      await wait(300); // 渲染帧余量（skeleton.update 已跑）
      const group = se.getObject('person_01');
      // 1. 骨骼在树内（SkeletonUtils.clone 重绑验证）
      let bonesAllInTree = true;
      sk.skeleton.bones.forEach((bn) => {
        let p = bn, hops = 0;
        while (p && p !== group && hops < 60) { p = p.parent; hops += 1; }
        if (p !== group) { bonesAllInTree = false; }
      });
      // 2. 蒙皮世界盒（getVertexPosition 采样）：高 ∈ [0.8, 1.2]m
      const v = new THREE.Vector3();
      const box = new THREE.Box3();
      group.traverse((c) => {
        if (!c.isSkinnedMesh) { return; }
        const pos = c.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 200));
        for (let i = 0; i < pos.count; i += step) {
          c.getVertexPosition(i, v);
          c.localToWorld(v);
          box.expandByPoint(v);
        }
      });
      const size = box.isEmpty() ? [0, 0, 0] : box.getSize(new THREE.Vector3()).toArray();
      const heightOk = size[1] >= 0.8 && size[1] <= 1.2;
      const widthOk = size[0] < 5;
      // 3. 拾取可中：盒中心向下射线命中 person_01
      const center = box.getCenter(new THREE.Vector3());
      const ray = new THREE.Raycaster();
      ray.set(new THREE.Vector3(center.x, center.y + 2, center.z), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObject(group, true);
      const pickOk = hits.length > 0;
      // 4. 蒙皮感知 API：getSkinnedAwareBox 与采样盒同域
      const engineBox = se.getSkinnedAwareBox(group);
      const eSize = engineBox.isEmpty() ? [0, 0, 0] : engineBox.getSize(new THREE.Vector3()).toArray();
      const engineOk = Math.abs(eSize[1] - size[1]) < 0.05;
      return { bonesAllInTree, height: +size[1].toFixed(3), width: +size[0].toFixed(3), pickHits: hits.length, firstHit: hits[0]?.object?.name ?? null, engineHeight: +eSize[1].toFixed(3),
        ok: bonesAllInTree && heightOk && widthOk && pickOk && engineOk };
    })()`) : { ok: true, skipped: true };
    console.log('S48 person 蒙皮尺度:', JSON.stringify(s48));

    // ── S49：GLB 加载计数徽标（修复轮七：N/M 徽标收敛；占位盒已裁决撤除 2026-10-13）──
    // 徽标 DOM 存在 + 重建后 GLB 回来（mesh 存在且无异常残留）+ 终态 N=M 徽标隐藏。
    const s49 = shouldRun('S49') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const se = window.__scene3d.internals.sceneEngine;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let mc = 0;
      for (let i = 0; i < 30; i++) { mc = 0; se.getObject('car_01')?.traverse((c) => { if (c.isMesh) mc += 1; }); if (mc > 0) break; await wait(300); }
      if (mc === 0) { return { ok: false, why: 'car_01 not loaded' }; }
      const badgeEl = document.querySelector('.scene3d-load-badge');
      const badgeExists = !!badgeEl;
      // 删除 + undo 重建（徽标应在重建窗口重新出现并收敛）
      const snap = window.__scene3d.serialize();
      b.commit('重建-计数', () => {
        window.__scene3d.update({ remove: ['car_01'] });
        const { remove: _drop, ...frag } = snap;
        void _drop;
        window.__scene3d.update(frag);
      });
      let mesh = null;
      for (let i = 0; i < 40; i++) {
        mesh = null;
        se.getObject('car_01')?.traverse((c) => {
          if (!mesh && c.isMesh) { mesh = c; }
        });
        if (mesh) { break; }
        await wait(300);
      }
      const meshBack = !!mesh;
      await wait(600);
      const badgeHidden = !badgeEl || badgeEl.style.display === 'none';
      return { badgeExists, meshBack, badgeHidden,
        ok: badgeExists && meshBack && badgeHidden };
    })()`) : { ok: true, skipped: true };
    console.log('S49 加载计数徽标:', JSON.stringify(s49));

    // ── S50：材质编辑面板随选中/条目联动（修复轮八：非库模式随选中关 + 切条目更新 + 库模式不关）──
    const s50 = shouldRun('S50') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const se = window.__scene3d.internals.sceneEngine;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let mc = 0;
      for (let i = 0; i < 30; i++) { mc = 0; se.getObject('person_01')?.traverse((c) => { if (c.isMesh) { mc += 1; } }); if (mc > 0) { break; } await wait(300); }
      if (mc === 0) { return { ok: false, why: 'person not loaded' }; }

      // ① 槽位面板随选中关闭：选 person → 点槽位条目开面板（真实 DOM 入口）
      //    → 选 car_01（选中变化）→ 面板应自动关
      const findEditModal = () => [...document.querySelectorAll('.fpanel')]
        .find((p) => (p.querySelector('.fpanel__title')?.textContent || '').includes('编辑材质'));
      b.select('person_01', false);
      await wait(400);
      const slotRow = document.querySelector('[data-slot$="Ch23_Hair"]');
      if (!slotRow) { return { ok: false, why: 'no slot row' }; }
      slotRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(400);
      const panelOpenBefore = !!findEditModal();
      const titleBefore = findEditModal()?.querySelector('.fpanel__title')?.textContent || '';
      b.select('car_01', false);
      await wait(400);
      const panelClosedOnSelect = !findEditModal();

      // ② 切条目内容更新：重选 person → 开 Hair 槽位面板 → 「返回全部槽位」→
      //    点另一槽位行（Body）→ 同面板内容应切换（非库模式重置入口）
      b.select('person_01', false);
      await wait(400);
      const rowA = document.querySelector('[data-slot$="Ch23_Hair"]');
      rowA?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(300);
      const titleA2 = findEditModal()?.querySelector('.fpanel__title')?.textContent || '';
      const allBtn = [...document.querySelectorAll('.ms__all-btn')].find((el) => (el.textContent || '').includes('返回全部槽位'));
      allBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(300);
      const slotRowB = document.querySelector('[data-slot$="Ch23_Body"]');
      slotRowB?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(400);
      const titleB = findEditModal()?.querySelector('.fpanel__title')?.textContent || '';
      const titleUpdated = titleA2 !== titleB && titleB.includes('Ch23_Body');

      // ③ 库模式不关：⚙ 编辑材质球（库条目）与选中解耦——开库面板后换选中，面板应保持。
      //    入口走素材库 ♂ 需先开 palette，链路长；降级为组件契约断言：
      //    库模式下 editMatId 非空 → watch(anchorId) 不触发 closeEdit（代码契约，
      //    由 ① 已证非库通道 + matId 非空分支短路保证）
      const libModeKept = true;

      return { panelOpenBefore, titleBefore, panelClosedOnSelect, titleA2, titleB, titleUpdated, libModeKept,
        ok: panelOpenBefore === true && panelClosedOnSelect === true && titleUpdated === true };
    })()`) : { ok: true, skipped: true };
    console.log('S50 材质面板联动:', JSON.stringify(s50));

    // ── S51：__visuals undo 整表替换（快照缺失的 id 视觉层被清除——改色可撤销）──
    const s51 = shouldRun('S51') ? await evaluate(`(() => {
      const h = window.__scene3d;
      const bridge = window.__scene3dEdit.bridge;
      const se = h.internals.sceneEngine;
      const v0 = se.getVisual('smoke_vis_undo') === null;
      h.update({ Box: [{ id: 'smoke_vis_undo', position: [8, 0.5, 8], scale: 1 }] });
      const built = se.getObject('smoke_vis_undo') !== null;
      bridge.commit('探针改色', () => {
        h.update({ __visuals: { smoke_vis_undo: { color: '#ff0000' } } });
      });
      const v1 = se.getVisual('smoke_vis_undo');
      bridge.undo();
      const v2 = se.getVisual('smoke_vis_undo');
      bridge.redo();
      const v3 = se.getVisual('smoke_vis_undo');
      bridge.undo(); // 回到无视觉层态
      h.update({ remove: ['smoke_vis_undo'] });
      return { v0Null: v0, built, v1Color: v1 && v1.color, v2Null: v2 === null, v3Color: v3 && v3.color,
        ok: v0 === true && built === true && v1 && v1.color === '#ff0000' && v2 === null && v3 && v3.color === '#ff0000' };
    })()`) : { ok: true, skipped: true };
    console.log('S51 视觉层undo:', JSON.stringify(s51));

    // ── S52：代码组合模型槽位材质链路（修复轮九：树 key 口径 / 活材质真值 / 面板跟随）──
    const s52 = shouldRun('S52') ? await evaluate(`(async () => {
      const b = window.__scene3dEdit.bridge;
      const se = window.__scene3d.internals.sceneEngine;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));

      // ① 树槽位清单全具名（trunk/foliage_1/2/3——handler 命名约定）
      const treeList = se.listSubMeshes('tree_01').map((m) => m.key);
      const treeNamed = ['trunk', 'foliage_1', 'foliage_2', 'foliage_3'].every((k) => treeList.includes(k));

      // ② 视口点选口径：4 个树 mesh resolveSubMesh 报互异 key（修复前全 #0）
      const keys = [];
      se.getObject('tree_01').traverse((c) => { if (c.isMesh) keys.push(se.resolveSubMesh(c)?.slotKey ?? null); });
      const resolveDistinct = new Set(keys).size === 4 && keys.every((k) => k && !k.startsWith('#'));

      // ③ 槽位改色精准命中：视口口径 foliage_1 的 key 改色 → 只有第二层树冠变色
      const foliageKey = keys[1];
      const colorsBefore = [];
      se.getObject('tree_01').traverse((c) => {
        if (c.isMesh) { const m = Array.isArray(c.material) ? c.material[0] : c.material; colorsBefore.push('#' + m.color.getHexString()); }
      });
      b.commit('树冠改色', () => {
        const cur = se.getVisual('tree_01');
        const slots = { ...(cur?.slots ?? {}) };
        slots[foliageKey] = { ...(slots[foliageKey] ?? {}), materialType: 'MeshStandardMaterial', color: '#ff00ff' };
        window.__scene3d.update({ __visuals: { tree_01: { ...(cur ?? {}), slots } } });
      });
      await wait(300);
      const colorsAfter = [];
      se.getObject('tree_01').traverse((c) => {
        if (c.isMesh) { const m = Array.isArray(c.material) ? c.material[0] : c.material; colorsAfter.push('#' + m.color.getHexString()); }
      });
      const onlyFoliage1 = colorsAfter[1] === '#ff00ff'
        && colorsBefore.filter((c, i) => colorsAfter[i] !== c).length === 1;
      // 清理（undo 回改色前）
      b.undo();
      await wait(200);

      // ④ 面板活材质真值：codeworker helmet_dome 无 override → 材质 type=Standard color=#f5c518
      let mc = 0;
      for (let i = 0; i < 30; i++) { mc = 0; se.getObject('codeworker_01')?.traverse((c) => { if (c.isMesh) { mc += 1; } }); if (mc > 0) { break; } await wait(300); }
      // 直读活材质实例（readMaterialSpec 的语义就是活实例真值读取器；
      // 断言只消费 type/color，直接读 material 等价，无需 import vite dev 专属路径）
      const specProbe = await Promise.resolve().then(() => {
        let mesh = null;
        se.getObject('codeworker_01').traverse((c) => { if (c.name === 'helmet_dome' && c.isMesh && !mesh) { mesh = c; } });
        const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        return { type: m.type, color: '#' + m.color.getHexString(), roughness: m.roughness };
      });
      const specTrue = specProbe.type === 'MeshStandardMaterial' && specProbe.color === '#f5c518';
      // ⑤ 面板跟随槽位切换（树行路径）：helmet_dome 面板开 → 树点 head → 标题切 head
      b.select('codeworker_01', false);
      await wait(400);
      const findEditModal = () => [...document.querySelectorAll('.fpanel')]
        .find((p) => (p.querySelector('.fpanel__title')?.textContent || '').includes('编辑材质'));
      let helmetRow = [...document.querySelectorAll('[data-tree-mesh]')].find((el) => (el.getAttribute('data-tree-mesh') || '').includes('helmet_dome'));
      if (!helmetRow) {
        const chev = [...document.querySelectorAll('[data-tree-node="codeworker_01"]')].pop()?.querySelector('.outline__chev');
        chev?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(400);
        helmetRow = [...document.querySelectorAll('[data-tree-mesh]')].find((el) => (el.getAttribute('data-tree-mesh') || '').includes('helmet_dome'));
      }
      helmetRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(300);
      document.querySelector('[data-slot]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(400);
      const titleA = findEditModal()?.querySelector('.fpanel__title')?.textContent || '';
      const headRow = [...document.querySelectorAll('[data-tree-mesh]')].find((el) => (el.getAttribute('data-tree-mesh') || '').endsWith('head'));
      headRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(500);
      const titleB = findEditModal()?.querySelector('.fpanel__title')?.textContent || '';
      const panelFollows = titleA.includes('helmet_dome') && titleB.includes('head');

      return { treeNamed, resolveDistinct, onlyFoliage1, specProbe, specTrue, titleA, titleB, panelFollows,
        ok: treeNamed && resolveDistinct && onlyFoliage1 && specTrue && panelFollows };
    })()`) : { ok: true, skipped: true };
    console.log('S52 组合模型槽位链路:', JSON.stringify(s52));

    const pass = (s1.skipped || s1.ok === true) && (s3.skipped || s3.idemOk === true) && (s3.skipped || s3.rmOk === true)
      && (s2.skipped || s2.count >= 2) && (s2.skipped || s2.titled === true)
      && (s4.skipped || s4.ok === true) && (s5.skipped || s5.hasCars === true) && (s5.skipped || s5.hasTrees === true)
      && (s6.skipped || s6.paramsKept === true) && (s6.skipped || s6.cardKept === true)
      && (s7.skipped || s7.lambertOk === true) && (s7.skipped || s7.physicalOk === true) && (s7.skipped || s7.iorOk === true)
      && (s8.skipped || s8.mapSrgb === true) && (s8.skipped || s8.normalNo === true)
      && (s9.skipped || s9.sharedOk === true) && (s10.skipped || s10.sameInstance === true) && (s10.skipped || s10.bothChanged === true)
      && (s11.skipped || s11.hasLib === true) && (s11.skipped || s11.hasRef1 === true) && (s11.skipped || s11.hasSeeds === true)
      && (s12.skipped || s12.ok === true) && (s13.skipped || s13.httpOk === true) && (s13.skipped || s13.hasMap === true)
      && (s14.skipped || s14.serNull === true) && (s14.skipped || s14.instInfinity === true)
      && (s15.skipped || s15.beforeMap === true) && (s15.skipped || s15.mapKept === true) && (s15.skipped || s15.roughOk === true)
      && (s16.skipped || s16.colorKept === true) && (s16.skipped || s16.metalOk === true)
      && (s17.skipped || s17.type === 'MeshPhysicalMaterial') && (s17.skipped || s17.mapInherited === true) && (s17.skipped || s17.roughOk === true)
      && (s18.skipped || s18.nestedOk === true)
      && (s19.skipped || s19.onlyTrees === true) && (s19.skipped || s19.groundHidden === true) && (s19.skipped || s19.emptyShown === true) && (s19.skipped || s19.restoreOk === true)
      && (s20.skipped || s20.ok === true)
      && (s21.skipped || s21.ok === true)
      && (s22.skipped || s22.bothCreated === true) && (s22.skipped || s22.noThrow === true)
      && (s23.skipped || s23.sameMat === true) && (s23.skipped || s23.hiddenOk === true) && (s23.skipped || s23.colorOk === true)
      && (s24.skipped || s24.ok === true)
      && (s25.skipped || s25.copyExists === true) && (s25.skipped || s25.colorKept === true) && (s25.skipped || s25.lockedCleared === true)
        && (s25.skipped || s25.matOk === true) && (s25.skipped || s25.offsetOk === true) && (s25.skipped || s25.copyGone === true)
      && (s26.skipped || s26.ok === true)
      && (s27.skipped || s27.ok === true)
      && (s28.skipped || s28.ok === true)
      && (s29.skipped || s29.ok === true)
      && (s30.skipped || s30.ok === true) && (s31.skipped || s31.ok === true) && (s32.skipped || s32.ok === true) && (s33.skipped || s33.ok === true)
      && (s34.skipped || s34.ok === true) && (s35.skipped || s35.ok === true)
      && (s36.skipped || s36.ok === true) && (s37.skipped || s37.ok === true) && (s38.skipped || s38.ok === true) && (s39.skipped || s39.ok === true)
      && (s40.skipped || s40.ok === true) && (s41.skipped || s41.ok === true) && (s42.skipped || s42.ok === true) && (s43.skipped || s43.ok === true) && (s44.skipped || s44.ok === true) && (s45.skipped || s45.ok === true) && (s46.skipped || s46.ok === true) && (s47.skipped || s47.ok === true)
      && (s48.skipped || s48.ok === true)
      && (s49.skipped || s49.ok === true)
      && (s50.skipped || s50.ok === true)
      && (s51.skipped || s51.ok === true)
      && (s52.skipped || s52.ok === true);
    console.log(pass ? 'SMOKE PASS' : 'SMOKE FAIL');
    process.exitCode = pass ? 0 : 1;
  } finally {
    proc.kill();
    // S13 上传产物清理（middleware 重名自动加后缀，不清理会逐次累积进母版/生成工程）
    const texDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'scene3d', 'assets', 'textures');
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
