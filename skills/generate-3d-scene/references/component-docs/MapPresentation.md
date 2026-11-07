# MapPresentation

`import { MapPresentation } from '@a3d/a3d-components/map'`

Owns presentation only. Dispose restores touched style properties and removes owned resources.

## Example

```ts
const presentation = new MapPresentation(map, { theme: 'light' });
presentation.updateSurface('building', { color: '#ffffff' });
presentation.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。