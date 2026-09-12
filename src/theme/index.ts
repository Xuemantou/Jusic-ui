import { watch } from 'vue'
import { useTheme } from 'vuetify'
import { md3Colors } from './md3'
import { activeSeed, isDark } from './state'

export { DEFAULT_SEED, md3Colors, md3Variables } from './md3'
export { extractSeed } from './extractSeed'
export {
  activeSeed,
  isDark,
  seedSource,
  setSeedSource,
  setThemeMode,
  themeMode,
  type SeedSource,
  type ThemeMode,
} from './state'

/**
 * 把主题状态同步到 Vuetify 运行时主题。必须在组件 setup 中调用（useTheme 依赖注入上下文）。
 *
 * 两条同步路径：
 *   - 明暗模式 → 切换 theme 名（dark / light）
 *   - seed 变化 → 重建两个主题的全部颜色角色
 *
 * 二者都通过 Vuetify 的 theme 响应式对象生效：styles 是 computed，
 * 变更后 Vuetify 会重新生成 CSS 变量并写回 <style id="vuetify-theme-stylesheet">，
 * 因此动态取色不需要刷新页面。
 */
export function syncVuetifyTheme() {
  const theme = useTheme()

  watch(
    [activeSeed, isDark],
    ([seed, dark]) => {
      theme.themes.value.dark.colors = md3Colors(seed, true)
      theme.themes.value.light.colors = md3Colors(seed, false)
      theme.global.name.value = dark ? 'dark' : 'light'
    },
    { immediate: true },
  )
}
