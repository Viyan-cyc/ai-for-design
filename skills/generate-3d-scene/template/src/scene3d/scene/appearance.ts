import type { StateVisual } from '../scene-core/materials';

/** 场景业务状态配色；通用材质机制留在 core。 */
export const stateMaterials: Record<string, Record<string, StateVisual>> = {
  cars: {
    normal: { color: '#64798a', metalness: 0.6, roughness: 0.4 },
    alarm: { color: '#64798a', emissive: '#401010', emissiveIntensity: 1.2 },
    maintenance: { color: '#d8a921', metalness: 0.2, roughness: 0.7 },
  },
};
