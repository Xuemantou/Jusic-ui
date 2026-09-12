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

// 非法 seed 必须安全回退，不能让界面崩掉
const fallback = md3Colors('not-a-color', true)
check('非法 seed 回退到默认配色', fallback.primary === teal.primary)

// MD2 遗留键必须被覆盖掉，否则会残留 #1F5592 之类的旧蓝色
check('MD2 遗留变体键已覆盖为 MD3 值', teal['primary-darken-1'] === teal.primary, teal['primary-darken-1'])
check('surface-light 已映射（组件依赖）', teal['surface-light'] === teal['surface-container-high'])

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

console.log()
if (failed) {
  console.log(`❌ ${failed} 项未通过`)
  process.exit(1)
}
console.log('✅ 全部通过')
