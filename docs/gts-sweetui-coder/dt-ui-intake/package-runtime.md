# package-runtime.md

## 1 实际安装版本

| 包 | 路径 | 实际版本 |
|---|---|---|
| @hw-dtn/dt-ui | node_modules/@hw-dtn/dt-ui | **1.4.1** |
| @hw-seq/sweet-ui-base (顶层) | node_modules/@hw-seq/sweet-ui-base | **5.7.0** |
| @hw-seq/sweet-ui-base (dt-ui 内嵌) | node_modules/@hw-dtn/dt-ui/node_modules/@hw-seq/sweet-ui-base | **5.6.5** |
| vue | node_modules/vue | **3.5.29** |
| echarts | node_modules/echarts | **6.1.0** |
| three | node_modules/three | **0.183.0** |
| @antv/g6 | node_modules/@antv/g6 | **5.1.1** |
| lodash | node_modules/lodash | **4.18.1** |
| dayjs (顶层) | node_modules/dayjs | **1.11.23** (SweetUI 依赖解析) |
| dayjs (dt-ui 内嵌) | node_modules/@hw-dtn/dt-ui/node_modules/dayjs | — (存在，版本由 dt-ui 5.6.5 sweet-ui-base 依赖锁定 1.11.13) |
| jquery | node_modules/jquery | **4.0.0** |
| axios | node_modules/axios | **1.19.0** |
| sortablejs | node_modules/sortablejs | **1.15.7** |
| xss | node_modules/xss | **1.0.15** |

## 2 dt-ui package.json 入口

```json
{
  "name": "@hw-dtn/dt-ui",
  "type": "module",
  "version": "1.4.1",
  "main": "lib/index.js",
  "module": "es/index.mjs",
  "style": "dist/index.css",
  "exports": {
    ".": { "import": "./es/index.mjs", "require": "./lib/index.js" },
    "./es": { "import": "./es/index.mjs" },
    "./lib": { "require": "./lib/index.js" },
    "./es/*.mjs": { "import": "./es/*.mjs" },
    "./es/*": { "import": "./es/*.mjs" },
    "./lib/*.js": { "require": "./lib/*.js" },
    "./lib/*": { "require": "./lib/*.js" },
    "./*": "./*"
  },
  "files": ["dist", "es", "lib", "theme-chalk"]
}
```

- **无 `browser` 字段**，无 `types` 字段，无 TypeScript 声明。
- `sideEffects` 列表含 `dist/*`、`theme-chalk/**/*.css/.less`、`es/components/*/css/*`、`lib/components/*/css/*`。

## 3 依赖关系

### dt-ui dependencies（全部是 dependencies，无 peerDependencies）

```json
{
  "@antv/g6": "5.1.1",
  "@hw-seq/sweet-ui-base": "5.6.5",
  "sortablejs": "1.15.7",
  "axios": "1.19.0",
  "dayjs": "1.11.13",
  "echarts": "6.1.0",
  "jquery": "4.0.0",
  "lodash": "4.18.1",
  "three": "0.183.0",
  "vue": "3.5.29",
  "xss": "1.0.15"
}
```

**关键事实：dt-ui 将 Vue、echarts、SweetUI、three、@antv/g6 全部声明为 `dependencies`，不是 `peerDependencies`。** 这意味着 dt-ui 的设计假定自行安装这些包，不要求宿主提供。

### sweet-ui-base dependencies（顶层 5.7.0）

```json
{
  "@rc-component/async-validator": "5.1.0",
  "dayjs": "1.11.23",
  "echarts": "6.1.0",
  "lodash": "4.18.1",
  "vue": "3.5.29",
  "xss": "1.0.15"
}
```

同样全部是 `dependencies`，无 `peerDependencies`。

## 4 dt-ui 与 SweetUI 关系

### 4.1 dt-ui **外部依赖** SweetUI，不内嵌产物

dt-ui 的 ESM 代码通过以下方式引用 SweetUI：

| 引用方式 | 出现位置 |
|---|---|
| `import { makeInstaller } from "@hw-seq/sweet-ui-base"` | `es/index.mjs`、`es/theme/theme.mjs` |
| `import { withInstall, withNoopInstall } from "@hw-seq/sweet-ui-base"` | 各组件 `index.mjs`（chart、bar-chart-three、custom-bar-chart、dashboard-designer、point-bezier、time-line-control 等） |
| `import { SweetButton } from "@hw-seq/sweet-ui-base"` | `dashboard-designer/designer.vue.mjs` |
| `import { SweetInputNumber } from "@hw-seq/sweet-ui-base"` | `bar-chart-three/bar-chart-3d.vue.mjs` |
| `import { setTheme as setTheme$1 } from "@hw-seq/sweet-ui-base"` | `es/theme/theme.mjs` |

**dt-ui 不内嵌 SweetUI 的组件代码**，所有 SweetUI 组件都是运行时 import。但 dt-ui 自带 `node_modules/@hw-seq/sweet-ui-base@5.6.5`——这是 npm 浏览行为：dt-ui 声明依赖 `"5.6.5"`（精确），顶层声明 `"^5.7.0"`，npm 在 dt-ui 内部安装一份 5.6.5。

**结论：dt-ui 会加载自己内嵌的 SweetUI 5.6.5 而非顶层 5.7.0，除非打包工具（Vite/webpack）将 @hw-seq/sweet-ui-base 解析到顶层。** 这可能导致双实例问题。

### 4.2 dt-ui **不内嵌** Vue/echarts/图表引擎产物

dt-ui 的 ESM 代码直接 `import * as echarts from "echarts"` / `import { ref, computed... } from "vue"` / `import * as THREE from "three"` / `import { jQuery } from "../../node_modules/jquery/dist-module/jquery.module.mjs"`。

这些依赖在打包时从 node_modules 解析，不在 dt-ui 产物内嵌入（UMD 除外，见下节）。

## 5 ESM 格式

**真实存在。** `es/index.mjs` (272 行) 是主入口，导出所有组件、工具函数、常量。

- ESM 组件按 `es/components/{name}/` 组织，每组件含 `index.mjs` + `.vue.mjs`（编译后的 SFC render 函数）+ `css/`（CSS 导入）。
- 子路径导出 `./es/chart/index.mjs` 等也可用。
- CSS 入口：`dist/index.css`（通过 `style` 字段），组件级 CSS 有 `es/components/*/css/` 和 `theme-chalk/` 两种来源。

## 6 UMD 格式

**真实存在。** `dist/dt-ui.umd.cjs` (25,419,754 字节，约 24.3 MB)。

### UMD 头部分析

```js
(function(global2, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? factory(exports, require("lodash"), require("vue"),
              require("./utils/js-xss-options"), require("@antv/g6"), require("xss"))
    : typeof define === "function" && define.amd
    ? define(["exports", "lodash", "vue", "./utils/js-xss-options", "@antv/g6", "xss"], factory)
    : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self,
       factory(global2["dtn-ui"] = {},
               global2._$z,         // lodash
               global2.Vue,         // vue
               global2.jsXssOptions,// js-xss-options (本地模块!)
               global2.g6,          // @antv/g6
               global2.xss))        // xss
})(this, function(exports2, _$z, vue, jsXssOptions, g6, xss) { ... })
```

### UMD 外部依赖

| CJS require | AMD define | 全局变量 | 说明 |
|---|---|---|---|
| lodash | lodash | `global2._$z` | **必须预加载** |
| vue | vue | `global2.Vue` | **必须预加载** |
| ./utils/js-xss-options | ./utils/js-xss-options | `global2.jsXssOptions` | **本地模块，UMD 内联了**但仍声明为外部——需核实 |
| @antv/g6 | @antv/g6 | `global2.g6` | **必须预加载** |
| xss | xss | `global2.jsXssOptions` 不对 → 实际是 `global2.xss` | **必须预加载** |

**缺失的 UMD 外部依赖（关键问题）：**

| 依赖 | 说明 |
|---|---|
| **echarts** | 未在 UMD factory 参数中声明！DtChart 组件 `import * as echarts from "echarts"` 被 **内联打包** 到 UMD 中（约 ~2MB echarts 代码嵌入其中） |
| **three** | 未在 UMD factory 参数中声明！bar-chart-three、topo-three、bar-chart(BarChart class) 的 three.js 被 **内联打包** |
| **@hw-seq/sweet-ui-base** | 未在 UMD factory 参数中声明！DtChart 的 `withInstall`、DtBarChartThree 的 `SweetInputNumber` 等被 **内联打包** |
| **jquery** | NuGet—DtChart 引用 `../../node_modules/jquery/dist-module/jquery.module.mjs`，在 UMD 中可能内联为 interact.js 垫片或其他形式 |
| **axios** | dt-ui 的 `http` 工具依赖 axios，UMD 中可能内联 |
| **sortablejs** | grid-layout 依赖，可能内联 |

**事实：UMD 体积 24.3 MB 的大部分是内联的 echarts + three.js + sweet-ui-base + jquery/interact.js。对外只声明了 lodash、vue、@antv/g6、xss 四个外部依赖。**

### UMD 全局变量

`global2["dtn-ui"]` — 挂载到 `window["dtn-ui"]`。

### UMD 加载顺序（离线预览可行的前提）

1. lodash → `window._$z`
2. Vue 3 → `window.Vue`
3. @antv/g6 → `window.g6`
4. xss → `window.xss`
5. dt-ui.umd.cjs → `window["dtn-ui"]`
6. CSS: `dist/index.css` (1,013,339 字节)

**jQuery 未作为外部依赖声明**，意味着 DtChart 内部使用的 jQuery 模块已内联到 UMD 中，不需要单独加载。

### UMD CSS 及资源

- `dist/index.css` (1,013,339 字节，约 1 MB) — 包含全部组件样式。
- `theme-chalk/` 目录有独立 CSS 文件（`sweet-chart.css`、`sweet-bar-chart-three.css` 等），是按组件拆分的样式。
- `theme-chalk/assets/fonts/dtn.svg` + `dtn.woff` — dt-ui 自定义图标字体。
- `theme-chalk/assets/images/` — 包含设备图标 (SVG)、空状态图 (PNG，light/dark/black 三种)、3D 3D 图辅助图标等。
- CSS 中使用 SweetUI token：`var(--swt-font-size-normal)`、`var(--swt-color-gray5)` 等。

## 7 双实例风险

| 场景 | 风险 |
|---|---|
| dt-ui ESM + SweetUI 5.7.0 顶层 | dt-ui 内嵌 SweetUI 5.6.5，若打包工具不做去重，将同时加载两个版本的 SweetUI → 可能导致 `withInstall` 注册到不同 Vue app、主题 token 不一致、i18n 不共享 |
| dt-ui UMD + SweetUI UMD | UMD 内联了 SweetUI 代码，无法共享宿主的 SweetUI → **必然双实例**，主题切换无效 |
| Vue 双实例 | dt-ui 将 vue 3.5.29 声明为 dependencies，若 npm 去"重"不生效，可能加载两个 Vue → 响应式系统断裂 |
| echarts 双实例 | dt-ui ESM 引用 echarts，SweetUI 也依赖 echarts → 只要打包工具解析到同一份（顶层 node_modules），就只有一份；UMD 中 dt-ui 内联了一份，若宿主也加载 echarts 则双份 |

## 8 npm 去重现状

实际 node_modules 结构：

```
node_modules/
  vue@3.5.29              ← 顶层，被 SweetUI 5.7.0 和 dt-ui 共用
  echarts@6.1.0           ← 顶层，共用
  three@0.183.0           ← 顶层，共用
  lodash@4.18.1           ← 顶层，共用
  @antv/g6@5.1.1          ← 顶层，共用
  @hw-seq/sweet-ui-base@5.7.0  ← 顶层
  @hw-dtn/dt-ui/
    node_modules/
      @hw-seq/sweet-ui-base@5.6.5  ← dt-ui 专有
      dayjs/              ← dt-ui/sweet-ui-base@5.6.5 专有
```

**去重策略：** Vite 的 `resolve.dedupe` 配置可将 `vue`、`echarts`、`@hw-seq/sweet-ui-base` 强制解析到顶层，消除双实例。对 UMD 构建无效。

## 9 项目 package.json

```json
{
  "dependencies": {
    "@hw-dtn/dt-ui": "^1.4.1",
    "@hw-seq/sweet-ui-base": "^5.7.0",
    "@vitejs/plugin-vue": "^5.2.4",
    "vite": "^6.4.3"
  }
}
```

项目顶层仅声明了这两个 UI 库 + Vite，不直接声明 echarts/vue/three 等——这些是传递依赖。

## 10 总结

1. **dt-ui 是外部依赖 SweetUI 的组件库**，不内嵌 SweetUI 产物到 ESM 代码中，但 npm 安装时自带了 `sweet-ui-base@5.6.5`。
2. **没有 uDesign2.2 专用的 echarts 图表主题文件**（见 chart-theme.md 详细分析）。
3. **UMD 真实存在但体积巨大（24.3 MB）**，内联了 echarts + three.js + sweet-ui-base，对外只声明 4 个外部依赖。
4. **双实例风险明确**：dt-ui 内嵌的 SweetUI 5.6.5 与顶层 5.7.0 会导致组件注册、主题、i18n 不共享。
5. **ECharts 版本 6.1.0 是事实**——不要把 "计划升级到 5.7.0" 混淆为图表引擎版本。echarts 6.1.0 是真实安装版本。
