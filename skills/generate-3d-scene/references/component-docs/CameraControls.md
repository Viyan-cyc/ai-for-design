# CameraControls

`import { CameraControls } from '@a3d/a3d-components/camera'`

Orbit-style camera controller with smooth transitions.

Supports `PerspectiveCamera` and `OrthographicCamera` with orbit rotation,
dolly/zoom, truck/pan, boundary constraints, collision detection,
and configurable mouse/touch input mapping.

## Options（CameraControlsOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| camera | `PerspectiveCamera \| OrthographicCamera` | — | The camera to control. Supports `PerspectiveCamera` and `OrthographicCamera`. |
| domElement | `HTMLElement` | — | The DOM element to attach pointer events to (usually `renderer.domElement`). |
| minPolarAngle | `number` | `0` | Minimum polar (vertical) angle in radians. |
| maxPolarAngle | `number` | `Math.PI` | Maximum polar (vertical) angle in radians. |
| minAzimuthAngle | `number` | `-Infinity` | Minimum azimuth (horizontal) angle in radians. |
| maxAzimuthAngle | `number` | `Infinity` | Maximum azimuth (horizontal) angle in radians. |
| minDistance | `number` | `Number.EPSILON` | Minimum distance from target (perspective). |
| maxDistance | `number` | `Infinity` | Maximum distance from target (perspective). |
| infinityDolly | `boolean` | `false` | Allow dolly past the target point. |
| minZoom | `number` | `0.01` | Minimum zoom factor (orthographic). |
| maxZoom | `number` | `Infinity` | Maximum zoom factor (orthographic). |
| smoothTime | `number` | `0.25` | Smooth time for programmatic transitions (seconds). |
| draggingSmoothTime | `number` | `0.125` | Smooth time while the user is dragging (seconds). |
| maxSpeed | `number` | `Infinity` | Maximum interpolation speed. |
| azimuthRotateSpeed | `number` | `1.0` | Horizontal rotation speed multiplier. |
| polarRotateSpeed | `number` | `1.0` | Vertical rotation speed multiplier. |
| dollySpeed | `number` | `1.0` | Mouse-wheel dolly speed multiplier. |
| dollyDragInverted | `boolean` | `false` | Invert drag direction when dollying / zooming. |
| truckSpeed | `number` | `2.0` | Truck / pedestal drag speed multiplier. |
| enabled | `boolean` | `true` | Whether the controls are enabled. |
| dollyToCursor | `boolean` | `false` | Dolly toward the mouse cursor instead of screen center. |
| dragToOffset | `boolean` | `false` | Drag translates the focal offset instead of trucking. |
| boundaryFriction | `number` | `0` | Friction factor at boundary edges (0 = hard clamp, 1 = no friction). |
| restThreshold | `number` | `0.01` | Threshold for considering the camera at rest. |
| boundaryEnclosesCamera | `boolean` | `false` | When true, constrains the camera position (not just target) within boundary. |
| mouseButtons | `MouseButtons` | — | Mouse button → action mapping. |
| touches | `Touches` | — | Touch gesture → action mapping. |
| boundary | `Box3` | — | Boundary box constraining the camera target or position. |
| viewport | `{…}` | — | Viewport scissor region for rendering into a sub-region. |
| colliderMeshes | `Object3D<Object3DEventMap>[]` | — | Meshes that the camera cannot pass through. |
| onUpdate | `{…}` | — | Fired every frame the camera updates. |
| onWake | `{…}` | — | Fired when the camera starts moving. |
| onRest | `{…}` | — | Fired when camera movement drops below `restThreshold`. |
| onSleep | `{…}` | — | Fired when the camera stops moving. |
| onTransitionStart | `{…}` | — | Fired when any transition begins. |
| onControlStart | `{…}` | — | Fired when the user starts dragging. |
| onControl | `{…}` | — | Fired while the user is dragging. |
| onControlEnd | `{…}` | — | Fired when the user stops dragging. |
| name | `string` | — | Optional name applied to the `Object3D.name` property.
Useful for debugging and scene traversal. |
| visible | `boolean` | `true (inherited from THREE.Object3D)` | Whether the component is visible on creation. |
| userData | `Record<string, unknown>` | — | Arbitrary user data attached to the object.
Stored in `Object3D.userData`. |

## Example

```ts
const controls = new CameraControls({
  camera,
  domElement: renderer.domElement,
  smoothTime: 0.3,
});

// Programmatic rotation
await controls.rotateTo( Math.PI / 4, Math.PI / 3, true );

// Per-frame update
controls.update( delta );
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。