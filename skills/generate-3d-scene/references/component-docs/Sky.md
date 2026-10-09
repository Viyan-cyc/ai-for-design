# Sky

`import { Sky } from '@a3d/a3d-components/core'`

Sky —— 天空穹顶组件。

基于内翻球体（`BackSide`）+ 着色器实现的**天空穹顶**，通过从地平线到天顶的
幂次渐变模拟天空大气效果。球体始终从内部可见，相机应位于球体内部。

**特性:**
- 继承 `THREE.Mesh`，可直接加入任意 Three.js 场景
- 使用 `THREE.BackSide` 渲染，球体从内部可见
- 天顶 / 地平线颜色可独立配置，支持运行时动态切换
- 渐变指数与偏移量可调，灵活控制渐变曲线
- 实现 IDisposable —— `dispose()` 释放 geometry / material

**注意:** 球体半径应大于场景范围但小于相机远裁剪面，否则天空可能被裁剪。
建议将相机远裁剪面设为略大于天空球半径。

## Options（SkyOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| size | `number` | `1000` | 天空球半径（世界单位）。
应足够大以包围整个场景，但不要超出相机远裁剪面。 |
| topColor | `ColorRepresentation` | `0x109df4 (天蓝)` | 天顶颜色（球体最高处的颜色）。
接受 hex、CSS 字符串或 `THREE.Color`。 |
| bottomColor | `ColorRepresentation` | `0xf5f5f5 (浅灰白)` | 地平线 / 底部颜色。
接受 hex、CSS 字符串或 `THREE.Color`。 |
| offset | `number` | `0` | 世界坐标偏移量，用于调整渐变中心高度。
增大该值使渐变整体上移，地平线附近颜色更偏 bottomColor。 |
| exponent | `number` | `0.6` | 渐变指数，控制从地平线到天顶的颜色过渡曲线。
值越大过渡越陡峭（天顶色区域更集中），值越小过渡越平缓。 |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |

## Example

```ts
import { Sky } from '@a3d/a3d-components/core';

// 天空穹顶
const sky = new Sky({
  size: 500,
  topColor: 0x109df4,
  bottomColor: 0xf5f5f5,
  offset: 0,
  exponent: 0.6,
});
scene.add(sky);

// 运行时调整颜色
sky.setTopColor(0x1a8af4).setBottomColor(0xe0e0e0);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。