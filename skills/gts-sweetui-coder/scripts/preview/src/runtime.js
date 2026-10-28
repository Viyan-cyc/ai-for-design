import './assets/base.css'
import SweetUI from '@hw-seq/sweet-ui-base'
import { installTheme } from './theme.js'
import { installI18n } from './i18n/index.js'
export async function installRuntime(app) {
  app.use(SweetUI)
  installTheme(app)
  await installI18n(app)
}
