import type { TreeSceneFragment } from '@/scene-core/types';
import type { Bridge } from './Bridge';

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
] as const;

/** Replace the lighting rig as one undoable edit; preserve model materials and geometry. */
export function applyScenePreset(bridge: Bridge, id: string): void {
  const preset = SCENE_PRESETS.find((item) => item.id === id);
  if (!preset) {
    return;
  }
  const patch: TreeSceneFragment = {
    scene: { background: preset.background, environment: { intensity: preset.environment } },
    renderer: { toneMapping: 'ACESFilmic', exposure: preset.exposure },
    lights: [
      {
        id: 'preset_sky', type: 'HemisphereLight', color: preset.sky, groundColor: preset.ground, intensity: 1.2,
      },
      {
        id: 'preset_key', type: 'DirectionalLight', color: preset.key, intensity: preset.intensity, position: [20, 30, 15], target: [0, 0, 0], castShadow: false,
      },
      {
        id: 'preset_fill', type: 'DirectionalLight', color: '#dce8ff', intensity: 0.8, position: [-15, 12, -10], target: [0, 0, 0], castShadow: false,
      },
    ],
  };
  bridge.commit(`场景预设：${ preset.label}`, () => bridge.handle.update(patch));
}
