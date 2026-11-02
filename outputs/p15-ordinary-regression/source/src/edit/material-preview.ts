import type * as THREE from 'three';
import type { MaterialSpec } from '../scene3d/scene-core/index';

export interface TexturePreview { label: string; image?: string; }
export type TexturePreviews = Record<string, TexturePreview>;
const cache = new WeakMap<THREE.Texture, { version: number; source: unknown; preview: TexturePreview }>();

/** UI-only snapshots: never serialize these as material texture references. */
export const texturePreviews = (material: THREE.Material | null): TexturePreviews => {
  const result: TexturePreviews = {};
  if (!material) { return result; }
  for (const [key, value] of Object.entries(material)) {
    if (!value || !(value as THREE.Texture).isTexture) { continue; }
    const texture = value as THREE.Texture;
    const source = texture.image as (CanvasImageSource & { width?: number; height?: number }) | undefined;
    const cached = cache.get(texture);
    if (cached && cached.version === texture.version && cached.source === source) {
      result[key] = cached.preview;
      continue;
    }
    const width = source?.width ?? 0;
    const height = source?.height ?? 0;
    const preview: TexturePreview = { label: `已有贴图${width && height ? ` · ${width}×${height}` : ''}` };
    if (width && height && typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(128, width);
        canvas.height = Math.max(1, Math.round(height * canvas.width / width));
        canvas.height = Math.min(128, canvas.height);
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(source!, 0, 0, canvas.width, canvas.height);
          preview.image = canvas.toDataURL();
        }
      } catch { /* Compressed or cross-origin textures still show their presence. */ }
    }
    // Retry pending images once they finish loading.
    if (width && height) { cache.set(texture, { version: texture.version, source, preview }); }
    result[key] = preview;
  }
  return result;
};

export const materialSwatch = (spec: MaterialSpec, textures?: TexturePreviews): Record<string, string> => {
  const s = spec as unknown as Record<string, unknown>;
  const color = typeof s.color === 'string' ? s.color : '#ffffff';
  const roughness = typeof s.roughness === 'number' ? s.roughness : 1;
  const highlight = Math.max(0.12, 0.5 - roughness * 0.35);
  const image = textures?.map?.image;
  return {
    backgroundColor: color,
    backgroundImage: image ? `url("${image}")` : `radial-gradient(circle at 32% 28%, rgba(255,255,255,${highlight}), transparent 65%)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundBlendMode: image ? 'multiply' : 'normal',
  };
};

