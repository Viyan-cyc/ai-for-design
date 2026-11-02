# MapRuntime

`import { MapRuntime } from '@a3d/a3d-components/map'`

Optional MapLibre host for a shared-context Three scene. No editor or business dependencies.
Map owns the canvas, navigation and frame scheduling. Consumers must use standard
depth (logarithmicDepthBuffer=false), autoClear=false and reset GL state per draw.
Dispose the consumer's Three resources before disposing this runtime.
Import MapLibre CSS once in the application, not in this library.

## Options（MapRuntimeOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| host | `HTMLElement` | — | Element receiving an owned absolute-positioned map container. |
| style | `string` | — | MapLibre style URL. |
| origin | `[number, number]` | — | Local metre-frame origin [longitude, latitude], Mercator latitude within ±85. |
| center | `[number, number]` | — | Initial map center. Defaults to origin. |
| zoom | `number` | `16` | Initial zoom. |
| pitch | `number` | `45` | Initial pitch in degrees. |
| bearing | `number` | `0` | Initial bearing in degrees. |
| pixelRatio | `number` | `1` | Canvas pixel ratio, applied once by MapLibre. |
| antialias | `boolean` | `false` | Context antialiasing; cannot change without recreation. |
| getMaxFps | `{…}` | `60` | Current application animation FPS cap; navigation remains map-owned. |
| loadTimeoutMs | `number` | `60000` | Initialization timeout in milliseconds. |

## Example

```ts
import { MapRuntime } from '@a3d/a3d-components/map';
import 'maplibre-gl/dist/maplibre-gl.css';
const runtime = await MapRuntime.create({ host, style: styleUrl, origin: [121.5, 31.2] });
// Create renderer with runtime.canvas and runtime.context; do not clear shared depth.
runtime.setFrameTarget({ camera, draw: () => {
  renderer.resetState(); renderer.render(scene, camera); renderer.resetState();
} });
runtime.requestFrame();
// On teardown: renderer.dispose(); runtime.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。