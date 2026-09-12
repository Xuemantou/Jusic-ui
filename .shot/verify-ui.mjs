// UI 方案验证：宽屏三窗格 / 窄屏单窗格 + 底部导航 + mini player
// 用法：node .shot/verify-ui.mjs
const URL_ = process.env.SHOT_URL || 'http://127.0.0.1:8080/'
// Firefox 的 BiDi 只允许一个活动会话，端口可覆盖以便另起实例
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

const PROBE = `JSON.stringify((() => {
  const box = s => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor }
  }
  const q = s => !!document.querySelector(s)
  return {
    vw: innerWidth, vh: innerHeight,
    home: q('.home-page'), panes: q('.page-panes'),
    isWide: q('.page-panes--wide'),
    panePlayer: box('.pane-player'), paneQueue: box('.pane-queue'), paneChat: box('.pane-chat'),
    navbar: box('.md3-navbar'), mini: box('.mini-player'),
    navItems: document.querySelectorAll('.md3-nav-item').length,
    // MD3 指示器药丸：选中项的 .md3-nav-indicator 必须有实际背景色
    // （类名写成 .v-btn--selected 时它会永远是 transparent，且不报错）
    navPill: (() => {
      const el = document.querySelector('.md3-navbar .v-btn--active .md3-nav-indicator')
      return el ? getComputedStyle(el).backgroundColor : null
    })(),
    fabs: document.querySelectorAll('.v-fab').length,
    queueItems: document.querySelectorAll('.queue-list .v-list-item').length,
    playingHighlight: q('.v-list-item--playing'),
    chatInput: q('.chat-input__field'),
    homeList: q('.home-house-list'),
    // 作者抽屉是 temporary，关闭时必须移出屏幕，否则会盖住首个窗格
    drawer: (() => {
      const el = document.querySelector('.v-navigation-drawer')
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { x: Math.round(r.x), w: Math.round(r.width), visibility: cs.visibility }
    })(),
    formErrors: (window.__jusicErrors || []).filter(e => !/良性/.test(e)),
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 160),
  }
})())`

const fs = await import('node:fs')

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context

    // ---------------- 宽屏 ----------------
    await send('browsingContext.setViewport', {
      context: ctx,
      viewport: { width: 1440, height: 900 },
      devicePixelRatio: 1,
    })
    await send('browsingContext.navigate', {
      context: ctx,
      url: `${URL_}?t=${Date.now()}`,
      wait: 'complete',
    })
    await wait(4500)

    const home = JSON.parse(await evalIn(ctx, PROBE))
    console.log('【宽屏 1440 首页】', JSON.stringify({
      home: home.home, houseList: home.homeList, fabs: home.fabs, errors: home.formErrors,
    }))
    let shot = await send('browsingContext.captureScreenshot', { context: ctx })
    fs.writeFileSync('.shot/v2-home-wide.png', Buffer.from(shot.data, 'base64'))

    const clicked = await evalIn(ctx, `(() => {
      const el = document.querySelector('.home-house-list .v-list-item')
      if (!el) return 'NO_ROOM'
      el.click(); return 'ENTERED'
    })()`)
    console.log('进入房间:', clicked)
    await wait(7000)

    const wide = JSON.parse(await evalIn(ctx, PROBE))
    console.log('【宽屏播放页】', JSON.stringify(wide, null, 2))
    shot = await send('browsingContext.captureScreenshot', { context: ctx })
    fs.writeFileSync('.shot/v2-play-wide.png', Buffer.from(shot.data, 'base64'))

    // ---------------- 窄屏 ----------------
    // 直接以窄视口重新加载（模拟手机打开），而不是在宽屏基础上 resize：
    // Vuetify 的断点是 JS 计算的，CDP 改视口后要等 resize 事件回流，
    // 重新加载能让它从一开始就按窄屏初始化，验证的才是用户真实看到的样子。
    await send('browsingContext.setViewport', {
      context: ctx,
      viewport: { width: 420, height: 860 },
      devicePixelRatio: 1,
    })
    await send('browsingContext.navigate', {
      context: ctx,
      url: `${URL_}?t=${Date.now()}`,
      wait: 'complete',
    })
    await wait(4500)

    const nHome = JSON.parse(await evalIn(ctx, PROBE))
    console.log('【窄屏 420 首页】', JSON.stringify({
      home: nHome.home, houseList: nHome.homeList, fabs: nHome.fabs, errors: nHome.formErrors,
    }))

    const nClicked = await evalIn(ctx, `(() => {
      const el = document.querySelector('.home-house-list .v-list-item')
      if (!el) return 'NO_ROOM'
      el.click(); return 'ENTERED'
    })()`)
    console.log('窄屏进入房间:', nClicked)
    await wait(7000)

    const narrow = JSON.parse(await evalIn(ctx, PROBE))
    console.log('【窄屏播放页（player 窗格）】', JSON.stringify({
      isWide: narrow.isWide,
      player: narrow.panePlayer, queue: narrow.paneQueue, chat: narrow.paneChat,
      navbar: narrow.navbar, navItems: narrow.navItems, navPill: narrow.navPill, mini: narrow.mini,
      errors: narrow.formErrors,
    }, null, 2))
    shot = await send('browsingContext.captureScreenshot', { context: ctx })
    fs.writeFileSync('.shot/v2-play-narrow-player.png', Buffer.from(shot.data, 'base64'))

    // 切到「点歌队列」窗格
    await evalIn(ctx, `(() => {
      const btns = document.querySelectorAll('.md3-navbar .v-btn')
      if (btns[1]) { btns[1].click(); return 'ok' }
      return 'no-nav'
    })()`)
    await wait(900)
    const q1 = JSON.parse(await evalIn(ctx, PROBE))
    console.log('【窄屏 → 队列窗格】', JSON.stringify({
      player: q1.panePlayer, queue: q1.paneQueue, chat: q1.paneChat,
      queueItems: q1.queueItems, playingHighlight: q1.playingHighlight,
    }, null, 2))
    shot = await send('browsingContext.captureScreenshot', { context: ctx })
    fs.writeFileSync('.shot/v2-play-narrow-queue.png', Buffer.from(shot.data, 'base64'))

    // 切到「聊天」窗格
    await evalIn(ctx, `(() => {
      const btns = document.querySelectorAll('.md3-navbar .v-btn')
      if (btns[2]) { btns[2].click(); return 'ok' }
      return 'no-nav'
    })()`)
    await wait(900)
    const q2 = JSON.parse(await evalIn(ctx, PROBE))
    console.log('【窄屏 → 聊天窗格】', JSON.stringify({
      player: q2.panePlayer, queue: q2.paneQueue, chat: q2.paneChat, chatInput: q2.chatInput,
    }, null, 2))
    shot = await send('browsingContext.captureScreenshot', { context: ctx })
    fs.writeFileSync('.shot/v2-play-narrow-chat.png', Buffer.from(shot.data, 'base64'))

    await send('session.end', {})
  } catch (e) {
    console.error('失败:', e.message)
  }
  process.exit(0)
})
// 超时也必须结束 BiDi 会话，否则会话会一直占着（Firefox 只允许一个）
setTimeout(async () => {
  try {
    await send('session.end')
  } catch {
    /* 会话已失效时忽略 */
  }
  console.error('timeout')
  process.exit(1)
}, 120000)
