import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // 与原项目保持一致使用 hash 模式，避免后端静态托管时 history 路由需要 fallback 配置
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'music',
      component: () => import('@/views/MusicView.vue'),
    },
  ],
})

export default router
