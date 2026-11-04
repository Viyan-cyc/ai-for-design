# Chart API — @hw-dtn/dt-ui v1.5.0

> Generated: 2026-11-04 | Source: es/ compiled output, runtime-verified

---

## Index

1. [DtChart (ECharts wrapper)](#1-dtchart)
2. [BarChart (3D class)](#2-barchart-3d)
3. [DtBarChartThree (3D Vue wrapper)](#3-dtbarchartthree)
4. [DtTopoThree (3D topology)](#4-dttopothree)
5. [G6 Topologies](#5-g6-topologies)
6. [DtPointBezier (SVG)](#6-dtpointbezier)
7. [DtCustomBarChart (CSS)](#7-dtcustombarchart)
8. [DtDashboardDesigner/Renderer](#8-dashboard-components)
9. [Shared utilities & inject keys](#9-shared-utilities)
10. [Runtime integration notes](#10-runtime-integration)

---

## 1. DtChart

**[已执行]** Source: `es/components/chart/index.vue.mjs`
**[已执行]** Runtime-validated: line, bar, pie, gauge series with theme switching

General-purpose ECharts wrapper. All echarts series types supported.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | Object | `{}` | ECharts option object (reactive; deep-watched) |
| `created` | Function | — | Callback after first render, receives chart instance |
| `showEmpty` | Boolean | false | Show DtNoData when series is empty |
| `width` | String\|Number | `"100%"` | Container width |
| `height` | String\|Number | `"200px"` | Container height |
| `showTheme` | Boolean | false | **Must be true** to enable echarts theme registration |
| `theme` | String | `""` | ECharts theme name (from chartTheme keys). **[BUG]** validator is broken — see Runtime notes |

### Events

| Event | Payload | Description |
|---|---|---|
| `resize` | `(chartEl, chartInstance)` | After chart.resize() |

### Theme Mechanism

**[已执行]** Flow:

1. On setup, if `showTheme=true`, `setDefaultTheme()` registers ALL `chartTheme` keys via `echarts.registerTheme(key, chartTheme[key])`
2. `theme` prop change → watch → nextTick → render()
3. render(): if `showTheme=true && theme` → **dispose + re-init** with `echarts.init(el, theme, { devicePixelRatio: window.devicePixelRatio * 1.5 })`
4. Theme switch **recreates echarts instance** (dispose + init), not just setOption

### Data Update

- Setting `options.isNew = true` → forces full re-creation
- Otherwise `setOption(value, true)` (notMerge mode)

### Resize

- Internal `resize.on(el, handler)` (ResizeObserver)
- Watches `width`/`height` props
- `onActivated` → `nextTick(resizeChart())`
- `window.dispatchEvent(new Event('resize'))` also triggers (via DtBarChartThree)

### Lifecycle

- `onMounted` → nextTick → render()
- `onBeforeUnmount` → chart.dispose()
- `onActivated` → nextTick → resizeChart()

### Runtime Warning: Theme Validator

**[已执行 fact]** The built-in validator is buggy:

```js
validator(val) {
  return ["", Object.keys(THEME_MAP)].includes(val);
  // Creates: ["", ["light","dark",...]] — individual keys never match
}
```

**[已执行 fix]** Patch at app startup:

```js
import { DtChart, DtNoData, THEME_MAP } from '@hw-dtn/dt-ui'
;[DtChart, DtNoData].forEach((c) => {
  if (c?.props?.theme?.validator) {
    c.props.theme.validator = (val) => val === '' || Object.keys(THEME_MAP).includes(val)
  }
})
```

---

## 2. BarChart (3D)

**[已执行]** Source: `es/components/bar-chart/index.mjs`
**NOT a Vue component.** Imperative class API.

### Constructor

```js
new BarChart(dom: HTMLElement, data?: Array, config?: Object)
```

### Config

```js
{
  theme: "light",         // "light" | "dark"
  xAxis: { key: "xAxis", data: [] },
  yAxis: { key: "yAxis" },
  zAxis: { key: "zAxis", data: [] },
  statusMap: ["alarm", "normal"],
  bar: {},
  selectType: "default",
  selectable: true
}
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `update` | `(data, options?)` | Update data. `options.resetCamera` resets view |
| `resize` | `(width, height)` | Resize renderer |
| `setTheme` | `(theme: "light"\|"dark")` | In-place update of scene bg, axis, bar colors |
| `getTheme` | `() => string` | Current theme |
| `resetCamera` | `()` | Reset camera |
| `zoomIn` / `zoomOut` | `()` | Zoom control |
| `select` | `(id, options?) => boolean` | Select by id |
| `deselect` | `()` | Clear selection |
| `destroy` | `()` | Full cleanup |
| `trackCardPosition` | `(id, {x,y,z})` | Register tracking |
| `untrackCardPosition` | `(id)` | Remove tracking |
| `clearTrackedPositions` | `()` | Clear all |
| `getRenderer` | `() => RendererManager` | Advanced access |
| `getBarChart3D` | `() => BarChart3D` | Advanced access |

### Events

`click`, `hover`, `dblclick`, `select`, `updatePosition`

---

## 3. DtBarChartThree

**[已执行]** Source: `es/components/bar-chart-three/bar-chart-3d.vue.mjs`

### Props

| Prop | Type | Default |
|---|---|---|
| `options` | Object | `{}` |
| `theme` | String | `"dark"` |

### Events

| Event | Payload |
|---|---|
| `page-change` | pageNo |
| `after-bar-click` | bar object |
| `bar-mouse-hover` | bar object |

### Exposed

| Method | Description |
|---|---|
| `renderingData()` | Re-render |
| `simulatedClickBar(obj)` | Simulate bar click |

### Runtime Warning: window.onresize

**[已执行 fact]** On mount: `window.onresize = () => { resizeRender() }`. On unmount: `window.onresize = null`.

This **overwrites** any existing `window.onresize` and **destroys** it on unmount rather than restoring the previous handler.

---

## 4. DtTopoThree

**[已执行]** Source: `es/components/topo-three/`

### Props

| Prop | Type | Default |
|---|---|---|
| `options` | Object | `{}` |
| `useSuper` | Boolean | false |

### Events

| Event | Payload |
|---|---|
| `loaded` | `utils` API object |
| `click-model` | `selectList, event` |
| `hover-model` | `modelInfo, event` |

### Utils API (from `loaded` event)

`init`, `handleFlow`, `handleExpand`, `handleZoom`, `handleView`, `handleSearch`, `handleResize`, `toggleName`, `handleSetting`

### External Resources (CRITICAL — ~8MB)

- `.glb` 3D models: npu, server, leaf, spine, roce (~50-650KB each)
- Draco WASM: `draco_decoder.wasm` (~192KB), `draco_decoder2.wasm` (~478KB), `draco_decoder.js` (~719KB)
- Background images: `bg-light-*.png` (~3.2MB), `bg-dark-*.png` (~1.7MB)

---

## 5. G6 Topologies

### DtClusterTopo

Props: `data`, `tooltipContent`, `clickMenus`, `topoNEStyle`. Events: `click-menu`, `selected-change`.

### DtRelationTopo

Props: `nodeId`, etc. Various topo interaction events.

### DtInferTopo

Props: `data`, etc. Uses `InferGraph`, `PolyBox` custom node.

**All G6 topologies** are NOT theme-responsive (hardcoded node/edge colors).

---

## 6. DtPointBezier

**[已执行]** Source: `es/components/point-bezier/`
**[已执行]** Runtime-validated with trigger/target data + relation

### Props

| Prop | Type | Default |
|---|---|---|
| `relation` | Array | `[]` |
| `triggerData` | Array | `[]` |
| `targetData` | Array | `[]` |
| `fill` | String | `"none"` |
| `stroke` | String | `"#ccc"` |
| `strokeWidth` | Number | `4` |

### Data Format

```js
triggerData: [{ id: 't1', label: 'A', isShow: true }]
targetData:  [{ id: 'e1', label: 'X', isShow: true }]
relation:    [{ start: 't1', end: 'e1' }]
```

### Events

`delete`, `add`, `click`, `enter`, `leave`, `blur`

### Runtime Note

Uses `resolveDirective("click-outside")`. Requires `vClickOutside` to be registered manually if `app.use(SweetUI)` is not called.

---

## 7. DtCustomBarChart

**[已执行]** Runtime-validated: renders CSS horizontal bar chart

### Props

| Prop | Type | Default |
|---|---|---|
| `option` | Object | — |

```js
{
  yData: ['Service A', 'Service B'],
  seriesData: [85, 62],
  xMax: 100,
  xStep: 20,
  yLabelFontSize: 12,
  xTickFontSize: 12,
  barHeight: 24,
  barRadius: 4,
  labelShow: true,
  tooltipShow: true
}
```

---

## 8. Dashboard Components

### DtDashboardDesigner

Drag-and-drop dashboard designer. Uses `inject('sweetI18n')` extensively — requires i18n provide.

### DtDashboardRenderer

Render-only companion.

---

## 9. Shared Utilities

### Inject Keys

| Key | Provides |
|---|---|
| `"sweetI18n"` | i18n translate function — **MUST be provided** |
| `INJECT_ECHARTS_UTILS_KEY` | echartsUtils |
| `INJECT_EVENT_BUS_KEY` | EventBus |
| `INJECT_RESIZE_KEY` | resize |
| `INJECT_G6_UTILS_KEY` | g6Utils |
| `INJECT_HTTP_KEY` | http service |
| `INJECT_LOGIN_USER_KEY` | loginUser |
| `INJECT_FAST_QUEUE_KEY` | fastQueue |
| `INJECT_FULLSCREEN_KEY` | fullscreen |
| `INJECT_AXIOS_KEY` | axios |
| `INJECT_RESOLUTION_KEY` | resolution |

### Full Export List (from es/index.mjs)

**Charts/Visual:** `DtChart`, `BarChart`, `DtBarChartThree`, `DtTopoThree`, `DtClusterTopo`, `DtClusterTopoIcon`, `DtRelationTopo`, `DtInferTopo`, `DtPointBezier`, `DtCustomBarChart`, `DtDashboardDesigner`, `DtDashboardRenderer`

**Theme:** `setTheme`, `chartTheme`, `THEME_MAP`, `THEME_TYPE`, `i18n`

**NOT exported:** `themeInfo` (exists in `es/theme/theme.mjs`, not in index)

**Utils:** `$echartsUtils`, `$g6Utils`, `echartsUtils`, `g6Utils`, `CustomGraph`, `CustomTooltip`, `resize`, `resizeUtil`, `useHandleResize`

**Other:** `DtNoData`, `DtDialog`, `DtFilter`, `DtTable`, `DtTree`, `DtTransferTree`, `DtTimeSelectBar`, `DtSidePanel`, `DtMbbCard`, `DtFullscreen`, `DtMultiSelect`, `DtDateTimeUtc`, `DtTimeLineControl`, `DtTimeSelectBarOption`, `DtI18nConfigModal`, `DtI18nConfigProvider`, `DtCustomLoading`, `DtDate`

**Directives:** `vEllipsis`, `vVerify`, `vTrim`, `vCustomLoading`, `vCustomDraggable`, `vCustomResizable`

---

## 10. Runtime Integration

### Minimal Working main.js

**[已执行]** Verified in validation project:

```js
import { createApp } from 'vue'
import App from './App.vue'
import DtUI, { setTheme as dtSetTheme } from '@hw-dtn/dt-ui'
import { setTheme as sweetSetTheme, vClickOutside } from '@hw-seq/sweet-ui-base'
import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css'
import '@hw-dtn/dt-ui/dist/index.css'

const app = createApp(App)
app.provide('sweetI18n', (key) => key)
app.use(DtUI)
app.directive('click-outside', vClickOutside)

// Theme
app.config.globalProperties.$switchTheme = (name) => {
  const cssName = name === 'uDesign2.2-dark' ? 'GTS UDesign（默认风格）-dark' : name
  dtSetTheme(name, app)
  sweetSetTheme(cssName, app)
}
app.config.globalProperties.$switchTheme('uDesign2.2-light')
app.mount('#app')
```

### Minimal vite.config.js

**[已执行]**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    dedupe: ['vue', 'echarts', 'lodash', 'dayjs', 'xss', '@hw-seq/sweet-ui-base']
  },
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false'
  }
})
```

### Post-install Fix

**[已执行]** After `npm install`, remove nested sweet-ui-base and clear Vite cache:

```bash
Remove-Item -Recurse -Force 'node_modules\@hw-dtn\dt-ui\node_modules'
Remove-Item -Recurse -Force 'node_modules\.vite'
npx vite --force
```
