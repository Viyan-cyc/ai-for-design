# Outlines

`import { Outlines } from '@a3d/a3d-components/core'`

Outlines — 描边组件。

原生 Three.js 实现（继承 `THREE.Group`）。

工作原理：取父级 `Mesh` 的几何体，按折痕角度分裂法线后生成一个**背面渲染**的描边网格，
在顶点着色器里沿法线把几何外扩 `thickness`，再叠回父级之下，形成轮廓描边效果。

**特性:**
- 继承 `THREE.Group`，可直接挂到任意 Three.js 场景
- 支持普通 `Mesh`、`SkinnedMesh`（绑定骨架）、`InstancedMesh`（复用实例矩阵）
- `screenspace` 切换屏幕空间 / 世界空间线宽
- 通过 `toCreasedNormals` 在硬边处分裂法线，描边沿真实轮廓外扩
- 实现 IDisposable —— `dispose()` 释放描边几何体与材质

## Options（OutlinesOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| mesh | `Mesh<BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>, Material<MaterialEventMap> \| Material<MaterialEventMap>[], Object3DEventMap> \| SkinnedMesh<BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>, Material<MaterialEventMap> \| Material<MaterialEventMap>[], Object3DEventMap> \| InstancedMesh<BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>, Material<MaterialEventMap> \| Material<MaterialEventMap>[], InstancedMeshEventMap>` | — | 要描边的父级网格。支持普通 `Mesh`、`SkinnedMesh`、`InstancedMesh`。 |
| color | `ColorRepresentation` | `'black'` | 描边颜色。 |
| opacity | `number` | `1` | 描边不透明度。 |
| transparent | `boolean` | `false` | 描边是否透明。 |
| screenspace | `boolean` | `false` | 线宽是否与缩放无关（屏幕空间恒定）。
- `true`：厚度按世界单位沿法线偏移，与摄像机距离无关；
- `false`（默认）：厚度按裁剪空间偏移，远处更细、近处更粗。 |
| thickness | `number` | `0.05` | 描边线宽。 |
| angle | `number` | `Math.PI` | 几何折痕角度（弧度）。
- `0` = 不分裂、直接复用父级法线；
- `Math.PI`（默认）= 在每个硬边处分裂法线，使描边沿轮廓外扩、平面区域不被描边。 |
| renderOrder | `number` | `0` | 渲染顺序。 |
| polygonOffset | `boolean` | `false` | 是否启用多边形偏移（避免与父级表面 Z-fighting）。 |
| polygonOffsetFactor | `number` | `0` | 多边形偏移因子。 |
| toneMapped | `boolean` | `true` | 是否参与色调映射。 |
| clippingPlanes | `Plane[]` | — | 裁剪平面列表。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |
| children | `Object3D<Object3DEventMap>[]` | — | Children to add to the group on construction.
Each child is passed to `this.add(child)` in the constructor. |

## Example

```ts
import { Outlines } from '@a3d/a3d-components/core';

const mesh = new THREE.Mesh(geometry, material);
const outline = new Outlines({ mesh, color: 'red', thickness: 0.05 });
mesh.add(outline); // 描边作为 mesh 的子级，自动跟随变换 / 骨架
scene.add(mesh);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。