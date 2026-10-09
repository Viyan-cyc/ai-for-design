# Grid

`import { Grid } from '@a3d/a3d-components/core'`

Grid —— 无限参考网格组件。

基于屏幕空间四边形 + 着色器实现的**无限网格**。
通过把整屏四边形反投影成世界射线，再与网格平面求交，在着色器中绘制**无边界**的网格，
因此无论相机如何移动 / 拉远，网格始终铺满屏幕、永远画不到头。

**特性:**
- 继承 `THREE.Mesh`，可直接加入任意 Three.js 场景
- 写入 `gl_FragDepth`，网格能被场景中的物体正确遮挡（与地面交互自然）
- 主 / 次双层网格（粗线 + 细线），可独立配置间距与不透明度
- 网格线、X 轴、Z/Y 轴颜色均可自定义（默认 X 轴红、Z/Y 轴蓝），坐标轴可用 `showAxis` 开关
- 可选基于相机距离的**线性淡出**，远处网格自然消失
- 支持水平地面（XZ）与垂直立面（XY）两种平面，可 GSAP 平滑切换
- 实现 IDisposable —— `dispose()` 释放 geometry / material

**注意:** 反投影矩阵依赖相机，组件在 `onBeforeRender` 中按当前渲染相机自动更新，
无需手动调用任何更新方法。

## Options（GridOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| primaryScale | `number` | `5` | 主网格（粗线）间距缩放，单位与世界单位一致。
每隔该距离绘制一条粗线。 |
| secondaryScale | `number` | `1` | 次级网格（细线）间距缩放。
叠加在主网格之上，形成逐级细分的效果。 |
| showAxis | `boolean` | `true` | 是否显示坐标轴高亮（X 轴 + Z/Y 轴）。
轴线颜色由 GridOptions.xAxisColor / GridOptions.zAxisColor 决定，
粗细固定（约 1px 抗锯齿线）。关闭后仅显示普通网格。 |
| primaryFade | `number` | `0.7` | 主网格淡出系数，乘到主网格线条 alpha 上。 |
| secondaryFade | `number` | `0.4` | 次级网格淡出系数，乘到次级网格线条 alpha 上。 |
| linearFade | `boolean` | `true` | 是否启用基于相机距离的线性淡出（远处网格逐渐消失）。
通过编译宏 `USE_LINEARFADE` 控制，运行时切换会重新编译着色器。 |
| fadeStart | `number` | `30` | 线性淡出起始距离（世界单位）。小于该距离不淡出。 |
| fadeEnd | `number` | `100` | 线性淡出结束距离（世界单位）。大于该距离完全透明。 |
| plane | `GridPlane` | `'xz'` | 网格平面。
- `'xz'`：水平地面（世界 Y=0 平面），适合作为场景地面参考网
- `'xy'`：面向 +Z 的立面（世界 Z=0 平面），适合作为 2D 坐标墙 |
| color | `ColorRepresentation` | `0x333333 (深灰)` | 网格线颜色（直接决定最终线色，颜色越深线越暗）。
接受 hex、CSS 字符串或 `THREE.Color`。 |
| xAxisColor | `ColorRepresentation` | `0xff0000 (红)` | X 轴高亮颜色。 |
| zAxisColor | `ColorRepresentation` | `0x0000ff (蓝)` | Z 轴（地面模式 XZ）/ Y 轴（立面模式 XY）高亮颜色。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |

## Example

```ts
import { Grid } from '@a3d/a3d-components/core';

// 作为无限地面参考网
const grid = new Grid({ primaryScale: 5, secondaryScale: 1 });
scene.add(grid);

// 运行时调整样式
grid.setShowAxis(false).setLinearFade(true).setFade(20, 80);

// 平滑切换到 2D 立面网格
grid.setPlane('xy');
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。