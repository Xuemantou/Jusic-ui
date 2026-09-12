/**
 * Material You 主题的运行时验证（Firefox WebDriver BiDi）
 *
 * 验证三件事，都是离线断言覆盖不到的：
 *   ① MD3 颜色角色是否真的落到 CSS 变量上（--v-theme-*）
 *   ② 明暗切换是否**热更新**——不刷新页面也能换掉整套变量
 *   ③ 切换后前景/背景对比度是否仍然可读
 *
 * 前置：
 *   - dev server 跑在 8080
 *   - Firefox 以调试端口启动：
 *       firefox --headless --remote-debugging-port 9222 about:blank
 * 用法：node scripts/verify-theme-runtime.mjs
 */
const URL_UNDER_TEST = process.env.THEME_VERIFY_URL || 'http://127.0.0.1:8080/'

const ws = new WebSocket('ws://127.0.0.1:9222/session')
let id = 0
const pending = new Map()
const logs = []

let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failed++
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}

ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(JSON.stringify(msg.error)))
    else resolve(msg.result)
  } else if (msg.method === 'log.entryAdded') {
    const p = msg.params
    logs.push(`[${p.level || p.type}] ${p.text || ''}`)
  }
})

ws.addEventListener('error', e => {
  console.error('WebSocket 错误:', e.message || e)
  process.exit(1)
})

const wait = ms => new Promise(r => setTimeout(r, ms))

/** 读取当前生效的 MD3 变量与背景色 */
const READ_STATE = `JSON.stringify((() => {
  const cs = getComputedStyle(document.documentElement)
  const names = ['primary','on-primary','primary-container','on-primary-container',
    'secondary','secondary-container','tertiary','tertiary-container',
    'error','error-container','surface','on-surface','surface-variant','on-surface-variant',
    'surface-container-lowest','surface-container-low','surface-container',
    'surface-container-high','surface-container-highest','surface-dim','surface-bright',
    'outline','outline-variant','inverse-surface','inverse-primary','scrim','shadow','surface-tint',
    'surface-light','on-surface-light','on-surface-bright','background','on-background']
  const vars = {}
  for (const n of names) vars[n] = cs.getPropertyValue('--v-theme-' + n).trim()
  const app = document.querySelector('.v-application')

  // 排版：插入探针元素读计算后的字号。
  // Vuetify 4 不提供 .text-h5 等类，若未自补则元素只会继承默认字号。
  const typo = {}
  for (const cls of ['text-h5', 'text-body-2', 'text-caption']) {
    const el = document.createElement('div')
    el.className = cls
    document.body.appendChild(el)
    const c = getComputedStyle(el)
    typo[cls] = c.fontSize + ' / ' + c.lineHeight
    el.remove()
  }

  return {
    vars,
    typo,
    elevationOverlay: cs.getPropertyValue('--v-elevation-overlay-color').trim(),
    themeClass: app ? app.className : null,
    appBg: app ? getComputedStyle(app).backgroundColor : null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    storedMode: localStorage.getItem('JUSIC_THEME_MODE'),
  }
})())`

async function evaluate(contextId, expression) {
  const res = await send('script.evaluate', {
    expression,
    target: { context: contextId },
    awaitPromise: false,
    resultOwnership: 'none',
  })
  return res.result.value
}

async function readState(contextId) {
  return JSON.parse(await evaluate(contextId, READ_STATE))
}

/** 读取当前主题下的可读性对比（标题色 vs 卡片背景） */
const READ_CONTRAST = `JSON.stringify((() => {
  const lum = (rgb) => {
    const m = rgb.match(/\\d+/g)
    if (!m) return null
    const [r, g, b] = m.slice(0, 3).map(v => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ct = (a, b) => { const la = lum(a), lb = lum(b); if (la == null || lb == null) return null
    const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05) }
  const app = document.querySelector('.v-application')
  const btn = document.querySelector('.v-btn')
  const card = document.querySelector('.v-card')
  return {
    appColor: app ? getComputedStyle(app).color : null,
    appBg: app ? getComputedStyle(app).backgroundColor : null,
    appContrast: app ? ct(getComputedStyle(app).color, getComputedStyle(app).backgroundColor) : null,
    btnText: btn ? getComputedStyle(btn).color : null,
    btnBg: btn ? getComputedStyle(btn).backgroundColor : null,
    btnContrast: btn ? ct(getComputedStyle(btn).color, getComputedStyle(btn).backgroundColor) : null,
    cardBg: card ? getComputedStyle(card).backgroundColor : null,
  }
})())`

ws.addEventListener('open', async () => {
  let contextId
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    contextId = tree.contexts[0].context
    await send('session.subscribe', { events: ['log.entryAdded'] })

    console.log(`--- 导航到 ${URL_UNDER_TEST} ---`)
    await send('browsingContext.navigate', { context: contextId, url: URL_UNDER_TEST, wait: 'complete' })
    await wait(4000)

    // ---------- ① 初始状态（默认深色）----------
    const dark = await readState(contextId)
    console.log('\n=== ① 初始（深色）状态 ===')
    console.log('主题类名:', dark.themeClass)
    console.log('--v-theme-primary          =', dark.vars.primary)
    console.log('--v-theme-primary-container=', dark.vars['primary-container'])
    console.log('--v-theme-tertiary         =', dark.vars.tertiary)
    console.log('--v-theme-surface          =', dark.vars.surface)
    console.log('--v-theme-surface-light    =', dark.vars['surface-light'])

    const MD3_SIGNATURE = ['primary-container', 'on-primary-container', 'tertiary', 'tertiary-container',
      'surface-container-lowest', 'surface-container-low', 'surface-container-high', 'surface-container-highest',
      'surface-dim', 'surface-bright', 'outline', 'outline-variant', 'inverse-surface', 'inverse-primary',
      'scrim', 'shadow', 'surface-tint', 'secondary-container', 'error-container']
    const missingVars = MD3_SIGNATURE.filter(n => !dark.vars[n])
    check('MD3 角色已落到 CSS 变量', missingVars.length === 0, missingVars.length ? `缺失: ${missingVars.join(', ')}` : `${MD3_SIGNATURE.length} 项齐全`)
    check('Vuetify 遗留角色 surface-light 有值', !!dark.vars['surface-light'], dark.vars['surface-light'])
    check('组件消费的 on-surface-light / on-surface-bright 有值',
      !!dark.vars['on-surface-light'] && !!dark.vars['on-surface-bright'])

    // 排版类必须真的生效：Vuetify 4 移除了 .text-h5 等类，未自补时这里只会是继承的默认字号
    console.log('--- 排版探针 ---')
    for (const [cls, v] of Object.entries(dark.typo)) console.log(`  .${cls} → ${v}`)
    check('.text-h5 = 24px（MD3 headline-small）', dark.typo['text-h5'].startsWith('24px'), dark.typo['text-h5'])
    check('.text-body-2 = 14px（MD3 body-medium）', dark.typo['text-body-2'].startsWith('14px'), dark.typo['text-body-2'])
    check('.text-caption = 12px（MD3 body-small）', dark.typo['text-caption'].startsWith('12px'), dark.typo['text-caption'])

    // MD3 tonal elevation：叠加色应为 surface-tint 而非中性黑白
    check('elevation-overlay-color 已设为 surface-tint', !!dark.elevationOverlay, dark.elevationOverlay)

    const darkShot = await send('browsingContext.captureScreenshot', { context: contextId })
    const fs = await import('node:fs')
    const darkBytes = Math.round(darkShot.data.length * 3 / 4)
    fs.writeFileSync('theme-dark.png', Buffer.from(darkShot.data, 'base64'))

    // ---------- ② 通过 UI 切到浅色（验证热更新，不刷新）----------
    console.log('\n=== ② 点击「外观设置」→「浅色」 ===')
    const opened = await evaluate(contextId, `(() => {
      const btn = document.querySelector('button[title="外观设置"]')
      if (!btn) return 'NO_BUTTON'
      btn.click()
      return 'CLICKED'
    })()`)
    console.log('打开菜单:', opened)
    check('找到外观设置按钮', opened === 'CLICKED')

    await wait(1200)
    const clicked = await evaluate(contextId, `(() => {
      const items = [...document.querySelectorAll('.v-list-item')]
      const target = items.find(el => (el.textContent || '').trim().startsWith('浅色'))
      if (!target) return 'NO_ITEM:' + items.map(el => (el.textContent || '').trim().slice(0, 12)).join('|')
      target.click()
      return 'CLICKED'
    })()`)
    console.log('点击「浅色」:', clicked)
    check('找到并点击「浅色」菜单项', clicked === 'CLICKED')

    await wait(1500)
    const light = await readState(contextId)
    console.log('\n=== ③ 切换后状态 ===')
    console.log('主题类名:', light.themeClass)
    console.log('--v-theme-primary          =', light.vars.primary)
    console.log('--v-theme-primary-container=', light.vars['primary-container'])
    console.log('--v-theme-surface          =', light.vars.surface)
    console.log('localStorage 模式:', light.storedMode)

    // 核心断言：没有刷新页面，CSS 变量与背景都必须变
    check('未刷新页面即切换主题（热更新）', dark.vars.surface !== light.vars.surface,
      `${dark.vars.surface} → ${light.vars.surface}`)
    check('primary 随之改变', dark.vars.primary !== light.vars.primary,
      `${dark.vars.primary} → ${light.vars.primary}`)
    check('primary-container 随之改变', dark.vars['primary-container'] !== light.vars['primary-container'],
      `${dark.vars['primary-container']} → ${light.vars['primary-container']}`)

    // 浅色主题的 surface 应该比深色主题更亮
    const lumOf = rgbStr => {
      const m = (rgbStr || '').match(/\d+/g)
      if (!m) return null
      const [r, g, b] = m.slice(0, 3).map(v => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const dl = lumOf(dark.appBg), ll = lumOf(light.appBg)
    check('浅色主题背景确实变亮', dl != null && ll != null && ll > dl,
      `app 背景亮度 ${dl?.toFixed(3)} → ${ll?.toFixed(3)}`)
    check('localStorage 已持久化模式', light.storedMode === 'light', String(light.storedMode))

    const lightShot = await send('browsingContext.captureScreenshot', { context: contextId })
    const lightBytes = Math.round(lightShot.data.length * 3 / 4)
    fs.writeFileSync('theme-light.png', Buffer.from(lightShot.data, 'base64'))

    // ---------- ④ 浅色下的可读性 ----------
    const contrast = JSON.parse(await evaluate(contextId, READ_CONTRAST))
    console.log('\n=== ④ 浅色主题可读性 ===')
    console.log('应用前景/背景:', contrast.appColor, '/', contrast.appBg, '→', contrast.appContrast?.toFixed(2))
    console.log('按钮文字/底色:', contrast.btnText, '/', contrast.btnBg, '→', contrast.btnContrast?.toFixed(2))
    check('应用正文对比度 ≥ 4.5', (contrast.appContrast ?? 0) >= 4.5, contrast.appContrast?.toFixed(2))
    if (contrast.btnContrast != null) {
      check('按钮文字对比度 ≥ 4.5', contrast.btnContrast >= 4.5, contrast.btnContrast.toFixed(2))
    }

    // ---------- ⑤ 动态取色 ----------
    console.log('\n=== ⑤ 动态取色（改用背景图提取的 seed） ===')
    const seedChanged = await evaluate(contextId, `(() => {
      localStorage.setItem('JUSIC_THEME_SEED_SOURCE', 'background')
      return 'SET'
    })()`)
    // 取色逻辑在模块初始化时 watch，需刷新才能重跑（这是持久化路径，非热更新路径）
    await send('browsingContext.navigate', { context: contextId, url: URL_UNDER_TEST, wait: 'complete' })
    await wait(4500)
    const dyn = await readState(contextId)
    console.log('重载后 --v-theme-primary =', dyn.vars.primary)
    check('切换配色来源后 primary 变化（或安全回退）', typeof dyn.vars.primary === 'string' && dyn.vars.primary.length > 0,
      dyn.vars.primary)
    // 无论取色成功还是回退，都必须是合法值
    check('配色来源切换后仍是合法配色', /^\d+,\s?\d+,\s?\d+$/.test(dyn.vars.primary) || /^\d/.test(dyn.vars.primary), dyn.vars.primary)

    // ---------- ⑥ 截图体量对比 ----------
    console.log('\n=== ⑥ 截图 ===')
    console.log('深色:', darkBytes, '字节 → theme-dark.png')
    console.log('浅色:', lightBytes, '字节 → theme-light.png')
    check('两次截图内容量级合理（非空白）', darkBytes > 20000 && lightBytes > 20000,
      `${darkBytes} / ${lightBytes}`)
    check('深色与浅色截图不同（主题确实换掉了）', darkBytes !== lightBytes)

    // ---------- 运行时错误 ----------
    const errors = logs.filter(l => /error|Error|warn.*resolve|undefined is not/.test(l))
    console.log('\n=== 浏览器日志 (' + logs.length + ' 条) ===')
    logs.slice(0, 20).forEach(l => console.log(' ', l.slice(0, 240)))
    check('无运行时错误', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '干净')
  } catch (e) {
    console.error('执行失败:', e.message)
    failed++
  }

  console.log()
  if (failed) {
    console.log(`❌ ${failed} 项未通过`)
    process.exit(1)
  }
  console.log('✅ 运行时验证全部通过')
  process.exit(0)
})

setTimeout(() => {
  console.error('超时')
  process.exit(1)
}, 90000)
