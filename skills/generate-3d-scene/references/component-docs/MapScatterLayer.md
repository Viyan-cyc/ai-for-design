# MapScatterLayer

`import { MapScatterLayer } from '@a3d/a3d-components/map'`

One transparent canvas, driven by the host's render events; sizes are CSS pixels.

## Example

```ts
const scatter = new MapScatterLayer(map, { theme: 'light', onSelect: marker => console.log(marker.ids) });
scatter.setData([{ id: 'device_1', lng: 114.06, lat: 22.54 }]);
scatter.setOptions({ visible: false });
scatter.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。