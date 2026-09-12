import { createRouter, createWebHashHistory } from 'vue-router'
import AlarmInsight from '../views/alarm-insight/index.vue'

const routes = [
  { path: '/', name: 'alarm-insight', component: AlarmInsight },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
