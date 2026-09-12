const ws = new WebSocket('ws://127.0.0.1:9222/session')
let id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result) } })
const wait = ms => new Promise(r => setTimeout(r, ms))
const evalIn = async (ctx, e) => (await send('script.evaluate', { expression: e, target: { context: ctx }, awaitPromise: false, resultOwnership: 'none' })).result.value
ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 900 }, devicePixelRatio: 1 })
    await send('browsingContext.navigate', { context: ctx, url: 'http://127.0.0.1:8080/?t=' + Date.now(), wait: 'complete' })
    await wait(4500)
    await evalIn(ctx, `(() => { const c = document.querySelector('.home-page .v-chip'); if (c) c.click(); return 1 })()`)
    await wait(6500)
    const expr = `JSON.stringify((() => {
      const info = (el) => { if (!el) return null
        const cs = getComputedStyle(el); const b = el.getBoundingClientRect()
        return {
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
          box: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
          display: cs.display, dir: cs.flexDirection, flex: cs.flex,
          h: cs.height, minH: cs.minHeight, gap: cs.rowGap
        } }
      const panel = document.querySelector('.chat-panel')
      const col = document.querySelector('.chat-column')
      // 打印 chat-panel 的实际父链，确认 flex 上下文是谁
      const chain = []
      let n = panel
      for (let i = 0; i < 4 && n; i++) { chain.push(info(n)); n = n.parentElement }
      return { col: info(col), chain }
    })())`
    console.log(JSON.stringify(JSON.parse(await evalIn(ctx, expr)), null, 1))
    await send('session.end', {})
  } catch (e) { console.error('失败:', e.message) }
  process.exit(0)
})
setTimeout(() => { console.error('timeout'); process.exit(1) }, 90000)
