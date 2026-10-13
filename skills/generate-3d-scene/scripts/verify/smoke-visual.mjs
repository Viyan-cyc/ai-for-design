/**
 * smoke-visual.mjs — 视觉冒烟（多模态档；非多模态档跳过，结论标注"未经视觉确认"）
 *
 * 产出四视口截图（PNG 落盘，供 LLM 看图判定比例/遮挡/漂浮/配色）：
 *   ① 全景   当前相机默认视角整页截图
 *   ② 主视角 frameObject 聚焦主体（取场景首个 GLB 资产节点）
 *   ③ 特写   相机推近主体（position * 0.4）看细节
 *   ④ 线框   场景全部材质 wireframe=true 后截图（看完还原）
 *
 * 截图方式：CDP Page.captureScreenshot（headless 下 canvas 前缓冲不可达，
 * drawImage/toDataURL 拿不到 WebGL 内容——CDP 合成层截图是唯一可靠路径）。
 *
 * 用法：node smoke-visual.mjs [url] [--out <目录>] [--edit]
 *   url 默认 http://localhost:5199/；--out 默认 <cwd>/shots-visual
 *   退出码：0 四张产出 / 1 缺失 / 2 CDP 环境不可用
 *
 * 注意：本脚本只负责产出截图。看图判定由多模态 LLM 做（读 PNG 判比例/遮挡/漂浮/配色），
 * 断言清单见 references/verification.md。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const EDIT = argv.includes('--edit');
const urlIdx = argv.findIndex((a) => !a.startsWith('-'));
const URL_ARG = urlIdx >= 0 ? argv[urlIdx] : 'http://localhost:5199/';
const PAGE = EDIT ? `${URL_ARG}?edit=1` : URL_ARG;
const outIdx = argv.indexOf('--out');
const OUT_DIR = resolve(outIdx >= 0 ? argv[outIdx + 1] : 'shots-visual');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9231;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  mkdirSync(OUT_DIR, { recursive: true });

  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${CDP_PORT}`, '--no-first-run',
    `--user-data-dir=${process.env.TEMP}\\gts-smoke-visual`,
    '--window-size=1280,800', PAGE,
  ], { stdio: 'ignore' });

  try {
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
      console.error('CDP 不可用（环境预检不过）→ 视觉冒烟转人工');
      process.exit(2);
    }

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
    const shot = async (name) => {
      const r = await rpc('Page.captureScreenshot', { format: 'png' });
      const { writeFileSync } = await import('node:fs');
      const file = `${OUT_DIR}/${name}.png`;
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return file;
    };

    // 等场景 + GLB 加载收敛
    let mounted = false;
    for (let i = 0; i < 10; i += 1) {
      mounted = await evaluate('!!window.__gts3d');
      if (mounted) {
        break;
      }
      await sleep(700);
    }
    if (!mounted) {
      console.log('VISUAL FAIL: __gts3d 未挂载');
      process.exitCode = 1;
      return;
    }
    await sleep(3000);

    // ① 全景
    await shot('1-overview');

    // ② 主视角：聚焦首个 GLB 资产节点（判据：listSubMeshes 有清单 = GLB/组合模型；图元无子网格清单）
    const focusId = await evaluate(`(() => {
      const se = window.__gts3d.internals.sceneEngine;
      const ids = se.getAllIds();
      const glb = ids.find((id) => se.listSubMeshes(id).length > 0);
      return glb ?? ids[0];
    })()`);
    await evaluate(`window.__gts3d.frameObject(${JSON.stringify(focusId)})`);
    await sleep(800);
    await shot('2-main');

    // ③ 特写：相机推近
    await evaluate(`(() => {
      const cam = window.__gts3d.internals.camera;
      cam.position.multiplyScalar(0.4);
    })()`);
    await sleep(800);
    await shot('3-closeup');

    // ④ 线框：全材质 wireframe 开 → 截图 → 还原
    await evaluate(`(() => {
      const mats = new Set();
      window.__gts3d.internals.scene.traverse((c) => {
        if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => mats.add(m)); }
      });
      for (const m of mats) { m.wireframe = true; }
      window.__wfRestore = () => { for (const m of mats) { m.wireframe = false; } };
    })()`);
    await sleep(800);
    await shot('4-wireframe');
    await evaluate('window.__wfRestore?.()');

    // 产出核验：4 张 + 每张 > 10KB（非空白页截图通常远大于此）
    const names = ['1-overview', '2-main', '3-closeup', '4-wireframe'];
    const files = names.map((n) => `${OUT_DIR}/${n}.png`);
    const missing = files.filter((f) => !existsSync(f) || statSync(f).size < 10240);
    if (missing.length > 0) {
      console.log(`VISUAL FAIL: 产出缺失或过小 ${missing.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(`VISUAL PASS: 四视口截图产出 → ${files.join(' / ')}`);
    console.log('（看图判定由多模态 LLM 做：读 PNG 判比例/遮挡/漂浮/配色；非多模态档跳过本步）');
  } finally {
    proc.kill();
  }
};

main().catch((e) => {
  console.error('VISUAL ERROR:', e.message);
  process.exit(1);
});
