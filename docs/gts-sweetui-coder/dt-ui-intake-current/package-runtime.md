# Package Runtime — @hw-dtn/dt-ui v1.5.0

> Generated: 2026-11-04 | Re-verified against actual installed packages after runtime validation

## 1. Package Identity

| Field | Value |
|---|---|
| name | `@hw-dtn/dt-ui` |
| version | **1.5.0** |
| type | `module` |
| license | HISL |
| main | `lib/index.js` |
| module | `es/index.mjs` |
| style | `dist/index.css` |

## 2. Exports Map

**[已执行]** Read from `node_modules/@hw-dtn/dt-ui/package.json`:

```json
{
  ".":          { "import": "./es/index.mjs", "require": "./lib/index.js" },
  "./es":       { "import": "./es/index.mjs" },
  "./lib":      { "require": "./lib/index.js" },
  "./es/*.mjs": { "import": "./es/*.mjs" },
  "./es/*":     { "import": "./es/*.mjs" },
  "./lib/*.js": { "require": "./lib/*.js" },
  "./lib/*":    { "require": "./lib/*.js" },
  "./*":        "./*"
}
```

## 3. Direct Dependencies

**[已执行]** From `package.json` `dependencies`:

| Package | Declared | Installed at Root | Nested in dt-ui/node_modules |
|---|---|---|---|
| `vue` | 3.5.29 | 3.5.29 | — |
| `@hw-seq/sweet-ui-base` | 5.6.5 | **5.7.0** | **5.6.5** (CRITICAL) |
| `echarts` | 6.1.0 | 6.1.0 | — |
| `three` | 0.185.1 | 0.185.1 | — |
| `@antv/g6` | 5.1.1 | 5.1.1 | — |
| `lodash` | 4.18.1 | 4.18.1 | — |
| `dayjs` | 1.11.23 | 1.11.23 | — |
| `jquery` | 4.0.0 | 4.0.0 | — |
| `sortablejs` | 1.15.7 | 1.15.7 | — |
| `axios` | 1.20.0 | 1.20.0 | — |
| `xss` | 1.0.15 | 1.0.15 | — |

## 4. Critical: Dual sweet-ui-base Conflict

### The Problem

**[已执行 fact]** `dt-ui/node_modules/@hw-seq/sweet-ui-base@5.6.5` co-exists with root `@hw-seq/sweet-ui-base@5.7.0`. Each copy brings its own Vue instance.

### Runtime Symptoms (Observed)

When both copies are active:

1. **`unref(...) is not a function`** — DtNoData calls `inject("sweetI18n")`, gets sweetI18n from one copy, but `unref` resolves to the other copy's Vue, causing `unref(reactiveRef)` to fail
2. **Duplicate component registration** — `"Component 'SweetButtonGroup' has already been registered"` (5+ components)
3. **Duplicate directive registration** — `"Directive 'customLoading' has already been registered"`, `"Directive 'ellipsis' has already been registered"`
4. **`injection 'sweetI18n' not found`** — sweetI18n is provided by one Vue app instance but injected from another
5. **`onMounted is called when there is no active component instance`** — cascading from the unref crash

### Required Fix: dedupe + Nested Removal

**[已执行]** The following combination is REQUIRED for co-existence with root sweet-ui-base 5.7.0:

```js
// vite.config.js
resolve: {
  dedupe: ['vue', 'echarts', 'lodash', 'dayjs', 'xss', '@hw-seq/sweet-ui-base']
}
```

Additionally, the nested `dt-ui/node_modules/@hw-seq/sweet-ui-base/` directory must be **physically removed** from the validation project's `node_modules`. Without removal, even with `dedupe`, Vite's pre-bundling may resolve dt-ui's bare `import "@hw-seq/sweet-ui-base"` to the nested copy first.

**[已执行]** Command that fixed the blank-page crash:
```bash
Remove-Item -Recurse -Force 'node_modules\@hw-dtn\dt-ui\node_modules'
Remove-Item -Recurse -Force 'node_modules\.vite'   # clear cache
npx vite --port 5174 --force                        # force re-prebundle
```

## 5. Plugin Installation Pattern

### makeInstaller Architecture

**[已执行]** dt-ui uses sweet-ui-base's `makeInstaller`:

```js
// es/index.mjs
import { makeInstaller } from "@hw-seq/sweet-ui-base";
var INSTALLED_KEY = Symbol("DTN_UI");
var installer = makeInstaller(INSTALLED_KEY, [...Components]);
installer.i18n = i18n;
installer.setTheme = setTheme;
export { installer as default };
```

### makeInstaller Implementation

**[已执行]** From pre-bundled source:

```js
var makeInstaller = (key, plugins = [], setup) => ({
  install: (app) => {
    if (app[key]) return;  // guard against double install
    app[key] = true;
    plugins.forEach((p) => app.use(p));  // calls install on each component/directive
    setup?.(app);
  }
});
```

### Correct app.use Pattern

**[已执行 fact]** Calling `app.use(SweetUI)` then `app.use(DtUI)` causes **double registration** because:
- `app.use(SweetUI)` installs all sweet-ui-base components/directives (uses `SWEET_BASE_INSTALLED_KEY` guard)
- `app.use(DtUI)` calls `app.use()` on each dt-ui component; components like `DtChart` use `withInstall` from sweet-ui-base which re-registers the same sweet-ui-base components if they're embedded

**[已执行]** Correct pattern — only `app.use(DtUI)`:

```js
import DtUI, { setTheme as dtSetTheme } from '@hw-dtn/dt-ui'
import { setTheme as sweetSetTheme, vClickOutside } from '@hw-seq/sweet-ui-base'

const app = createApp(App)
app.provide('sweetI18n', (key) => key)   // fallback before setTheme runs
app.use(DtUI)
app.directive('click-outside', vClickOutside)  // manually register missing directive
```

### Remaining Warning: "A plugin must either be a function or an object with an 'install' function"

**[推断]** This warning comes from one item in dt-ui's `Components` array not having a valid `install` method. The `makeInstaller` iterates `plugins.forEach(p => app.use(p))`, and if any entry is not a proper plugin object, Vue warns. This is a **dt-ui library bug** — does not cause crashes.

## 6. Missing Directives After app.use(DtUI)

### click-outside Directive

**[已执行 fact]** DtPointBezier and DtTable use `resolveDirective("click-outside")`. sweet-ui-base registers this as `"clickOutside"` (PascalCase). Vue 3 camelize converts `click-outside` → `clickOutside`, so the name matches.

**[已执行 fact]** However, DtUI's `Components` array does NOT include sweet-ui-base's `vClickOutside` directive plugin (`B20` object in pre-bundle). Sweet-ui-base's own installer registers it, but since we don't call `app.use(SweetUI)`, it's never registered.

**[已执行 fix]** Manually register:

```js
import { vClickOutside } from '@hw-seq/sweet-ui-base'
app.directive('click-outside', vClickOutside)
```

## 7. sweetI18n Injection

**[已执行 fact]** Multiple dt-ui components use `inject("sweetI18n")` in their setup function. The `sweetI18n` is a **function** (not an object): `sweetI18n("some.key")` returns the localized string.

**[已执行 fact]** sweet-ui-base's `setTheme()` calls `app.provide("sweetI18n", tFunction)`. But if `setTheme` is called after component mount (or from the wrong Vue instance), the injection fails at render time.

**[已执行 fix]** Provide a fallback before `app.use(DtUI)`:

```js
app.provide('sweetI18n', (key) => key)
```

This is overwritten by sweet-ui-base's `setTheme()` which provides the real i18n function. The fallback prevents the `"injection 'sweetI18n' not found"` warning and DtNoData crash.

## 8. Vue Feature Flags

**[已执行 fact]** Without defining Vue compile-time feature flags, the dev console shows:

```
Feature flag __VUE_PROD_HYDRATION_MISMATCH_DETAILS__ is not explicitly defined.
```

**[已执行 fix]** In `vite.config.js`:

```js
define: {
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  __VUE_OPTIONS_API__: 'true',
  __VUE_PROD_DEVTOOLS__: 'false'
}
```

## 9. Theme Prop Validator Bug

**[已执行 fact]** In `es/components/chart/index.vue.mjs` and `es/components/no-data/index.vue.mjs`:

```js
theme: {
  type: String,
  default: "",
  validator(val) {
    return ["", Object.keys(THEME_MAP)].includes(val);
  }
}
```

This creates a 2-element array: `["", ["light","dark","black",...]]`. `includes(val)` checks if `val === ""` OR `val === the entire keys array`. Individual theme names like `"light"` **never validate**.

**[已执行 fix]** Runtime patch in App.vue:

```js
;[DtChart, DtNoData].forEach((c) => {
  if (c?.props?.theme?.validator) {
    c.props.theme.validator = (val) => val === '' || Object.keys(THEME_MAP).includes(val)
  }
})
```

This is a **dt-ui library bug** (affects all consumers). The patch is non-breaking — the warning is cosmetic, charts render regardless.

## 10. Dist File Layout

**[已执行]**

```
@hw-dtn/dt-ui/dist/
  dt-ui.js           26,800,298 bytes  ~26MB  ESM all-in-one bundle
  dt-ui.umd.cjs      27,234,455 bytes  ~27MB  CJS/UMD all-in-one bundle
  index.css           1,013,339 bytes  ~1MB   Combined CSS (incl. base64 WOFF font)
```

## 11. UMD External Dependencies

**[已执行]** The UMD file (`dt-ui.umd.cjs`) uses `require()` for these externals:

| Require ID | Global Variable | Package | Available in dist/ |
|---|---|---|---|
| `lodash` | `_$z` | lodash 4.18.1 | No (external) |
| `vue` | `Vue` | vue 3.5.29 | No (external) |
| `./utils/js-xss-options` | `jsXssOptions` | **local** | **MISSING** |
| `@antv/g6` | `g6` | @antv/g6 5.1.1 | No (external) |
| `xss` | `xss` | xss 1.0.15 | No (external) |

### Bundled Inside UMD

**[已执行]** Via content search:
- `THREE.WebGLRenderer` → three.js **bundled**
- `echarts.registerTheme` → echarts **bundled**
- jQuery, dayjs, axios, sortablejs → **bundled**

### UMD Critical: js-xss-options Missing

**[已执行 fact]** `dist/utils/` does not exist. The UMD references `require("./utils/js-xss-options")` which will fail for CJS consumers. For browser usage, `window.jsXssOptions` must be set before loading the UMD.

The content is in `es/utils/js-xss-options.mjs` — an xss whitelist object (~200 HTML tag rules).

### UMD is NOT Recommended

The ESM path (via Vite bundling) is the correct approach. The UMD path has:
1. Missing `js-xss-options` module
2. Non-standard `_$z` lodash global
3. 27MB file size (echarts + three + jQuery all bundled)
4. No CSS bundled — must load `dist/index.css` separately

## 12. DtBarChartThree: window.onresize Overwrite

**[已执行]** In `es/components/bar-chart-three/bar-chart-3d.vue.mjs`:

```js
window.onresize = () => { resizeRender(); };
// ... on unmount:
window.onresize = null;
```

This **overwrites** any existing `window.onresize` handler (e.g., from other components or the application). On unmount, it sets `window.onresize = null` which **removes** the handler rather than restoring the previous one.

**[建议]** If using DtBarChartThree alongside other components that listen to resize, use `addEventListener('resize', handler)` instead of relying on `window.onresize`.

## 13. sweet-ui-base CSS Theme Selector Mapping

**[已执行]** The existing skill `theme.js` correctly maps:

```js
const cssName = name === 'uDesign2.2-dark' ? 'GTS UDesign（默认风格）-dark' : name
nativeSetTheme(cssName, application)
```

Source: `skills/gts-sweetui-coder1/scripts/preview/src/theme.js`

## 14. Version Conflict Summary

| Concern | Status | Evidence | Action Required |
|---|---|---|---|
| Dual sweet-ui-base (5.6.5 vs 5.7.0) | **RESOLVED** | dedupe + nested removal | Remove nested copy, add to dedupe |
| sweetI18n injection crash | **RESOLVED** | `app.provide('sweetI18n', fn)` before app.use | Add provide |
| click-outside directive missing | **RESOLVED** | Manual `app.directive('click-outside', vClickOutside)` | Register manually |
| Duplicate component registration | **RESOLVED** | Only `app.use(DtUI)`, not both | Don't call app.use(SweetUI) |
| Theme validator bug | **WORKAROUND** | Runtime patch on DtChart/DtNoData props | Patch or accept warning |
| Vue feature flags | **RESOLVED** | vite `define` config | Add define block |
| "plugin must be function" warning | **KNOWN** | dt-ui Components array entry bug | Library bug, non-breaking |
| UMD js-xss-options missing | **KNOWN** | dist/utils/ absent | Provide manually for UMD |
| chartTheme missing uDesign2.2 | **KNOWN** | Only 5 keys in chartTheme | Map to light/dark fallback |
| window.onresize overwrite | **KNOWN** | DtBarChartThree mounts/unmounts | Use addEventListener instead |
| themeInfo not exported | **KNOWN** | Not in index.mjs exports | Access via internal path if needed |
