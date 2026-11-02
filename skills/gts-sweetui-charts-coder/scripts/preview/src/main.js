import { createApp } from 'vue'
import App from './App.vue'
import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css'
import { installRuntime } from './runtime.js'
const app = createApp(App)
installRuntime(app).then(() => app.mount('#app')).catch(console.error)
