/**
 * edit/AlignmentService — 对齐/分布（纯几何计算，不碰 DOM/Gizmo）
 *
 * 对齐：选轴 → 把多选物体的该轴位置统一到基准（= 最后选中的）物体。
 *   模式：origin（位置原点）/ center（包围盒中心）/ min（包围盒最小边）/ max（包围盒最大边）
 * 分布：选轴 → ≥3 物体在最小/最大之间按包围盒中心等距排列。
 *
 * 纯函数：输入 Bridge（读选中与 bbox）→ 输出 position patch 列表；
 * 调用方（PropertyPanel/LLM）经 bridge.commit 应用——操作天然进撤销栈。
 */
import * as THREE from 'three';
import { showEditorMessage } from './message';
import type { Bridge } from './Bridge';
import type { TreeSceneFragment } from '@/scene-core/types';

export type AlignAxis = 'x' | 'y' | 'z';
export type AlignMode = 'origin' | 'center' | 'min' | 'max';

const AXIS_INDEX: Record<AlignAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export interface PositionPatch {
  id: string;
  position: [number, number, number];
}

/** Convert a world-axis displacement through the current parent transform. */
const offsetInWorld = (obj: THREE.Object3D, axis: number, delta: number): THREE.Vector3 => {
  const position = obj.getWorldPosition(new THREE.Vector3());
  position.setComponent(axis, position.getComponent(axis) + delta);
  return obj.parent ? obj.parent.worldToLocal(position) : position;
};

// Moving an ancestor also moves selected descendants; require independent targets.
const hasNestedSelection = (bridge: Bridge): boolean => {
  const ids = new Set(bridge.selectedIds);
  const engine = bridge.handle.internals.sceneEngine;
  for (const id of ids) {
    let parent = engine.getNode(id)?.parentId;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      if (ids.has(parent)) {
        showEditorMessage('请仅选择同一层级的独立对象，不要同时选择父对象及其子对象。');
        return true;
      }
      visited.add(parent);
      parent = engine.getNode(parent)?.parentId;
    }
  }
  return false;
};

/** 计算对齐 patch（基准物体不动，其余向基准看齐） */
export const computeAlign = (
  bridge: Bridge,
  axis: AlignAxis,
  mode: AlignMode,
): PositionPatch[] => {
  if (hasNestedSelection(bridge)) {
    return [];
  }
  const ids = bridge.selectedIds;
  const anchorId = bridge.anchorId;
  if (!anchorId || ids.length < 2) {
    return [];
  }
  const ai = AXIS_INDEX[axis];
  const anchorObj = bridge.handle.internals.sceneEngine.getObject(anchorId);
  const anchorBox = bridge.getBbox(anchorId);
  if (!anchorObj || !anchorBox) {
    return [];
  }

  // 基准参照值
  const anchorValue = mode === 'origin'
    ? anchorObj.getWorldPosition(new THREE.Vector3()).getComponent(ai)
    : mode === 'center'
      ? anchorBox.getCenter(new THREE.Vector3()).getComponent(ai)
      : mode === 'min'
        ? anchorBox.min.getComponent(ai)
        : anchorBox.max.getComponent(ai);

  const patches: PositionPatch[] = [];
  for (const id of ids) {
    if (id === anchorId || bridge.isLocked(id)) {
      continue;
    }
    const obj = bridge.handle.internals.sceneEngine.getObject(id);
    const box = bridge.getBbox(id);
    if (!obj || !box) {
      continue;
    }
    // 当前物体同模式参照值
    const currentValue = mode === 'origin'
      ? obj.getWorldPosition(new THREE.Vector3()).getComponent(ai)
      : mode === 'center'
        ? box.getCenter(new THREE.Vector3()).getComponent(ai)
        : mode === 'min'
          ? box.min.getComponent(ai)
          : box.max.getComponent(ai);
    const pos = offsetInWorld(obj, ai, anchorValue - currentValue);
    patches.push({ id, position: [pos.x, pos.y, pos.z] });
  }
  return patches;
};

/** 计算分布 patch（≥3 物体，按包围盒中心在首尾之间等距） */
export const computeDistribute = (
  bridge: Bridge,
  axis: AlignAxis,
): PositionPatch[] => {
  const ids = bridge.selectedIds;
  if (ids.length < 3) {
    return [];
  }
  const ai = AXIS_INDEX[axis];
  const items = ids
    .map((id) => {
      const obj = bridge.handle.internals.sceneEngine.getObject(id);
      const box = bridge.getBbox(id);
      if (!obj || !box) {
        return null;
      }
      return {
        id,
        obj,
        center: box.getCenter(new THREE.Vector3()).getComponent(ai),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => a.center - b.center);
  if (items.length < 3) {
    return [];
  }
  const first = items[0]!.center;
  const step = (items[items.length - 1]!.center - first) / (items.length - 1);
  return items.slice(1, -1).map((item, i) => {
    const target = first + step * (i + 1);
    const pos = offsetInWorld(item.obj, ai, target - item.center);
    return { id: item.id, position: [pos.x, pos.y, pos.z] as [number, number, number] };
  }).filter((patch) => !bridge.isLocked(patch.id));
};

/** 应用 patch（bridge.commit 内调用；label 进撤销栈）。v3：按所属分组聚合 position 片段 */
export const applyPatches = (bridge: Bridge, patches: PositionPatch[]): void => {
  if (patches.length === 0) {
    return;
  }
  const sceneEngine = bridge.handle.internals.sceneEngine;
  const byType = new Map<string, PositionPatch[]>();
  for (const p of patches) {
    const type = sceneEngine.getNodeType(p.id);
    if (!type || bridge.isLocked(p.id)) {
      continue;
    }
    const list = byType.get(type) ?? [];
    list.push(p);
    byType.set(type, list);
  }
  if (byType.size === 0) {
    return;
  }
  bridge.commit('对齐/分布', () => {
    const frag: TreeSceneFragment = {};
    byType.forEach((nodes, type) => {
      frag[type] = nodes;
    });
    bridge.handle.update(frag);
  });
};
