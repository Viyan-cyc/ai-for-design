# MeshReflectorMaterial

`import { MeshReflectorMaterial } from '@a3d/a3d-components/material'`

MeshReflectorMaterial — a **planar reflection material** for Three.js.

Extends `THREE.MeshStandardMaterial` with real-time planar reflection
rendering. The material renders the scene from a mirrored virtual camera
into a render target, then composites the reflection onto the surface
with configurable blur, distortion, and depth-aware effects.

**Features:**
- Real-time planar reflections (mirror, floor, water, etc.)
- Multi-pass Kawase blur for soft reflections
- Depth-aware blur (near objects sharper, far objects blurrier)
- Normal-map-aware reflection distortion
- Distortion map support for water-like effects
- Configurable reflection strength, contrast, and mirror mode
- Oblique clip plane to prevent artifacts behind the reflector

**Usage:**
Unlike React-based implementations, this is a pure Three.js class.
Call `updateBeforeRender(renderer, scene, camera)` every frame
**before** `renderer.render(scene, camera)` to update the reflection.

## Options（MeshReflectorMaterialOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| resolution | `number` | `256` | Resolution of the reflection render target (width = height).
Higher values produce sharper reflections at the cost of GPU performance. |
| blur | `number \| [number, number]` | `[0, 0]` | Blur radius for the reflection texture.
- A single number applies the same blur in both directions.
- A `[width, height]` tuple allows asymmetric blur.
- Set to `0` or `[0, 0]` to disable blur. |
| mixBlur | `number` | `0` | How much the blurred reflection is mixed in (0–1).
- `0` = only sharp reflection
- `1` = fully blurred reflection
Only effective when `blur` is non-zero. |
| mixStrength | `number` | `1` | Overall strength of the reflection mix (0–1+).
- `0` = no reflection (pure base material)
- `1` = full reflection strength |
| mixContrast | `number` | `1` | Contrast adjustment applied to the reflection color.
- `1` = no change
- `> 1` = higher contrast
- `< 1` = lower contrast |
| mirror | `number` | `0` | How mirror-like the reflection is (0–1).
- `0` = reflection is blended with the base material color
- `1` = reflection replaces the base material color entirely |
| distortion | `number` | `1` | Distortion intensity (0–1+).
Requires a `distortionMap` texture to take effect. |
| distortionMap | `Texture` | — | A texture used to distort the reflection UV coordinates.
The red channel is used as the distortion offset.
When set, `USE_DISTORTION` define is enabled. |
| minDepthThreshold | `number` | `0.9` | Minimum depth threshold for depth-aware blur.
Pixels with depth below this value receive no depth-based blur. |
| maxDepthThreshold | `number` | `1` | Maximum depth threshold for depth-aware blur.
Pixels with depth above this value receive full depth-based blur. |
| depthScale | `number` | `0` | Scale factor for depth-based blur effect.
- `0` = disable depth-aware blur
- `> 0` = enable depth-aware blur with this scale |
| depthToBlurRatioBias | `number` | `0.25` | Bias controlling the ratio between depth and blur.
Higher values make the blur more dominant over depth. |
| reflectorOffset | `number` | `0` | Offset of the reflector plane along its normal direction.
Useful to avoid z-fighting when the reflector sits exactly on a surface. |
| color | `ColorRepresentation` | `0xffffff` | Base color of the material.
Accepts any value that `THREE.Color.set()` understands. |
| metalness | `number` | `0` | Metalness of the base material (0–1). |
| roughness | `number` | `0` | Roughness of the base material (0–1).
Also affects blur mixing: higher roughness → more blur. |

## Example

```ts
import { MeshReflectorMaterial } from '@a3d/a3d-components/material';

// Create a reflective floor
const reflectorMat = new MeshReflectorMaterial({
  mirror: 0.75,
  blur: [300, 100],
  mixBlur: 1,
  mixStrength: 0.8,
  resolution: 512,
  color: 0x999999,
});
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  reflectorMat,
);
floor.rotation.x = -Math.PI / 2;
reflectorMat.bindToMesh(floor);
scene.add(floor);

// In your render loop:
function animate() {
  requestAnimationFrame(animate);
  reflectorMat.updateBeforeRender(renderer, scene, camera);
  renderer.render(scene, camera);
}
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。