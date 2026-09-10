import axios from 'axios'
import { baseUrl } from '@/config/environment'

/**
 * HTTP 客户端（用于首页未连接时的房间相关接口）
 */
const http = axios.create({
  baseURL: baseUrl,
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  config.headers['AccessToken'] = 'token'
  return config
})

export default http
