# 01-runtime.md — SweetUI 运行时接入资料

> 静态核实 @hw-seq/sweet-ui-base 5.7.0 | 2026-10-27

---

## 1. 版本与依赖

| 项 | 值 | 来源 |
|---|---|---|
| npm 包 | `@hw-seq/sweet-ui-base@5.7.0` | package.json |
| 描述 | Sweet UI 5.4 | package.json |
| 许可 | HISL | package.json |
| Vue | `vue@3.5.29`（**直接依赖**，非 peerDependency） | package.json:82 |
| dayjs | `1.11.23` | package.json:78 |
| echarts | `6.1.0` | package.json:79 |
| lodash | `4.18.1` | package.json:80 |
| xss | `1.0.15` | package.json:83 |
| @rc-component/async-validator | `5.1.0` | package.json:77 |
| **无 peerDependencies 字段** | — | package.json 无该 key |

**注意**：Vue 是直接依赖而非 peer，与宿主工程 Vue 版本冲突时需注意。

---

## 2. npm 导出

| 入口 | 格式 | 路径 |
|---|---|---|
| `import` | ESM | `es/index.mjs` |
| `require` | CJS | `lib/index.js` |
| 子路径 `./es/*` | ESM | `es/*.mjs` |
| 子路径 `./lib/*` | CJS | `lib/*.js` |
| CSS | — | `dist/sweet-ui-base.css`（package.json `"style"` 字段） |

**ESM 主入口 `es/index.mjs` 导出**：
- 默认导出 = `makeInstaller` 产物（含 `install` 方法，全量注册 137 组件）
- 具名导出：`setTheme`、`i18n`、`chartTheme`、所有 137 个 PascalCase 组件名 + 工具函数

```js
// ESM 使用
import SweetUI, { setTheme, i18n, SweetButton, SweetTable } from '@hw-seq/sweet-ui-base'
import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css' // 或 theme-chalk
```

---

## 3. UMD 导出

| 项 | 值 |
|---|---|
| 文件 | `dist/sweet-ui-base.umd.cjs` |
| 全局变量 | `window["sweet-ui-base"]` |
| 外部映射 | `W.xss` → `xss`、`W._$1` → `lodash`、`W.Vue` → `vue` |

UMD 导出成员与 ESM 一致：`install`、`setTheme`、`i18n`、所有组件构造函数等。

```html
<script src="vue.global.prod.js"></script>
<script src="lodash.min.js"></script>     <!-- 全局名 _$1 -->
<script src="xss.js"></script>            <!-- 全局名 xss -->
<script src="sweet-ui-base.umd.cjs"></script>
<script>
  const SweetUI = window['sweet-ui-base'];
  const app = Vue.createApp({...});
  app.use(SweetUI);  // 全量注册
</script>
```

---

## 4. CSS / 字体资源

### 4.1 dist CSS

`dist/sweet-ui-base.css` — 单文件全量 CSS，含：
- **字体内联**：`@font-face { font-family: sweetui; src: url(data:font/woff;base64,...) }`
- 全部 137 组件样式
- 9 套主题 CSS 变量声明（含 `:root` + 8 个 `body[theme=...]` 选择器）

### 4.2 theme-chalk 目录（按需/独立主题）

| 路径 | 用途 |
|---|---|
| `theme-chalk/index.css` | 全组件 CSS 汇总 |
| `theme-chalk/base.css` | 基础重置 |
| `theme-chalk/common.css` | 公共样式 |
| `theme-chalk/sweet-*.css` | 单组件 CSS（按需引入） |
| `theme-chalk/sweet/` | 同上，带命名空间目录 |
| `theme-chalk/vars/*.css` | 主题 CSS 变量文件（9 个） |
| `theme-chalk/fonts/sweet.css` | 图标字体 CSS（718 个 class） |
| `theme-chalk/assets/fonts/sweetui.woff` | 图标字体二进制（~254KB） |

### 4.3 CSS 主题选择器清单

| CSS 选择器 | 对应文件 |
|---|---|
| `:root` | `var-ui-common.css` |
| `body[theme=light]` | `var-ui-light.css` |
| `body[theme=dark]` | `var-ui-dark.css` |
| `body[theme=black]` | `var-ui-black.css` |
| `body[theme="uDesign2.2-light"]` | `var-ui-uDesign2.2-light.css` |
| `body[theme="uDesign2.2-dark"]` | `var-ui-uDesign2.2-dark.css` |
| `body[theme="GTS UDesign（默认风格）-dark"]` | `var-ui-uDesign2.2-dark.css` |
| `body[theme="hDesign1.1-light"]` | `var-ui-hDesign1.1-light.css` |
| `body[theme="hDesign1.1-dark"]` | `var-ui-hDesign1.1-dark.css` |
| `body[theme="hDesign3.1"]` | `var-ui-hDesign3.1.css` |

**重点**：`var-ui-uDesign2.2-dark.css` 文件中的选择器名是 `body[theme='GTS UDesign（默认风格）-dark']`，而不是 `body[theme="uDesign2.2-dark"]`。后者在 `dist/sweet-ui-base.css` 中仅含 `background-color` 一条规则。

---

## 5. 三个候选主题 API 参数

### 5.1 uDesign2.2-light

| 项 | 值 |
|---|---|
| API 名称 | `uDesign2.2-light` |
| CSS 选择器 | `body[theme='uDesign2.2-light']` |
| API 名 = CSS 名 | **是**（名称一致，无需映射） |
| CSS 变量文件 | `theme-chalk/vars/var-ui-uDesign2.2-light.css` |
| token 数量 | 380 个 unique 变量名 |

### 5.2 uDesign2.2-dark

| 项 | 值 |
|---|---|
| API 名称 | `uDesign2.2-dark` |
| CSS 选择器 | `body[theme='GTS UDesign（默认风格）-dark']` |
| API 名 ≠ CSS 名 | **是**（需要映射） |
| CSS 变量文件 | `theme-chalk/vars/var-ui-uDesign2.2-dark.css` |
| token 数量 | 380 个 unique 变量名 |

**映射证据**：`es/entry.mjs` 中原生 `setTheme` 的实现：
```js
const setTheme = (theme = "light", app) => {
  app && (app.config.globalProperties.$theme = theme);
  document.body.setAttribute("theme", theme);
};
```
原生 `setTheme` 直接将参数设为 `body[theme]` 属性值，**不做任何名称映射**。传入 `'uDesign2.2-dark'` 会设置 `body[theme="uDesign2.2-dark"]`，但这不是深色 token 的选择器。

### 5.3 公共依赖 :root

| 项 | 值 |
|---|---|
| CSS 选择器 | `:root` |
| CSS 变量文件 | `theme-chalk/vars/var-ui-common.css` |
| token 数量 | 302 个 unique 变量名（其中 120 个为 `ancilary` 拼写错误的辅助色板，从未被组件 `var()` 引用） |

---

## 6. window.setTheme — 库原生 vs 现有 skill 自建

### 6.1 库原生 `setTheme`

**源码**：`es/entry.mjs` 第 5-8 行

```js
const setTheme = (theme = "light", app) => {
  app && (app.config.globalProperties.$theme = theme);
  document.body.setAttribute("theme", theme);
};
```

- **无映射**：直接将 `theme` 参数写入 `body[theme]` 属性
- 默认值 `"light"`
- 可选 `app` 参数，设置 `$theme` 全局属性
- ESM 导入：`import { setTheme } from '@hw-seq/sweet-ui-base'`
- UMD：`window['sweet-ui-base'].setTheme`

### 6.2 现有 skill 预览 HTML 中的 `window.setTheme`

**源码**：`skills/gts-sweetui-coder/scripts/preview/index.gts.html` 第 125-140 行

```js
window.setTheme = function (name, app) {
    var cssName = name === 'uDesign2.2-dark' ? 'GTS UDesign（默认风格）-dark' : name;
    document.body.setAttribute("theme", cssName);
    if (SweetUI && SweetUI.setTheme && app) {
        SweetUI.setTheme(cssName, app);
        if (app.config && app.config.globalProperties) {
            app.config.globalProperties.$theme = name;
        }
    }
    var appEl = document.getElementById("app");
    if (appEl) {
        appEl.style.display = "none";
        appEl.offsetHeight;
        appEl.style.display = "";
    }
};
```

**与库原生的差异**：

1. **API→CSS 名称映射**（第 126 行）：`'uDesign2.2-dark'` → `'GTS UDesign（默认风格）-dark'`，其他名称直传
2. **委托库原生**（第 128-133 行）：映射后的 `cssName` 传给 `SweetUI.setTheme(cssName, app)`，而非 `name`
3. **`$theme` 保留 API 名**（第 131 行）：`app.config.globalProperties.$theme = name`（而非 `cssName`），使组件内读取的 `$theme` 始终是用户友好的 API 名
4. **强制 reflow**（第 134-139 行）：临时 `display:none` → `offsetHeight` → `display:""` 强制 DOM 重绘，确保 CSS 变量切换后视觉立即生效

**结论**：`window.setTheme` 是现有 skill 在预览 HTML 中自建的包装函数，解决库原生缺少映射的缺陷。**源码脱离预览 HTML 后仍可切换主题，但须自行处理映射**。

---

## 7. 真实 Vue 工程如何切换主题

### 7.1 方案 A：自建映射函数

```js
import { setTheme as libSetTheme } from '@hw-seq/sweet-ui-base'

const THEME_MAP = { 'uDesign2.2-dark': 'GTS UDesign（默认风格）-dark' }

function applyTheme(apiName, app) {
  const cssName = THEME_MAP[apiName] || apiName
  libSetTheme(cssName, app)
  if (app?.config?.globalProperties) {
    app.config.globalProperties.$theme = apiName
  }
}
```

### 7.2 方案 B：直接设置 attribute

```js
function applyTheme(apiName) {
  const cssName = apiName === 'uDesign2.2-dark'
    ? 'GTS UDesign（默认风格）-dark'
    : apiName
  document.body.setAttribute('theme', cssName)
}
```

两种方案均需引入 `var-ui-common.css` + 目标主题 CSS 文件。

### 7.3 预览 HTML 接线

```html
<link rel="stylesheet" href="public/library/sweet-ui-base.css">
<link rel="stylesheet" href="src/assets/themes/var-ui-common.css">
<link rel="stylesheet" href="src/assets/themes/var-ui-uDesign2.2-light.css">
<link rel="stylesheet" href="src/assets/themes/var-ui-uDesign2.2-dark.css">
<script src="public/library/sweet-ui-base.umd.cjs"></script>
<script>
window.setTheme = function(name, app) { /* 映射 + setAttribute + reflow */ };
</script>
```

---

## 8. i18n

### 8.1 API

**源码**：`es/locale/index.mjs`

```js
const i18n = (lang = "zh_CN", app, callback) => {
  w(lang, app, () => {           // setSweetI18n
    const { sweetLang } = app.config.globalProperties;
    z(localeMessages[sweetLang], app);  // setLocaleMessages
    callback == null || callback();
  });
};
```

- ESM：`import { i18n } from '@hw-seq/sweet-ui-base'` → `i18n(lang, app, callback?)`
- UMD：`window['sweet-ui-base'].i18n(lang, app, callback?)`
- `app` 参数必填（设置 `globalProperties.sweetLang` 和注册词典）
- `callback` 可选，词典加载后执行
- 不需要 vue-i18n

### 8.2 支持语言（11 种）

| 代码 | 语言 |
|---|---|
| `zh_CN` | 简体中文 |
| `en_US` | 英语 |
| `zh_TW` | 繁体中文 |
| `de_DE` | 德语 |
| `ar_SA` | 阿拉伯语 |
| `fa_IR` | 波斯语 |
| `es_ES` | 西班牙语 |
| `fr_FR` | 法语 |
| `pt_PT` | 葡萄牙语 |
| `th_TH` | 泰语 |
| `tr_TR` | 土耳其语 |

### 8.3 默认中文初始化

用户不提国际化时，页面直接写中文，不需要调用 `i18n()`。组件内置中文为默认语言。
用户要求国际化时：

```js
import { i18n } from '@hw-seq/sweet-ui-base'
i18n('zh_CN', app)  // 或 i18n('en_US', app)
```

### 8.4 自定义页面词典

用户要求多语言时，页面词典放 `src/i18n/` 下，key 命名 `msg.{页面}.{分类}.{语义}`（至少 3 个点）。仅收界面文案和封闭枚举显示名，记录内容（标题/描述等）不进词典。

```js
// src/i18n/zh_CN.js
export default { 'msg.device.list.title': '设备列表', 'msg.device.status.running': '运行中' }

// src/i18n/en_US.js
export default { 'msg.device.list.title': 'Device List', 'msg.device.status.running': 'Running' }
```

接入方式：页面自行 `import` 词典对象，根据当前 `sweetLang` 选择对应词典，通过 `$t` 或响应式变量渲染。

---

## 9. 图表主题

### 9.1 chartTheme 对象

**源码**：`es/chart-theme/index.mjs`

```js
const chartTheme = {
  light: r,
  dark: t,
  black: i,
  'hDesign1.1-dark': o,
  'hDesign1.1-light': a,
};
```

**5 个已注册 echarts 主题**：`light`、`dark`、`black`、`hDesign1.1-dark`、`hDesign1.1-light`。

**无 `uDesign2.2-*` 图表主题**。`SweetEcharts` 组件内部在加载时额外注册了 `light` 和 `dark` 两个 echarts 主题。

---

## 10. build.mjs 关键片段

### 10.1 Token 前缀免检（第 422-437 行）

```js
for (const m of text.matchAll(/var\(\s*(--[a-z][a-z0-9-]*)\s*\)/g)) {
    const tok = m[1];
    if (tok.startsWith('--swt-')) continue;
    if (tok.startsWith('--sweet-')) continue;
    if (!definedTokens.has(tok)) {
        const hints = tokenHints(tok, definedTokens);
        fail(`unknown token var(${tok}) : did you mean --swt-*?${hints.length ? ` candidates: ${hints.join(', ')}` : ''}`);
    }
}
for (const m of text.matchAll(/var\(\s*(--[a-z][a-z0-9-]*)\s*,/g)) {
    const tok = m[1];
    if (tok.startsWith('--swt-')) continue;
    if (tok.startsWith('--sweet-')) continue;
    if (!definedTokens.has(tok)) warn(`token var(${tok}) used with fallback but never defined`);
}
```

**逻辑**：`--swt-*` 和 `--sweet-*` 前缀的 CSS 变量引用一律放行，不校验是否在已定义集合中。

### 10.2 动态图标检查（第 290-319 行）

**静态 `icon-class`**（第 290-299 行）：
```js
for (const m of tplContent.matchAll(/(?<!:)(?:icon-class|iconClass)\s*=\s*"([^"]+)"/g)) {
    const val = m[1].trim();
    const parts = val.split(/\s+/).filter(Boolean);
    for (const p of parts) {
        if (!SWT_ICON_CSS_CLASSES.has(p)) {
            const hint = SWT_ICONS.has(p) ? ` (PascalCase — use "sweetui-icon-${kebabize(p)}" instead)` : '';
            fail(`${rel}: unknown iconClass "${p}"${hint}`);
        }
    }
}
```

**动态 `:icon-class`**（第 300-319 行）：
```js
for (const m of tplContent.matchAll(/:(?:icon-class|iconClass)\s*=\s*"/g)) {
    // 提取表达式内单引号字符串，逐一校验
    const staticParts = [...expr.matchAll(/'([^']+)'/g)].map(x => x[1]);
    for (const p of staticParts) { /* 同上校验 */ }
    if (staticParts.length === 0 && !/^\s*$/.test(expr)) {
        warn(`${rel}: dynamic iconClass expression — cannot statically validate`);
    }
}
```

### 10.3 预览 window.setTheme 实现（index.gts.html 第 125-140 行）

见上方 §6.2 完整代码。

---

## 11. 无慢案例日志和截图

本轮未补跑页面，无运行耗时日志和截图。以上均为静态核实。
