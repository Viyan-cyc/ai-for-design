# 05-runtime-confirmation.md — 运行接入证据补充

> 静态核实 + 最小运行验证 @hw-seq/sweet-ui-base 5.7.0 | 2026-10-28

---

## 1. SweetUI 自定义业务词典接入

### 1.1 核心 API（静态核实，源码级别确证）

SweetUI **官方支持**自定义词典，通过 `setLocaleMessages(messages, app)` 合并到全局 reactive 词典存储。

**源码**：`es/utils/locale/use-locale.mjs`

```js
import { merge } from "../util/index.mjs"

// 唯一的词典合并 API
const setLocaleMessages = (messages = {}, app) => {
  merge(app.config.globalProperties.sweetI18nLocaleMessages || {}, messages)
}
```

**主包导出确认**：`es/index.mjs` 命名导出包含 `setLocaleMessages`、`useLocale`、`setSweetI18n`、`localeContextKey`。

```js
import { setLocaleMessages, useLocale, setSweetI18n } from '@hw-seq/sweet-ui-base'
```

**注意**：`sweetI18n` 翻译函数本身**不是**直接导出的命名 export。它通过以下三种方式获取。

### 1.2 组件中取词的三种方式

| 方式 | 代码 | 可用场景 |
|---|---|---|
| Options API | `this.sweetI18n("key")` | 模板和方法中自动可用（globalProperties） |
| Composition API inject | `const t = inject("sweetI18n"); t("key")` | `<script setup>` 中 |
| useLocale composable | `const { t } = useLocale(); t("key")` | `<script setup>` 中，返回 `{ lang, locale, t }` |

**没有 `$t`**。SweetUI 不注册 `app.config.globalProperties.$t`。翻译函数名是 `sweetI18n`，不是 `$t`。

### 1.3 翻译函数行为

源码（`es/utils/locale/use-locale.mjs` 原始 TypeScript，source map 还原）：

```ts
const translate = (path: string, option: Record<string, string|number> | undefined, locale: Language): string => {
  return get(locale, path, path)                                      // lodash.get 解析点路径
    .replace(/\{(\w+)\}/g, (_, key) => `${option?.[key] ?? `{${key}}`}`)  // 插值替换
}

const buildTranslator = (locale: MaybeRef<Language>): Translator =>
  (path, option) => translate(path, option, unref(locale))
```

- 翻译函数签名：`t(key: string, params?: Record<string, string|number>) => string`
- **key 解析**：使用 `lodash.get()` 支持点路径，如 `"el.datepicker.year"` 解析为 `{el:{datepicker:{year:"..."}}}` 的嵌套结构
- **插值**：`{paramName}` 占位符，如 `"共 {total} 条"` + `{total: 100}` → `"共 100 条"`；缺失参数保留原占位符
- **key 不存在**：返回 key 本身作为 fallback

### 1.4 内置词典是否保留

**是的，完全保留**。`i18n(lang, app)` 的调用链：

```
i18n("en_US", app)
  → setSweetI18n("en_US", app, innerCallback)
    → 创建 reactive({}), 构建翻译函数, 设置全局属性
    → innerCallback()
      → setLocaleMessages(localeMessages["en"], app)   // 注入内置词典
  → callback?.()                                        // 用户回调
```

内置词典在 `innerCallback` 中通过 `setLocaleMessages` 合并到 `sweetI18nLocaleMessages`。此后用户再调用 `setLocaleMessages` 添加自定义 key，是追加/覆盖到**同一个** reactive 对象，内置词典 key 仍然存在。

**⚠️ 重新调用 `i18n()` 或 `setSweetI18n()` 会重置整个词典**（`sweetI18nLocaleMessages = reactive({})`），需再次 `setLocaleMessages` 补回自定义词典。

### 1.5 切换语言后响应式更新

`sweetI18nLocaleMessages` 是 `reactive({})` 对象。翻译函数 `t()` 内部通过 `computed(() => appContext.config.globalProperties.sweetI18nLocaleMessages || {})` 引用，因此：

1. 调用 `setLocaleMessages(newMessages, app)` 修改 reactive 对象 → 使用 `t()` 的组件自动重新渲染
2. 调用 `i18n("en_US", app)` 重置 reactive 对象 + 注入新语言内置词典 → 使用 `t()` 的组件自动重新渲染

**Options API 的 `this.sweetI18n()` 和 Composition API 的 `inject("sweetI18n")` 都指向同一个翻译函数**，该函数读 reactive 对象，切换语言自然响应式。

### 1.6 最小可运行示例

#### ESM（真实工程）

```js
// main.js
import { createApp } from 'vue'
import SweetUI, { i18n, setLocaleMessages } from '@hw-seq/sweet-ui-base'
import App from './App.vue'
import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css'

const app = createApp(App)
app.use(SweetUI)

// 初始化中文 + 注册自定义词典（必须放在 i18n 之后或 callback 内）
i18n('zh_CN', app, () => {
  setLocaleMessages({
    msg_device_list_title: '设备列表',
    msg_device_status_running: '运行中',
    msg_device: { list: { export: '导出', count: '共 {total} 台' } }
  }, app)
})

app.mount('#app')
```

```vue
<!-- 页面组件 -->
<script setup>
import { inject } from 'vue'
const t = inject('sweetI18n')

// 或者：
// import { useLocale } from '@hw-seq/sweet-ui-base'
// const { t } = useLocale()
</script>

<template>
  <h1>{{ t('msg_device_list_title') }}</h1>
  <p>{{ t('msg_device.list.export') }}</p>
  <p>{{ t('msg_device.list.count', { total: 42 }) }}</p>
  <!-- 组件内置 key 同样可用 -->
  <p>{{ t('common_ok') }}</p>
  <p>{{ t('el.pagination.total', { total: 100 }) }}</p>
</template>
```

#### UMD 预览

```html
<script>
// i18n 已在 main.js 中调用
// 自定义词典需在 Vue app 创建后追加
SweetUI.setLocaleMessages({
  msg_page_title: '设备管理',
  msg_status: { online: '在线', offline: '离线' }
}, app)
</script>

<!-- 模板中 -->
<!-- {{ sweetI18n('msg_page_title') }} -->
<!-- {{ sweetI18n('msg_status.online') }} -->
```

**注意**：UMD 下 SweetUI 全局对象为 `window["sweet-ui-base"]`，`setLocaleMessages` 在其上作为属性可用。

### 1.7 词典结构约定

自定义词典 key 建议遵循 `msg.{页面}.{分类}.{语义}` 三段点路径（与 SKILL.md 一致），与内置 `el.*`/`common_*` 命名空间区分：

```js
setLocaleMessages({
  // flat key（同组件内置风格）
  msg_device_list_title: '设备列表',
  // nested key（lodash.get 点路径）
  msg_device: {
    list: { title: '设备列表', export: '导出', count: '共 {total} 台' },
    status: { running: '运行中', error: '故障' }
  }
}, app)
```

---

## 2. SweetUI UMD lodash 全局名验证

### 2.1 UMD wrapper 实际期望（静态核实）

**文件**：`dist/sweet-ui-base.umd.cjs` 第 1 行

```js
(function(W, Fo){
  typeof exports=="object" && typeof module<"u"
    ? Fo(exports, require("xss"), require("lodash"), require("vue"))
    : typeof define=="function" && define.amd
      ? define(["exports","xss","lodash","vue"], Fo)
      : (W=typeof globalThis<"u"?globalThis:W||self,
         Fo(W["sweet-ui-base"]={}, W.xss, W._$1, W.Vue))
})(this, function(W, Fo, U, i){...})
```

| CJS require | 全局变量 | UMD 形参 | 用途 |
|---|---|---|---|
| `"xss"` | `W.xss` | `Fo` | XSS 过滤 |
| `"lodash"` | **`W._$1`** | `U` | 工具库 |
| `"vue"` | `W.Vue` | `i` | Vue 框架 |

**确认**：SweetUI UMD 期望 `window._$1` 接收 lodash。

### 2.2 lodash.min.js 实际导出的全局名（静态核实）

**文件**：`scripts/preview/public/library/lodash.min.js`

文件末尾关键代码：

```js
...be=de();typeof define=="function"&&typeof define.amd=="object"&&define.amd?(re._=be, define(function(){return be})):ue?((ue.exports=be)._=be,ee._=be):re._=be}).call(this);
```

浏览器 `<script>` 加载后执行 `re._=be`（`re` = `root` = `window`），设置 **`window._`**。

**结论**：lodash.min.js 只导出 `window._`，**不导出 `window._$1`**。需要别名接线。

### 2.3 现有预览 HTML 中的别名接线（静态核实）

**文件**：`scripts/preview/index.gts.html` 第 106-107 行

```html
<script src="./public/library/lodash.min.js"></script>
<script>window._$1 = window._; window._$z = window._;</script>
```

- `window._$1 = window._` — 为 SweetUI UMD 提供 lodash
- `window._$z = window._` — 为 DtUI UMD 提供 lodash

**没有这行，SweetUI UMD 会收到 `undefined` 的 lodash，运行时将崩溃。**

### 2.4 xss.js 全局名问题（静态核实 + 运行验证）

**文件**：`scripts/preview/public/library/xss.js`

该文件是 **Browserify 普通打包**（无 `--standalone` 参数），结构为 `(function(){...})()({...},{...},[2])`。

**运行验证**（Node.js CJS 模拟）：

```
> xss CJS export type: object
> xss CJS export keys: []       ← 空对象
> xss.filterXSS type: undefined ← 不存在
```

**浏览器加载**：该脚本执行后 **不设置任何全局变量**。`window.xss` 和 `window.filterXSS` 均为 `undefined`。

**现有预览 HTML 中的接线**（第 104-105 行）：

```html
<script src="./public/library/xss.js"></script>
<script>window.xss = window.xss || window.filterXSS;</script>
```

因为 `window.xss` 和 `window.filterXSS` 加载后都是 `undefined`，所以：

```
window.xss = undefined || undefined  →  window.xss = undefined
```

**这是一个接线 bug**：别名行无法建立有效的 xss 引用。

### 2.5 xss 在 SweetUI 中的实际使用

UMD 中 `Fo`（xss 参数）的引用：

| 引用方式 | 数量 | 说明 |
|---|---|---|
| `Fo()`（直接调用） | 2 | 尝试将 xss 当作函数调用 |
| `Fo.filterXSS` | 1 | sweet-func 工具中引用 `filterXSS` 方法 |
| `Fo`（其他引用） | 11 | 参数传递等 |

`es/utils/sweet-func/index.mjs` 中：

```js
import { filterXSS as u } from "xss"
// ...
const f = {
  // ...
  filterXSS: u,     // 直接使用 xss.filterXSS
  // ...
}
```

**后果**：UMD 下 xss 未正确接入时，`sweet-func.filterXSS` 为 `undefined`，任何调用该方法的代码将报错。**但常规组件路径（表单、表格、弹窗等）不调用 filterXSS**，仅在使用 SweetUI 的 v-html XSS 过滤或 sweet-func 工具时触发。

### 2.6 正确的脚本加载顺序和接线

```html
<!-- 1. Vue -->
<script src="./public/library/vue.global.prod.js"></script>

<!-- 2. lodash（导出 window._） -->
<script src="./public/library/lodash.min.js"></script>

<!-- 3. 别名接线 -->
<script>
  window._$1 = window._;      // SweetUI lodash
  window._$z = window._;      // DtUI lodash

  // xss 修复：手动创建全局引用
  // xss.js 是 Browserify 打包，不自动导出全局。
  // 需要在加载 xss.js 前设置 module,exports 为空对象，
  // 或替换为 UMD 版本的 xss 库。
  // 临时方案：加载后再手动赋值（需确认 xss.js 内部是否能正确执行）
</script>

<!-- 4. xss（原始 Browserify 包，当前接线有问题） -->
<script src="./public/library/xss.js"></script>
<script>
  // 如果 xss.js 执行正确但未设全局，需根据其内部模块 ID 手动提取
  // 当前该行无效：window.xss = window.xss || window.filterXSS;
  // 替代方案：使用 xss 的 UMD/standalone 版本，或提前模拟 module/exports
</script>

<!-- 5. SweetUI UMD -->
<script src="./public/library/sweet-ui-base.umd.cjs"></script>
```

### 2.7 xss 接线修复方案

**方案 A（推荐）**：替换 `xss.js` 为 UMD standalone 版本

```bash
# 下载 xss 的 browser standalone 版本（自带全局导出）
# 如：https://github.com/leizongmin/js-xss/blob/master/dist/xss.js
# standalone 版本会在 window 上设置 window.filterXSS 和 window.xss
```

然后接线改为：

```html
<script src="./public/library/xss.js"></script>
<script>window.xss = window.filterXSS;</script>
```

**方案 B**：在加载 xss.js 前模拟 CommonJS 环境

```html
<script>
  // 欺骗 Browserify bundle，让它以为在 Node.js 环境中
  if (typeof module === 'undefined') {
    window.module = { exports: {} };
    window.exports = window.module.exports;
  }
</script>
<script src="./public/library/xss.js"></script>
<script>
  window.filterXSS = window.module.exports.filterXSS || window.module.exports;
  window.xss = window.filterXSS;
  delete window.module;
  delete window.exports;
</script>
```

**方案 C（最简单）**：不做修复，明确记录限制

当前预览 HTML 中 xss 接线无效，但常规 CRUD 页面不触发 `filterXSS` 调用。仅在 v-html XSS 过滤场景受影响，可标注为已知限制。

---

## 附：版本与来源

| 项 | 路径 | 版本 |
|---|---|---|
| SweetUI npm 包 | `node_modules/@hw-seq/sweet-ui-base` | 5.7.0 |
| SweetUI UMD | `dist/sweet-ui-base.umd.cjs` | 同上 |
| lodash.min.js | `skills/.../scripts/preview/public/library/lodash.min.js` | (未标注版本) |
| xss.js | `skills/.../scripts/preview/public/library/xss.js` | Browserify bundle |
| 预览 HTML | `skills/.../scripts/preview/index.gts.html` | — |
| i18n 源码 | `es/utils/locale/index.mjs` + `use-locale.mjs` + `es/locale/index.mjs` | — |
| source map 还原 | `use-locale.mjs.map` + `index.mjs.map` | — |

**实际执行情况**：

- lodash Node.js require 验证：已执行，确认 CJS 导出类型为 function，`_` 属性为 function
- xss Node.js require 验证：已执行，确认 CJS 导出为空对象，`filterXSS` 为 undefined
- UMD wrapper 解析：静态核实，未运行浏览器加载
- i18n API：全部静态核实（源码 + source map），未在浏览器中实际运行 `setLocaleMessages` 后观察响应式更新