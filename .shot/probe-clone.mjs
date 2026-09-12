// 诊断：@container 里给 .np-cover 的 max-width 到底有没有应用。
// 手法是把封面克隆一份、插进同一个容器里再读计算样式 ——
// 原元素可能因为页面已被渲染过而拿到陈旧的计算值，新插入的元素一定是最新计算。
// 用法：BIDI_PORT=xxxx node .shot/probe-clone.mjs
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
const evalIn = async (ctx, e) => {
  const r = await send('script.evaluate', {
    expression: e,
    target: { context: ctx },
    awaitPromise: false,
    resultOwnership: 'none',
  })
  if (!r || r.result === undefined) throw new Error('无结果: ' + JSON.stringify(r).slice(0, 200))
  return r.result.value
}

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', {
      context: ctx,
      viewport: { width: 375, height: 667 },
      devicePixelRatio: 1,
    })
    await send('browsingContext.navigate', {
      context: ctx,
      url: `${URL_}?t=${Date.now()}`,
      wait: 'complete',
    })
    await wait(4500)
    await evalIn(
      ctx,
      `(() => { const el = document.querySelector('.home-house-list .v-list-item'); if (el) el.click(); return 'ok' })()`,
    )
    await wait(7000)

    const out = await evalIn(
      ctx,
      `JSON.stringify((() => {
        const pane = document.querySelector('.pane-player')
        const np = document.querySelector('.now-playing')
        const cover = document.querySelector('.np-cover')

        // 克隆 A：插进同一个容器（应当受 @container 影响）
        const a = cover.cloneNode(true)
        a.style.position = 'absolute'
        a.style.visibility = 'hidden'
        pane.append(a)
        // 克隆 B：插到 body 下（没有 player 容器祖先，应当拿到基础值）
        const b = cover.cloneNode(true)
        b.style.position = 'absolute'
        b.style.visibility = 'hidden'
        document.body.append(b)

        const pr = pane.getBoundingClientRect()
        const res = {
          paneSize: [Math.round(pr.width), Math.round(pr.height)],
          paneContainer: getComputedStyle(pane).containerType + '/' + getComputedStyle(pane).containerName,
          origMaxWidth: getComputedStyle(cover).maxWidth,
          cloneInPaneMaxWidth: getComputedStyle(a).maxWidth,
          cloneInBodyMaxWidth: getComputedStyle(b).maxWidth,
          npVarOnNp: getComputedStyle(np).getPropertyValue('--np-cover').trim(),
          titleFontSize: getComputedStyle(document.querySelector('.np-meta__title')).fontSize,
          albumDisplay: (() => {
            const al = document.querySelector('.np-meta__album')
            return al ? getComputedStyle(al).display : '(无专辑)'
          })(),
          // 同一容器里，一个长度属性（max-width）和一个自定义属性（--np-gap）的对照
          npGapVar: getComputedStyle(np).getPropertyValue('--np-gap').trim(),
          coverWidthNow: Math.round(cover.getBoundingClientRect().width),
          cloneWidthNow: Math.round(a.getBoundingClientRect().width),
        }
        a.remove(); b.remove()
        return res
      })())`,
    )
    console.log(JSON.stringify(JSON.parse(out), null, 2))
    await send('session.end', {})
  } catch (e) {
    console.error('异常:', e.message)
    try {
      await send('session.end')
    } catch {
      /* 会话可能已失效 */
    }
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
