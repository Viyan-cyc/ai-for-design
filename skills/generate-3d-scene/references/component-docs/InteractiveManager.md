# InteractiveManager

`import { InteractiveManager } from '@a3d/a3d-components/interactive'`

Centralized raycaster-based interaction system.

## Architecture

1. **Intersection expansion**: Each raw Three.js hit is expanded into
   multiple `Intersection` entries — one per registered ancestor. A hit
   on a child mesh produces entries for both the child AND its registered
   parent(s), all in a flat sorted list.

2. **Flat iteration (not DOM-style bubbling)**: Events are dispatched by
   iterating the flat intersection list. `stopPropagation()` breaks the
   loop — it does NOT walk the parent chain.

3. **Hover tracking**: Keyed by `eventObject.uuid` (the registered object),
   so moving between child meshes of the same registered object does not
   fire `out`/`over`. `over`+`enter` fire together on new hover;
   `out`+`leave` fire together via `cancelPointer`.

4. **Click validation**: Only fires on `initialHits` (objects hit during
   pointerDown). `pointerMissed` fires on non-hit registered objects.

## Options（InteractiveManagerOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| camera | `Camera` | — | The camera used for raycasting. Updated externally (e.g. by OrbitControls). |
| domElement | `HTMLElement` | — | The canvas element (or `renderer.domElement`) to attach DOM listeners to. |
| scene | `Object3D` | — | The scene or root object to raycast into.

- **Provided**: one `intersectObject(scene, true)` call raycasts the entire
  tree; hits are resolved to registered objects via parent-chain walking.
- **Omitted**: `intersectObjects(registered, recursive)` only hits
  registered objects. |
| controls | `ControlsLike` | — | Camera controller to temporarily disable during pointer-down drag. |
| clickThreshold | `number` | `2` | Pixel distance threshold for click-vs-drag discrimination. |
| doubleClickTimeThreshold | `number` | `300` | Maximum time in ms between two clicks for a doubleclick. |
| recursive | `boolean` | `true` | Whether to raycast recursively into children of registered objects.

Only applies when `scene` is **not** provided. |
| computeNDC | `ComputeNDCFn` | — | Custom raycast coordinate normalization hook. |
| filterIntersections | `FilterIntersectionsFn` | — | Custom intersection filter on raw Three.js intersections
(before expanding to registered ancestors). |

## Example

```ts
const manager = new InteractiveManager({
  camera,
  domElement: renderer.domElement,
  scene,
  controls: orbitControls,
});

manager.add(myMesh, {
  onClick: (e) => console.log('clicked!', e.eventObject),
  onPointerOver: (e) => { e.eventObject.material.emissive.setHex(0x333333); },
  onPointerOut: (e) => { e.eventObject.material.emissive.setHex(0x000000); },
});

manager.dispose();
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。