import { ref } from 'vue'
import { setTheme as nativeSetTheme } from '@hw-seq/sweet-ui-base'
export const theme = ref('uDesign2.2-light')
let application
export function installTheme(app) { application = app; setTheme(theme.value) }
export function setTheme(name) {
  if (!['uDesign2.2-light', 'uDesign2.2-dark'].includes(name)) throw new Error('Unsupported theme: ' + name)
  const cssName = name === 'uDesign2.2-dark' ? 'GTS UDesign（默认风格）-dark' : name
  nativeSetTheme(cssName, application)
  document.body.style.backgroundColor = name === 'uDesign2.2-dark' ? 'var(--swt-color-bg-primary)' : ''
  theme.value = name
}
