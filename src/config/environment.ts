/**
 * 环境配置
 *
 * 与原项目 environment.js 对齐，改用 Vite 的 import.meta.env。
 * - development: 默认指向本地后端 8080（联调时可用 VITE_API_BASE 覆盖）
 * - production: 空字符串，走同源（前端构建产物嵌入后端 static 目录同域部署）
 *
 * 覆盖方式：在 .env.local 中写 VITE_API_BASE=http://your-host:port
 */

const mode = import.meta.env.MODE

/** 显式配置优先（.env.local / 构建参数），没有则按环境取默认值 */
const configured = import.meta.env.VITE_API_BASE as string | undefined

let baseUrl = ''

if (configured !== undefined && configured !== '') {
  baseUrl = configured
} else if (import.meta.env.DEV || mode === 'test') {
  baseUrl = 'http://127.0.0.1:8080'
} else {
  // production：同源部署
  baseUrl = ''
}

export const isProduction = import.meta.env.PROD

export { baseUrl }
