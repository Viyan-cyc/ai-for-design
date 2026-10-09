# Path

`import { Path } from '@a3d/a3d-components/core'`

Path — 路径绘制组件。

把一组 3D 顶点先经 `setBeveledCurves`（直线段 + 二次贝塞尔圆角）构造成曲线，
再经 `computeFrames`（Frenet 标架）采样，最后扫掠成**管道**或**扁平带**两种几何体。
算法翻译成 three.js 语言。

**特性:**
- 继承 `THREE.Group`，可直接加入任意 Three.js 场景
- `mode: 'tube'` 生成圆管（支持起终点封盖、锐角拐角椭圆拉伸避免撕裂）
- `mode: 'plane'` 生成扁平带（支持单/双偏侧、锐角几何修补、末端箭头）
- `bevelRadius > 0` 时拐角倒圆角；`up` 控制截面朝向（不传则 Frenet 自动）
- `close: true` 时路径自动闭合为环
- 所有路径共享同一材质；未传入材质时使用默认 `MeshStandardMaterial`
- 实现 IDisposable —— `dispose()` 释放全部几何体（自建材质一并释放）

## Options（PathOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| paths | `PathData[]` | — | 一组路径数据，每个元素生成一条管道或平面带。 |
| material | `Material` | — | 共享材质。所有路径复用。不传则使用默认 `MeshStandardMaterial`（`dispose()` 时一并释放）。 |
| flow | `FlowOptions` | `不开启` | 流光效果配置。开启后流光贯穿整组 paths（从第一条流向最后一条）。
流光材质由本组件 clone 生成并独立释放，不影响传入的 `material`。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |
| children | `Object3D<Object3DEventMap>[]` | — | Children to add to the group on construction.
Each child is passed to `this.add(child)` in the constructor. |

## Example

```ts
import { Path } from '@a3d/a3d-components/core';

// 3D 折线 → 圆管（带封盖）
const tube = new Path({
  paths: [{
    path: [[0,0,0],[3,0,0],[3,3,0],[0,3,0]],
    mode: 'tube', bevelRadius: 0.5, radius: 0.15,
    generateStartCap: true, generateEndCap: true,
  }],
});
scene.add(tube);

// 2D 折线 → 扁平带（锐角修补）
const route = new Path({
  paths: [{
    path: [[0,0,0],[3,0,0],[3,0,3],[0,0,3]],
    mode: 'plane', bevelRadius: 0, width: 0.5,
    side: 'both', sharp: true, up: [0,1,0],
  }],
});
scene.add(route);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。