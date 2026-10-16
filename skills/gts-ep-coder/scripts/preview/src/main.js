// ============================================================
// 真实工程接入入口（预览不执行此文件；预览由 index.gts.html 加载）
// 依赖：vue@^3.4、element-plus@^2.13.5、@element-plus/icons-vue@^2.3、dayjs@^1.11、less@^4.2（主题与组件样式均为 .less）
//       （国际化按需启用，启用时另装 vue-i18n@^9.14 并接 src/i18n/）
// ============================================================
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import './assets/themes/base.less'
import './assets/themes/bridge.less'
import './assets/themes/default.less'
// ▼▼ 换肤插槽：接入新皮肤 less 后在此追加 import ▼▼
import App from './App.vue'

const app = createApp(App)
// EP 组件内置文案（分页等）默认中文；启用国际化后改由 App.vue 的 ElConfigProvider 跟随语言
app.use(ElementPlus, { locale: zhCn })
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}
app.mount('#app')
