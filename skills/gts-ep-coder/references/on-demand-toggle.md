# 按需能力接入参考（国际化 / 主题切换 UI）

> 受众：执行 gts-ep-coder 的 AI。本文档是"用户明确要求切换功能时"的实现参考，
> **默认工程不含任何切换 UI**（见 SKILL.md「国际化：按需启用」「主题切换：机制常驻，UI 按需」）。
> 此处提供安装与状态装配参考；真实运行只按实际验收记录声明。**UI 形态（图标/下拉/菜单项……）按用户描述调整**，
> 不要照抄本文当作唯一形态。

## 通用前提

- i18n 装配素材：`scripts/preview/i18n-scaffold/`（接线复用；两语言词典按业务同步更新）。
- 预览加载器已就绪：`index.gts-ep.html` 的 moduleCache 已映射 `vue-i18n` 与 EP locale 子路径，
  接入后预览直接生效，**无需改预览加载器**。
- 标准入口在mount前调用installI18n(app)；离线入口在App调用useI18n前通过同一函数安装。

## 一、国际化 + 主题切换同时接入（公共接线）

App.vue完整参考（XxxYyy是占位名，替换为init返回的PAGE，不固定使用此目录；页面组件路径按工程替换 `./pages/XxxYyy/index.vue`）：

```vue
<script setup>
// 应用壳：装配 i18n / 主题切换（预览与真实工程共用）
import { ref, getCurrentInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElConfigProvider, ElTooltip, ElIcon, ElButton } from 'element-plus'
import { Moon, Sunny } from '@element-plus/icons-vue'
import { installI18n, setLocale, EP_LOCALES } from './i18n/index.js'
import Page from './pages/XxxYyy/index.vue'

// 标准main与此处共用安装函数；离线不执行main，须在useI18n之前安装
const inst = getCurrentInstance()
if (inst) installI18n(inst.appContext.app)

const { t, locale } = useI18n({ useScope: 'global' })

// 主题切换：data-theme 属性驱动（html[data-theme="..."]）
const THEME_KEY = 'uxproto-theme'
const theme = ref('default')
try { const saved = localStorage.getItem(THEME_KEY); if (['default', 'dark'].includes(saved)) theme.value = saved } catch {}
document.documentElement.setAttribute('data-theme', theme.value)
const nextTheme = () => {
  const target = theme.value === 'default' ? 'dark' : 'default'
  setTheme(target)
}

const setTheme = (name) => {
  theme.value = name
  document.documentElement.setAttribute('data-theme', name)
  try { localStorage.setItem(THEME_KEY, name) } catch {}
}

const isDark = (name) => name !== 'default'

// 语言切换：toggle 到另一语言（持久化在 src/i18n 内）
const toggleLocale = () => {
  const target = locale.value === 'zh-cn' ? 'en' : 'zh-cn'
  setLocale(target)
}
const localeLabel = (loc) => (loc === 'zh-cn' ? 'EN' : '中文')
</script>

<template>
  <ElConfigProvider :locale="EP_LOCALES[locale]">
    <div class="app-shell">
      <div class="app-toolbar">
        <ElTooltip :content="localeLabel(locale)" placement="bottom">
          <ElButton class="icon-btn" text :aria-label="localeLabel(locale)" @click="toggleLocale">
            {{ localeLabel(locale) }}
          </ElButton>
        </ElTooltip>
        <ElTooltip :content="isDark(theme) ? t('msg.demo.app.themeLight') : t('msg.demo.app.themeDark')" placement="bottom">
          <ElButton class="icon-btn" text :aria-label="isDark(theme) ? t('msg.demo.app.themeLight') : t('msg.demo.app.themeDark')" @click="nextTheme">
            <ElIcon :size="16"><Moon v-if="isDark(theme)" /><Sunny v-else /></ElIcon>
          </ElButton>
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
  margin: 0;
}
</style>
```

**关键约束（顺序不可变，预览挂死/报错的根因就在这两条）：**
1. **统一安装必须在 `useI18n()` 之前** —— 预览不执行 main.js，无人 `app.use(i18n)`，
   缺装会抛 `Error: 27`（NOT_INSTALLED），组件渲染为空白。安装去重由共享installI18n管理，不依赖私有标记。
2. **EP 文案跟随用 `ElConfigProvider :locale`** —— 组件库内置文案（分页等）不走词典，
   绑定 `EP_LOCALES[locale]` 后自动跟随语言。
3. 词典 key 集合两份保持一致（en 缺失回落中文）；`t('msg.demo.app.themeLight')` 等文案
   需在词典中成对存在。

## 二、只接主题切换（不接 i18n）

不 import vue-i18n，去掉幂等补装与 `ElConfigProvider`（标准工程由 `main.js`、离线预览由加载器安装EP中文locale），保留 `setTheme`/`nextTheme` + 切换控件即可：

```js
// App.vue script 内
import { ref } from 'vue'
const THEME_KEY = 'uxproto-theme'
const theme = ref('default')
try { const saved = localStorage.getItem(THEME_KEY); if (['default', 'dark'].includes(saved)) theme.value = saved } catch {}
document.documentElement.setAttribute('data-theme', theme.value)
const setTheme = (name) => {
  theme.value = name
  document.documentElement.setAttribute('data-theme', name)
  try { localStorage.setItem(THEME_KEY, name) } catch {}
}
```

切换控件形态按用户描述实现（图标/下拉/菜单项均可）。

## 三、代码自查与维护验收

- 跑 build 门禁：`node scripts/build.mjs --dir "<工程目录>"` 期望 `RESULT: OK`。
- 普通生成按规则完成源码自查及build，不自动打开浏览器。维护者验证接线时，浏览器检查：语言切换后词典与 EP 分页文案跟随、`data-theme` 持久化、控制台无 `Error: 27` 与未定义 token。

标准main启用国际化时仅追加：

```js
import { installI18n } from './i18n/index.js'
// createApp之后、app.mount之前
installI18n(app)
```

locale直接来自useI18n，不另存ref副本；配置数组存labelKey并在模板t()，或用computed，不能只在setup翻译一次。
