# Html

`import { Html } from '@a3d/a3d-components/core'`

Html — Overlay HTML element positioned in 3D space.

把任意 DOM 元素钉在 3D 场景中的物体上：随相机投影定位，支持
CSS3D 变换（`transform`）、距离缩放（`distanceFactor`）、遮挡检测（`occlude`）。
常用于 3D 标注、信息卡片、跟随面板。

## Options（HtmlOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| el | `HTMLElement` | — | 要挂到场景的 DOM 元素；省略时按 `as` 新建 div。 |
| as | `string` | `'div'` | 新建元素使用的标签名（仅 `el` 未提供时生效）。 |
| portal | `HTMLElement` | `null（画布父元素）` | DOM 挂载目标容器；省略时挂到画布父元素。 |
| prepend | `boolean` | `false` | 为 true 时插到 `portal` 的首个子节点之前（默认追加到末尾）。 |
| center | `boolean` | `false` | 为 true 时元素以 50% 平移居中于投影点。 |
| fullscreen | `boolean` | `false` | 为 true 时铺满画布全屏（忽略 3D 投影定位）。 |
| eps | `number` | `0.001` | 射线求交的 epsilon 容差。 |
| distanceFactor | `number` | — | 缩放系数：按相机距离缩放元素（模拟 3D 深度感）；省略则恒定 1:1 像素尺寸。 |
| sprite | `boolean` | `false` | 为 true 时按 sprite 方式渲染（始终面向相机）。 |
| transform | `boolean` | `false` | 为 true 时用 CSS3D 变换（缩放/旋转随场景），否则仅 2D 投影定位。 |
| zIndexRange | `[number, number]` | `[16777271, 0]` | 元素 zIndex 范围 `[far, near]`，按深度插值。 |
| calculatePosition | `CalculatePositionFn` | `内置投影` | 自定义投影函数 `(object, camera, width, height) => [x, y]`。 |
| wrapperClass | `string` | — | 包裹容器的 CSS 类名。 |
| pointerEvents | `PointerEventsValue` | `'auto'` | 元素 CSS `pointer-events`。 |
| style | `string \| Partial<CSSStyleDeclaration>` | — | 元素内联样式（对象或 CSS 字符串）。 |
| className | `string` | — | 元素 CSS 类名。 |
| occlude | `OccludeMode` | `false` | 遮挡模式：`true`=blending、`'raycast'`=射线遮挡、`'blending'`=混合、传 Object3D[] 指定遮挡体。 |
| onOcclude | `{…}` | — | 遮挡状态变化回调（`hidden`=被遮挡）。 |
| occludeGeometry | `BufferGeometry` | — | 自定义遮挡检测几何体（`'raycast'` 模式用；省略用 1x1 代理面）。 |
| occludeMaterial | `Material` | — | 遮挡代理面的材质。 |
| castShadow | `boolean` | `false` | 遮挡代理面是否投射阴影。 |
| receiveShadow | `boolean` | `false` | 遮挡代理面是否接收阴影。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |

## Example

```ts
import * as THREE from 'three';
import { Html } from '@a3d/a3d-components/core';

const label = new Html({
  center: true,
  distanceFactor: 8,            // 随距离缩放
  occlude: 'raycast',           // 被几何体挡住时隐藏
  style: { background: '#fff', padding: '8px', borderRadius: '4px' },
});
label.element.innerHTML = '<strong>1 号风机</strong><br/>转速 12.3 rpm';
label.position.copy(turbine.position);
scene.add(label);

// 每帧：label.update() 需在 render 前调用（传入 camera/renderer 走精确遮挡）
function frame() {
  label.update(0, camera, renderer);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。