import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

/**
 * Material Design 3 主题
 * 初始使用深色主题 + teal 主色（与原项目视觉基调一致），
 * 后续在 design token 阶段统一精调为 MD3 tonal palette。
 *
 * 注意：Vuetify 4 的 createVuetify 不再自动注册组件（components/directives 默认为空），
 * 必须显式传入，否则所有 v-* 组件都无法解析。
 */
const vuetify = createVuetify({
  components,
  directives,
  defaults: {
    global: {
      ripple: true,
    },
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#121212',
          surface: '#1E1E1E',
          primary: '#009688',
          'primary-darken-1': '#00796B',
          secondary: '#4DB6AC',
          accent: '#FF4081',
          error: '#CF6679',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
        },
      },
    },
  },
})

export default vuetify
