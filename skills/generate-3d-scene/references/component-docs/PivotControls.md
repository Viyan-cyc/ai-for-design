# PivotControls

`import { PivotControls } from '@a3d/a3d-components/controls'`

PivotControls —— 统一变换操控 Gizmo（平移 / 旋转 / 缩放一体）。

原生 Three.js 实现。与 TransformControls
「一次只显示一种模式」不同，PivotControls 在一个 gizmo 上**同时**呈现：
- 三根**轴箭头**（AxisArrow，单轴平移）
- 三个**平面滑块**（PlaneSlider，双轴平移）
- 三段**旋转弧**（AxisRotator，绕轴旋转）
- 三个**缩放球**（ScalingSphere，单轴缩放）

## 用法
```ts
const pivot = new PivotControls({ camera, renderer, controls: orbit });
scene.add(pivot);
pivot.add(model);              // 受控内容

function frame() {
  const dt = clock.getDelta();
  orbit.update();
  pivot.update(dt);            // 每帧调用（同步 fixed 缩放 / 刷新线条分辨率）
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
```

## Options（PivotControlsOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| camera | `Camera` | — | 观察相机（`fixed` 模式与缩放计算依赖）。 |
| renderer | `WebGLRenderer` | — | 渲染器（提供 canvas + 视口尺寸；指针监听挂在其 `domElement` 上）。 |
| controls | `PivotControlsLike` | — | 相机控制器（OrbitControls 等）；拖拽期间会被临时禁用以抑制轨道。 |
| enabled | `boolean` | `true` | 是否启用交互（false 时 gizmo 仅显示、不响应拖拽）。 |
| autoTransform | `boolean` | `true` | 拖拽后是否自动把局部变换应用到本组（false 时只通过 onDrag 回调输出矩阵）。 |
| activeAxes | `[boolean, boolean, boolean]` | `[true, true, true]` | 各轴是否参与（X/Y/Z）。 |
| disableAxes | `boolean` | `false（全部启用）` | 关闭某类操控件（轴箭头/平面滑块/旋转弧/缩放球各自独立开关）。 |
| disableSliders | `boolean` | `false` | 关闭平面滑块（双轴平移）。 |
| disableRotations | `boolean` | `false` | 关闭旋转弧。 |
| disableScaling | `boolean` | `false` | 关闭缩放球。 |
| offset | `[number, number, number]` | `[0,0,0]` | gizmo 相对原点的额外平移（不受 anchor 影响，二者叠加）。 |
| rotation | `[number, number, number]` | `[0,0,0]` | gizmo 起始旋转（Euler，XYZ 顺序）。 |
| matrix | `Matrix4` | — | 受控起始矩阵（受控模式：每帧以该矩阵覆盖本组矩阵；拖拽不会持久）。 |
| anchor | `[number, number, number]` | — | 包围盒锚点 —— 每个分量为 -1 / 0 / +1，把 gizmo 定位到内容包围盒的角 / 边 / 中心。 |
| scale | `number` | `1` | gizmo 整体缩放（世界单位；`fixed` 时为像素）。 |
| lineWidth | `number` | `4` | 可见线条宽度（像素）。 |
| fixed | `boolean` | `false` | 为 true 时 gizmo 保持固定屏幕像素尺寸（`scale` 语义变为像素）。 |
| visible | `boolean` | `true` | gizmo 是否可见。 |
| axisColors | `[ColorRepresentation, ColorRepresentation, ColorRepresentation]` | `['#ff2060','#20df80','#2080ff']` | 三轴颜色 `[X, Y, Z]`。 |
| hoveredColor | `ColorRepresentation` | `'#ffff40'` | 悬停高亮色。 |
| opacity | `number` | `1` | 整体不透明度。 |
| depthTest | `boolean` | `true` | 是否做深度测试（false 则 gizmo 穿透显示）。 |
| renderOrder | `number` | `500` | 渲染顺序。 |
| userData | `Record<string, unknown>` | — | 附着到命中 mesh 的自定义 userData。 |
| translationLimits | `LimitsTuple` | `undefined（不限制）` | 平移区间限制，三轴各自 `[min, max]`，端点可为 `undefined` 表示不限制。 |
| rotationLimits | `LimitsTuple` | `undefined（不限制）` | 旋转区间限制（弧度），三轴各自 `[min, max]`。 |
| scaleLimits | `LimitsTuple` | `undefined（不限制）` | 缩放区间限制，三轴各自 `[min, max]`。 |
| annotations | `boolean` | `false` | 拖拽时显示数值徽标。 |
| annotationsClass | `string` | — | 徽标 div 的额外 CSS 类名。 |
| children | `Object3D<Object3DEventMap>[]` | — | 受控内容（自动 `this.add`）。也可构造后用 `pivot.add(content)`。 |
| onDragStart | `{…}` | — | 拖拽开始回调（收到操控件类型、轴、原点等上下文）。 |
| onDrag | `{…}` | — | 拖拽中：`(local, deltaLocal, world, deltaWorld)`。 |
| onDragEnd | `{…}` | — | 拖拽结束回调。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |

## Example

```ts
import * as THREE from 'three';
import { PivotControls } from '@a3d/a3d-components/controls';

const pivot = new PivotControls({
  camera,
  renderer,
  controls: orbit,          // 相机控制器（拖拽期间自动禁用）
  axisColors: ['#ff2060', '#20df80', '#2080ff'],
});
scene.add(pivot);
pivot.add(model);           // 受控内容

function frame() {
  const dt = clock.getDelta();
  orbit.update();
  pivot.update(dt);         // 每帧调用（同步 fixed 缩放 / 刷新线条分辨率）
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。