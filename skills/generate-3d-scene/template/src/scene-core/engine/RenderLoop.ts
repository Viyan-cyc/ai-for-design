/**
 * RenderLoop — 渲染循环（每帧渲染 + resize 监听 + 帧统计）
 *
 * 帧统计（fps/calls/triangles）供 Debug HUD 与 perf-fps.mjs 门禁读取。
 */
import * as THREE from 'three';
import type { RendererEngine } from './RendererEngine';
import type { ControlsEngine } from './ControlsEngine';

/** 每帧回调（卡片屏幕投影、自定义动画等注册在这里） */
export type FrameCallback = (delta: number, elapsed: number) => void;

/** 帧统计快照 */
export interface FrameStats {
  fps: number;
  calls: number;
  triangles: number;

  /** 运行秒数 */
  elapsed: number;
}

export class RenderLoop {
  private clock = new THREE.Clock();

  private callbacks: FrameCallback[] = [];

  private running = false;

  private rafId = 0;

  private resizeObserver: ResizeObserver;

  private resizeCbs: Array<(width: number, height: number) => void> = [];

  private frameTimes: number[] = [];

  private lastStats: FrameStats = {
    fps: 0, calls: 0, triangles: 0, elapsed: 0,
  };

  constructor(
    private rendererEngine: RendererEngine,
    private controlsEngine: ControlsEngine,
    private getScene: () => THREE.Scene,
    private getCamera: () => THREE.Camera,
  ) {
    this.resizeObserver = new ResizeObserver(() => {
      const size = this.rendererEngine.applySize();
      this.resizeCbs.forEach((cb) => cb(size.width, size.height));
    });
    const canvas = this.rendererEngine.renderer.domElement;
    if (canvas.parentElement) {
      this.resizeObserver.observe(canvas.parentElement);
    }
  }

  /** 注册每帧回调（返回反注册函数） */
  onFrame(cb: FrameCallback): () => void {
    this.callbacks.push(cb);
    return () => {
      this.callbacks = this.callbacks.filter((c) => c !== cb);
    };
  }

  /** 注册 resize 回调（相机 aspect / CSS2D 层同步用；返回反注册函数） */
  onResize(cb: (width: number, height: number) => void): () => void {
    this.resizeCbs.push(cb);
    return () => {
      this.resizeCbs = this.resizeCbs.filter((c) => c !== cb);
    };
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    const tick = (): void => {
      if (!this.running) {
        return;
      }
      this.rafId = requestAnimationFrame(tick);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.elapsedTime;
      this.controlsEngine.update(delta);
      for (const cb of this.callbacks) {
        cb(delta, elapsed);
      }
      this.rendererEngine.render(this.getScene(), this.getCamera());
      this.recordFrame();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private recordFrame(): void {
    const now = performance.now();
    this.frameTimes.push(now);
    // 只保留 1 秒窗口
    while (this.frameTimes.length > 0 && now - (this.frameTimes[0] as number) > 1000) {
      this.frameTimes.shift();
    }
    const info = this.rendererEngine.renderer.info;
    this.lastStats = {
      fps: this.frameTimes.length,
      calls: info.render.calls,
      triangles: info.render.triangles,
      elapsed: this.clock.elapsedTime,
    };
  }

  /** 读取当前帧统计（Debug HUD / perf 门禁采样） */
  getStats(): FrameStats {
    return { ...this.lastStats };
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.resizeCbs = [];
    this.callbacks = [];
  }
}
