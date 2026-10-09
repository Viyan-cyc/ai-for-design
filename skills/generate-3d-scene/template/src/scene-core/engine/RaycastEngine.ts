/**
 * RaycastEngine — 射线拾取（core 内部与 edit 共用的唯一拾取实现）
 *
 * 只依赖场景图（SceneEngine 的 resolveId 做命中归属），不依赖 edit。
 * pickable=false 的物体（含其子树）不参与检测。
 */
import * as THREE from 'three';
import type { PickResult } from '../types';

export class RaycastEngine {
  private raycaster = new THREE.Raycaster();

  private pointer = new THREE.Vector2();

  /**
   * 屏幕坐标拾取（clientX/Y 相对画布容器）。
   * @param objects 参与检测的根对象列表（一般为 scene.children）
   * @param isPickable 物体 id → 是否可拾取（pickable=false 的装饰物跳过）
   */
  pick(
    clientX: number,
    clientY: number,
    dom: HTMLElement,
    camera: THREE.Camera,
    objects: THREE.Object3D[],
    isPickable: (id: string) => boolean,
    resolveId: (obj: THREE.Object3D) => string | null,
  ): PickResult | null {
    const rect = dom.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    for (const hit of hits) {
      const id = resolveId(hit.object);
      if (!id) {
        continue;
      }
      if (!isPickable(id)) {
        continue;
      }
      return {
        id,
        object: hit.object,
        point: hit.point.clone(),
        distance: hit.distance,
      };
    }
    return null;
  }

  dispose(): void {
    // Raycaster 无 GPU 资源
  }
}
