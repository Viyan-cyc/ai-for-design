// ============================================================
// 真实工程接入入口（预览不执行此文件；预览由 index.gts.html 加载）
// 依赖：vue@^3.5、@hw-seq/sweet-ui-base@^5.6（内网 registry）、
//       xss、lodash、echarts@^6.1、less@^4.4（主题与组件样式均为 .less）
//       （dayjs 由 SweetUI 内部使用，工程无需直接安装）
// ============================================================
import { createApp } from 'vue'
import SweetUIBase from '@hw-seq/sweet-ui-base'
import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css'
import './assets/themes/base.less'
import './assets/themes/bridge.less'
import './assets/themes/default.less'
// ▼▼ 换肤插槽：接入新皮肤 less 后在此追加 import ▼▼
import App from './App.vue'

const app = createApp(App)
// SweetUI 组件内置文案（分页等）默认中文；启用国际化后由 sweetUIBase.i18n / sweet-config-provider :locale 跟随语言
app.use(SweetUIBase)
app.mount('#app')
