# Runtime Acceptance — @hw-dtn/dt-ui v1.5.0

> Generated: 2026-11-04 | Updated with full runtime validation results

## 1. Validation Project

**Location:** `D:\project\gts\ai-for-design\output\dt-ui-runtime-check-current`
**Dev server:** `npx vite --port 5174 --strictPort` → `http://localhost:5174/index.html`

### Setup Commands (executed)

```bash
cd D:\project\gts\ai-for-design\output\dt-ui-runtime-check-current
npm install    # 186 packages

# CRITICAL: Remove nested sweet-ui-base to prevent dual Vue instance
Remove-Item -Recurse -Force 'node_modules\@hw-dtn\dt-ui\node_modules'

# CRITICAL: Clear Vite pre-bundle cache after removing nested copy
Remove-Item -Recurse -Force 'node_modules\.vite'

# Build
npx vite build   # SUCCESS (17.70s, 3857 modules)

# Dev server
npx vite --port 5174 --strictPort --force
```

### Installed Versions

**[已执行]**

| Package | Version | Resolution Path |
|---|---|---|
| vue | 3.5.29 | node_modules/vue |
| @hw-seq/sweet-ui-base | 5.7.0 | node_modules/@hw-seq/sweet-ui-base |
| @hw-dtn/dt-ui | 1.5.0 | node_modules/@hw-dtn/dt-ui |
| echarts | 6.1.0 | node_modules/echarts |
| three | 0.185.1 | node_modules/three |
| @antv/g6 | 5.1.1 | node_modules/@antv/g6 |
| lodash | 4.18.1 | node_modules/lodash |

### Build Result

**[已执行]** `npx vite build` → **SUCCESS** (17.70s, 3857 modules)

Output: `dist/index-e140655f.js` (7,053 KB) + `dist/index-52607a18.css` (1,869 KB) + assets

Warnings: chunk size > 500KB (expected: three.js + echarts bundled together)

### Vite Configuration (verified working)

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

**[已执行 fact]** Adding `@hw-seq/sweet-ui-base` to dedupe is **necessary but not sufficient** — the nested `dt-ui/node_modules/@hw-seq/sweet-ui-base@5.6.5` must also be physically removed, and `.vite` cache cleared.

### main.js (verified working)

```js
import { createApp } from 'vue'
import App from './App.vue'
import DtUI, { setTheme as dtSetTheme } from '@hw-dtn/dt-ui'
import { setTheme as sweetSetTheme, vClickOutside } from '@hw-seq/sweet-ui-base'
import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css'
import '@hw-dtn/dt-ui/dist/index.css'

const app = createApp(App)
app.provide('sweetI18n', (key) => key)   // fallback before setTheme provides real one
app.use(DtUI)
app.directive('click-outside', vClickOutside)

app.config.globalProperties.$switchTheme = (name) => {
  const cssName = name === 'uDesign2.2-dark' ? 'GTS UDesign（默认风格）-dark' : name
  dtSetTheme(name, app)
  sweetSetTheme(cssName, app)
}
app.config.globalProperties.$switchTheme('uDesign2.2-light')
app.mount('#app')
```

---

## 2. Runtime Error Resolution Log

### Error 1: `unref(...) is not a function` (FATAL — blank page)

**Cause:** Two copies of sweet-ui-base (5.6.5 nested + 5.7.0 root) → two Vue instances. `unref` from wrong copy.

**Fix:** dedupe + remove nested + clear cache.

**Status:** **RESOLVED** ✓

### Error 2: `injection "sweetI18n" not found` (FATAL — DtNoData crash)

**Cause:** `setTheme()` hasn't been called yet when DtNoData first renders. Without the call, no `app.provide("sweetI18n", t)` exists.

**Fix:** `app.provide('sweetI18n', (key) => key)` before `app.use(DtUI)`.

**Status:** **RESOLVED** ✓

### Error 3: `onMounted is called when there is no active component instance`

**Cause:** Cascading from DtNoData crash (unref error breaks the component instance).

**Fix:** Resolved when Error 1 and 2 are fixed.

**Status:** **RESOLVED** ✓

### Error 4: `ECharts: Can't get DOM width or height`

**Cause:** DtNoData crash disrupts mount sequence → charts try to init on zero-size containers.

**Fix:** Resolved when Error 1 and 2 are fixed.

**Status:** **RESOLVED** ✓

### Error 5: Duplicate directive/component registration warnings

**Cause:** Calling both `app.use(SweetUI)` and `app.use(DtUI)` — DtUI's installer already registers SweetUI components.

**Fix:** Only `app.use(DtUI)`, do NOT call `app.use(SweetUI)`.

**Status:** **RESOLVED** ✓

### Error 6: `A plugin must either be a function or an object with an "install" function`

**Cause:** An entry in dt-ui's Components array lacks a valid `install` method.

**Fix:** None — dt-ui library bug. Non-breaking warning only.

**Status:** **KNOWN** — warning persists, no crash

### Error 7: `Failed to resolve directive: click-outside`

**Cause:** DtPointBezier uses `resolveDirective("click-outside")`. sweet-ui-base's installer would register it, but we don't call `app.use(SweetUI)`.

**Fix:** `app.directive('click-outside', vClickOutside)` manually.

**Status:** **RESOLVED** ✓

### Error 8: `Invalid prop: theme validator check failed`

**Cause:** dt-ui bug: `["", Object.keys(THEME_MAP)].includes(val)` creates nested array.

**Fix:** Runtime patch:

```js
;[DtChart, DtNoData].forEach((c) => {
  if (c?.props?.theme?.validator) {
    c.props.theme.validator = (val) => val === '' || Object.keys(THEME_MAP).includes(val)
  }
})
```

**Status:** **WORKAROUND** ✓ (warning eliminated)

### Error 9: `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` feature flag warning

**Cause:** Vue esm-bundler expects compile-time flags to be globally defined.

**Fix:** Add `define` block to vite.config.js.

**Status:** **RESOLVED** ✓

---

## 3. Components Included in Test

| Component | Included | Engine | Build | Runtime |
|---|---|---|---|---|
| DtChart (line) | Yes | echarts | OK | **User验收** |
| DtChart (bar) | Yes | echarts | OK | **User验收** |
| DtChart (pie) | Yes | echarts | OK | **User验收** |
| DtChart (gauge) | Yes | echarts | OK | **User验收** |
| DtCustomBarChart | Yes | CSS | OK | **User验收** |
| DtPointBezier | Yes | SVG | OK | **User验收** |
| DtNoData | Yes | — | OK | **User验收** |
| DtBarChartThree | No | three | OK (build) | Not tested |
| DtTopoThree | No | three | OK (build) | Not tested |
| G6 topologies | No | g6 | OK (build) | Not tested |

---

## 4. Verified Checks

| Check | Result | Evidence |
|---|---|---|
| Vite build succeeds | **PASS** | `npx vite build` → 3857 modules, 17.70s |
| Single Vue instance | **PASS** | dedupe + nested removal → no dual-instance crash |
| Single echarts instance | **PASS** | dedupe config |
| Single sweet-ui-base copy | **PASS** | dedupe + nested removed, Vite metadata shows 1 entry |
| DtChart import | **PASS** | `import { DtChart } from '@hw-dtn/dt-ui'` |
| chartTheme import | **PASS** | Keys: light, dark, black, hDesign1.1-dark, hDesign1.1-light |
| uDesign2.2 chartTheme | **FAIL** | No uDesign2.2 entries → map to light/dark |
| THEME_MAP includes uDesign2.2 | **PASS** | uDesign2.2-dark, uDesign2.2-light defined |
| themeInfo export | **FAIL** | Not in index.mjs exports |
| setTheme export | **PASS** | From both dt-ui and sweet-ui-base |
| sweetI18n injection | **PASS** | Resolved with provide fallback |
| click-outside directive | **PASS** | Resolved with manual registration |
| CSS theme vars uDesign2.2-light | **PASS** | `body[theme='uDesign2.2-light']` |
| CSS theme vars uDesign2.2-dark | **PASS** | `body[theme='GTS UDesign（默认风格）-dark']` |
| Vue feature flags | **PASS** | define block in vite.config.js |
| Theme validator patch | **PASS** | Runtime patch eliminates warnings |

---

## 5. User Acceptance Scenarios

### 5.1 Data Update

**[已执行]** Validation project implements:
- `updateLineData()` button → `lineData1.value` modified → computed `lineOptions` → DtChart watches options → `setOption(newVal, true)`

**[User验收]** Click "Update Line Data" button → line chart should re-render with new random data.

### 5.2 Resize

**[已执行]** Validation project implements:
- `resizeCharts()` button → `window.dispatchEvent(new Event('resize'))`

**[User验收]** Resize browser window or click "Trigger Resize" → charts should adapt.

**[警告]** If DtBarChartThree is present, it overwrites `window.onresize`. Use `addEventListener` instead.

### 5.3 Hidden → Show

**[已执行]** Validation project implements:
- Toggle buttons for `showSection3d` (controls DtCustomBarChart visibility)
- Toggle buttons for `showChartSection` (controls gauge DtChart visibility)

**[User验收]** Click "Toggle DtChart visibility" → gauge chart hides → click again → gauge should render correctly when shown.

**[已知限制]** ECharts may report "Can't get DOM width or height" if chart container has 0 dimensions when mounted. Use `nextTick` + `chart.resize()` after visibility change.

### 5.4 Theme Round-Trip (uDesign2.2-light ↔ uDesign2.2-dark)

**[已执行]** Validation project implements:
- `toggleTheme()` button → switches between uDesign2.2-light and uDesign2.2-dark
- DtChart `chartThemeName` computed: uDesign2.2-light → `"light"`, uDesign2.2-dark → `"dark"`
- CSS body attribute switches between `"uDesign2.2-light"` and `"GTS UDesign（默认风格）-dark"`

**[User验收]** Click "Theme" button → CSS vars switch (background, text colors) + echarts re-inits with dark/light theme. Click again → returns to light.

**[未验证]** Whether ECharts color palettes exactly match uDesign2.2 token values.

---

## 6. UMD Status

**[事实]** UMD file exists at `dist/dt-ui.umd.cjs` (~27MB). Not usable standalone:

1. `require("./utils/js-xss-options")` → module **missing** from dist/
2. echarts + three + jQuery bundled inside → massive size
3. CSS not bundled → must load `dist/index.css` + `sweet-ui-base.css` separately
4. Non-standard `_$z` global for lodash

**[建议]** Use ESM path (Vite bundling) for all consumption scenarios. UMD is not practical.

---

## 7. Build & Dev Commands

```bash
# From validation project directory
cd D:\project\gts\ai-for-design\output\dt-ui-runtime-check-current

# Install
npm install

# Post-install fix (REQUIRED)
Remove-Item -Recurse -Force 'node_modules\@hw-dtn\dt-ui\node_modules'

# Build
npx vite build

# Dev
Remove-Item -Recurse -Force 'node_modules\.vite'  # clear cache if needed
npx vite --port 5174 --strictPort --force          # force re-prebundle
# Open: http://localhost:5174/index.html

# Preview built files
npx vite preview --port 4174
```

---

## 8. Fact / Inference / Executed / Unverified Tags

| Tag | Meaning |
|---|---|
| **[已执行]** | Verified by running command or reading source |
| **[推断]** | Logical deduction from verified facts |
| **[建议]** | Suggested action |
| **[User验收]** | Requires browser verification by user |
| **[未验证]** | Not tested (requires browser or additional setup) |
| **[已知限制]** | Design limitation |
| **[警告]** | Known issue requiring attention |
| **[事实]** | Factual observation |

---

## 9. Critical Findings Summary

1. **Dual sweet-ui-base is the #1 blocker** — Without dedupe + nested removal + cache clear, runtime crashes with `unref is not a function`. All three steps are mandatory.
2. **sweetI18n must be provided before mount** — `app.provide('sweetI18n', fn)` as fallback; setTheme overwrites with real function.
3. **click-outside directive must be registered manually** — When only using `app.use(DtUI)` without `app.use(SweetUI)`.
4. **Theme validator is a dt-ui bug** — Runtime patch or accept cosmetic warning.
5. **uDesign2.2 echarts themes don't exist** — Map to `light`/`dark` fallback.
6. **CSS dark-theme selector is non-trivial** — `"GTS UDesign（默认风格）-dark"` mapping required (existing skill handles this).
7. **UMD impractical** — Missing js-xss-options, 27MB, non-standard globals.
8. **3D components need ~8MB external resources** — glb models, Draco WASM, bg images.
9. **DtBarChartThree overwrites window.onresize** — Interferes with other resize listeners.
10. **themeInfo not exported** — Use internal path `es/theme/theme.mjs` if needed.
