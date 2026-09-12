import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
// MD3 排版工具类：Vuetify 4 已移除 .text-h1 等类，需自行补齐（见该文件说明）
import './styles/typography.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')
