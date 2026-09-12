/**
 * 图标存在性校验
 *
 * 背景：`@mdi/font` 里并不存在所有你在别处见过的 mdi-* 名字。用了不存在的名字，
 * Vuetify 不会报错、控制台不会警告、构建也不会失败——**图标只是渲染成空白**，
 * 表现为"按钮好像没加载出资源"，只能靠肉眼发现。本项目就先后踩到过两次
 * （`mdi-music-box-search`、`mdi-account-balance`）。
 *
 * 这个脚本把 src/ 里用到的所有 mdi-* 名字扫出来，逐个到字体 CSS 里核对。
 * 运行：npm run verify:icons
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const FONT_CSS = join(ROOT, 'node_modules/@mdi/font/css/materialdesignicons.css')
const EXTS = new Set(['.vue', '.ts', '.js', '.html'])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (EXTS.has(extname(p))) out.push(p)
  }
  return out
}

/** 收集 src/ 下所有 mdi-* 名字，记录首次出现的位置便于定位 */
const used = new Map()
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/mdi-[a-z0-9-]+/g)) {
    if (!used.has(m[0])) used.set(m[0], file.slice(ROOT.length))
  }
}

const css = readFileSync(FONT_CSS, 'utf8')
const missing = []
for (const [icon, where] of used) {
  if (!new RegExp(`\\.${icon}[,:{]`).test(css)) missing.push({ icon, where })
}

console.log(`已检查 ${used.size} 个图标（数据源：@mdi/font）`)

if (missing.length) {
  console.error(`\n❌ ${missing.length} 个图标在字体里不存在，会静默渲染成空白：`)
  for (const m of missing) console.error(`   ${m.icon}   首次出现于 ${m.where}`)
  console.error('\n请换成确实存在的图标名（可在 materialdesignicons.com 查），或先 grep 字体 CSS 确认。')
  process.exit(1)
}

console.log('✅ 全部图标都存在')
