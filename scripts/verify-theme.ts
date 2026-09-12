/**
 * MD3 主题校验脚本
 *
 * 覆盖 MD3 最核心的承诺：角色色由色调板派生，因此对比度应由规范保证，
 * 而不是靠人手试色——这正是原 MD2 配色做不到、且确实不达标的地方。
 *
 * 运行：
 *   npx esbuild scripts/verify-theme.ts --bundle --format=esm --platform=node \
 *     --outfile=.theme-check.mjs && node .theme-check.mjs && rm .theme-check.mjs
 */
import { readFileSync } from 'node:fs'
import { Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities'
import { createTheme } from 'vuetify/lib/composables/theme.js'
import { DEFAULT_SEED, md3Colors, md3Theme } from '../src/theme/md3'

let failed = 0

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failed++
}

/** WCAG 相对亮度 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (hi + 0.05) / (lo + 0.05)
}

// Vuetify 的 BaseColors + OnColors：缺任何一个，createVuetify 的类型或组件样式就会出问题
const VUETIFY_REQUIRED = [
  'background', 'surface', 'primary', 'secondary', 'success', 'warning', 'error', 'info',
  'on-background', 'on-surface', 'on-primary', 'on-secondary', 'on-success', 'on-warning', 'on-error', 'on-info',
]

// Vuetify 组件内部实际消费的 --v-theme-* 变量（grep 自 vuetify/lib 得到），
// 漏掉这些不会报错，只会让组件样式静默取到空值
const CONSUMED_BY_COMPONENTS = [
  'surface', 'on-surface', 'surface-variant', 'on-surface-variant', 'surface-light',
  'on-surface-light', 'surface-bright', 'on-surface-bright', 'background', 'on-background',
  'primary', 'error', 'on-error',
]

// MD3 标志性角色：MD2 完全没有这些概念，是本次升级的核心
const MD3_SIGNATURE = [
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'primary-container', 'on-primary-container',
  'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest',
  'surface-dim', 'inverse-surface', 'inverse-on-surface', 'inverse-primary',
  'outline', 'outline-variant', 'scrim', 'shadow', 'surface-tint',
  'primary-fixed', 'primary-fixed-dim', 'on-primary-fixed-variant',
]

for (const dark of [true, false]) {
  const label = dark ? '深色' : '浅色'
  const colors = md3Colors(DEFAULT_SEED, dark)

  check(`${label}：Vuetify 必需角色齐全`, VUETIFY_REQUIRED.every(k => colors[k]))
  check(`${label}：组件消费的角色齐全`, CONSUMED_BY_COMPONENTS.every(k => colors[k]))
  check(`${label}：MD3 标志性角色齐全`, MD3_SIGNATURE.every(k => colors[k]))

  const missing = MD3_SIGNATURE.filter(k => !colors[k])
  if (missing.length) console.log(`    缺失：${missing.join(', ')}`)

  // MD3 的对比度由色调差保证，这里验证它真的成立
  check(
    `${label}：on-primary/primary 对比度 ≥ 4.5`,
    contrast(colors['on-primary'], colors.primary) >= 4.5,
    contrast(colors['on-primary'], colors.primary).toFixed(2),
  )
  check(
    `${label}：on-surface/surface 对比度 ≥ 4.5`,
    contrast(colors['on-surface'], colors.surface) >= 4.5,
    contrast(colors['on-surface'], colors.surface).toFixed(2),
  )
  check(
    `${label}：on-surface-variant/surface 对比度 ≥ 4.5`,
    contrast(colors['on-surface-variant'], colors.surface) >= 4.5,
    contrast(colors['on-surface-variant'], colors.surface).toFixed(2),
  )
  check(
    `${label}：on-primary-container/primary-container 对比度 ≥ 4.5`,
    contrast(colors['on-primary-container'], colors['primary-container']) >= 4.5,
    contrast(colors['on-primary-container'], colors['primary-container']).toFixed(2),
  )
  check(
    `${label}：surface-container 与 surface 有可辨层次`,
    colors['surface-container'] !== colors.surface,
    `${colors['surface-container']} vs ${colors.surface}`,
  )

  // 生成的值必须是合法 hex，否则 Vuetify 的 parseColor 会产出 NaN 变量
  const bad = Object.entries(colors).filter(([, v]) => !/^#[0-9a-f]{6}$/i.test(v))
  check(`${label}：全部 ${Object.keys(colors).length} 个值均为合法 hex`, bad.length === 0, bad.slice(0, 3).map(([k, v]) => `${k}=${v}`).join(' '))
}

// 动态取色的前提：换 seed 必须真的换掉整套配色
const teal = md3Colors('#009688', true)
const purple = md3Colors('#6750A4', true)
check('换 seed 会改变配色（动态取色的前提）', teal.primary !== purple.primary, `${teal.primary} vs ${purple.primary}`)
check('换 seed 后 on-primary 仍达标', contrast(purple['on-primary'], purple.primary) >= 4.5, contrast(purple['on-primary'], purple.primary).toFixed(2))

// ---------- 配色安全性：任意色相的 seed 都必须可读 ----------
// 动态取色的 seed 来自用户背景图，可能是任何色相。MD3 的价值正在于
// 对比度由色调差保证，因此这里遍历色相环做回归——只要这个断言成立，
// 「用户换一张图导致界面不可读」就不可能发生。
console.log()
console.log('=== 任意 seed 的配色安全性 ===')

const HUE_SAMPLES = 24
let worstPrimary = Infinity
let worstPrimaryAt = ''
let worstSurface = Infinity
let unreadable = 0

for (let i = 0; i < HUE_SAMPLES; i++) {
  const hue = (360 / HUE_SAMPLES) * i
  const seed = hexFromArgb(Hct.from(hue, 48, 50).toInt())

  for (const dark of [true, false]) {
    const c = md3Colors(seed, dark)
    const p = contrast(c['on-primary'], c.primary)
    const s = contrast(c['on-surface'], c.surface)
    if (p < worstPrimary) {
      worstPrimary = p
      worstPrimaryAt = `${seed} / ${dark ? 'dark' : 'light'}`
    }
    worstSurface = Math.min(worstSurface, s)
    if (p < 4.5) unreadable++
    if (s < 4.5) unreadable++
  }
}

check(
  `${HUE_SAMPLES} 个色相 × 明暗共 ${HUE_SAMPLES * 2} 套配色：正文对比度全部 ≥ 4.5`,
  unreadable === 0,
  `最差 on-primary ${worstPrimary.toFixed(2)} @ ${worstPrimaryAt}；最差 on-surface ${worstSurface.toFixed(2)}`,
)

// seed 来自图片，还可能是极端明暗或低饱和色
const EXTREME_SEEDS = ['#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
let extremeBad = 0
for (const seed of EXTREME_SEEDS) {
  for (const dark of [true, false]) {
    const c = md3Colors(seed, dark)
    if (contrast(c['on-primary'], c.primary) < 4.5) extremeBad++
    if (contrast(c['on-surface'], c.surface) < 4.5) extremeBad++
  }
}
check(`极端 seed（纯黑/纯白/灰/纯色）共 ${EXTREME_SEEDS.length * 2} 套仍可读`, extremeBad === 0, `不达标 ${extremeBad} 项`)

// 非法 seed 必须安全回退，不能让界面崩掉
const fallback = md3Colors('not-a-color', true)
check('非法 seed 回退到默认配色', fallback.primary === teal.primary)

// MD2 遗留键必须被覆盖掉，否则会残留 #1F5592 之类的旧蓝色
check('MD2 遗留变体键已覆盖为 MD3 值', teal['primary-darken-1'] === teal.primary, teal['primary-darken-1'])
check('surface-light 已映射（组件依赖）', teal['surface-light'] === teal['surface-container-high'])

// ---------- 防止 Vuetify 默认主题的 MD2 值泄漏 ----------
// Vuetify 的主题是 mergeDeep(defaults, options) 合并的，默认主题里硬编码的键不会消失。
// 若 md3Colors 没覆盖到，最终 CSS 里就会残留这些 MD2 颜色。
console.log()
console.log('=== Vuetify 默认主题键覆盖 ===')

const VUETIFY_DEFAULT_KEYS = [
  'background', 'surface', 'surface-bright', 'surface-light', 'surface-variant',
  'on-surface-variant', 'primary', 'primary-darken-1', 'secondary', 'secondary-darken-1',
  'error', 'info', 'success', 'warning',
]

// 摘自 vuetify/lib/composables/theme.js 的 genDefaults()
const VUETIFY_MD2_DEFAULTS: Record<string, string> = {
  '#1867c0': 'light primary', '#1f5592': 'light primary-darken-1',
  '#48a9a6': 'light secondary', '#018786': 'light secondary-darken-1',
  '#b00020': 'light error', '#121212': 'dark background', '#212121': 'dark surface',
  '#ccbfd6': 'dark surface-bright', '#424242': 'dark surface-light',
  '#c8c8c8': 'dark surface-variant', '#2196f3': 'primary/info', '#277cc1': 'dark primary-darken-1',
  '#54b6b2': 'dark secondary', '#cf6679': 'dark error', '#4caf50': 'success', '#fb8c00': 'warning',
}

for (const dark of [true, false]) {
  const label = dark ? '深色' : '浅色'
  const colors = md3Colors(DEFAULT_SEED, dark)

  const uncovered = VUETIFY_DEFAULT_KEYS.filter(k => !(k in colors))
  check(`${label}：覆盖 Vuetify 默认主题全部 ${VUETIFY_DEFAULT_KEYS.length} 个键`, uncovered.length === 0,
    uncovered.length ? `未覆盖: ${uncovered.join(', ')}` : '')

  const leaked = Object.entries(colors)
    .filter(([, v]) => VUETIFY_MD2_DEFAULTS[v.toLowerCase()])
    .map(([k, v]) => `${k}=${v}(${VUETIFY_MD2_DEFAULTS[v.toLowerCase()]})`)
  check(`${label}：无 MD2 默认色残留`, leaked.length === 0, leaked.slice(0, 4).join(' '))
}

// ---------- 设计令牌：高度 / 状态层 / 形状 ----------
console.log()
console.log('=== 设计令牌 ===')

const { colors: darkColors, variables: darkVars } = md3Theme(DEFAULT_SEED, true)
const { variables: lightVars } = md3Theme(DEFAULT_SEED, false)

// MD3 tonal elevation：抬升表面叠加 surface-tint，而不是中性黑白
check(
  'elevation-overlay-color = surface-tint（tonal elevation）',
  darkVars['elevation-overlay-color'] === darkColors['surface-tint'],
  String(darkVars['elevation-overlay-color']),
)
check(
  '明暗两侧 elevation 叠加色不同（随主题色调走）',
  darkVars['elevation-overlay-color'] !== lightVars['elevation-overlay-color'],
)

// MD3 规范：hover 8% / focus 10% / pressed 10% / dragged 16%
check(
  '状态层透明度为 MD3 规范值',
  darkVars['hover-opacity'] === 0.08 &&
    darkVars['focus-opacity'] === 0.1 &&
    darkVars['pressed-opacity'] === 0.1 &&
    darkVars['dragged-opacity'] === 0.16,
  `hover=${darkVars['hover-opacity']} pressed=${darkVars['pressed-opacity']}`,
)

// MD3 shape scale: 4 / 8 / 12 / 16 / 28
const SHAPE_TOKENS = ['shape-xs', 'shape-sm', 'shape-md', 'shape-lg', 'shape-xl']
check('shape scale 令牌齐全', SHAPE_TOKENS.every(k => k in darkVars))
check(
  'shape scale 严格递增',
  // 令牌值是 '4px' 这类字符串，必须 parseFloat，Number('4px') 会得到 NaN
  SHAPE_TOKENS.map(k => parseFloat(String(darkVars[k]))).every((v, i, arr) => i === 0 || arr[i - 1] < v),
  SHAPE_TOKENS.map(k => `${k}=${darkVars[k]}`).join(' '),
)

// ---------- 设计令牌：排版 ----------
// 脚本经 esbuild 打包后 import.meta.url 指向产物（node_modules/.cache/），
// 故用 cwd 解析源码路径——npm script 从项目根运行
const typoCss = readFileSync('src/styles/typography.css', 'utf8')

// 定义了却没人引用的令牌就是死代码
const declaredTokens = [...typoCss.matchAll(/^\s*(--v-type-[a-z-]+):/gm)].map(m => m[1])
const unusedTokens = declaredTokens.filter(name => !typoCss.includes(`var(${name})`))
check(
  `排版令牌全部被引用（共 ${declaredTokens.length} 个）`,
  unusedTokens.length === 0,
  unusedTokens.length ? `未引用: ${unusedTokens.join(', ')}` : '',
)

// Vuetify 4 已移除这些类，必须自补，否则项目里 8 处用法静默失效
const MD3_TYPE_CLASSES = [
  'text-h1', 'text-h2', 'text-h3', 'text-h4', 'text-h5', 'text-h6',
  'text-subtitle-1', 'text-subtitle-2', 'text-body-1', 'text-body-2',
  'text-caption', 'text-button', 'text-overline',
]
const missingClasses = MD3_TYPE_CLASSES.filter(c => !typoCss.includes(`.${c}`))
check(
  'Vuetify 兼容排版类齐全',
  missingClasses.length === 0,
  missingClasses.length ? `缺失: ${missingClasses.join(', ')}` : `${MD3_TYPE_CLASSES.length} 个`,
)

// ---------- 热更新机制（在 Node 内驱动 Vuetify theme，无需浏览器）----------
// Vuetify 的 theme 是响应式的：styles 是由 themes 派生的 computed。
// 这里直接驱动它，验证「改 colors / 切主题名 → CSS 变量重算」这条路径本身成立，
// 从而把"运行时切换能生效"从源码推断变成可复现的观测。
console.log()
console.log('=== 热更新机制 ===')

const theme = createTheme({
  defaultTheme: 'dark',
  variations: false,
  themes: {
    dark: { dark: true, ...md3Theme(DEFAULT_SEED, true) },
    light: { dark: false, ...md3Theme(DEFAULT_SEED, false) },
  },
})

/** 取 :root 块中当前生效主题的 primary（:root 始终是当前主题的值） */
function rootPrimary(css: string): string | undefined {
  const root = css.slice(css.indexOf(':root'), css.indexOf('.v-theme--'))
  return (root.match(/--v-theme-primary:\s*([^;]+)/) || [])[1]
}

const s0 = theme.styles.value
check('theme.styles 产出 CSS', s0.length > 10_000, `${s0.length} 字符`)
check('其中含 MD3 角色 primary-container', s0.includes('--v-theme-primary-container'))
check('其中含 MD3 令牌 elevation-overlay-color', s0.includes('--v-elevation-overlay-color'))
check('其中含 shape 令牌', s0.includes('--v-shape-lg'))
check('其中含状态层令牌', s0.includes('--v-hover-opacity'))

// 改 colors 必须触发重算——这是动态取色与主题切换共用的路径
theme.themes.value.dark.colors = md3Theme('#6750A4', true).colors
const s1 = theme.styles.value
check(
  '改 colors 触发 CSS 重算（热更新）',
  s0 !== s1 && rootPrimary(s0) !== rootPrimary(s1),
  `${rootPrimary(s0)} → ${rootPrimary(s1)}`,
)

// 切主题名必须换到另一套值
void theme.change('light')
const s2 = theme.styles.value
check('切主题名切换到浅色配色', rootPrimary(s2) !== rootPrimary(s1), `light primary = ${rootPrimary(s2)}`)

// tonal elevation 的叠加色必须跟着 seed 走
const tintA = md3Theme('#009688', true).variables['elevation-overlay-color']
const tintB = md3Theme('#6750A4', true).variables['elevation-overlay-color']
check('elevation 叠加色随 seed 变化', tintA !== tintB, `${tintA} → ${tintB}`)

console.log()
if (failed) {
  console.log(`❌ ${failed} 项未通过`)
  process.exit(1)
}
console.log('✅ 全部通过')
