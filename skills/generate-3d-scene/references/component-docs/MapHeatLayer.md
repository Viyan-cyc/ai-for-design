# MapHeatLayer

`import { MapHeatLayer } from '@a3d/a3d-components/map'`

Native single heat surface. No fetching, demo fallback, Vue or private animation loop.

## Example

```ts
const heat = new MapHeatLayer(map, { id: 'traffic', valueRange: [0, 100] });
heat.setData([{ id: 'sensor_1', lng: 114.06, lat: 22.54, value: 45 }]);
// Before removing the host map:
heat.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。