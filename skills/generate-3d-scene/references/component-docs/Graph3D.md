# Graph3D

`import { Graph3D } from '@a3d/a3d-components/graph'`

Graph3D —— 3D 图可视化主组件。

## Options（Graph3DOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| data | `GraphData` | — | 初始图数据。若提供，构造后立即 Graph3D.setData。 |
| nodeSize | `number` | `0.3` | 节点默认尺寸（球体半径）。当节点自身未指定 `size` 时使用。 |
| nodeMaterial | `MeshStandardMaterial` | — | 节点材质**模板**。每个节点构造时 `clone()` 一份独立实例，故各节点状态变更
（改色/高亮等）互不影响；不传则用内置默认 `MeshStandardMaterial` 作模板。 |
| nodeGeometry | `{…}` | — | 节点几何体**工厂**（可选）。传入则每个节点用其返回值替代默认球体，
可实现自定义节点形状（如六边形瓦片）。工厂接收节点尺寸 `size`，须返回
**新建**的 `BufferGeometry`（节点自行释放）。`setData` 重建后仍应用 ——
即「重新生成」数据后形状不丢。运行时用 Graph3D.setNodeGeometry 切换。 |
| edgeMaterial | `LineBasicMaterial` | — | 边材质**模板**（`LineBasicMaterial`）。每条边构造时 `clone()` 一份独立实例，
故各边状态变更互不影响；不传则用内置默认值作模板。模板本身不被释放。 |
| edgeType | `"line" \| "path"` | `'line'` | 边形态。
- `'line'`（默认）：`LineSegments` 直线段。
- `'path'`：复用 `core/Path` 的圆管（可选箭头）。

注：单条边可在 `EdgeData.type` 上覆盖此全局默认（见 Graph3D.setData）。 |
| edgePathRadius | `number` | `0.05` | `'path'` 形态边的管道半径。 |
| edgeArrow | `boolean` | `false` | `'path'` 形态边是否在末端生成箭头（有向边）。 |
| initialRadius | `number` | `3` | 占位环形散布的半径（仅当节点无显式坐标时使用）。 |
| layout | `LayoutPreset` | — | 声明式布局预设（Step 5）。若提供，每次 Graph3D.setData 后自动应用该布局
（无需手动 `applyLayout`），构造时也会立即应用一次。

与命令式 Graph3D.applyLayout 的区别：`layout` 被**记忆**，`setData` 重建后自动重应用；
`applyLayout` 是一次性、不记忆。运行时可用 Graph3D.setLayout 切换预设，
用 Graph3D.getLayout 读取当前预设。 |
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
import { Graph3D } from '@a3d/a3d-components/graph';

const graph = new Graph3D();
graph.setData({
  nodes: [{ id: 'n1' }, { id: 'n2' }],
  edges: [{ source: 'n1', target: 'n2' }],
});
scene.add(graph);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。