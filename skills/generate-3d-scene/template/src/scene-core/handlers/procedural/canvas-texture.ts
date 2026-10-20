import * as THREE from 'three';

/** A new texture per call; once attached to a material, SceneEngine owns its lifetime. */
export function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void): THREE.CanvasTexture {
  if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 4096)) throw new Error('Canvas dimensions must be integers in 1..4096');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  paint(ctx, canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Text auto-fits; no asset search or external fonts required. */
export function labelTexture(text: string, options: { width?: number; height?: number; color?: string; background?: string; fontSize?: number } = {}): THREE.CanvasTexture {
  const width = options.width ?? 512, height = options.height ?? 128;
  return canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = options.background ?? '#243445'; ctx.fillRect(0, 0, width, height);
    let size = options.fontSize ?? height * 0.5;
    if (!Number.isFinite(size) || size <= 0) throw new Error('fontSize must be positive');
    ctx.font = `${size}px sans-serif`;
    const measured = ctx.measureText(text).width;
    if (measured > width * 0.9) size *= width * 0.9 / measured;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = options.color ?? '#ffffff';
    ctx.fillText(text, width / 2, height / 2);
  });
}
