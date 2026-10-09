# Wireframe

`import { Wireframe } from '@a3d/a3d-components/core'`

Wireframe — 线框化组件。

原生 Three.js 实现（继承 `THREE.Group`）。

工作原理：基于**重心坐标（barycentric）**在每个三角形内计算到三条边的最小距离，
用 `fwidth` 抗锯齿画出线条；支持虚线、收窄、正反面不同色、半透明填充。

提供两种模式：
- **独立线框**（默认，`overrideMaterial = false`）：在父级网格下挂一个子 `Mesh`，
  用独立 `ShaderMaterial` 渲染线框 + 填充，父级原材质不变；
- **材质覆盖**（`overrideMaterial = true`）：通过 `onBeforeCompile` 把线框注入
  父级材质，与原 PBR 光照混合渲染，适合「带光照的线框模型」。

两种模式都要求几何体具备 `barycentric` 属性——本组件会在初始化时自动调用
applyBarycentric 计算（**就地修改父级几何体**，必要时请传入副本）。

**特性:**
- 继承 `THREE.Group`，可直接挂到任意 Three.js 场景
- 抗锯齿线条（standard derivatives）、虚线 / 收窄可调
- 正反面独立着色、半透明填充
- 实现 IDisposable —— `dispose()` 释放线框几何体与材质

## Options（WireframeOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| mesh | `Mesh` | — | 要线框化的父级网格。 |
| stroke | `ColorRepresentation` | `'#ff0000'` | 线条（描边）颜色。 |
| backfaceStroke | `ColorRepresentation` | `'#0000ff'` | 背面线条颜色（仅在 `colorBackfaces` 为真时用于背面）。 |
| fill | `ColorRepresentation` | `'#00ff00'` | 填充颜色（三角形内部）。 |
| strokeOpacity | `number` | `1` | 线条不透明度。 |
| fillOpacity | `number` | `0.25` | 填充不透明度。 |
| fillMix | `number` | `0` | 填充颜色与原材质 `diffuse` 的混合比例（仅 `overrideMaterial` 模式有效）。
- `0` = 完全用 `fill`；
- `1` = 完全用原材质漫反射色。 |
| thickness | `number` | `0.05` | 线条粗细（0–1，经 `map(0,1,0,0.34)` 映射为实际像素厚度）。 |
| colorBackfaces | `boolean` | `false` | 是否给背面单独着色（用 `backfaceStroke`）。 |
| dash | `boolean` | `false` | 是否启用虚线。 |
| dashInvert | `boolean` | `true` | 虚线是否反转（亮 / 暗段互换）。 |
| dashRepeats | `number` | `4` | 虚线重复次数（每条边重复几段）。 |
| dashLength | `number` | `0.5` | 虚线一段中「亮」的占比（0–1）。 |
| squeeze | `boolean` | `false` | 是否启用中间收窄（线条向段中心变细）。 |
| squeezeMin | `number` | `0.2` | 收窄最小值。 |
| squeezeMax | `number` | `1` | 收窄最大值。 |
| renderOrder | `number` | `0` | 渲染顺序。 |
| toneMapped | `boolean` | `false` | 是否参与色调映射。 |
| overrideMaterial | `boolean` | `false` | 是否覆盖父级材质（`onBeforeCompile` 注入），而非生成独立线框网格。
- `false`（默认）：创建一个 `THREE.Mesh` 子级，用独立 `WireframeMaterial` 渲染线框，
  父级原材质不受影响，线框与填充叠在同一个几何体上；
- `true`：直接改写父级材质（`onBeforeCompile`），把线框融入原 PBR 渲染，
  适合「带光照的线框化模型」。此模式下 `fillMix` 生效。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |
| children | `Object3D<Object3DEventMap>[]` | — | Children to add to the group on construction.
Each child is passed to `this.add(child)` in the constructor. |

## Example

```ts
import { Wireframe } from '@a3d/a3d-components/core';

const mesh = new THREE.Mesh(geometry, standardMaterial);
const wf = new Wireframe({ mesh, stroke: '#ff0000', thickness: 0.1, dash: true });
mesh.add(wf); // 作为子级，自动跟随父级变换
scene.add(mesh);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。