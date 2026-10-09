# GizmoViewport

`import { GizmoViewport } from '@a3d/a3d-components/helper'`

GizmoViewport —— 三轴视口指示器（GizmoHelper 的默认内容），仿 **ThreeOrbitControlsGizmo**
（[Fennec-hub/ThreeOrbitControlsGizmo](https://github.com/Fennec-hub/ThreeOrbitControlsGizmo)）的 2D 扁平气泡样式。

样式细节：
- **连接线**：仅 +X / +Y / +Z 正轴从中心连出细彩色线；负轴无线。
- **正轴气泡**：实心彩色圆 + 常显暗色字母（X/Y/Z）。
- **负轴气泡**：半透明同色填充 + 同色实心边框；字母（−X/−Y/−Z）仅悬停时显示。
- **深度色**：每帧按各轴朝向切换 正面=亮色 / 背面=暗色，并按深度排序绘制（前压后）。
- **整体悬停**：鼠标进入 helper 区域时，背后浮现一个浅白色透明圆底（`backdropOpacity` 可调）。
- **气泡悬停**：悬停某个气泡时，**仅其字母变白**，气泡填充 / 边框不变。

气泡为始终面向相机的 `Sprite`。点击任一轴头触发 GizmoViewportOptions.onPick，
交由 GizmoHelper.tweenCamera 把主相机平滑旋转到对应标准视角。

## Options（GizmoViewportOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| onPick | `{…}` | — | 点击轴头时的回调，参数为该轴的世界方向（如 `(1,0,0)`）。
通常传 `(dir) => gizmo.tweenCamera(dir)`。 |
| colors | `{…}` | `{ x:['#f73c3c','#942424'], y:['#6ccb26','#417a17'], z:['#178cf0','#0e5490'] }` | 三轴颜色，每条轴为 `[正面亮色, 背面暗色]`。 |
| labels | `[string, string, string]` | `['X','Y','Z']` | 正轴气泡标签文字 `[X, Y, Z]`（常显）。 |
| negativeLabels | `[string, string, string]` | `['-X','-Y','-Z']` | 负轴气泡标签文字 `[-X, -Y, -Z]`（仅悬停时显示）。 |
| labelColor | `ColorRepresentation` | `'#222222'` | 标签文字常规色（正轴未悬停时）。 |
| hoverColor | `ColorRepresentation` | `'#ffffff'` | 悬停时文字变白的颜色。 |
| negativeOpacity | `number` | `0.35` | 负轴气泡填充透明度。 |
| backdropOpacity | `number` | `0.13` | 整体悬停时出现的白色圆底透明度（0 关闭）。 |
| size | `number` | `1` | 气泡整体缩放。 |
| hideNegativeAxes | `boolean` | `false` | 是否隐藏负方向轴头（−X/−Y/−Z）。 |
| hideAxisHeads | `boolean` | `false` | 是否隐藏所有轴头（仅保留轴线）。 |
| disabled | `boolean` | `false` | 是否禁用点击拾取。 |
| name | `string` | — | `Object3D.name`。 |

## Example

```ts
import { GizmoViewport } from '@a3d/a3d-components/helper';

const viewport = new GizmoViewport({ onPick: (dir) => gizmo.tweenCamera(dir) });
gizmo.setContent(viewport);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。