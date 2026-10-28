# 06-working-preview.md — 已验证可用的预览接线

> 只读核实现有 gts-sweetui-coder 成功预览实现 | 2026-10-28

---

## 1. 脚本加载顺序（已验证，index.gts.html:101-116）

```
顺序  行号  脚本                           作用                           设置的全局
────  ────  ─────────────────────────────   ────────────────────────────   ──────────────
 1    102   process env shim               NODE_ENV=production             window.process
 2    103   vue.global.prod.js             Vue 3 运行时                    window.Vue
 3    104   xss.js                         XSS 过滤库                     window.filterXSS ← 关键！
 4    105   alias: xss                     别名接线                       window.xss = window.filterXSS
 5    106   lodash.min.js                  工具库                         window._
 6    107   alias: lodash                  别名接线                       window._$1, window._$z
 7    108   jsXssOptions shim              XSS 选项空对象                  window.jsXssOptions = {}
 8    109   g6 stub                        @antv/g6 最小桩                 window.g6
 9    110   dayjs.min.js                   日期库                          window.dayjs
10    111   sweet-ui-base.umd.cjs          SweetUI UMD                    window["sweet-ui-base"]
11    112   dt-ui.umd.cjs                  DtUI UMD                       window["dtn-ui"]
12    113   echarts.min.js                 ECharts                        window.echarts
13    114   vue-echarts.iife.min.js        VueECharts                     window.VueECharts
14    115   less.min.js                    Less 编译器                    window.less
15    116   vue3-sfc-loader.js             SFC 加载器                     window["vue3-sfc-loader"]
    119   preview-data.js                 源码映射                       window.__UX_PROTO_SRC__
```

**加载顺序规则**：Vue → xss → lodash → (aliases) → SweetUI → DtUI → echarts → VueECharts → less → SFC loader — UMD 库必须在其依赖全局已就绪后加载。

---

## 2. 依赖文件完整清单（public/library/）

| 文件               | 全局导出              | UMD 期望名    | 用途方     |
|--------------------|-----------------------|---------------|------------|
| vue.global.prod.js | `window.Vue`          | `W.Vue`       | SweetUI/DtUI |
| xss.js             | `window.filterXSS`    | `W.xss`       | SweetUI/DtUI |
| lodash.min.js      | `window._`            | `W._$1`/`W._$z` | SweetUI/DtUI |
| dayjs.min.js       | `window.dayjs`        | —             | moduleCache |
| sweet-ui-base.umd.cjs | `window["sweet-ui-base"]` | — | 主 UI 库 |
| dt-ui.umd.cjs      | `window["dtn-ui"]`    | —             | 辅 UI 库 |
| echarts.min.js     | `window.echarts`      | —             | 图表 |
| vue-echarts.iife.min.js | `window.VueECharts` | —         | 图表组件 |
| less.min.js        | `window.less`         | —             | 运行时 CSS 编译 |
| vue3-sfc-loader.js | `window["vue3-sfc-loader"]` | —    | .vue 加载 |

---

## 3. 全局变量别名 — 运行时验证结果

### 3.1 window._$1（lodash → SweetUI）

```js
// lodash.min.js 导出: window._
// index.gts.html:107
window._$1 = window._;   // → typeof: "function" ✓
window._$z = window._;   // → typeof: "function" ✓（DtUI 用）
```

**验证方式**：lodash.min.js 尾部 `re._=be`，浏览器加载后 `window._` 为 lodash 函数。别名直接赋值立即生效。

**SweetUI UMD 消费**：`Fo(W["sweet-ui-base"]={}, W.xss, W._$1, W.Vue)` — 形参 `U` 收到 lodash 函数 ✓

### 3.2 window.xss（xss → SweetUI/DtUI）— **05 结论需纠正**

```js
// xss.js 加载后: window.filterXSS = <function>  ✓（Browserify 入口模块显式设置）
//               window.xss = undefined
// index.gts.html:105
window.xss = window.xss || window.filterXSS;  // → typeof: "function" ✓
```

**浏览器环境验证**（模拟 `global.window = global` 后 eval xss.js）：

```
typeof window.filterXSS:  "function"   ← xss.js 入口模块显式设置
typeof window.xss:        "undefined"  ← xss.js 不设置 window.xss
typeof (window.xss = window.xss || window.filterXSS): "function"  ✓
window.xss === window.filterXSS:  true
window.xss.filterXSS:  function     ← SweetUI UMD 通过 Fo.filterXSS 访问，有效
window.xss.FilterXSS:  function     ← FilterXSS 构造函数
```

**filterXSS 功能测试**：

```
window.xss('<script>alert(1)</script>hello')
→ "&lt;script&gt;alert(1)&lt;/script&gt;hello"   ✓
window.xss('<b onmouseover=alert(1)>test</b>')
→ "<b>test</b>"                                 ✓
```

**关键证据**：xss.js 入口模块（Browserify 模块 2）包含显式的浏览器全局导出：

```js
// xss.js 模块 2 内部（第 11528 字节起）
if (typeof window !== "undefined") {
  window.filterXSS = module.exports;
}
```

`module.exports` 此时为 `filterXSS` 函数（同时附加了 `.filterXSS`、`.FilterXSS`、`.whiteList` 等属性），因此 `window.filterXSS` 是完整可用的 XSS 模块对象。

### 3.3 05-runtime-confirmation.md 纠正项

| 05 原结论 | 实际验证结果 | 纠正 |
|---|---|---|
| xss.js Browserify bundle "不设置任何全局变量" | xss.js 入口模块显式设置 `window.filterXSS`（有 `typeof window` 检查） | **错误** — 浏览器环境下 `window.filterXSS` 有效 |
| `window.xss = window.xss \|\| window.filterXSS` 是"接线 bug" | 此行正确工作：`window.filterXSS` 已由 xss.js 设置，`undefined \|\| filterXSS` = filterXSS | **错误** — 不是 bug，接线正确 |
| 05 的 Node.js `require()` 验证显示 CJS 导出为空对象 | Node CJS 环境下 `module.exports` 未被 Browserify 内部模块桥接到 Node 层级；但浏览器下 `window.filterXSS` 有效 | Node 测试结论本身正确但**不适用于浏览器** |
| 建议替换 xss.js 为 UMD standalone 版本或模拟 CJS 环境 | 无需替换 — 当前 xss.js + 别名行在浏览器下完全正常工作 | **两个修复方案均不需要** |
| SweetUI 的 `Fo.filterXSS` 会在 `Fo=undefined` 时崩溃 | `Fo` 实际为 `window.filterXSS` 函数对象，`Fo.filterXSS` 即 `filterXSS.filterXSS` = filterXSS 函数 | **不崩溃** — 正常工作 |

---

## 4. SweetUI 注册与初始化（index.gts.html:121-277）

### 4.1 变量提取

```js
var SweetUI = window["sweet-ui-base"];
var DtUI = window["dtn-ui"];
```

### 4.2 主题切换 — window.setTheme

```js
window.setTheme = function (name, app) {
    var cssName = name === 'uDesign2.2-dark'
        ? 'GTS UDesign（默认风格）-dark'
        : name;
    document.body.setAttribute("theme", cssName);
    if (SweetUI && SweetUI.setTheme && app) {
        SweetUI.setTheme(cssName, app);
        if (app.config && app.config.globalProperties) {
            app.config.globalProperties.$theme = name;
        }
    }
    // 强制 reflow，确保 CSS 变量切换生效
    var appEl = document.getElementById("app");
    if (appEl) {
        appEl.style.display = "none";
        appEl.offsetHeight;
        appEl.style.display = "";
    }
};
```

**主题映射**：`uDesign2.2-dark` → `GTS UDesign（默认风格）-dark`，其他名原样传递。

**body 默认主题**：`<body theme="uDesign2.2-light">`（index.gts.html:97）

**SweetUI 原生 `setTheme`**：不做映射，仅直接设置 `body[theme]` 属性名。

### 4.3 主题 CSS 注入

```js
var THEME_DIR = "/src/assets/themes/";
Object.keys(SRC)
    .filter(function (p) { return p.indexOf(THEME_DIR) === 0 && p.slice(-4) === ".css"; })
    .sort()
    .forEach(function (p) { addStyle(SRC[p]); });
```

源码映射中的 `/src/assets/themes/*.css` 文件在 app 挂载前全部注入为 `<style>` 标签。

### 4.4 Vue App 创建与插件注册

```js
var app = Vue.createApp({
    components: {
        UxRoot: Vue.defineAsyncComponent(function () {
            return window["vue3-sfc-loader"].loadModule("/src/App.vue", options);
        }),
    },
    template: "<UxRoot />",
});

if (SweetUI && SweetUI.default) { app.use(SweetUI.default); }
else if (SweetUI) { app.use(SweetUI); }

if (DtUI && DtUI.default) { app.use(DtUI.default); }
else if (DtUI) { app.use(DtUI); }
```

**注意**：UMD 全局对象可能是 `{ default: Plugin, ... }` 或直接是 Plugin 对象，代码做了两种兼容。

### 4.5 i18n 初始化

```js
if (SweetUI && SweetUI.i18n) { SweetUI.i18n("zh_CN", app); }
if (DtUI && DtUI.i18n) { DtUI.i18n("zh_CN", app); }
```

默认语言：`zh_CN`。无自定义业务词典，无语言切换 UI。

### 4.6 moduleCache 关键映射

```js
moduleCache: Object.assign(Object.create(null), {
    vue: Vue,
    "@hw-seq/sweet-ui-base": SweetUI,
    "@hw-dtn/dt-ui": DtUI,
    dayjs: dayjs,
    echarts: echarts,
    "vue-echarts": VueECharts,
    less: less,
    "@hw-seq/sweet-ui-base/es/locale/lang/zh_CN": { default: {} },
    "@hw-seq/sweet-ui-base/es/locale/lang/en_US": { default: {} },
    "css": { default: function(){} },
    "@antv/g6": window.g6,
    "three": { default: {}, __esModule: true },
})
```

---

## 5. ESM main.js 对照（开发环境入口）

```js
import { createApp } from 'vue'
import App from './App.vue'
import SweetUI from '@hw-seq/sweet-ui-base'
import DtUI from '@hw-dtn/dt-ui'
import { i18n } from '@hw-seq/sweet-ui-base'
import { i18n as dtI18n } from '@hw-dtn/dt-ui'

const app = createApp(App)
app.use(SweetUI)
app.use(DtUI)
i18n('zh_CN', app)
dtI18n('zh_CN', app)
app.mount('#app')
```

ESM 与 UMD 接线对应：

| ESM import              | UMD 来源                    | moduleCache key                |
|-------------------------|-----------------------------|--------------------------------|
| `vue`                   | `window.Vue`                | `"vue"` → `Vue`                |
| `@hw-seq/sweet-ui-base` | `window["sweet-ui-base"]`   | 同左                           |
| `@hw-dtn/dt-ui`         | `window["dtn-ui"]`          | 同左                           |
| `{ i18n }` (named)      | `SweetUI.i18n`              | —                              |
| `{ i18n as dtI18n }`    | `DtUI.i18n`                 | —                              |

---

## 6. CSS 资源加载顺序

```html
<link rel="stylesheet" href="./public/library/sweet-ui-base.css">    <!-- 1. SweetUI 组件样式 -->
<link rel="stylesheet" href="./public/library/sweet-fonts.css">      <!-- 2. SweetUI 字体 -->
<link rel="stylesheet" href="./public/library/dt-ui.css">            <!-- 3. DtUI 组件样式 -->
<link rel="stylesheet" href="./public/library/vue-echarts.style.css"><!-- 4. ECharts 样式 -->
```

运行时注入的主题 CSS 优先级高于 `<link>`（后注入的 `<style>` 在 DOM 中靠后，同优先级下覆盖）。

---

## 7. UMD 全局变量需求对照

### SweetUI UMD (`sweet-ui-base.umd.cjs`)

```js
Fo(W["sweet-ui-base"]={}, W.xss, W._$1, W.Vue)
```

| CJS require | 浏览器全局   | 值来源                | 别名行               | 形参 | 验证 |
|---|---|---|---|---|---|
| `"xss"`     | `W.xss`      | `window.filterXSS` (xss.js 设置) | L105: `window.xss \|\| window.filterXSS` | `Fo` | ✓ function |
| `"lodash"`  | `W._$1`      | `window._` (lodash.min.js 设置) | L107: `window._$1 = window._` | `U` | ✓ function |
| `"vue"`     | `W.Vue`      | `window.Vue` (vue.global.prod.js 设置) | 无需别名 | `i` | ✓ object |

### DtUI UMD (`dt-ui.umd.cjs`)

```js
factory(global2["dtn-ui"]={}, global2._$z, global2.Vue, global2.jsXssOptions, global2.g6, global2.xss)
```

| CJS require      | 浏览器全局         | 值来源            | 别名行/行号       | 形参          | 验证 |
|---|---|---|---|---|---|
| `"lodash"`       | `global2._$z`     | `window._`        | L107: `window._$z = window._` | `_$z` | ✓ function |
| `"vue"`          | `global2.Vue`     | `window.Vue`      | 无需别名 | `vue` | ✓ object |
| `"./utils/js-xss-options"` | `global2.jsXssOptions` | L108手动设置 | L108: `window.jsXssOptions = {}` | `jsXssOptions` | ✓ object |
| `"@antv/g6"`     | `global2.g6`      | L109最小桩        | L109 inline stub | `g6` | ✓ object |
| `"xss"`          | `global2.xss`     | `window.filterXSS` | L105: `window.xss \|\| window.filterXSS` | `xss` | ✓ function |

---

## 8. XSS 在 SweetUI 中的实际使用

### 8.1 sweet-func 工具对象（ESM 源码）

```js
// es/utils/sweet-func/index.mjs
import { filterXSS as u } from "xss"
const f = {
    escape2Html: e => { ... },
    filterXSS: u,          // 直接引用 xss.filterXSS
    getCookie: e => { ... },
    docCookies: { ... },
    // ...更多工具方法
}
export { f as default }
```

### 8.2 UMD 中的等价代码

```js
// sweet-ui-base.umd.cjs 中
filterXSS: Fo.filterXSS    // Fo = window.xss = filterXSS 函数对象
```

当 `window.xss = filterXSSFunction` 时：
- `Fo` = filterXSSFunction
- `Fo.filterXSS` = filterXSSFunction.filterXSS = filterXSS（同源码中 `exports.filterXSS = filterXSS` 设的属性）
- `Fo()` = filterXSSFunction() = filterXSS(html, options)（可当函数直接调用）

### 8.3 Vue 实例上的访问

```js
// SweetUI install 时
app.config.globalProperties.$sweet = r   // r = sweet-func default export
app.provide("$sweet", r)
```

组件中：
- Options API: `this.$sweet.filterXSS(html)`
- Composition API: `inject("$sweet").filterXSS(html)`

---

## 9. i18n 语言切换验证

**当前预览页面无语言切换 UI，无自定义业务词典**。仅初始化 `i18n("zh_CN", app)`。

**未验证项**（标记，不新造页面）：

- [ ] 切换语言后组件内置词条是否响应式更新（理论确认：`i18n()` 重置 reactive 对象后注入新语言内置词典，`computed` 引用自动触发重渲染，**理论应更新**）
- [ ] 切换语言后自定义业务词条是否保留（理论确认：`i18n()` 调用**重置**整个 `sweetI18nLocaleMessages`，自定义词条丢失，需在 `i18n()` callback 或之后重新 `setLocaleMessages`）
- [ ] 业务词条与组件内置词条是否同时更新（理论确认：是，共用同一 reactive 对象，但前提是自定义词条已在 `i18n()` 之后重新注入）

---

## 10. 完整接线可复用模板

以下是从已验证可用的预览中提取的最小正确接线，供 skill 重建参考：

```html
<!-- 1. process shim -->
<script>window.process = window.process || { env: { NODE_ENV: "production" } };</script>

<!-- 2. Vue -->
<script src="./public/library/vue.global.prod.js"></script>

<!-- 3. xss → 设置 window.filterXSS -->
<script src="./public/library/xss.js"></script>
<script>window.xss = window.xss || window.filterXSS;</script>

<!-- 4. lodash → 设置 window._ -->
<script src="./public/library/lodash.min.js"></script>
<script>window._$1 = window._; window._$z = window._;</script>

<!-- 5. DtUI 额外依赖 -->
<script>window.jsXssOptions = {};</script>
<script>/* g6 stub (inline) */</script>

<!-- 6. 其他库 -->
<script src="./public/library/dayjs.min.js"></script>

<!-- 7. UI 库 UMD（依赖全局已就绪） -->
<script src="./public/library/sweet-ui-base.umd.cjs"></script>
<script src="./public/library/dt-ui.umd.cjs"></script>

<!-- 8. 图表/编译/加载器 -->
<script src="./public/library/echarts.min.js"></script>
<script src="./public/library/vue-echarts.iife.min.js"></script>
<script src="./public/library/less.min.js"></script>
<script src="./public/library/vue3-sfc-loader.js"></script>

<!-- 9. 源码映射 -->
<script src="./preview-data.js"></script>

<!-- 10. 初始化 -->
<script>
    var SweetUI = window["sweet-ui-base"];
    var DtUI = window["dtn-ui"];
    window.setTheme = function (name, app) { /* 如上文 4.2 */ };

    // 主题 CSS 注入
    Object.keys(window.__UX_PROTO_SRC__)
        .filter(function (p) { return p.indexOf("/src/assets/themes/") === 0 && p.slice(-4) === ".css"; })
        .sort()
        .forEach(function (p) { /* addStyle */ });

    var app = Vue.createApp({ /* async UxRoot */ });
    app.use(SweetUI.default || SweetUI);
    app.use(DtUI.default || DtUI);
    SweetUI.i18n("zh_CN", app);
    DtUI.i18n("zh_CN", app);
    app.mount("#app");
</script>
```

---

## 11. 05-runtime-confirmation.md 纠正摘要

| # | 05 原结论 | 纠正后 |
|---|---|---|
| 1 | xss.js Browserify bundle "不设置任何全局变量，window.xss 和 window.filterXSS 均为 undefined" | xss.js 入口模块显式包含 `if (typeof window !== "undefined") { window.filterXSS = module.exports; }`。浏览器加载后 `window.filterXSS` 为 function，仅 `window.xss` 为 undefined |
| 2 | `window.xss = window.xss \|\| window.filterXSS` 是"接线 bug" | 不是 bug。`window.filterXSS` 已由 xss.js 有效设置，`undefined \|\| filterXSS` = filterXSS 完整函数对象 |
| 3 | 05 的 Node.js require 验证显示 CJS 导出空对象，故推论浏览器全局也不存在 | Node CJS 下 Browserify 内部模块不桥接到 Node 的 module.exports；但浏览器环境通过 `window.filterXSS = module.exports` 显式导出。**Node 测试不适用于浏览器场景** |
| 4 | 建议两个修复方案（替换 UMD 版本 / 模拟 CJS 环境） | 不需要。当前 xss.js + 别名行在浏览器下完全正常工作 |
| 5 | SweetUI 的 `Fo.filterXSS` 会在 xss 为 undefined 时崩溃 | `Fo` 实际为可用的 filterXSS 函数对象，`Fo.filterXSS` 有效解析为同名函数 |
| 6 | "xss 在 SweetUI 中的实际使用"后果描述：UMD 下 filterXSS 为 undefined | UMD 下 filterXSS 正常可用 |

**05 中正确保持的内容**：
- lodash 全局名验证（window._、_$1 别名）— 全部正确
- i18n API 描述（setLocaleMessages、useLocale、翻译函数行为）— 全部正确
- UMD wrapper 解析 — 全部正确

---

## 附：验证环境

| 项 | 值 |
|---|---|
| 验证方式 | Node.js 模拟 `global.window = global` + eval；静态源码分析 |
| xss.js 浏览器模拟 | `typeof window.filterXSS` = "function"；`window.xss("<script>...")` 过滤结果正确 |
| lodash.min.js | `typeof window._` = "function"；`window._$1 = window._` 立即生效 |
| SweetUI UMD 浏览器模拟 | 完整 eval 失败（缺少 DOM API createTextNode），但 UMD wrapper 解析 + xss/lodash 全局验证通过 |
| 预览 HTML 源码 | 完整读取 280 行，逐行核实 |
| main.js ESM 源码 | 完整读取 16 行，与 UMD 接线对照一致 |