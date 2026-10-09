# Rack

`import { Rack } from '@a3d/a3d-components/core'`

Rack —— 货架组件。

由立柱、横梁（框架）与层板组成的仓储货架。所有构件复用同一个单位 BoxGeometry，
经两个 InstancedMesh（框架 + 层板）实例化渲染——无论货架多大规模，始终只有 2 个 draw call。

**坐标系:** 原点位于货架前缘左端——宽度沿 +X（`0 … 总宽`）、高度沿 +Y（`0 … 总高`）、
深度沿 -Z（`0 … -depth`），正面朝 +Z。

**特性:**
- 继承 `THREE.Group`，可直接加入任意 Three.js 场景
- `row` / `col` 支持数量（等分布局）或数组（逐货位宽度 / 逐层高度）
- `goodsPlank` 三种层板模式：百分比字符串 / 固定宽度数值 / 显式数组；不传则为整层通长实心层板
- `set()` 动态重建：只传变化字段（浅合并），适配数据驱动的场景（如智能排布）
- `copy()` / `clone()` 拷贝结构数据后整体重建，不与源实例共享任何实例网格
- 实现 IDisposable —— `dispose()` 释放实例网格与共享几何体（自建材质一并释放）

## Options（RackOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| data | `RackData` | — | 初始货架数据。不传则创建空货架，之后可随时 Rack.set。 |
| frameMaterial | `Material` | — | 框架（立柱 + 横梁）共享材质。不传则使用默认 `MeshStandardMaterial`（`dispose()` 时一并释放）。 |
| plankMaterial | `Material` | — | 层板共享材质。不传则使用默认 `MeshStandardMaterial`（`dispose()` 时一并释放）。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |
| children | `Object3D<Object3DEventMap>[]` | — | Children to add to the group on construction.
Each child is passed to `this.add(child)` in the constructor. |

## Example

```ts
import { Rack } from '@a3d/a3d-components/core';

// 4 货位 × 3 层、深 1m 的等分货架，每货位放一块 60% 宽的层板
const rack = new Rack({
  data: { row: 4, col: 3, width: 1.2, height: 0.8, depth: 1, goodsPlank: '60' },
});
scene.add(rack);

// 数据驱动重建：只改层数，其余沿用
rack.set({ col: 5 });

// 逐货位宽度 + 逐层高度 + 显式层板
rack.set({
  row: [1, 2, 1],
  col: [0.5, 1, 1.5],
  goodsPlank: [{ position: { x: 1, y: 1, z: -0.5 }, width: 0.6, depth: 0.9 }],
});
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。