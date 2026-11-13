import { MapRuntime } from '@a3d/a3d-components/map';
const host = document.querySelector('#host') as HTMLElement;
const out = document.querySelector('#result')!;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const startView = { center: [121.49, 31.23] as [number, number], zoom: 16, pitch: 45, bearing: 0 };
const endView = { ...startView, center: [121.491, 31.231] as [number, number] };
const style = URL.createObjectURL(new Blob([JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eee' } }] })], { type: 'application/json' }));
let runtime: MapRuntime | undefined;
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
try {
  runtime = await MapRuntime.create({ host, style, origin: startView.center, ...startView });
  const map = runtime.map;
  const view = () => ({ center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() });
  const assertView = (expected: typeof startView) => {
    const current = view();
    check(current.center.every((v, i) => Math.abs(v - expected.center[i]) < 1e-7)
      && ['zoom', 'pitch', 'bearing'].every(key => Math.abs(current[key as 'zoom'] - expected[key as 'zoom']) < 1e-7), 'Unexpected camera state');
  };
  // Register before triggering work; idle includes source worker completion and rendering.
  const settle = (action: () => void) => new Promise<void>((resolve, reject) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { map.off('idle', done); reject(new Error('Map idle timeout')); }, 8000);
    map.once('idle', done);
    try { action(); map.triggerRepaint(); } catch (error) { clearTimeout(timer); map.off('idle', done); reject(error); }
  });
  const results = [];
  const gl = runtime.context, ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  for (const count of [0]) {
    await settle(() => { map.stop(); map.jumpTo(startView); });
    assertView(startView);
    let frames = 0;
    const onRender = () => frames++;
    map.on('render', onRender);
    try {
      await wait(1000);
      const idleFrames = frames;
      assertView(startView);
      const navigationStart = view();
      frames = 0; // Exclude all data update renders from navigation measurement.
      const navigationTime = performance.now();
      await settle(() => map.easeTo({ ...endView, duration: 1000, essential: true }));
      const navigationElapsedMs = performance.now() - navigationTime;
      assertView(endView);
      const navigationEnd = view();
      check(Math.hypot(...navigationEnd.center.map((v, i) => v - navigationStart.center[i]) as [number, number]) > .0001, 'Navigation did not move');
      check(frames > 0, 'Navigation did not render');
      results.push({ count, idleFramesPerSecond: idleFrames, navigationRenderEvents: frames, navigationElapsedMs, navigationStart, navigationEnd });
    } finally { map.off('render', onRender); }

  }
  out.textContent = JSON.stringify({ environment: { gpu, userAgent: navigator.userAgent, dpr: map.getPixelRatio(), width: host.clientWidth, height: host.clientHeight }, results,
    note: 'R2 base-map only, zero overlays; not comparable with old overlay load. Local blank style; equal camera paths verified. Event counts and idle latency are not GPU timing or city FPS.' }, null, 2) + '\nALL PASS';
} catch (error) { out.textContent = 'FAIL ' + error; }
finally { runtime?.dispose(); URL.revokeObjectURL(style); }
