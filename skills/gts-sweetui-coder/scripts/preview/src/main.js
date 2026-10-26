// 标准Vue工程入口。离线预览使用同一个native-adapter，不另写一套库接线。
import { createApp } from 'vue'
import '@hw-seq/sweet-ui-base/theme-chalk/sweet/index.css'
import './assets/themes/base.css'
import './assets/themes/native-compat.css'
import './native-styles.js'
import App from './App.vue'
import { installNative } from './native-adapter.js'

const app = createApp(App)
installNative(app).then(()=>app.mount('#app')).catch(error=>{
  document.getElementById('app').textContent='初始化失败：'+error.message
  console.error(error)
})
