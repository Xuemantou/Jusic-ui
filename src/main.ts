import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
// MD3 排版工具类：Vuetify 4 已移除 .text-h1 等类，需自行补齐（见该文件说明）
import './styles/typography.css'
// MD3 组件形状对齐：把 Vuetify 的 MD2 小圆角换成 MD3 形状语言
import './styles/md3-components.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')
