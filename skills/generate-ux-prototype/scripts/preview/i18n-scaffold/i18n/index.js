// ============================================================
// i18n 装配（vue-i18n）
// 词典放 ./locales/{locale}.js；页面里 const { t } = useI18n()。
// key 命名：msg.{页面}.{分类}.{语义}，至少 3 个点（见 code-rules 规则 10.2）。
// 切换语言：从本模块导入 setLocale / getLocale / 默认导出 i18n。
// Element Plus 组件内置文案（分页/日期选择等）经 epLocale 提供，
// 在 App.vue 用 <ElConfigProvider :locale="epLocale"> 跟随当前语言。
// ============================================================
import { createI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import messagesZhCn from './locales/zh-cn.js'
import messagesEn from './locales/en.js'

export const SUPPORTED_LOCALES = ['zh-cn', 'en']

export const EP_LOCALES = { 'zh-cn': zhCn, en }

function getInitialLocale() {
  try {
    const saved = localStorage.getItem('uxproto-locale')
    return SUPPORTED_LOCALES.includes(saved) ? saved : 'zh-cn'
  } catch {
    return 'zh-cn'
  }
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'zh-cn',
  messages: { 'zh-cn': messagesZhCn, en: messagesEn },
})

// 切换语言并持久化；EP 组件文案由 App.vue 的 ElConfigProvider 响应跟随
export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return
  i18n.global.locale.value = locale
  try {
    localStorage.setItem('uxproto-locale', locale)
  } catch {
    /* 持久化失败不影响本次切换 */
  }
}

export function getLocale() {
  return i18n.global.locale.value
}

export default i18n
