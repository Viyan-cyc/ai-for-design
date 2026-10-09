# Wall

`import { Wall } from '@a3d/a3d-components/core'`

Wall — 墙体绘制组件。

每面墙先生成一个水密、带圆角的「厚路径挤出」实体（无缝、无割裂感），再用 CSG
（three-bvh-csg）从其上减去每个墙洞（窗 / 门）的棱柱——因此墙洞是真正的实体布尔开口，
边缘干净、与墙体连续。

**特性:**
- 继承 `THREE.Group`，可直接加入任意 Three.js 场景
- 墙体路径定义在 XZ 平面（y 被忽略），从 `y = 0` 向上生长至 `y = height`
- 每个拐角按 `radius` 倒圆角；数组形式可逐顶点指定，`undefined` 回退到全局值；
  `close = true` 时形成环形墙体
- 支持每段独立的墙洞（WallHole，窗 / 门），按段局部坐标描述并贯通墙体厚度
- UV 沿墙长（u）/ 墙高（v）重算，支持 `uvMode: 'repeat' | 'stretch'`，
  便于整面贴图（砖墙 / 窗户）；墙洞经 CSG 挖出后贴图在开口周围连续过渡
- 所有墙体共享同一材质；未传入材质时使用默认 `MeshStandardMaterial`
- 实现 IDisposable —— `dispose()` 释放全部几何体（自建材质一并释放）

## Options（WallOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| walls | `WallData[]` | — | 一组墙体数据，每个元素绘制一面墙。 |
| material | `Material` | — | 共享材质。所有墙体复用。不传则使用默认 `MeshStandardMaterial`（`dispose()` 时一并释放）。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |
| children | `Object3D<Object3DEventMap>[]` | — | Children to add to the group on construction.
Each child is passed to `this.add(child)` in the constructor. |

## Example

```ts
import { Wall } from '@a3d/a3d-components/core';

const wall = new Wall({
  walls: [
    {
      path: [[0, 0, 0], [6, 0, 0], [6, 0, 5], [0, 0, 5]],
      width: 0.25,
      height: 3,
      radius: 1,
      close: true,
      hole: [
        // 第 0 段（[0,0,0]→[6,0,0]）上的一扇门：沿墙 2~4m、高 0~2.1m
        { segment: 0, path: [[2, 0], [4, 0], [4, 2.1], [2, 2.1]] },
      ],
    },
  ],
});
scene.add(wall);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。