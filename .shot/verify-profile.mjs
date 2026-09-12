// 个人设置持久化验证：设昵称/音源 → 刷新 → 仍生效 → 进房后昵称自动同步给服务器
// 用法：BIDI_PORT=xxxx node .shot/verify-profile.mjs
const URL_ = process.env.SHOT_URL || 'http://127.0.0.1:8888/'
const PORT = process.env.BIDI_PORT || '9222'
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/session`)
let id = 0
const pending = new Map()
const send = (m, p = {}) =>
  new Promise((res, rej) => {
    const i = ++id
    pending.set(i, { res, rej })
    ws.send(JSON.stringify({ id: i, method: m, params: p }))
  })
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result)
  }
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const evalIn = async (ctx, e) =>
  (await send('script.evaluate', { expression: e, target: { context: ctx }, awaitPromise: false, resultOwnership: 'none' })).result.value

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`)
}

const NICK = '__昵称持久化测试__'
const lastDialogText = `(() => {
  const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
  return (ds[ds.length - 1]?.innerText || '').replace(/\\s+/g, ' ').slice(0, 140)
})()`
const clickDialogButton = (text) => `(() => {
  const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
  const root = ds[ds.length - 1] || document
  const btn = [...root.querySelectorAll('button')].find(b => (b.innerText || '').includes(${JSON.stringify(text)}))
  if (!btn) return 'NOT_FOUND'
  btn.click(); return 'CLICKED'
})()`
const fillFirstInput = (value) => `(() => {
  const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
  const root = ds[ds.length - 1]
  const el = root?.querySelector('input')
  if (!el) return 'NO_INPUT'
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, ${JSON.stringify(value)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return 'OK'
})()`
const reload = async (ctx, ms = 4500) => {
  await send('browsingContext.navigate', { context: ctx, url: `${URL_}?t=${Date.now()}`, wait: 'complete' })
  await wait(ms)
}

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', { context: ctx, viewport: { width: 1440, height: 900 }, devicePixelRatio: 1 })

    // 从干净状态开始
    await reload(ctx)
    await evalIn(ctx, `localStorage.removeItem('USER_NAME');localStorage.removeItem('JUSIC_CHAT_SOURCE');'ok'`)
    await reload(ctx)

    // ---------- 1. 首页打开个人设置 ----------
    let r = await evalIn(ctx, `(() => { const b = document.querySelector('button[title="个人设置"]'); if (!b) return 'NO_BTN'; b.click(); return 'CLICKED' })()`)
    await wait(1500)
    let txt = await evalIn(ctx, lastDialogText)
    check('首页可以打开个人设置', r === 'CLICKED' && txt.includes('个人设置'), txt.slice(0, 50))
    check('面板含昵称与默认音源', txt.includes('昵称') && txt.includes('默认音源'), txt.slice(0, 80))

    // ---------- 2. 设置昵称 ----------
    r = await evalIn(ctx, fillFirstInput(NICK))
    await wait(400)
    r = await evalIn(ctx, clickDialogButton('保存'))
    await wait(1500)
    const savedName = await evalIn(ctx, `localStorage.getItem('USER_NAME') || ''`)
    check('昵称已写入本地存储', savedName === NICK, `USER_NAME=${savedName}`)

    // ---------- 3. 切换默认音源为 QQ ----------
    r = await evalIn(ctx, `(() => {
      const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
      const root = ds[ds.length - 1]
      const btn = [...(root?.querySelectorAll('.v-btn-toggle .v-btn') || [])].find(b => (b.innerText || '').trim() === 'QQ')
      if (!btn) return 'NOT_FOUND'
      btn.click(); return 'CLICKED'
    })()`)
    await wait(800)
    const savedSource = await evalIn(ctx, `localStorage.getItem('JUSIC_CHAT_SOURCE') || ''`)
    check('默认音源已写入本地存储', savedSource === 'qq', `JUSIC_CHAT_SOURCE=${savedSource}`)

    // ---------- 4. 刷新后仍然保留 ----------
    await reload(ctx)
    const afterReload = JSON.parse(await evalIn(ctx, `JSON.stringify({
      name: localStorage.getItem('USER_NAME') || '',
      source: localStorage.getItem('JUSIC_CHAT_SOURCE') || '',
    })`))
    check('刷新后昵称仍在', afterReload.name === NICK, afterReload.name)
    check('刷新后音源仍在', afterReload.source === 'qq', afterReload.source)

    // 打开面板确认回填
    await evalIn(ctx, `(() => { const b = document.querySelector('button[title="个人设置"]'); if (b) b.click(); return 'ok' })()`)
    await wait(1500)
    const filled = await evalIn(ctx, `(() => {
      const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
      const root = ds[ds.length - 1]
      return root?.querySelector('input')?.value || ''
    })()`)
    check('再次打开面板时昵称已回填', filled === NICK, filled)
    r = await evalIn(ctx, `(() => {
      const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
      const root = ds[ds.length - 1]
      const btn = root?.querySelector('.v-card-title button')
      if (btn) btn.click(); return 'CLOSED'
    })()`)
    await wait(1000)

    // ---------- 5. 进房后昵称自动同步给服务器 ----------
    r = await evalIn(ctx, `(() => {
      const el = document.querySelector('.home-house-list .v-list-item')
      if (!el) return 'NO_ROOM'
      el.click(); return 'ENTERED'
    })()`)
    await wait(7000)
    check('进入房间', r === 'ENTERED', r)

    // 发一条聊天，看别人（和自己）看到的昵称是不是设置过的那个
    const msg = 'profile-check-' + Date.now()
    await evalIn(ctx, `(() => {
      const input = document.querySelector('.chat-input__field input')
      if (!input) return 'NO_INPUT'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(msg)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return 'TYPED'
    })()`)
    await wait(600)
    await evalIn(ctx, `(() => { const b = document.querySelector('.chat-input__row .v-btn[title="发送"]'); if (b) b.click(); return 'ok' })()`)
    await wait(3500)
    const chatText = await evalIn(ctx, `(document.querySelector('.chat-container')?.innerText || '').replace(/\\s+/g, ' ')`)
    check('进房后昵称自动同步（聊天里显示设置过的昵称）', chatText.includes(NICK), chatText.slice(-90))

    // ---------- 6. 音源在聊天面板里也是 QQ ----------
    // Vuetify 4 的选中态类名是 v-btn--active（没有 --selected）
    const selected = await evalIn(ctx, `(() => {
      const btn = document.querySelector('.chat-tools .v-btn-toggle .v-btn--active')
      return (btn?.innerText || '').trim()
    })()`)
    check('聊天面板默认音源为 QQ', selected === 'QQ', `选中=${selected || '无'}`)

    const errs = await evalIn(ctx, `JSON.stringify((window.__jusicErrors || []).filter(e => !/良性/.test(e)))`)
    check('全程无 JS 错误', errs === '[]', errs)

    const failed = results.filter((x) => !x.ok)
    console.log(`\n结果：${results.length - failed.length}/${results.length} 通过` + (failed.length ? `，失败：${failed.map((f) => f.name).join('、')}` : ''))
    await send('session.end', {})
  } catch (e) {
    console.error('异常:', e.message)
  }
  process.exit(0)
})
setTimeout(async () => {
  try {
    await send('session.end')
  } catch {
    /* 忽略 */
  }
  console.error('timeout')
  process.exit(1)
}, 180000)
