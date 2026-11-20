// Copy to src/3d/components/objects/block.ts. Register registerBlockHandler in scene-profile.ts.
import * as THREE from 'three';
import type { SceneEngine } from '../../scene';
import type { NodeFactoryDefinition } from '../../scene/types';
import { handlerUtils } from '../factories';

export const registerBlockHandler = (engine: SceneEngine): void => {
  const definition: NodeFactoryDefinition = {
    create(node) {
      const root = new THREE.Group();
      handlerUtils.applyTransform(root, node);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshStandardMaterial({ color: '#71879b', roughness: 0.7 }),
      );
      body.name = 'body';
      body.position.y = 1;
      body.castShadow = true;
      body.receiveShadow = true;
      root.add(body);
      return root;
    },
    update() { return 'updated'; },
  };
  engine.registerFactory('blocks', definition);
};
