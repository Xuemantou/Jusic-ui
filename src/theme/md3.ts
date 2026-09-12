import {
  DynamicColor,
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities'

/**
 * Material You（Material Design 3）色彩系统
 *
 * 与 MD2 的根本差别：MD2 是手挑的一堆固定十六进制值（primary/secondary/accent…），
 * MD3 的颜色全部由**一个 seed color** 经 HCT（色相-色度-色调）色彩空间派生出的
 * tonal palette 生成，每个角色对应确定的 tone 值。由此：
 *   - 前景/背景对比度由色调差保证，不靠手工试色；
 *   - 明暗两套配色是同一色调板的两种映射，而非两套独立手选值；
 *   - 换一个 seed 就能得到一整套协调配色（Material You 动态取色）。
 */

/** camelCase → kebab-case。Vuetify 把 colors 的 key 原样拼成 `--v-theme-<key>`，故此处即最终变量名 */
const toKebab = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * MaterialDynamicColors 上挂载了全部 MD3 颜色角色（0.4.0 为 54 个）。
 * 直接枚举而非手写映射表：库新增角色时自动跟进，也不会漏掉任何一项。
 * 过滤掉 *PaletteKeyColor —— 那是调色板的锚点色，不是可用的界面角色。
 */
const ROLES = Object.entries(MaterialDynamicColors as unknown as Record<string, unknown>)
  .filter(
    (entry): entry is [string, DynamicColor] =>
      entry[1] instanceof DynamicColor && !entry[0].endsWith('PaletteKeyColor'),
  )
  .map(([key, role]) => [toKebab(key), role] as const)

/** 默认 seed：原项目品牌主色 teal */
export const DEFAULT_SEED = '#009688'

/**
 * Vuetify 内置语义色。MD3 规范只有 primary/secondary/tertiary/error 四组，
 * 但 Vuetify 组件（v-snackbar、v-alert 等）内部依赖 success/warning/info，
 * 故按 MD3 的同一套 tone 规则为它们生成配色，保证与主色协调。
 */
const EXTRA_SEEDS: Record<string, string> = {
  success: '#4CAF50',
  warning: '#FB8C00',
  info: '#2196F3',
}

/**
 * Vuetify 组件内部仍在消费的 MD2 遗留角色（例如 v-card 用了 --v-theme-surface-light），
 * MD3 规范里没有对应项。映射到语义最接近的 MD3 角色，否则组件会取到空值而样式塌掉。
 */
const LEGACY_ROLE_FALLBACK: Record<string, string> = {
  'surface-light': 'surface-container-high',
  'on-surface-light': 'on-surface',
  'on-surface-bright': 'on-surface',
}

/**
 * Vuetify 默认主题里硬编码的 MD2 变体键。theme 是深度合并的，删不掉这些 key，
 * 只能覆盖，否则会残留 #1F5592 之类的旧蓝色。MD3 没有「变体」概念，直接指向对应角色。
 */
const LEGACY_VARIANT_KEYS: Record<string, string> = {
  'primary-darken-1': 'primary',
  'secondary-darken-1': 'secondary',
  'primary-lighten-1': 'primary',
  'secondary-lighten-1': 'secondary',
}

/**
 * Vuetify 硬性要求的颜色角色（对应其内部的 BaseColors + OnColors）。
 * md3Colors 必然产出这些 key，但 Record<string, string> 无法向 TS 证明这一点，
 * 故显式声明，使返回值能直接赋给 Vuetify 的 colors 而无需 as 断言。
 * （Vuetify 的 Colors 接口未对外导出，只能靠结构化类型匹配。）
 */
type VuetifyRequiredRoles =
  | 'background'
  | 'surface'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'on-background'
  | 'on-surface'
  | 'on-primary'
  | 'on-secondary'
  | 'on-success'
  | 'on-warning'
  | 'on-error'
  | 'on-info'

export type Md3Colors = Record<string, string> & Record<VuetifyRequiredRoles, string>

/** 校验 seed 合法性，非法则回退默认值 */
function normalizeSeed(seed: string): string {
  return /^#?[0-9a-f]{6}$/i.test(seed.trim()) ? seed.trim() : DEFAULT_SEED
}

/**
 * 为一个补充语义色生成 MD3 风格的主色与前景色。
 * tone 取值与 SchemeTonalSpot 对 primary 的处理一致：深色模式 80 / 浅色模式 40，
 * 前景色取 20 / 100，从而保证与主题其余部分的对比度水准一致。
 */
function extraTones(seed: string, dark: boolean) {
  const src = Hct.fromInt(argbFromHex(seed))
  return {
    main: hexFromArgb(Hct.from(src.hue, src.chroma, dark ? 80 : 40).toInt()),
    on: hexFromArgb(Hct.from(src.hue, src.chroma, dark ? 20 : 100).toInt()),
  }
}

/**
 * 由 seed 生成一套完整的 MD3 颜色角色表。
 * @param seed 十六进制种子色（如 #009688）
 * @param dark 是否深色模式
 */
export function md3Colors(seed: string, dark: boolean): Md3Colors {
  const source = normalizeSeed(seed)
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(source)), dark, 0)

  const colors: Record<string, string> = {}
  for (const [key, role] of ROLES) {
    colors[key] = hexFromArgb(role.getArgb(scheme))
  }

  for (const [legacy, target] of Object.entries(LEGACY_ROLE_FALLBACK)) {
    colors[legacy] = colors[target]
  }
  for (const [legacy, target] of Object.entries(LEGACY_VARIANT_KEYS)) {
    colors[legacy] = colors[target]
  }

  for (const [name, hex] of Object.entries(EXTRA_SEEDS)) {
    const { main, on } = extraTones(hex, dark)
    colors[name] = main
    colors[`on-${name}`] = on
  }

  return colors as Md3Colors
}

/**
 * MD3 状态层与形状令牌。
 *
 * 这些走 Vuetify 的 theme.variables，渲染为 `--v-<key>`（注意不带 theme- 前缀）。
 * 状态层透明度取 MD3 规范值（hover 8% / focus 10% / pressed 10% / dragged 16%），
 * 而 Vuetify 默认是 MD2 的 4%/12%/16%，必须覆写。
 *
 * 形状采用 MD3 shape scale：4 / 8 / 12 / 16 / 28，供组件样式以 var(--v-shape-*) 消费。
 */
export function md3Variables(dark: boolean): Record<string, string | number> {
  return {
    // —— 状态层（MD3 state layer opacities）——
    'hover-opacity': 0.08,
    'focus-opacity': 0.1,
    'pressed-opacity': 0.1,
    'dragged-opacity': 0.16,
    'selected-opacity': 0.08,
    'activated-opacity': 0.1,
    // —— 形状（MD3 shape scale）——
    'shape-none': '0px',
    'shape-xs': '4px',
    'shape-sm': '8px',
    'shape-md': '12px',
    'shape-lg': '16px',
    'shape-xl': '28px',
    // —— MD3 的 disabled 内容不透明度 ——
    'disabled-opacity': dark ? 0.38 : 0.38,
  }
}
