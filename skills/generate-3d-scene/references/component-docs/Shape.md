# Shape

`import { Shape } from '@a3d/a3d-components/core'`

Shape — 异形面绘制组件。

接收 XZ 平面上的轮廓点，挤出指定高度，生成带圆角的实心几何体。
与 Wall 类似（都是 XZ 路径 + Y 挤出），但 Shape 是**实心填充区域**
（无 width 偏移、无孔洞），Wall 是厚路径描边。

**特性:**
- 继承 `THREE.Group`，可直接加入任意 Three.js 场景
- 轮廓路径定义在 XZ 平面（y 被忽略），从 `y = 0` 向上挤出至 `y = height`
- 轮廓**总是闭合**（首尾自动相连形成封闭区域）
- 每个拐角按 `radius` 倒圆角；数组形式可逐顶点指定，`undefined` 回退到全局值
- UV 沿轮廓弧长（u）/ 高度（v）重算，支持 `uvMode: 'repeat' | 'stretch'`
- 所有异形面共享同一材质；未传入材质时使用默认 `MeshStandardMaterial`
- 实现 IDisposable —— `dispose()` 释放全部几何体（自建材质一并释放）

## Options（ShapeOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| shapes | `ShapeData[]` | — | 一组异形面数据，每个元素生成一个挤出几何体。 |
| material | `Material` | — | 共享材质。所有异形面复用。不传则使用默认 `MeshStandardMaterial`（`dispose()` 时一并释放）。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |
| children | `Object3D<Object3DEventMap>[]` | — | Children to add to the group on construction.
Each child is passed to `this.add(child)` in the constructor. |

## Example

```ts
import { Shape } from '@a3d/a3d-components/core';

// L 形异形台面
const shape = new Shape({
  shapes: [{
    path: [[0,0,0], [4,0,0], [4,0,2], [2,0,2], [2,0,5], [0,0,5]],
    height: 0.6,
    radius: 0.3,
    radiusSegments: 12,
    uvMode: 'repeat',
  }],
});
scene.add(shape);

// 混合圆角：第 0、3 个拐角 0.5，其余用全局值 0.2
const shape2 = new Shape({
  shapes: [{
    path: [[0,0,0], [3,0,0], [3,0,3], [0,0,3]],
    height: 0.4,
    radius: [0.5, undefined, undefined, 0.5],  // 第 1、2 个用全局 0.2
    radiusSegments: 12,
  }],
});
scene.add(shape2);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。