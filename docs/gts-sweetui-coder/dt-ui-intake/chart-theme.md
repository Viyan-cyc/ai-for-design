# chart-theme.md

## 1 dt-ui 图表主题现状

### 1.1 chart-theme 常量模块

> 源文件: `es/constants/chart-theme/index.mjs`

```js
const chartTheme = {
  light:              lightEcharts,
  dark:               darkEcharts,
  black:              blackEcharts,
  ["hDesign1.1-dark"]:  hDesignDark,
  ["hDesign1.1-light"]: hDesignLight
};
```

**事实：只有 5 个 echarts 图表主题 key，没有 `uDesign2.2-light` 和 `uDesign2.2-dark`。**

### 1.2 THEME_MAP 中的 uDesign 条目

> 源文件: `es/constants/index.mjs:8-16`

```js
const THEME_MAP = {
  ["hDesign1.1-dark"]:  "hDesign1.1-dark",
  ["hDesign1.1-light"]: "hDesign1.1-light",
  ["uDesign2.2-dark"]:  "uDesign2.2-dark",
  ["uDesign2.2-light"]: "uDesign2.2-light",
  light: "light",
  dark:  "dark",
  black: "black"
};
```

THEME_MAP 有 7 个 key，chartTheme 只有 5 个 key。

| THEME_MAP key | chartTheme key | 状态 |
|---|---|---|
| `light` | `light` | **有对应主题** |
| `dark` | `dark` | **有对应主题** |
| `black` | `black` | **有对应主题** |
| `hDesign1.1-light` | `hDesign1.1-light` | **有对应主题** |
| `hDesign1.1-dark` | `hDesign1.1-dark` | **有对应主题** |
| `uDesign2.2-light` | — | **缺失** |
| `uDesign2.2-dark` | — | **缺失** |

### 1.3 THEME_TYPE 分类

```js
const THEME_TYPE = {
  LIGHT: ["hDesign1.1-light", "uDesign2.2-light", "light"],
  DARK:  ["hDesign1.1-dark", "uDesign2.2-dark", "black"]
};
```

**推断：`uDesign2.2-light` 被归类为 LIGHT（映射到 light），`uDesign2.2-dark` 被归类为 DARK（映射到 black 或 dark）。但 DtChart 的 theme validator 直接放行 THEME_MAP 的 key，不做到 chartTheme 的映射。**

## 2 uDesign2.2-light / uDesign2.2-dark 映射分析

### 2.1 dt-ui setTheme 机制

> 源文件: `es/theme/theme.mjs`

```js
import { setTheme as setTheme$1 } from "@hw-seq/sweet-ui-base";
const themeInfo = reactive({});
const setTheme = (theme = 'light', app = void 0) => {
  themeInfo.theme = theme;
  themeInfo.isLight = THEME_TYPE.LIGHT.includes(theme);
  setTheme$1(theme, app);
};
```

dt-ui 的 `setTheme` 只做两件事：
1. 更新自己的 `themeInfo` reactive（`theme` 和 `isLight`）。
2. **委托给 SweetUI 的 `setTheme`**，后者执行 `document.body.setAttribute('theme', theme)`。

**dt-ui 的 setTheme 不做 chart-theme 映射，不调用 `echarts.registerTheme`。** 图表主题注册只发生在 DtChart 组件内部，且仅当 `showTheme=true` 时。

### 2.2 SweetUI 的 setTheme

> SweetUI 源文件: `es/entry.mjs` (由 task 探查确认)

```js
const setTheme = (theme = 'light', app) => {
  if (app) { app.config.globalProperties.$theme = theme; }
  document.body.setAttribute('theme', theme);
};
```

SweetUI 只设置 `body[theme]` 属性，用于 CSS attribute selector 切换组件样式。**SweetUI 自己也没有 uDesign2.2 专用的图表主题 —— SweetUI 的 chart-theme 也只有 light/dark/black/hDesign1.1 系列。**

### 2.3 深色主题实际选择器映射

当前 SweetUI skill 使用 `uDesign2.2-light` 和 `uDesign2.2-dark` 作为主题名。

在 CSS 层面，SweetUI 的组件样式是通过 `body[theme="uDesign2.2-dark"]` 等 attribute selector 定义的。这意味着 **CSS 组件主题切换**正常工作。

但在 **echarts 图表层面**，`uDesign2.2-dark` 没有对应的 echarts 主题对象。当 DtChart 的 `theme` prop 接收 `"uDesign2.2-dark"` 时：

1. **validator 通过**（THEME_MAP 包含此 key）
2. 但 `chartTheme["uDesign2.2-dark"]` 为 `undefined`
3. `echarts.registerTheme("uDesign2.2-dark", undefined)` → 可能静默失败或报错
4. `echarts.init(dom, "uDesign2.2-dark")` → echarts 找不到注册的主题 → **回退到 echarts 默认主题**（不带任何自定义颜色）

**事实结论：dt-ui 没有 uDesign2.2 专用的 echarts 图表主题，使用 `uDesign2.2-dark`/`uDesign2.2-light` 不会应用任何图表配色。**

## 3 默认配色来源

### 3.1 DtChart 无主题时

当 `showTheme=false`（默认值），DtChart 执行 `echarts.init(chartEl)`（不传主题名），使用 echarts 内置默认主题。echarts 6.1.0 默认配色受 `color` 数组控制，默认为 echarts 标准 10 色调。

### 3.2 DtChart 有主题时

当 `showTheme=true` 且 `theme="dark"`，使用 dt-ui `chartTheme.dark`：

> 源文件: `es/constants/chart-theme/dark.mjs`

```js
{
  title: { textStyle: { color: "#FFFFFF" }, subtextStyle: { color: "#6CA9F6" } },
  categoryAxis: { axisLine: { lineStyle: { color: "#4A6388" } }, axisLabel: { color: "#6CA9F6" } },
  valueAxis: { splitLine: { lineStyle: { color: ["#4A6388"] } }, axisLabel: { color: "#6CA9F6" } },
  tooltip: { backgroundColor: "#142F4D", textStyle: { color: "#FFFFFF" } },
  legend: { textStyle: { color: "#6CA9F6" } },
  dataZoom: { backgroundColor: "rgba(15, 122, 204, 0.1)", handleStyle: { borderColor: "#0F7ACC" } }
}
```

**注意：这些颜色是硬编码的，不使用 SweetUI CSS token。** `#6CA9F6`、`#4A6388`、`#142F4D` 等是 GTS UDesign(GTS) 风格深色配色，与 SweetUI token 定义的 uDesign2.2-dark 不相同。

### 3.3 DtChart light 主题

> 源文件: `es/constants/chart-theme/light.mjs`

```js
{
  title: { textStyle: { color: "#2E2E2E" } },
  categoryAxis: { axisLine: { lineStyle: { color: "#C6C6C6" } }, axisLabel: { color: "#777777" } },
  tooltip: { backgroundColor: "#FFFFFF", textStyle: { color: "#2E2E2E" } }
}
```

同样是硬编码颜色，不使用 SweetUI token。

### 3.4 hDesign1.1-light 主题

> 源文件: `es/constants/chart-theme/hDesign1.1-light.mjs`

```js
{
  title: { textStyle: { color: "#2a2a2a" } },
  legend: { textStyle: { color: "#1e1e1e" }, inactiveColor: "#a6a6a6" },
  tooltip: { backgroundColor: "#FFFFFF", borderColor: "#dfdfdf" },
  dataZoom: { handleStyle: { borderColor: "#0067d1" } }
}
```

这个配色更接近 uDesign2.2 的视觉风格（品牌色 `#0067d1`），但 **键名是 `hDesign1.1-light` 不是 `uDesign2.2-light`**。

### 3.5 hDesign1.1-dark 主题

```js
{
  title: { textStyle: { color: "#dfdfdf" } },
  legend: { textStyle: { color: "#f5f5f5" }, inactiveColor: "#626262" },
  tooltip: { backgroundColor: "#191919", borderColor: "#2a2a2a" },
  dataZoom: { handleStyle: { borderColor: "#0067d1" } }
}
```

同样是深色，配色接近 GTS UDesign。

## 4 是否使用 SweetUI Token

**否。** dt-ui 的 echarts 图表主题全部使用硬编码颜色值，不引用 `var(--swt-*)` CSS 变量。原因：echarts 主题是 JS 对象，在 `echarts.registerTheme()` 时传入，此时 DOM 尚未渲染或 CSS 变量不一定可读。

dt-ui 的 CSS 组件样式（`theme-chalk/` 下的 `.less`/`.css`）使用了 SweetUI token（如 `var(--swt-font-size-normal)`、`var(--swt-color-gray5)`），但 **图表配色不受 CSS token 控制**。

## 5 3D 图表主题

### 5.1 BarChart class (bar-chart/themes.mjs)

| 主题 | sceneBackground | planeColor | gridLineColor | axis 颜色 | bar 配色 |
|---|---|---|---|---|---|
| light | `#FFFFFF` | `#FFFFFF` | `#A6A6A6` | axes `#C9C9C9`, name `#191919`, label `#777777` | **固定** 绿/红 |
| dark | `#1A1A1A` | `#000000` | `#868686` | axes `#555555`, name `#E0E0E0`, label `#AAAAAA` | **固定** 绿/红 |

**柱体配色（normal: 绿 `#074020→#032612`，alarm: 红 `#670e0e→#500707`）不随主题变化。**

### 5.2 DtBarChartThree (bar-chart-three/utils/constants.mjs getBarOptions)

3D 柱状图的主题通过 `getBarOptions(theme)` 返回不同数值背景色，但柱体颜色 `barColorObj.normal/warning` 在 dark 和 light 间基本相同。**仅有场景背景色、网格色、轴色随主题切换。**

## 6 图表主题注册与切换流程

```
用户调用 dt-ui setTheme("uDesign2.2-dark", app)
  → themeInfo.theme = "uDesign2.2-dark"
  → themeInfo.isLight = false
  → sweetSetTheme("uDesign2.2-dark", app)
    → document.body.setAttribute("theme", "uDesign2.2-dark")
    → CSS 组件样式切换 ✓
  
DtChart 组件 (showTheme=true, theme="uDesign2.2-dark"):
  → setDefaultTheme() 注册 5 个主题: light, dark, black, hDesign1.1-dark, hDesign1.1-light
  → echarts.init(dom, "uDesign2.2-dark") ← key 不存在于注册列表
  → 主题回退到 echarts default ✗
```

## 7 可用扩展接口

### 7.1 手动注册 uDesign2.2 图表主题

dt-ui 导出了 `chartTheme` 对象和 `echarts`（通过 `$echartsUtils`），可以手动注册：

```js
import { chartTheme } from '@hw-dtn/dt-ui';
import * as echarts from 'echarts';

// 将 hDesign1.1-light 注册为 uDesign2.2-light 的别名
echarts.registerTheme('uDesign2.2-light', chartTheme['hDesign1.1-light']);
echarts.registerTheme('uDesign2.2-dark', chartTheme['hDesign1.1-dark']);
```

**推断：hDesign1.1-light/dark 可作为 uDesign2.2-light/dark 的近似配色。** 但颜色差异存在（esp. 品牌色 `#0067d1` vs uDesign2.2 的品牌色可能不同），未验证视觉一致性。

### 7.2 DtChart 组件的 showTheme 控制权

通过 `showTheme` prop 控制是否自动注册图表主题。设 `showTheme=false` 后可完全自主管理 echarts 主题。

### 7.3 3D 图表的主题扩展

BarChart class 有 `setTheme("light"|"dark")` 方法，只能切换 light/dark 两个预设。要扩展更多 3D 主题需修改 `bar-chart/themes.mjs` 并重新构建 dt-ui。

---

## 8 缺失与建议

| 项目 | 状态 | 建议 |
|---|---|---|
| uDesign2.2-light echarts 主题 | **缺失** | 可注册 hDesign1.1-light 作为近似，或从 SweetUI token 生成新主题 |
| uDesign2.2-dark echarts 主题 | **缺失** | 同上，可用 hDesign1.1-dark |
| echarts 主题与 SweetUI token 关联 | **无** | 需在运行时从 CSS 变量读取颜色后构建 echarts 主题对象 |
| 3D BarChart uDesign 主题 | **缺失** | 只有 light/dark 两种，且柱体颜色硬编码 |
| 图表主题自动跟随 setTheme | **不跟随** | DtChart 的 theme prop 需主动传入，不与 dt-ui setTheme 联动 |

**不把组件 CSS 主题当成图表主题。组件 CSS（`body[theme="uDesign2.2-dark"]` 选择器）控制 DtChart 容器边框、空状态文字等；echarts 画布内的配色由 JS 主题对象独立控制。不自行编造颜色映射。**
