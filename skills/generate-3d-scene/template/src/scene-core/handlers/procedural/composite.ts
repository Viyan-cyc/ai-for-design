import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../../types';

export interface PartTransform { position?: Vec3; rotation?: Vec3; scale?: number | Vec3 }
type Batch = { material: THREE.Material; geometries: THREE.BufferGeometry[] };
const matrix = (transform: PartTransform): THREE.Matrix4 => {
  const obj = new THREE.Object3D();
  if (transform.position) obj.position.set(...transform.position);
  if (transform.rotation) obj.rotation.set(...transform.rotation);
  const scale = transform.scale ?? 1;
  if (typeof scale === 'number') obj.scale.setScalar(scale); else obj.scale.set(...scale);
  obj.updateMatrix();
  return obj.matrix;
};

/** One builder per scene node. Geometry ownership transfers to the builder.
 * mesh keeps an editable slot per part; batch combines only an explicitly named slot.
 * Every call attaches its output automatically. Call finish exactly once before returning.
 * Materials are caller-owned until the finished root is returned to SceneEngine.
 */
export function createComposite() {
  const root = new THREE.Group();
  const batches = new Map<string, Batch>();
  const names = new Set<string>();
  let finished = false;
  const check = (name: string) => {
    if (finished) throw new Error('Composite already finished');
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`Invalid slot name: ${name}`);
  };
  const attach = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const builder = {
    batchSlot(name: string, material: THREE.Material) {
      check(name);
      if (names.has(name)) throw new Error(`Duplicate slot: ${name}`);
      names.add(name);
      batches.set(name, { material, geometries: [] });
      return { add(geometry: THREE.BufferGeometry, transform: PartTransform = {}) {
        builder.batch(name, geometry, material, transform);
      } };
    },
    mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, transform: PartTransform = {}) {
      check(name);
      if (names.has(name)) throw new Error(`Duplicate slot: ${name}`);
      names.add(name);
      const mesh = attach(name, geometry, material);
      mesh.applyMatrix4(matrix(transform));
      return mesh;
    },
    batch(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, transform: PartTransform = {}) {
      check(name);
      let batch = batches.get(name);
      if (batch && batch.material !== material) throw new Error(`Batch ${name} must use the same material instance`);
      if (!batch) {
        if (names.has(name)) throw new Error(`Duplicate slot: ${name}`);
        names.add(name);
        batch = { material, geometries: [] };
        batches.set(name, batch);
      }
      // Normalize indexed/non-indexed input; each call must pass a fresh geometry.
      const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
      if (normalized !== geometry) geometry.dispose();
      normalized.applyMatrix4(matrix(transform));
      batch.geometries.push(normalized);
    },
    finish(): THREE.Group {
      if (finished) throw new Error('Composite already finished');
      finished = true;
      try {
        for (const [name, batch] of batches) {
          if (!batch.geometries.length) continue;
          const merged = mergeGeometries(batch.geometries, false);
          if (!merged) throw new Error(`Incompatible geometry attributes in batch ${name}; use separate mesh slots`);
          merged.computeBoundingBox(); merged.computeBoundingSphere();
          attach(name, merged, batch.material);
        }
        return root;
      } catch (error) {
        root.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
        root.clear();
        throw error;
      } finally {
        for (const batch of batches.values()) for (const geometry of batch.geometries) geometry.dispose();
        batches.clear();
      }
    },
  };
  return builder;
}
