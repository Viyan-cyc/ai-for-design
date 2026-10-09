/**
 * scene-core/utils/material — 材质覆盖应用（registry 工厂与 SceneEngine patch 共用）
 */
import * as THREE from 'three';
import type { MaterialOverride } from '../types';

export const applyMaterialOverride = (root: THREE.Object3D, override: MaterialOverride | null | undefined): void => {
  if (!override) {
    return;
  }
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const base = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const std = (base ?? new THREE.MeshStandardMaterial()).clone() as THREE.MeshStandardMaterial;
    if (override.color !== undefined) {
      std.color = new THREE.Color(override.color);
    }
    if (override.metalness !== undefined) {
      std.metalness = override.metalness;
    }
    if (override.roughness !== undefined) {
      std.roughness = override.roughness;
    }
    if (override.opacity !== undefined) {
      std.transparent = override.opacity < 1;
      std.opacity = override.opacity;
    }
    if (override.emissive !== undefined) {
      std.emissive = new THREE.Color(override.emissive);
      std.emissiveIntensity = override.emissiveIntensity ?? 1;
    }
    if (override.wireframe !== undefined) {
      std.wireframe = override.wireframe;
    }
    if (override.flatShading !== undefined) {
      std.flatShading = override.flatShading;
      std.needsUpdate = true;
    }
    if (override.side !== undefined) {
      std.side = override.side === 'FrontSide' ? THREE.FrontSide
        : override.side === 'BackSide' ? THREE.BackSide
          : THREE.DoubleSide;
    }
    mesh.material = std;
  });
};
