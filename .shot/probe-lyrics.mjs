// 诊断：展开歌词后，封面为什么没有收缩、歌词区为什么没撑满
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

const DUMP = `JSON.stringify((() => {
  const body = document.querySelector('.now-playing')
  const cover = document.querySelector('.np-cover')
  const lyrics = document.querySelector('.np-lyrics')
  const lyricLine = document.querySelector('.np-lyric')
  const cs = el => el ? {
    w: Math.round(el.getBoundingClientRect().width),
    h: Math.round(el.getBoundingClientRect().height),
    maxW: getComputedStyle(el).maxWidth,
    maxH: getComputedStyle(el).maxHeight,
    inlineMaxH: el.style.maxHeight || '(无内联)',
    flex: getComputedStyle(el).flex,
  } : null
  return {
    bodyClasses: body ? body.className : '(找不到 .now-playing)',
    cover: cs(cover),
    lyrics: cs(lyrics),
    lyricLine: cs(lyricLine),
    // 歌词区的父层是谁：v-expand-transition 是否插入了额外元素
    lyricsParent: lyrics ? lyrics.parentElement.className : null,
  }
})())`

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', { context: ctx, viewport: { width: 1440, height: 900 }, devicePixelRatio: 1 })
    await send('browsingContext.navigate', { context: ctx, url: `${URL_}?t=${Date.now()}`, wait: 'complete' })
    await wait(4500)
    await evalIn(ctx, `(() => { const el = document.querySelector('.home-house-list .v-list-item'); if (el) el.click(); return 'ok' })()`)
    await wait(7000)

    console.log('=== 展开前 ===')
    console.log(await evalIn(ctx, DUMP))

    await evalIn(ctx, `(() => {
      const btn = [...document.querySelectorAll('.np-actions .v-btn')].find(b => (b.innerText || '').includes('歌词'))
      if (btn) btn.click(); return 'ok'
    })()`)

    for (const t of [400, 1200, 3000]) {
      await wait(t === 400 ? 400 : 800)
      console.log(`\n=== 点击后 ${t}ms ===`)
      console.log(await evalIn(ctx, DUMP))
    }

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
  process.exit(1)
}, 120000)
