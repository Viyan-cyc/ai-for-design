// ============================================================
// router/index.js — 路由配置（真实工程 + 预览共用）
// App.vue 使用 <RouterView />，预览加载器同样安装 router
// ============================================================
import { createRouter, createWebHashHistory } from 'vue-router'

// createWebHashHistory 兼容 file:// 离线预览；真实工程可改 createWebHistory()
// ▼▼ 页面路由：新增页面时在此添加 ▼▼
const routes = [
  // ROUTER_SLOT
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
