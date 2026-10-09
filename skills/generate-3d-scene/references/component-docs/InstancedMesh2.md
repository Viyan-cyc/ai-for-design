# InstancedMesh2

`import { InstancedMesh2 } from '@a3d/a3d-components/core'`

Enhanced `InstancedMesh` with per-instance frustum culling, BVH-accelerated raycasting,
LOD, per-instance uniforms, skeletal animation, morph targets, and indirect instancing.

Unlike standard `THREE.InstancedMesh`, this class uses **indirect instancing** via data textures,
allowing per-instance culling/sorting without buffer reallocation.

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。