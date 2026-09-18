// ============================================================
// 真实工程接入入口（预览不执行此文件；预览由 index.html 加载）
// 依赖：vue@^3.4、element-plus@^2.13.5、@element-plus/icons-vue@^2.3、dayjs@^1.11
// ============================================================
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import './assets/themes/base.css'
import './assets/themes/bridge.css'
import './assets/themes/default.css'
// ▼▼ 换肤插槽：接入新皮肤 css 后在此追加 import ▼▼
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}
app.mount('#app')
