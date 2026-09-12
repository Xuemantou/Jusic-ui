import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { DEFAULT_SEED, md3Colors, md3Variables } from '@/theme/md3'

/**
 * Material You（Material Design 3）主题
 *
 * 这里的颜色不是手写常量，而是由 seed color（默认 teal #009688）实时派生出的
 * 完整 MD3 角色表。运行时若用户切换了配色来源（例如跟随背景图取色），
 * 由 src/theme/index.ts 的 syncVuetifyTheme() 重建 colors —— 改 themes.*.colors
 * 会触发热更新重新生成 CSS 变量，无需刷新页面。
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
    // MD3 没有 lighten/darken 变体概念，关闭以免生成一堆冗余的 -lighten-N 变量
    variations: false,
    themes: {
      dark: {
        dark: true,
        colors: md3Colors(DEFAULT_SEED, true),
        variables: md3Variables(true),
      },
      light: {
        dark: false,
        colors: md3Colors(DEFAULT_SEED, false),
        variables: md3Variables(false),
      },
    },
  },
})

export default vuetify
