import * as THREE from 'three';
import type { SceneEngine } from '../../scene-core/index';
import type { SceneNode } from '../../scene-core/types';
import { handlerUtils } from '../../scene-core/handlers';
import { createComposite } from '../../scene-core/handlers/procedural/composite';
import { BRIGHT_MATERIALS } from '../visual-presets';

/** Procedural fallback, metres, bottom centred at origin, entrance faces +Z. */
export function buildingParams(node: SceneNode) {
  const p = node.params ?? {};
  const kind = p.kind ?? 'office';
  if (kind !== 'office' && kind !== 'factory') throw new Error('building kind must be office or factory');
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = p[key] ?? fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`building ${key} must be ${min}–${max}`);
    return value;
  };
  return {
    kind, width: number('width', kind === 'office' ? 20 : 36, 6, 200),
    depth: number('depth', kind === 'office' ? 14 : 24, 6, 200),
    height: number('height', kind === 'office' ? 20 : 9, 4, 160),
    bayWidth: number('bayWidth', 3.2, 1.5, 12),
    floorHeight: number('floorHeight', 3.6, 2.5, 8),
    roofDetails: p.roofDetails !== false,
  };
}

export function buildBuilding(node: SceneNode): THREE.Group {
  const { kind, width: w, depth: d, height: h, bayWidth, floorHeight, roofDetails } = buildingParams(node);
  const b = createComposite();
  const mat = {
    wall: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.wall),
    glass: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.glass),
    trim: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.trim),
    roof: new THREE.MeshStandardMaterial(BRIGHT_MATERIALS.roof),
  };
  b.mesh('shell', new THREE.BoxGeometry(w, h - 0.25, d), mat.wall, { position: [0, (h - 0.25) / 2, 0] });
  b.mesh('roof', new THREE.BoxGeometry(w, 0.25, d), mat.roof, { position: [0, h - 0.125, 0] });
  const frames = b.batchSlot('facade_trim', mat.trim);
  const floors = Math.max(1, Math.floor((h - 1) / floorHeight));
  // Each facade is a stable editable glass slot; panes are merged within that facade.
  for (const face of ['front', 'back', 'left', 'right'] as const) {
    const sideways = face === 'left' || face === 'right';
    const span = sideways ? d : w;
    const count = Math.max(1, Math.min(24, Math.floor((span - 1.6) / bayWidth)));
    const pitch = (span - 1.6) / count;
    const sign = face === 'back' || face === 'left' ? -1 : 1;
    const panes = b.batchSlot(`glass_${face}`, mat.glass);
    const rows = kind === 'office' ? floors : 1;
    for (let row = 0; row < rows; row++) {
      const y = kind === 'office' ? 1 + (row + 0.5) * (h - 2) / floors : h * 0.72;
      const ph = kind === 'office' ? (h - 2) / floors * 0.64 : Math.min(1.5, h * 0.18);
      for (let col = 0; col < count; col++) {
        const horizontal = -span / 2 + 0.8 + (col + 0.5) * pitch;
        panes.add(new THREE.BoxGeometry(pitch * 0.76, ph, 0.035), {
          position: sideways ? [sign * (w / 2 + 0.025), y, horizontal] : [horizontal, y, sign * (d / 2 + 0.025)],
          rotation: [0, sideways ? Math.PI / 2 : 0, 0],
        });
      }
    }
    if (kind === 'office') {
      for (let row = 1; row < floors; row++) frames.add(new THREE.BoxGeometry(span, 0.09, 0.08), {
        position: sideways ? [sign * (w / 2 + 0.04), 1 + row * (h - 2) / floors, 0] : [0, 1 + row * (h - 2) / floors, sign * (d / 2 + 0.04)],
        rotation: [0, sideways ? Math.PI / 2 : 0, 0],
      });
    }
  }
  b.mesh('entrance', new THREE.BoxGeometry(Math.min(4, w * 0.3), 2.7, 0.06), mat.glass, { position: [0, 1.35, d / 2 + 0.065] });
  b.mesh('canopy', new THREE.BoxGeometry(Math.min(6, w * 0.4), 0.16, 1.6), mat.trim, { position: [0, 2.9, d / 2 + 0.75] });
  if (kind === 'factory') {
    const doors = b.batchSlot('loading_doors', mat.roof);
    for (const sign of [-1, 1]) doors.add(new THREE.BoxGeometry(Math.min(3.5, w * 0.18), Math.min(3.5, h * 0.45), 0.06), {
      position: [sign * w * 0.31, Math.min(3.5, h * 0.45) / 2, d / 2 + 0.04],
    });
  }
  if (roofDetails) {
    const equipment = b.batchSlot('roof_equipment', mat.trim);
    for (const sign of [-1, 1]) equipment.add(new THREE.BoxGeometry(w * 0.16, 0.65, d * 0.2), { position: [sign * w * 0.23, h + 0.325, -d * 0.12] });
  }
  const root = b.finish();
  handlerUtils.applyTransform(root, node);
  return root;
}

export function registerBuildingHandler(sceneEngine: SceneEngine): void {
  sceneEngine.registerFactory('buildings', {
    create: node => {
      const root = buildBuilding(node);
      const previous = new Set<THREE.Material>();
      root.traverse(child => { if (child instanceof THREE.Mesh) previous.add(child.material as THREE.Material); });
      handlerUtils.applyVisualIfAny(root, node.id, id => sceneEngine.getVisual(id));
      root.traverse(child => {
        if (child instanceof THREE.Mesh) for (const material of Array.isArray(child.material) ? child.material : [child.material]) previous.delete(material);
      });
      previous.forEach(material => material.dispose());
      return root;
    },
    update: (_obj, next, previous) => JSON.stringify(buildingParams(next)) === JSON.stringify(buildingParams(previous)) ? 'updated' : 'rebuild',
  });
}
