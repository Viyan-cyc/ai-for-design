// 真实工程与离线loader共同使用的唯一接线处。内网核实实际API后只修本文件。
import { nextTick } from 'vue'
import SweetUI from '@hw-seq/sweet-ui-base'
import { installExtras, applyExtraTheme } from './native-plugins.js'

const THEME_ARGS = {
  'uDesign2.2-light': 'uDesign2.2-light',
  'uDesign2.2-dark': 'uDesign2.2-dark',
}
const LOCALE_ARGS = { 'zh-cn': 'zh_CN', en: 'en_US' }
let currentApp

export async function applyNativeTheme(name, app = currentApp) {
  if (!Object.hasOwn(THEME_ARGS, name)) throw new Error('Unsupported SweetUI theme: ' + name)
  if (typeof SweetUI.setTheme !== 'function') throw new Error('核实真实 SweetUI setTheme 导出并修正 native-adapter.js')
  await applyExtraTheme(THEME_ARGS[name], app)
  await SweetUI.setTheme(THEME_ARGS[name], app)
  document.documentElement.setAttribute('data-theme', name)
  await nextTick()
  window.dispatchEvent(new Event('gts-theme-change'))
  try { localStorage.setItem('gts-sweetui-theme', name) } catch {}
}

export function setNativeLocale(locale, app = currentApp) {
  if (!Object.hasOwn(LOCALE_ARGS, locale)) throw new Error('Unsupported SweetUI locale: ' + locale)
  if (typeof SweetUI.i18n !== 'function') throw new Error('核实真实 SweetUI i18n 导出并修正 native-adapter.js')
  return SweetUI.i18n(LOCALE_ARGS[locale], app)
}

export async function installNative(app) {
  currentApp = app
  await setNativeLocale('zh-cn', app)
  app.use(SweetUI)
  installExtras(app)
  let theme = 'uDesign2.2-light'
  try { const saved = localStorage.getItem('gts-sweetui-theme'); if (Object.hasOwn(THEME_ARGS, saved)) theme = saved } catch {}
  await applyNativeTheme(theme, app)
}
