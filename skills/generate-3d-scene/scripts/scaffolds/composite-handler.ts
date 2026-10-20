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
      // Same slot = intentionally edited as a whole. The builder attaches it automatically.
      const frame = builder.batchSlot('frame', steel);
      for (const x of [-1, 1]) for (const z of [-0.5, 0.5]) {
        frame.add(new THREE.BoxGeometry(0.12, 2, 0.12), { position: [x, 1, z] });
      }
      builder.mesh('shelf', new THREE.BoxGeometry(2.2, 0.12, 1.2),
        new THREE.MeshStandardMaterial({ color: '#d58b37' }), { position: [0, 1, 0] });
      builder.mesh('label', new THREE.PlaneGeometry(1.2, 0.3),
        new THREE.MeshStandardMaterial({ map: labelTexture(String(node.params?.label ?? node.id)), roughness: 0.8 }),
        { position: [0, 1.75, 0.57] });
      const root = builder.finish();
      handlerUtils.applyTransform(root, node);
      return root;
    },
    update() { return 'rebuild'; }, // Label is structural; unchanged params do not call update.
  };
  engine.registerFactory('assemblies', definition);
}
