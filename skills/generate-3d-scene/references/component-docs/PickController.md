# PickController

`import { PickController } from '@a3d/a3d-components/graph'`

PickController —— 图交互拾取与事件分发控制器。

不继承任何 Three 对象，仅作为「控制器」持有 Raycaster 与监听器。
必须在不再使用时调用 dispose 移除事件监听并还原反馈状态。

## Options（PickControllerOptions）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| domElement | `HTMLElement` | — | 监听 pointer 事件的宿主（通常是渲染 canvas）。 |
| graph | `Graph3D` | — | 拾取目标图组件。 |
| camera | `Camera` | — | 摄像机（NDC 射线 origin）。 |
| enabled | `boolean` | `true` | 是否启用。 |
| hover | `boolean` | `true` | 是否启用 hover 拾取。 |
| highlightOnHover | `boolean` | `true` | 是否应用内置悬停反馈（放大+发光）。 |
| highlightOnSelect | `boolean` | `true` | 是否应用内置选中反馈（常亮发光）。 |
| neighborHighlight | `boolean` | `true` | 选中节点时是否高亮相邻边（仅提亮邻接边，其余边不变）。 |
| selectionMode | `"single" \| "multiple"` | `'single'` | 选中模式。
- `'single'`（默认）：互斥。选中新元素自动取消旧选中。
- `'multiple'`：纯累加 toggle。点击追加选中，再点已选元素取消。

节点与边均可被选中。点击空白/地面清空全部选中。 |
| onHover | `GraphEventHandler` | — | hover / unhover 事件回调。 |
| onSelect | `GraphEventHandler` | — | click / select / unselect 事件回调。 |

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。