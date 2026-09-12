import { createRouter, createWebHashHistory } from 'vue-router'
import EventOpsCenter from '../views/event-ops-center/index.vue'

const routes = [
  { path: '/', name: 'event-ops-center', component: EventOpsCenter },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
