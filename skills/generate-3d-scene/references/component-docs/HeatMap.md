# HeatMap

`import { HeatMap } from '@a3d/a3d-components/heat'`

HeatMap — a **canvas-based heatmap texture generator**.

Renders data points onto an offscreen canvas using the two-pass alpha
channel technique:

1. **Shadow pass** — each point is drawn as a radial-gradient circle whose
   alpha encodes intensity; overlapping circles accumulate naturally.
2. **Colour pass** — the shadow canvas's alpha channel is mapped through a
   configurable colour gradient to produce the final heatmap image.

The result is exposed as a `THREE.CanvasTexture` that can be applied to any
material in a Three.js scene.

**Features:**
- Extends `THREE.Group` — can be added directly to any scene
- Implements IDisposable — cleans up canvases & texture on `dispose()`
- Chainable HeatMap.setData / HeatMap.setGradient methods
- Auto-updates the `CanvasTexture` when data or gradient changes

## Options（HeatMapOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| width | `number` | `256` | Canvas width in pixels. |
| height | `number` | `256` | Canvas height in pixels. |
| radius | `number` | `40` | Default radius for heat points (pixels).
Can be overridden per-point if `HeatMapPoint.radius` is provided. |
| opacity | `number` | `0.6` | Global opacity of the rendered heatmap (0–1).
Applied to the final colour-mapped canvas. |
| gradient | `HeatMapGradient` | ``{ 0.25: 'rgb(0,0,255)', 0.55: 'rgb(0,255,0)', 0.85: 'rgb(255,255,0)', 1.0: 'rgb(255,0,0)' }`` | Colour gradient mapping normalised intensity to colour.
Keys are positions in [0, 1]; values are CSS colour strings. |

## Example

```ts
import { HeatMap } from '@a3d/a3d-components/heat';

const heatMap = new HeatMap({
  width: 512,
  height: 512,
  radius: 50,
  opacity: 0.7,
});

heatMap.setData({
  max: 100,
  data: [
    { x: 100, y: 100, value: 80 },
    { x: 300, y: 200, value: 50 },
    { x: 400, y: 350, value: 100 },
  ],
});

// Use the texture on any mesh
const material = new THREE.MeshBasicMaterial({
  map: heatMap.texture,
  transparent: true,
});
const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), material);
scene.add(plane);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。