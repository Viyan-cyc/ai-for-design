// Maintenance consumer for the two admitted templates, not a universal adapter.
import * as THREE from 'three';
import { AuthoredComponent } from '@a3d/a3d-components/core';
import { HostHighlight } from '@a3d/a3d-components/helper';
import type { SceneEngine } from '../../scene-core';
import { handlerUtils } from '../../scene-core/handlers';

// Node params replace the whole business state; component setters are incremental.
function objectOptions(params: ConstructorParameters<typeof AuthoredComponent>[0]) {
  const probe = new AuthoredComponent();
  try { probe.setOptions(params === undefined ? {} : params); return probe.getOptions(); }
  finally { probe.dispose(); }
}
function hostOptions(params: ConstructorParameters<typeof HostHighlight>[1]) {
  const probe = new HostHighlight({root:new THREE.Group(),targets:[],invalidate:()=>{}});
  try { probe.setOptions(params === undefined ? {} : params); return probe.getOptions(); }
  finally { probe.dispose(); }
}

export function registerSyncedObject(engine: SceneEngine): void {
  engine.registerFactory('authored', {
    validate(node) {
      // Use the shipped component's validator through an isolated instance.
      const probe = new AuthoredComponent();
      try { probe.setOptions(node.params === undefined ? {} : node.params); } finally { probe.dispose(); }
    },
    create(node) {
      const object = new AuthoredComponent(node.params as ConstructorParameters<typeof AuthoredComponent>[0]);
      if (object.children[0]) object.children[0].name = 'body';
      handlerUtils.applyTransform(object, node);
      return object;
    },
    update(object, next, previous) {
      // Optional public properties have no value in getOptions() defaults.
      // Recreate when clearing them so incremental setters cannot retain them.
      if (['name','visible','userData'].some(key =>
        previous.params?.[key] !== undefined && next.params?.[key] === undefined)) return 'rebuild';
      (object as AuthoredComponent).setOptions(objectOptions(next.params));
      return 'updated';
    },
    // This audited class has no subscriptions/timers. SceneEngine owns its mesh
    // resources here; calling its standalone dispose would dispose those twice.
  });
}

export function registerSyncedHost(engine: SceneEngine): void {
  const effects = new WeakMap<THREE.Object3D, HostHighlight>();
  engine.registerFactory('highlighted', {
    validate(node) {
      const probe = new HostHighlight({root:new THREE.Group(),targets:[],invalidate:()=>{}});
      try { probe.setOptions(node.params === undefined ? {} : node.params); } finally { probe.dispose(); }
    },
    create(node, ctx) {
      const root = new THREE.Group();
      const target = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), new THREE.MeshStandardMaterial({color:'#71879b'}));
      target.name='borrowed_body';root.add(target);
      const effect=new HostHighlight({root,targets:[target],invalidate:()=>ctx.renderLoop?.invalidate?.()},node.params as ConstructorParameters<typeof HostHighlight>[1]);
      const owned=root.children[1];if(owned){owned.name='effect';owned.children.forEach((child,i)=>{child.name='outline_'+i;});}
      effects.set(root,effect);handlerUtils.applyTransform(root,node);return root;
    },
    update(root,next) {
      const effect=effects.get(root);if(!effect)throw Error('Missing attached effect');
      effect.setOptions(hostOptions(next.params));effect.syncTargets();return 'updated';
    },
    dispose(root) {effects.get(root)?.dispose();effects.delete(root);},
  });
}
