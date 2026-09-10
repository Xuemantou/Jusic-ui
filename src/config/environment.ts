/**
 * 环境配置
 *
 * 与原项目 environment.js 对齐，改用 Vite 的 import.meta.env。
 * - development: 默认指向本地后端 8080（联调时可按需改为线上 API）
 * - production: 空字符串，走同源（前端构建产物嵌入后端 static 目录同域部署）
 */

const mode = import.meta.env.MODE

let baseUrl = 'http://127.0.0.1'
let kuwoHttps = ''

if (import.meta.env.DEV) {
  baseUrl = 'http://127.0.0.1:8080'
  kuwoHttps = 'https://tx.alang.run/kuwo'
} else if (mode === 'test') {
  baseUrl = 'http://127.0.0.1:8080'
  kuwoHttps = ''
} else {
  // production：同源部署
  baseUrl = ''
  kuwoHttps = 'https://tx.alang.run/kuwo'
}

export const isProduction = import.meta.env.PROD

export { baseUrl, kuwoHttps }
