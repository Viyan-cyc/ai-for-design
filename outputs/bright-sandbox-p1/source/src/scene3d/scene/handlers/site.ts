import * as THREE from 'three';
import type { SceneEngine } from '../../scene-core';
import { createComposite } from '../../scene-core/handlers/procedural/composite';
import { BRIGHT_MATERIALS } from '../visual-presets';

/** Maintenance sample only; do not ship fixed campus layouts as default content. */
export function registerSiteHandler(engine: SceneEngine): void {
  engine.registerFactory('site', { create: () => {
    const b = createComposite();
    const material = {
      ground: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.ground),
      road: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.road),
      wall: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.wall),
      greenery: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.greenery),
      roof: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.roof),
      water: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.water),
    };
    const ground = b.mesh('ground', new THREE.BoxGeometry(96, 0.5, 80), material.ground, { position: [0, -0.25, 0] });
    ground.castShadow = false;
    const road = b.batchSlot('roads', material.road);
    road.add(new THREE.BoxGeometry(9, 0.025, 74), { position: [0, 0.015, 0] });
    road.add(new THREE.BoxGeometry(85, 0.025, 8), { position: [0, 0.015, 32] });
    const markings = b.batchSlot('road_markings', material.wall);
    for (let i = 0; i < 10; i++) markings.add(new THREE.BoxGeometry(0.12, 0.01, 2), { position: [0, 0.035, -32 + i * 6] });
    for (let i = 0; i < 12; i++) markings.add(new THREE.BoxGeometry(2, 0.01, 0.12), { position: [-38 + i * 6, 0.035, 32] });
    const green = b.batchSlot('landscape', material.greenery);
    const trunks = b.batchSlot('tree_trunks', material.roof);
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const x = side * 44, z = -30 + i * 9;
        green.add(new THREE.IcosahedronGeometry(1.5, 1), { position: [x, 3.2, z], scale: [1, 1.3, 1] });
        trunks.add(new THREE.CylinderGeometry(0.16, 0.22, 2.8, 6), { position: [x, 1.4, z] });
      }
    }
    for (const x of [-22, 23]) green.add(new THREE.BoxGeometry(22, 0.05, 3), { position: [x, 0.025, -30] });
    b.mesh('water', new THREE.BoxGeometry(9, 0.035, 4), material.water, { position: [-21, 0.02, 24] });
    return b.finish();
  } });
}
