import { ref } from 'vue'
import { i18n, setLocaleMessages } from '@hw-seq/sweet-ui-base'
export const locale = ref('zh_CN')
let application
let dictionaries = {}
export function setLanguage(lang) {
  if (!['zh_CN', 'en_US'].includes(lang)) return Promise.reject(new Error('Unsupported language: ' + lang))
  return new Promise((resolve, reject) => {
    try {
      i18n(lang, application, () => {
        try {
          setLocaleMessages(dictionaries[lang] || {}, application)
          locale.value = lang
          resolve()
        } catch (error) { reject(error) }
      })
    } catch (error) { reject(error) }
  })
}
export function installI18n(app, messages = {}, language = 'zh_CN') {
  application = app
  dictionaries = messages
  return setLanguage(language)
}
