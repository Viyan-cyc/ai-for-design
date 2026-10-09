# BitmapText

`import { BitmapText } from '@a3d/a3d-components/core'`

BitmapText — SDF-based dynamic text component for Three.js.

Renders text using a Signed Distance Field font atlas generated at runtime
via Canvas 2D. No external font files or plugins required.

**Features:**
- Dynamic font atlas generation via DynamicFont
- SDF rendering with configurable halo / gamma for anti-aliasing
- Optional drop shadow (color, offset, gamma)
- Optional outline / stroke (color, width, gamma)
- Text alignment (left / center / right)
- Word wrapping (nowrap / pre / word-wrapper) with CJK support
- Configurable letter spacing and line height
- Implements IDisposable — `dispose()` releases all GPU resources

## Options（BitmapTextOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| text | `string` | `''` | Text string to render. |
| fontSize | `number` | `72` | Font size in pixels. |
| fontFamily | `string` | `'sans-serif'` | CSS font-family. |
| fontWeight | `string` | `'normal'` | CSS font-weight. |
| fontStyle | `string` | `'normal'` | CSS font-style. |
| atlasWidth | `number` | `2048` | Atlas width. |
| atlasHeight | `number` | `2048` | Atlas height. |
| width | `number` | `1000` | Maximum line width (font units). |
| mode | `TextMode` | `'word-wrapper'` | Wrapping mode. |
| align | `TextAlign` | `'left'` | Text alignment. |
| letterSpacing | `number` | `0` | Extra spacing between characters (font units). |
| lineHeight | `number` | `fontSize` | Line height (font units). |
| baseline | `number` | `fontSize * 0.8` | Baseline offset (font units). |
| halo | `number` | `0.75` | SDF threshold. |
| gamma | `number` | `1` | SDF smoothing. |
| color | `ColorRepresentation` | `0xffffff` | Text color. |
| opacity | `number` | `1` | Opacity. |
| shadow | `boolean` | `false` | Whether to enable drop shadow. |
| shadowColor | `ColorRepresentation` | `0x4d4d4d` | Shadow color. |
| shadowOffset | `[number, number]` | `[0.001, -0.001]` | Shadow UV offset [x, y]. |
| shadowGamma | `number` | `1` | Shadow gamma. |
| outline | `boolean` | `false` | Whether to enable outline. |
| outlineColor | `ColorRepresentation` | `0xff0000` | Outline color. |
| outlineWidth | `number` | `0.05` | Outline width (SDF units). |
| outlineGamma | `number` | `1` | Outline gamma. |
| billboard | `boolean` | `false` | Whether text always faces camera. |
| scale | `number` | `0.01` | World-space scale factor. |
| centerX | `number` | `0.5 (centered)` | Horizontal center offset (0–1). |
| centerY | `number` | `0.5 (centered)` | Vertical center offset (0–1). |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |

## Example

```ts
import { BitmapText } from '@a3d/a3d-components/core';

const text = new BitmapText({
  text: 'Hello 世界',
  fontSize: 72,
  width: 1000,
  align: 'center',
  outline: true,
  outlineColor: 0x00bbff,
  outlineWidth: 0.06,
});
scene.add(text);

// Update text at runtime
text.setText('Updated text');

// Cleanup
text.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。