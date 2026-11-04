# Chart Theme — @hw-dtn/dt-ui v1.5.0

> Generated: 2026-11-04 | Runtime-verified

## 1. ECharts Chart Theme Object

**[已执行]** Source: `es/constants/chart-theme/index.mjs`

```js
const chartTheme = {
  light: lightEcharts,
  dark: darkEcharts,
  black: blackEcharts,
  "hDesign1.1-dark": hDesignDark,
  "hDesign1.1-light": hDesignLight
};
```

### Available ECharts Themes

| Theme Key | Source File | Nature |
|---|---|---|
| `light` | `light.mjs` | Light (gray palette, white bg) |
| `dark` | `dark.mjs` | Dark (blue-tinted, #142F4D bg) |
| `black` | `black.mjs` | Black |
| `hDesign1.1-dark` | `hDesign1.1-dark.mjs` | hDesign dark (#191919 bg) |
| `hDesign1.1-light` | `hDesign1.1-light.mjs` | hDesign light (white bg) |

### MISSING: uDesign2.2 ECharts Themes

**[已执行 fact]** `THEME_MAP` defines `uDesign2.2-light` and `uDesign2.2-dark`, but **`chartTheme` has NO entries for these keys**.

```js
THEME_MAP = {
  "hDesign1.1-dark": "hDesign1.1-dark",
  "hDesign1.1-light": "hDesign1.1-light",
  "uDesign2.2-dark": "uDesign2.2-dark",   // ← no chartTheme entry
  "uDesign2.2-light": "uDesign2.2-light",  // ← no chartTheme entry
  light: "light",
  dark: "dark",
  black: "black"
};
```

**[已执行 fact]** In validation project, `chartThemeName` computed maps uDesign2.2 → light/dark:

```js
const chartThemeName = computed(() => {
  if (['uDesign2.2-light', 'hDesign1.1-light', 'light'].includes(currentTheme.value)) {
    return 'light'
  }
  return 'dark'
})
```

**[推断]** When `theme="uDesign2.2-light"` is passed to DtChart, `echarts.registerTheme("uDesign2.2-light", chartTheme["uDesign2.2-light"])` would register `undefined`. The actual DtChart component's `setDefaultTheme()` only registers keys found in `chartTheme`, so `uDesign2.2-*` keys are never registered. Passing `"light"` or `"dark"` as the `theme` prop is the correct workaround.

## 2. DtChart Theme Mechanism

**[已执行]** Verified flow:

1. `showTheme=true` → `setDefaultTheme()` registers all 5 chartTheme keys
2. `theme` prop change → watch → dispose + `echarts.init(el, themeValue, { devicePixelRatio: devicePixelRatio * 1.5 })`
3. Theme switch **recreates echarts instance** (dispose + init + setOption)
4. CSS vars switch independently via `body[theme=...]`

### Theme Switch Sequence (uDesign2.2-light ↔ uDesign2.2-dark)

```
1. User clicks toggle
2. applyTheme("uDesign2.2-dark", app)
   ├── dtSetTheme("uDesign2.2-dark", app)  → themeInfo.theme = "uDesign2.2-dark"
   ├── sweetSetTheme("GTS UDesign（默认风格）-dark", app)  → body[theme='GTS UDesign（默认风格）-dark']
   └── body bg → var(--swt-color-bg-primary)
3. chartThemeName computed → "dark"
4. DtChart watches theme prop "dark" → dispose + echarts.init(el, "dark") → setOption(data)
5. CSS vars (body[theme]) → dark palette applied to all SweetUI components
6. ECharts uses "dark" theme (blue-tinted, #142F4D bg)
```

**[未验证]** Whether ECharts "dark" theme palette exactly matches uDesign2.2-dark CSS token colors. Likely close but not pixel-identical — the ECharts "dark" theme was designed generically.

## 3. 3D BarChart Themes

**[已执行]** Source: `es/components/bar-chart/themes.mjs`

Only `"light"` | `"dark"` supported:

```js
themes = {
  light: {
    sceneBackground: "#FFFFFF",
    planeColor: "#FFFFFF",
    gridLineColor: "#A6A6A6",
    axis: { axesColor: "#C9C9C9", ... },
    boxViewHelper: { backgroundColor: "#FFFFFF", fontColor: "#000" }
  },
  dark: {
    sceneBackground: "#1A1A1A",
    planeColor: "#000000",
    gridLineColor: "#868686",
    axis: { axesColor: "#555555", ... },
    boxViewHelper: { backgroundColor: "#1E1E1E", fontColor: "#fff" }
  }
};
```

- `BarChart.setTheme(theme)` → in-place update (no reinit needed)
- `DtBarChartThree` → `theme` prop change → full reinit
- No uDesign2.2 / hDesign / black variants for 3D

## 4. CSS Theme (sweet-ui-base)

### setTheme Implementation

**[已执行]** sweet-ui-base `setTheme` (from pre-bundle analysis):

```js
// 1. Sets globalProperties
app.config.globalProperties.sweetLang = lang;
app.config.globalProperties.sweetI18nLocaleMessages = reactive({});
const { t } = readonly(wrappedLocale(app));
app.config.globalProperties.sweetI18n = t;

// 2. Provides to Vue inject system
app.provide("sweetLang", readonly(lang));
app.provide("sweetI18n", t);

// 3. Sets CSS selector
document.body.setAttribute("theme", cssName);
```

### dt-ui setTheme Wrapper

**[已执行]** Source: `es/theme/theme.mjs`

```js
const themeInfo = reactive({});
const setTheme = (theme = "light", app = void 0) => {
  themeInfo.theme = theme;
  themeInfo.isLight = THEME_TYPE.LIGHT.includes(theme);
  setTheme$1(theme, app);  // delegates to sweet-ui-base
};
```

**Note:** `themeInfo` is **NOT re-exported** from package index. Cannot be imported by consumers.

### CSS Selector Mapping

**[已执行]**

| Logical Name | CSS Selector | Var File |
|---|---|---|
| uDesign2.2-light | `body[theme='uDesign2.2-light']` | `var-ui-uDesign2.2-light.css` |
| uDesign2.2-dark | `body[theme='GTS UDesign（默认风格）-dark']` | `var-ui-uDesign2.2-dark.css` |
| hDesign1.1-light | `body[theme='hDesign1.1-light']` | `var-ui-hDesign1.1-light.css` |
| hDesign1.1-dark | `body[theme='hDesign1.1-dark']` | `var-ui-hDesign1.1-dark.css` |
| light | `:root` (default) | `var-ui-light.css` |
| dark | (in base.css) | `var-ui-dark.css` |
| black | (in base.css) | `var-ui-black.css` |

### Correct Dual-Call for uDesign2.2

**[已执行]** Existing skill pattern (from `skills/gts-sweetui-coder1/scripts/preview/src/theme.js`):

```js
const cssName = name === 'uDesign2.2-dark' ? 'GTS UDesign（默认风格）-dark' : name
nativeSetTheme(cssName, application)
```

**[警告]** dt-ui's `setTheme("uDesign2.2-dark", app)` passes `"uDesign2.2-dark"` to sweetSetTheme, which sets `body[theme='uDesign2.2-dark']`. But the CSS variables for dark mode are on `body[theme='GTS UDesign（默认风格）-dark']`, so the dark CSS **will not activate** unless you apply the mapping before calling sweetSetTheme. The dual-call pattern (dtSetTheme + sweetSetTheme with mapping) is **required**.

### i18n Side Effect of setTheme

**[已执行 fact]** sweet-ui-base's `setTheme()` also:
1. Sets `app.config.globalProperties.sweetI18n` (the translation function)
2. Calls `app.provide("sweetI18n", t)` for `inject()` consumers

This means `setTheme` must be called **before** any component tries to `inject("sweetI18n")`, or a fallback `app.provide('sweetI18n', fn)` must be set up in advance.

## 5. Options-Level Color Override

```js
// DtChart - override theme colors in options
const options = {
  color: ['#c7000b', '#0067d1'],
  series: [{ type: 'bar', itemStyle: { color: '#c7000b' } }]
}

// BarChart 3D - custom config
const config = { theme: 'light', bar: { /* custom */ } }
```

## 6. Theme Capabilities Summary

| Component | Theme Support | Switch Method | Rebuild | uDesign2.2 |
|---|---|---|---|---|
| DtChart | 5 echarts themes | dispose + reinit | Yes | Map to light/dark |
| BarChart (3D class) | light/dark only | `setTheme()` in-place | No | Map to dark |
| DtBarChartThree | light/dark (prop) | prop → full reinit | Yes | Map to dark |
| DtTopoThree | No theme prop | N/A | N/A | N/A |
| G6 topologies | No theme prop | N/A | N/A | N/A |
| DtPointBezier | stroke/fill props | props | No | N/A |
| DtCustomBarChart | CSS vars via container | body[theme=...] | No | Via CSS vars |
| SweetUI CSS | 7+ CSS var sets | body[theme=...] | No | Fully supported |

## 7. Extension Interface for Custom ECharts Themes

**[已执行]** To add a uDesign2.2 echarts theme, register before DtChart mount:

```js
import * as echarts from 'echarts'

const uDesignDark = {
  color: ['#c7000b', '#0067d1', '#52c41a', ...],
  backgroundColor: '#142F4D',
  // ... full echarts theme spec
}
echarts.registerTheme('uDesign2.2-dark', uDesignDark)
```

Then pass `theme="uDesign2.2-dark"` to DtChart (after patching the validator, or accepting the warning).

**[未验证]** The exact uDesign2.2 brand color palette for echarts. The `light.mjs` and `dark.mjs` theme files in dt-ui could serve as a template for creating uDesign2.2-specific echarts themes.
