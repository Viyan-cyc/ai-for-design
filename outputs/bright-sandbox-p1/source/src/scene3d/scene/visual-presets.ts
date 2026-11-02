import type { TreeSceneFragment } from '../scene-core/types';

/** Material roles for procedural fallback only; never recolor imported assets implicitly. */
export const BRIGHT_MATERIALS = {
  wall: { color: '#f1f0eb', roughness: 0.8, metalness: 0 },
  glass: { color: '#b6cbd4', roughness: 0.28, metalness: 0.15 },
  trim: { color: '#d9dfe1', roughness: 0.65, metalness: 0.1 },
  roof: { color: '#d6dde0', roughness: 0.9, metalness: 0 },
  ground: { color: '#e4e9ed', roughness: 1, metalness: 0 },
  road: { color: '#a3afb9', roughness: 1, metalness: 0 },
  greenery: { color: '#8eb68b', roughness: 1, metalness: 0 },
  water: { color: '#a9d6e2', roughness: 0.32, metalness: 0.05 },
} as const;

/** Radius/target describe the business area, not an infinite background plane. */
export function createScenePreset(id: string, radius = 60, target: [number, number, number] = [0, 0, 0]): TreeSceneFragment {
  const preset = SCENE_PRESETS.find(item => item.id === id);
  if (!preset) throw new Error(`Unknown scene preset: ${id}`);
  if (!Number.isFinite(radius) || radius <= 0 || target.some(v => !Number.isFinite(v))) throw new Error('Preset radius/target must be finite');
  const bright = id === 'bright';
  const offset = (x: number, y: number, z: number): [number, number, number] => [target[0] + x * radius, target[1] + y * radius, target[2] + z * radius];
  return {
    scene: { background: preset.background, environment: { intensity: preset.environment }, ...(bright ? { fog: null } : {}) },
    renderer: { toneMapping: 'ACESFilmic', exposure: preset.exposure },
    lights: [
      { id: 'preset_sky', type: 'HemisphereLight', color: preset.sky, groundColor: preset.ground, intensity: bright ? 0.65 : 1.2 },
      { id: 'preset_key', type: 'DirectionalLight', color: preset.key, intensity: preset.intensity,
        position: bright ? offset(-0.8, 1.5, 0.9) : [20, 30, 15], target: bright ? [...target] : [0, 0, 0], castShadow: bright,
        shadowCameraLeft: -radius, shadowCameraRight: radius, shadowCameraTop: radius, shadowCameraBottom: -radius,
        shadowCameraNear: 0.1, shadowCameraFar: radius * 5, shadowBias: -0.0002 },
      { id: 'preset_fill', type: 'DirectionalLight', color: bright ? '#ffffff' : '#dce8ff', intensity: bright ? 0.35 : 0.8,
        position: bright ? offset(0.7, 0.6, -0.8) : [-15, 12, -10], target: bright ? [...target] : [0, 0, 0], castShadow: false },
    ],
  };
}

export const SCENE_PRESETS = [
  {
    id: 'industrial', label: '工业清晰', background: '#edf1f5', sky: '#ffffff', ground: '#818b99', key: '#fff5e8', intensity: 2.4, environment: 0.7, exposure: 1,
  },
  {
    id: 'cool', label: '机房冷色', background: '#e6eef7', sky: '#dcecff', ground: '#596c85', key: '#e5f1ff', intensity: 2, environment: 0.9, exposure: 1.05,
  },
  {
    id: 'day', label: '园区日景', background: '#dbeafa', sky: '#d9edff', ground: '#a29a83', key: '#fff1d6', intensity: 3, environment: 0.6, exposure: 1,
  },
  {
    id: 'bright', label: '明亮沙盘', background: '#f1f5fa', sky: '#ffffff', ground: '#c7cbd1', key: '#fffaf3', intensity: 2.1, environment: 0.65, exposure: 1,
  },
] as const;

