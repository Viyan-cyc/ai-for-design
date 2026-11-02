import { ref, shallowRef, computed } from 'vue'
import { i18n, setLocaleMessages } from '@hw-seq/sweet-ui-base'
export const locale = ref('zh_CN')
let application
let dictionaries = {}
let initialized = false
const currentI18nFn = shallowRef(key => key)
export const t = computed(() => currentI18nFn.value)
function delegatingI18n(key, args) {
  return currentI18nFn.value(key, args)
}
function reviveOldMessages(oldMsgs, newMsgs) {
  for (const k of Object.keys(oldMsgs)) { delete oldMsgs[k] }
  for (const k of Object.keys(newMsgs)) { oldMsgs[k] = newMsgs[k] }
}
function setLanguageInner(lang, app, isFirst) {
  const gp = app.config.globalProperties
  const oldMsgs = gp.sweetI18nLocaleMessages
  return new Promise((resolve, reject) => {
    i18n(lang, app, () => {
      try {
        setLocaleMessages(dictionaries[lang] || {}, app)
        const nativeT = gp.sweetI18n
        if (!isFirst && oldMsgs && gp.sweetI18nLocaleMessages !== oldMsgs) {
          reviveOldMessages(oldMsgs, gp.sweetI18nLocaleMessages)
          gp.sweetI18nLocaleMessages = oldMsgs
        }
        currentI18nFn.value = nativeT
        gp.sweetI18n = delegatingI18n
        if (typeof app.provide === 'function') { app.provide('sweetI18n', delegatingI18n) }
        locale.value = lang
        initialized = true
        resolve()
      } catch (error) { reject(error) }
    })
  })
}
export function setLanguage(lang) {
  if (!['zh_CN', 'en_US'].includes(lang)) return Promise.reject(new Error('Unsupported language: ' + lang))
  if (locale.value === lang && initialized) return Promise.resolve()
  return setLanguageInner(lang, application, false)
}
export function installI18n(app, messages = {}, language = 'zh_CN') {
  application = app
  dictionaries = messages
  return setLanguageInner(language, app, true)
}
