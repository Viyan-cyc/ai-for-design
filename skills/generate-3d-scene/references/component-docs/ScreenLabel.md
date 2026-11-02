# ScreenLabel

`import { ScreenLabel } from '@a3d/a3d-components/labels'`

Fixed CSS-pixel label for perspective, orthographic and shared map cameras.
Call dispose() when used independently. When handed to an engine resource owner,
let that owner release the material/texture instead; do not release twice.

## Options（ScreenLabelOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| text | `string` | `''` | Text used when no texture is supplied. |
| texture | `Texture` | — | Caller-owned texture; dispose() never releases an external texture. |
| widthPx | `number` | `180` | Display width in CSS pixels, independent of DPR. |
| heightPx | `number` | `48` | Display height in CSS pixels. |
| depthTest | `boolean` | `true` | Whether scene geometry can occlude the label. |
| anchor | `[number, number]` | `[0.5, 0]` | Sprite anchor, normalized X/Y. |

## Example

```ts
import { ScreenLabel } from '@a3d/a3d-components/labels';
const label = new ScreenLabel({ text: '机房', widthPx: 180 });
scene.add(label);
// On removal, when not managed by an engine:
label.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。