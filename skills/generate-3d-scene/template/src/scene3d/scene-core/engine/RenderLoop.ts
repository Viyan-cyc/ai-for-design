import type * as THREE from 'three';
import type { RendererEngine } from './RendererEngine';
import type { ControlsEngine } from './ControlsEngine';
import { onResourcesChanged } from '../render-invalidation';

/** Active time in seconds; simulationDelta is capped at 0.1 for bounded-step consumers. */
export type FrameCallback = (delta: number, elapsed: number, simulationDelta: number) => void;
export interface FrameStats {
  fps: number; calls: number; triangles: number; elapsed: number;
  idle: boolean; paused: boolean; sampling: boolean; maxFps: number;
}

/** One scheduler for both run/edit. Only successful scene draws count as frames. */
export class RenderLoop {
  private callbacks: Array<{ cb: FrameCallback; continuous: boolean }> = [];
  private afterFrameCallbacks: FrameCallback[] = [];
  private resizeCbs: Array<(width: number, height: number) => void> = [];
  private running = false;
  private rafId = 0;
  private inTick = false;
  private dirty = true;
  private lastTime = 0;
  private clockActive = false;
  private deadline = 0;
  private elapsed = 0;
  private sampleStart = performance.now();
  private frameTimes: number[] = [];
  private calls = 0;
  private triangles = 0;
  private resizeObserver: ResizeObserver;
  private unsubscribeResources: () => void;

  constructor(
    private rendererEngine: RendererEngine,
    private controlsEngine: ControlsEngine,
    private getScene: () => THREE.Scene,
    private getCamera: () => THREE.Camera,
    private externalRequest?: () => void,
  ) {
    this.resizeObserver = new ResizeObserver(() => {
      const size = this.rendererEngine.applySize();
      this.resizeCbs.forEach(cb => cb(size.width, size.height));
      this.invalidate();
    });
    const canvas = this.rendererEngine.renderer.domElement;
    if (canvas.parentElement) this.resizeObserver.observe(canvas.parentElement);
    this.controlsEngine.controls.addEventListener('change', this.invalidate);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.unsubscribeResources = onResourcesChanged(this.invalidate);
  }

  /** Animation callbacks keep rendering while registered. Observers pass continuous=false. */
  onFrame(cb: FrameCallback, continuous = true): () => void {
    const entry = { cb, continuous };
    this.callbacks.push(entry);
    this.invalidate();
    return () => { this.callbacks = this.callbacks.filter(item => item !== entry); };
  }
  onAfterFrame(cb: FrameCallback): () => void {
    this.afterFrameCallbacks.push(cb);
    return () => { this.afterFrameCallbacks = this.afterFrameCallbacks.filter(item => item !== cb); };
  }
  onResize(cb: (width: number, height: number) => void): () => void {
    this.resizeCbs.push(cb);
    return () => { this.resizeCbs = this.resizeCbs.filter(item => item !== cb); };
  }
  private continuous(): boolean {
    return this.rendererEngine.getConfig().renderMode === 'continuous'
      || this.controlsEngine.controls.autoRotate || this.callbacks.some(item => item.continuous);
  }
  invalidate = (): void => {
    this.dirty = true;
    if (!this.running || document.hidden) return;
    if (!this.clockActive) {
      const now = performance.now();
      if (now - this.lastTime > 1000) { this.frameTimes = []; this.sampleStart = now; }
      this.lastTime = now;
      this.clockActive = true;
    }
    if (this.externalRequest) { this.externalRequest(); return; }
    if (this.inTick || this.rafId) return;
    this.rafId = requestAnimationFrame(this.tick);
  };
  private visibilityChanged = (): void => {
    cancelAnimationFrame(this.rafId); this.rafId = 0;
    this.frameTimes = []; this.sampleStart = performance.now(); this.deadline = 0;
    this.clockActive = false;
    if (!document.hidden) this.invalidate();
  };
  private tick = (now: number): void => {
    this.rafId = 0;
    if (!this.running || document.hidden) return;
    const limit = this.rendererEngine.getConfig().maxFps ?? 60;
    const interval = limit > 0 ? 1000 / limit : 0;
    if (!this.externalRequest && interval && now + 0.5 < this.deadline) {
      this.rafId = requestAnimationFrame(this.tick); return;
    }
    // A host may draw without invalidate after sleeping. Do not charge that gap.
    const delta = this.clockActive ? Math.max(0, (now - this.lastTime) / 1000) : 0;
    const simulationDelta = Math.min(0.1, delta);
    this.clockActive = true;
    this.lastTime = now; this.elapsed += delta;
    this.deadline = interval ? (this.deadline > 0 && now - this.deadline < interval
      ? this.deadline + interval : now + interval) : now;
    this.dirty = false; this.inTick = true;
    try {
      if (!this.externalRequest) this.controlsEngine.update(delta);
      for (const { cb } of [...this.callbacks]) cb(delta, this.elapsed, simulationDelta);
      const renderer = this.rendererEngine.renderer;
      renderer.info.autoReset = false;
      renderer.info.reset();
      this.rendererEngine.render(this.getScene(), this.getCamera());
      this.frameTimes.push(now);
      this.calls = renderer.info.render.calls;
      this.triangles = renderer.info.render.triangles;
      this.trim(now);
      for (const cb of [...this.afterFrameCallbacks]) cb(delta, this.elapsed, simulationDelta);
    } finally { this.inTick = false; }
    if (this.running && (this.dirty || this.continuous())) {
      if (this.externalRequest) this.externalRequest();
      else this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.clockActive = false;
    }
  };
  /** Called by a host-owned renderer (e.g. a geographic map custom layer). */
  drawExternal(now = performance.now()): void {
    if (!this.externalRequest) throw new Error('No external frame driver');
    this.tick(now);
  }
  configurationChanged(): void {
    this.deadline = 0; this.frameTimes = []; this.sampleStart = performance.now();
    this.invalidate();
  }
  start(): void {
    if (this.running) return;
    this.running = true; this.lastTime = this.sampleStart = performance.now(); this.invalidate();
  }
  stop(): void { this.running = false; this.clockActive = false; cancelAnimationFrame(this.rafId); this.rafId = 0; }
  private trim(now: number): void {
    while (this.frameTimes.length && now - this.frameTimes[0]! >= 1000) this.frameTimes.shift();
  }
  getStats(): FrameStats {
    const now = performance.now(); this.trim(now);
    return { fps: this.frameTimes.length, calls: this.calls, triangles: this.triangles,
      elapsed: this.elapsed, paused: document.hidden || !this.running,
      idle: !this.inTick && !this.continuous() && (this.externalRequest ? now - this.lastTime > 250 : !this.rafId),
      sampling: now - this.sampleStart < 1000, maxFps: this.rendererEngine.getConfig().maxFps ?? 60 };
  }
  dispose(): void {
    this.stop(); this.resizeObserver.disconnect(); this.unsubscribeResources();
    this.controlsEngine.controls.removeEventListener('change', this.invalidate);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.resizeCbs = []; this.callbacks = []; this.afterFrameCallbacks = [];
  }
}
