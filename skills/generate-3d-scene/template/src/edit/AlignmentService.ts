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
import type { Bridge } from './Bridge';

export type AlignAxis = 'x' | 'y' | 'z';
export type AlignMode = 'origin' | 'center' | 'min' | 'max';

const AXIS_INDEX: Record<AlignAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export interface PositionPatch {
  id: string;
  position: [number, number, number];
}

/** 计算对齐 patch（基准物体不动，其余向基准看齐） */
export const computeAlign = (
  bridge: Bridge,
  axis: AlignAxis,
  mode: AlignMode,
): PositionPatch[] => {
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
    ? anchorObj.position.getComponent(ai)
    : mode === 'center'
      ? anchorBox.getCenter(new THREE.Vector3()).getComponent(ai)
      : mode === 'min'
        ? anchorBox.min.getComponent(ai)
        : anchorBox.max.getComponent(ai);

  const patches: PositionPatch[] = [];
  for (const id of ids) {
    if (id === anchorId) {
      continue;
    }
    const obj = bridge.handle.internals.sceneEngine.getObject(id);
    const box = bridge.getBbox(id);
    if (!obj || !box) {
      continue;
    }
    // 当前物体同模式参照值
    const currentValue = mode === 'origin'
      ? obj.position.getComponent(ai)
      : mode === 'center'
        ? box.getCenter(new THREE.Vector3()).getComponent(ai)
        : mode === 'min'
          ? box.min.getComponent(ai)
          : box.max.getComponent(ai);
    const pos = obj.position.clone();
    pos.setComponent(ai, pos.getComponent(ai) + (anchorValue - currentValue));
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
    const pos = item.obj.position.clone();
    pos.setComponent(ai, pos.getComponent(ai) + (target - item.center));
    return { id: item.id, position: [pos.x, pos.y, pos.z] };
  });
};

/** 应用 patch（bridge.commit 内调用；label 进撤销栈） */
export const applyPatches = (bridge: Bridge, patches: PositionPatch[]): void => {
  if (patches.length === 0) {
    return;
  }
  bridge.commit('对齐/分布', () => {
    bridge.handle.update({ patch: patches.map((p) => ({ id: p.id, position: p.position })) });
  });
};
