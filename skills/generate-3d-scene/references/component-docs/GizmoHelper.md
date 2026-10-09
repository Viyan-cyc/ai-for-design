# GizmoHelper

`import { GizmoHelper } from '@a3d/a3d-components/helper'`

GizmoHelper —— 视口导航 Gizmo（Viewport Gizmo）容器。

原生 Three.js 实现。在屏幕角落绘制一个独立的小视口，用一个正交相机渲染
一个 gizmo（默认 GizmoViewport 三轴指示器）。该 gizmo 实时镜像主相机朝向，
点击其上的轴头即可把主相机平滑旋转到对应的标准视角。

**特性：**
- 自带独立虚拟场景 + 正交相机，通过 `scissor` / `viewport` 叠层绘制，不污染主场景。
- 每帧把内容根节点的四元数设为主相机世界矩阵的逆 —— gizmo 始终与主相机朝向同步。
- GizmoHelper.tweenCamera 用 `rotateTowards` 平滑动画相机到目标视角。
- 自带射线拾取：点击 gizmo 上的可拾取对象（如轴头）触发 `userData.onPick`。

**注意 —— 渲染顺序：**
`renderOverlay()` 会把 gizmo 画到主画面之上，因此**必须在每帧主场景
`renderer.render(scene, camera)` 之后**调用。`update(delta)` 则负责同步与动画，
可在主渲染之前或之后调用。

**不加入主场景：** GizmoHelper 管理自己的虚拟场景，因此**不要** `scene.add(gizmo)`。
只需创建它，并在渲染循环中调用 `update(delta)` 与 `renderOverlay()`。

## Options（GizmoHelperOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| camera | `Camera` | — | 主场景相机：gizmo 镜像其朝向，点击轴时围绕目标点旋转它。 |
| renderer | `WebGLRenderer` | — | 用于绘制 gizmo 叠层的 WebGLRenderer。 |
| controls | `GizmoControlsLike` | — | 相机控制器（OrbitControls 等）。可选；省略时围绕原点旋转。 |
| content | `GizmoContent` | — | gizmo 内容（GizmoViewport 等）。可在构造后用 GizmoHelper.setContent 设置。 |
| alignment | `GizmoAlignment` | `'bottom-right'` | 屏幕九宫格对齐位置。 |
| margin | `[number, number]` | `[16, 16]` | 相对屏幕边缘的留白 `[水平, 垂直]`（CSS 像素）。 |
| size | `number` | `120` | gizmo 叠层的方形边长（CSS 像素）。 |
| disabled | `boolean` | `false` | 是否整体禁用（不渲染、不响应点击、不做相机同步）。 |
| onTarget | `{…}` | — | 自定义轨道目标点提供函数，优先级高于 `controls.target`。 |
| onUpdate | `{…}` | — | 每个动画步的回调，替代 `controls.update`（二选一）。 |

## Example

```ts
import { GizmoHelper, GizmoViewport } from '@a3d/a3d-components/helper';

const gizmo = new GizmoHelper({
  camera,
  renderer,
  controls: orbitControls,
  alignment: 'bottom-right',
});
gizmo.setContent(new GizmoViewport({
  onPick: (dir) => gizmo.tweenCamera(dir),
}));

// 渲染循环（注意顺序）：
function frame() {
  const dt = clock.getDelta();
  controls.update();
  gizmo.update(dt);          // 同步 gizmo 朝向 + 动画相机
  renderer.render(scene, camera);
  gizmo.renderOverlay();     // 必须在主渲染之后
  requestAnimationFrame(frame);
}
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。