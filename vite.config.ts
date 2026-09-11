import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // 与原版 vue.config.js 的 publicPath: './' 对齐：产物可用于子路径部署
  // （绝对路径 /assets/... 在 nginx 的 /music/ 这类子路径下会 404）
  base: './',
  plugins: [vue()],
  define: {
    // sockjs-client 等 CJS 依赖引用了 Node 的 global，浏览器中不存在，需映射到 globalThis
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 监听所有地址（IPv4 + IPv6），避免默认只绑定 ::1 导致 127.0.0.1 访问失败
    host: true,
    port: 8080,
  },
})
