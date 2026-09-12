import { watch } from 'vue'
import { useTheme } from 'vuetify'
import { md3Theme } from './md3'
import { activeSeed, isDark } from './state'

export { DEFAULT_SEED, md3Colors, md3Theme } from './md3'
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
 *   - seed 变化 → 重建两个主题的全部颜色角色与令牌
 *
 * 令牌也要一起重建：MD3 的 tonal elevation 叠加色派生自 seed，换配色时它必须跟着换。
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
      const darkTheme = md3Theme(seed, true)
      const lightTheme = md3Theme(seed, false)

      theme.themes.value.dark.colors = darkTheme.colors
      theme.themes.value.dark.variables = darkTheme.variables
      theme.themes.value.light.colors = lightTheme.colors
      theme.themes.value.light.variables = lightTheme.variables

      // 用 change() 而不是 theme.global.name.value = ...：
      // 后者在 Vuetify 4 已弃用，会打印 [Vuetify UPGRADE] 警告。
      // 未开启 transition 时 change() 内部同步生效，行为与直接赋值一致。
      void theme.change(dark ? 'dark' : 'light')
    },
    { immediate: true },
  )
}
