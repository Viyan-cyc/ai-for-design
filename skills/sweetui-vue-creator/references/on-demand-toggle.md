# 按需能力接入参考（国际化 / 主题切换 UI）

> 受众：执行 sweetui-vue-creator 的 AI。本文档是"用户明确要求切换功能时"的实现参考，
> **默认工程不含任何切换 UI**（见 SKILL.md「国际化：按需启用」「主题切换：机制常驻，UI 按需」）。
> **UI 形态（图标/下拉/菜单项……）按用户描述调整**，不要照抄本文当作唯一形态。

## 通用前提

- SweetUI locale 资产：`@hw-seq/sweet-ui-base/es/locale/lang/`（11 种，`zh_CN.mjs`/`en_US.mjs`…）。
- 主题切换是 SweetUI 原生能力：`SweetUIBase.setTheme(name)`（= `document.body.setAttribute("theme", name)`），
  预览加载器 `window.setTheme` 已同口径接线。
- 组件库内置文案（分页等）跟随走 `sweet-config-provider :locale`，不引 vue-i18n——
  SweetUI 自带 i18n（`sweetUIBase.i18n(localeTag, app)`），词典机制见下文。

## 一、国际化 + 主题切换同时接入

App.vue 完整参考（页面组件名按工程替换 `./pages/XxxYyy/index.vue`）：

```vue
<script setup>
// 应用壳：装配 i18n / 主题切换（预览与真实工程共用）
import { ref, computed } from 'vue'
import { SweetConfigProvider } from '@hw-seq/sweet-ui-base'
import zhCN from '@hw-seq/sweet-ui-base/es/locale/lang/zh_CN'
import enUS from '@hw-seq/sweet-ui-base/es/locale/lang/en_US'
import IconPlus from './components/icon-plus.vue'
// 词典按 code-rules 规则 10.2 组织（msg.{页面}.{分类}.{语义}），此处从简示意
import { dict } from './i18n/dict.js'
import Page from './pages/XxxYyy/index.vue'

const localeTag = ref(localStorage.getItem('uxproto-locale') || 'zh_CN')
const LOCALES = { zh_CN: zhCN, en_US: enUS }

// 页面文案查表（词典 key 集合两份保持一致，en 缺失回落中文）
const t = (key) => (dict[localeTag.value] ?? dict.zh_CN)[key] ?? key

// 主题切换：body[theme] 属性驱动（SweetUI 原生机制）
const THEME_KEY = 'uxproto-theme'
const theme = ref(localStorage.getItem(THEME_KEY) || 'default')
const setTheme = (name) => {
  theme.value = name
  window.setTheme(name) // 预览加载器接线；真实工程用 SweetUIBase.setTheme
  localStorage.setItem(THEME_KEY, name)
}
const nextTheme = () => setTheme(theme.value === 'default' ? 'dark' : 'default')
const isDark = (name) => name !== 'default'

// 语言切换：toggle 到另一语言（词典与组件文案同时跟随）
const toggleLocale = () => {
  const target = localeTag.value === 'zh_CN' ? 'en_US' : 'zh_CN'
  localeTag.value = target
  localStorage.setItem('uxproto-locale', target)
}
const localeLabel = (loc) => (loc === 'zh_CN' ? 'EN' : '中文')
</script>

<template>
  <SweetConfigProvider :locale="LOCALES[localeTag]">
    <div class="app-shell">
      <div class="app-toolbar">
        <button class="icon-btn" type="button" :aria-label="localeLabel(localeTag)" @click="toggleLocale">
          {{ localeLabel(localeTag) }}
        </button>
        <button class="icon-btn" type="button" @click="nextTheme">
          <IconPlus :name="isDark(theme) ? 'moon' : 'sun'" />
        </button>
      </div>
      <Page />
    </div>
  </SweetConfigProvider>
</template>

<style scoped lang="less">
.app-shell {
  min-height: 100%;
}

.app-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-size-8);
  padding: var(--space-size-8) var(--space-size-16);
  background: var(--color-bg-2);
  border-bottom: 1px solid var(--color-border-separator);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--space-size-24);
  height: var(--space-size-24);
  padding: 0 var(--space-size-4);
  border: 1px solid transparent;
  border-radius: var(--radius-size-small);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;

  &:hover {
    color: var(--color-brand);
    background: var(--color-hover);
  }

  &:focus-visible {
    outline: 1px solid var(--color-border-focus);
    outline-offset: 1px;
  }
}
</style>
```

**关键约束：**
1. **组件库内置文案用 `SweetConfigProvider :locale`** —— 不引 vue-i18n、不用 EP 的
   locale 机制；locale 对象从包 `es/locale/lang/` 导入。
2. **全局装配用 `sweetUIBase.i18n(localeTag, app)`**（真实工程 main.js）——命令式 API
   （`$msgbox`/`$sweetNotify`）的内置文案由它驱动；config-provider 覆盖不到的命令式场景靠它。
3. **换肤调用 `setTheme`（body[theme]）**，皮肤名 = `default`/`dark`（我们的皮肤名，非
   SweetUI 自带主题值）；dark 皮肤由 gen-tokens 生成、随骨架交付，切换无回填项。
4. 词典 key 集合两份保持一致（en 缺失回落中文）。

## 二、只接主题切换（不接 i18n）

去掉 locale 相关 import、`SweetConfigProvider` 与词典（SweetUI 内置文案默认中文），
保留 `setTheme`/`nextTheme` + 切换控件即可：

```js
// App.vue script 内
import { ref } from 'vue'
const THEME_KEY = 'uxproto-theme'
const theme = ref(localStorage.getItem(THEME_KEY) || 'default')
const setTheme = (name) => {
  theme.value = name
  window.setTheme(name)
  localStorage.setItem(THEME_KEY, name)
}
```

切换控件形态按用户描述实现（图标/下拉/菜单项均可）。

## 三、验收

- 跑 build 门禁：`node scripts/build.mjs --dir "<工程目录>"` 期望 `RESULT: OK`。
- 浏览器冒烟：切换主题后按钮/边框/表格配色跟随（DevTools 确认 `body[theme]` 已切换）、
  接了 i18n 时分页内置文案跟随语言、刷新后持久化生效。
