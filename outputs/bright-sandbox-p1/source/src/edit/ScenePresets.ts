import type { Bridge } from './Bridge';
import { SCENE_PRESETS, createScenePreset } from '../scene3d/scene/visual-presets';
export { SCENE_PRESETS };

/** Stage-only edit: preserve authored assets, camera and quality settings. */
export function applyScenePreset(bridge: Bridge, id: string): void {
  const preset = SCENE_PRESETS.find(item => item.id === id);
  if (!preset) return;
  const data = bridge.handle.serialize();
  const target = data.camera.lookAt;
  const position = data.camera.position;
  const distance = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]);
  bridge.commit(`场景预设：${preset.label}`, () => bridge.handle.update(createScenePreset(id, Math.max(10, distance * 0.5), target)));
}
