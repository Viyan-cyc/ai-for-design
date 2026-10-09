# Node3D

`import { Node3D } from '@a3d/a3d-components/graph'`

Node3D —— 图节点的 3D 视觉载体。

第一步为球体 Mesh；通过 `setPosition()` 应用布局坐标，
`getSize()` 在用户未指定尺寸时通过包围盒自动计算。

## Options（Node3DOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| data | `NodeData` | — | **必填**。该节点对应的输入数据（至少需含 `id`）。 |
| defaultSize | `number` | `0.3` | 节点默认尺寸（球体半径）。当 `data.size` 未指定时使用。 |
| material | `MeshStandardMaterial` | — | 节点材质**模板**。每个节点构造时会 `clone()` 一份独立实例，故各节点
状态变更（改色/高亮等）互不影响；不传则用内置默认 `MeshStandardMaterial`
作模板。`dispose()` 释放各节点自己 clone 的实例（模板本身不被释放）。 |
| geometryFactory | `{…}` | — | 节点几何体**工厂**。传入则用其返回值替代默认的 `SphereGeometry`，
可实现自定义节点形状（如六边形瓦片、立方体等）。工厂接收节点尺寸 `size`
（球体半径量级，可忽略自行决定瓦片尺度），须返回**新建**的 `BufferGeometry`
（节点会自行 `dispose()`）。不传则用球体。运行时可用
Node3D.setGeometryFactory 切换。 |
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
const node = new Node3D({
  data: { id: 'n1', size: 0.5 },
  material: myMaterial,
});
graph.add(node);
node.setPosition({ id: 'n1', x: 2, y: 0, z: 0 });
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。