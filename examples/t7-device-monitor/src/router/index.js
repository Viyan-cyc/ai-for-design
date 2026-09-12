import { createRouter, createWebHashHistory } from 'vue-router'
import DeviceMonitor from '../views/device-monitor/index.vue'

const routes = [
  { path: '/', name: 'device-monitor', component: DeviceMonitor },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
