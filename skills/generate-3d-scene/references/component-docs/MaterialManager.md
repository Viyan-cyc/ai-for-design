# MaterialManager

`import { MaterialManager } from '@a3d/a3d-components/material'`

Interface for components that support resource cleanup.

Implement this interface (or extend a base class that does) to
allow deterministic disposal of GPU resources, event listeners,
and other long-lived allocations.

## Options（MaterialManagerOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| themes | `Record<string, Theme>` | — | 风格模板集合:theme 名 → 材质配置表。 |
| current | `string` | — | 初始 theme,默认第一个。 |
| assetCache | `AssetCache` | — | 注入的 AssetCache,用于贴图异步加载。未注入时仅支持纯配色 config。 |
| onError | `{…}` | — | 错误回调(未知 key/theme、type 不一致、贴图加载失败、共享模式下误用 repeat 等)。 |
| placeholderColor | `ColorRepresentation` | — | 占位颜色:带贴图材质在贴图未就绪时填充 color,避免闪白;贴图就绪后恢复 config color
(默认白)。无贴图材质不受影响。未设置时不占位(贴图未就绪时 color 保持 config 值)。 |

## Example

```ts
const comp = new MyComponent();
scene.add(comp);
// ... later ...
comp.dispose();
scene.remove(comp);
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。