// Copy to src/scene-core/handlers/composite-example.ts; register under assemblies.
import * as THREE from 'three';
import type { SceneEngine } from '../engine/SceneEngine';
import type { NodeFactoryDefinition } from '../types';
import { handlerUtils } from './registry';
import { createComposite } from './procedural/composite';
import { labelTexture } from './procedural/canvas-texture';

export function registerAssemblyHandler(engine: SceneEngine): void {
  const definition: NodeFactoryDefinition = {
    create(node) {
      const builder = createComposite();
      const steel = new THREE.MeshStandardMaterial({ color: '#64798a', roughness: 0.65 });
      // Bind the material once OUTSIDE loops. Repeated new Material/clone calls are different instances.
      // Same slot = intentionally edited as a whole; use a separate batchSlot for a different material.
      const frame = builder.batchSlot('frame', steel);
      for (const x of [-1, 1]) for (const z of [-0.5, 0.5]) {
        frame.add(new THREE.BoxGeometry(0.12, 2, 0.12), { position: [x, 1, z] });
      }
      // Independent editable parts: semantic side names, never coordinates in slot names.
      for (const {side, sign} of [{side:'neg_z',sign:-1},{side:'pos_z',sign:1}]) {
        builder.mesh(`rail_${side}`, new THREE.BoxGeometry(2.2,0.08,0.08), steel, {position:[0,1.1,sign*0.6]});
      }
      builder.mesh('shelf', new THREE.BoxGeometry(2.2, 0.12, 1.2),
        new THREE.MeshStandardMaterial({ color: '#d58b37' }), { position: [0, 1, 0] });
      builder.mesh('label', new THREE.PlaneGeometry(1.2, 0.3),
        new THREE.MeshStandardMaterial({ map: labelTexture(String(node.params?.label ?? node.id)), roughness: 0.8 }),
        { position: [0, 1.75, 0.57] });
      // Last builder operation: no mesh/batchSlot/batch/add after finish; finish only once.
      const root = builder.finish();
      handlerUtils.applyTransform(root, node);
      return root;
    },
    update() { return 'rebuild'; }, // Label is structural; unchanged params do not call update.
  };
  engine.registerFactory('assemblies', definition);
}
