# MapSurfaceParticleScan

`import { MapSurfaceParticleScan } from '@a3d/a3d-components/map'`

Optional map-only effect. Explicit complete footprints are preferred to clipped rendered tiles.
No private RAF: active animation requests the host MapRuntime scheduler.

## Example

```ts
const scan = new MapSurfaceParticleScan(runtime, { enabled: true, center: [0, 0], buildings });
scan.setOptions({ paused: true });
console.log(scan.getStats());
scan.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。