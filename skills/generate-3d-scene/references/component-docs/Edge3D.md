# Edge3D

`import { Edge3D } from '@a3d/a3d-components/graph'`

Edge3D —— 图边的 3D 视觉载体。

`'line'` 为直线段；`'path'` 为圆管（复用 Path）。`source`/`target`
变化时调用 `updateEnds()` 刷新几何。

## Options（Edge3DOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| id | `NodeId` | — | 边 id。 |
| source | `NodePos3D` | — | 起点坐标。 |
| target | `NodePos3D` | — | 终点坐标。 |
| type | `EdgeType` | `'line'` | 边形态。
- `'line'`（默认）：`LineSegments` 直线段，材质为 `LineBasicMaterial`。
- `'path'`：复用 Path 的 `mode:'tube'` 圆管，材质为 `MeshStandardMaterial`。 |
| pathRadius | `number` | `0.05` | `'path'` 形态的管道半径。仅 `type:'path'` 生效。 |
| arrow | `boolean` | `false` | `'path'` 形态是否在末端生成箭头（有向边）。仅 `type:'path'` 生效。 |
| material | `MeshStandardMaterial \| LineBasicMaterial` | — | 边材质**模板**。按 Edge3DOptions.type 决定材质类型：
- `'line'`：`LineBasicMaterial`；
- `'path'`：`MeshStandardMaterial`。

每条边构造时会 `clone()` 一份独立实例，故各边状态变更（改色/高亮等）
互不影响；不传则用内置默认值作模板。`dispose()` 释放各边自己 clone 的
实例（模板本身不被释放）。 |
| scale | `number` | `1` | 整体缩放。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |
| children | `Object3D<Object3DEventMap>[]` | — | Children to add to the group on construction.
Each child is passed to `this.add(child)` in the constructor. |

## Example

```ts
const edge = new Edge3D({ source: p1, target: p2, type: 'path', arrow: true, material: mat });
graph.add(edge);
// 节点位置变化后：
edge.updateEnds(newP1, newP2);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。