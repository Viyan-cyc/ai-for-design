# 按需能力接入参考（国际化 / 主题切换 UI）

> 受众：执行 generate-ux-prototype 的 AI。本文档是"用户明确要求切换功能时"的实现参考，
> **默认工程不含任何切换 UI**（见 SKILL.md「国际化：按需启用」「主题切换：机制常驻，UI 按需」）。
> 参考实现已验证通过 build 门禁 + 浏览器冒烟；**UI 形态（图标/下拉/菜单项……）按用户描述调整**，
> 不要照抄本文当作唯一形态。

## 通用前提

- i18n 装配素材：`scripts/preview/i18n-scaffold/`（逐字拷贝到工程 `src/i18n/`，不要重写）。
- 预览加载器已就绪：`index.gts.html` 的 moduleCache 已映射 `vue-i18n` 与 EP locale 子路径，
  接入后预览直接生效，**无需改预览加载器**。
- build 门禁：`ALLOWED_BARE` 已含 `vue-i18n`，EP locale 子路径 import 放行。

## 一、国际化 + 主题切换同时接入（已验证组合）

App.vue 完整参考（页面组件名按工程替换 `./pages/XxxYyy/index.vue`）：

```vue
<script setup>
// 应用壳：装配 i18n / 主题切换（预览与真实工程共用）
import { ref, getCurrentInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElConfigProvider, ElTooltip, ElIcon } from 'element-plus'
import { Moon, Sunny } from '@element-plus/icons-vue'
import i18n, { setLocale, EP_LOCALES } from './i18n/index.js'
import Page from './pages/XxxYyy/index.vue'

// 真实工程在 main.js app.use(i18n)；预览无独立入口，这里幂等补装（须先于 useI18n）
const inst = getCurrentInstance()
if (inst && !inst.appContext.app.__VUE_I18N_SYMBOL__) {
  inst.appContext.app.use(i18n)
}

const { t } = useI18n()

// 主题切换：data-theme 属性驱动（html[data-theme="..."]）
const THEME_KEY = 'uxproto-theme'
const theme = ref(localStorage.getItem(THEME_KEY) || 'default')
const nextTheme = () => {
  const target = theme.value === 'default' ? 'dark' : 'default'
  setTheme(target)
}

const setTheme = (name) => {
  theme.value = name
  document.documentElement.setAttribute('data-theme', name)
  localStorage.setItem(THEME_KEY, name)
}

const isDark = (name) => name !== 'default'

// 语言切换：toggle 到另一语言（持久化在 src/i18n 内）
const locale = ref(i18n.global.locale.value)
const toggleLocale = () => {
  const target = locale.value === 'zh-cn' ? 'en' : 'zh-cn'
  setLocale(target)
  locale.value = target
}
const localeLabel = (loc) => (loc === 'zh-cn' ? 'EN' : '中文')
</script>

<template>
  <ElConfigProvider :locale="EP_LOCALES[locale]">
    <div class="app-shell">
      <div class="app-toolbar">
        <ElTooltip :content="localeLabel(locale)" placement="bottom">
          <button class="icon-btn" type="button" :aria-label="localeLabel(locale)" @click="toggleLocale">
            {{ localeLabel(locale) }}
          </button>
        </ElTooltip>
        <ElTooltip :content="isDark(theme) ? t('msg.demo.app.themeLight') : t('msg.demo.app.themeDark')" placement="bottom">
          <button class="icon-btn" type="button" :aria-label="t('msg.demo.app.themeDark')" @click="nextTheme">
            <ElIcon :size="16"><Moon v-if="isDark(theme)" /><Sunny v-else /></ElIcon>
          </button>
        </ElTooltip>
      </div>
      <Page />
    </div>
  </ElConfigProvider>
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

**关键约束（顺序不可变，预览挂死/报错的根因就在这两条）：**
1. **幂等补装必须在 `useI18n()` 之前** —— 预览不执行 main.js，无人 `app.use(i18n)`，
   缺装会抛 `Error: 27`（NOT_INSTALLED），组件渲染为空白。判据 `__VUE_I18N_SYMBOL__` 与 vue-i18n 内部一致。
2. **EP 文案跟随用 `ElConfigProvider :locale`** —— 组件库内置文案（分页等）不走词典，
   绑定 `EP_LOCALES[locale]` 后自动跟随语言。
3. 词典 key 集合两份保持一致（en 缺失回落中文）；`t('msg.demo.app.themeLight')` 等文案
   需在词典中成对存在。

## 二、只接主题切换（不接 i18n）

不 import vue-i18n，去掉幂等补装与 `ElConfigProvider`（EP 文案由 `main.js` 的
`app.use(ElementPlus, { locale: zhCn })` 保证中文），保留 `setTheme`/`nextTheme` + 切换控件即可：

```js
// App.vue script 内
import { ref } from 'vue'
const THEME_KEY = 'uxproto-theme'
const theme = ref(localStorage.getItem(THEME_KEY) || 'default')
const setTheme = (name) => {
  theme.value = name
  document.documentElement.setAttribute('data-theme', name)
  localStorage.setItem(THEME_KEY, name)
}
```

切换控件形态按用户描述实现（图标/下拉/菜单项均可）。

## 三、验收

- 跑 build 门禁：`node scripts/build.mjs --dir "<工程目录>"` 期望 `RESULT: OK`。
- 浏览器冒烟：语言切换后词典与 EP 分页文案跟随、`data-theme` 持久化、控制台无 `Error: 27` 与未定义 token。
