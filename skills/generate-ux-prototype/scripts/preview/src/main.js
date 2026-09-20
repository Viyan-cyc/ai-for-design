// ============================================================
// 真实工程接入入口（预览不执行此文件；预览由 index.gts.html 加载）
// 依赖：vue@^3.4、vue-router@^4.4、element-plus@2.13.5、
//       dayjs@^1.11、less@^4.2
// 图标：不走 npm 包（@element-plus/icons-vue 已禁用）——IconPlus/Lucide 的
//       .svg 文件放 src/assets/icons/，`import icon from '.../xxx.svg'` 用
// ============================================================
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'

// 设计资产 token 体系（init.mjs 从资产库 ASSETS_ROOT 现取复制）
import './assets/themes/base.css'
import './assets/tokens/index.css'

// 项目 Less 基础样式（Vite 自动编译 Less）
import './assets/style/base.less'

// 路由
import router from './router'

// ▼▼ 自定义皮肤插槽：接入 theme-{name}.css 后在此追加 import ▼▼
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
