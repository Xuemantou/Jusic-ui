const ws = new WebSocket('ws://127.0.0.1:9222/session')
let id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result) } })
const wait = ms => new Promise(r => setTimeout(r, ms))
const evalIn = async (ctx, e) => (await send('script.evaluate', { expression: e, target: { context: ctx }, awaitPromise: false, resultOwnership: 'none' })).result.value

const DUMP = `JSON.stringify((() => {
  const list = []
  const walk = (el, depth) => {
    if (depth > 6) return
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && cs.display !== 'none') {
      const tag = el.tagName.toLowerCase()
      const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').filter(c => c && !c.startsWith('v-')).slice(0,3).join('.') : ''
      list.push({
        d: depth, t: tag, c: cls,
        box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        fs: cs.fontSize, fw: cs.fontWeight,
        pad: cs.padding, marg: cs.marginBottom,
        radius: cs.borderRadius,
        bg: cs.backgroundColor,
        color: cs.color,
      })
    }
    for (const ch of el.children) walk(ch, depth + 1)
  }
  walk(document.querySelector('.home-page') || document.body, 0)
  return { vw: innerWidth, vh: innerHeight, count: list.length, nodes: list.slice(0, 70) }
})())`

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 900 }, devicePixelRatio: 1 })
    await send('browsingContext.navigate', { context: ctx, url: `http://127.0.0.1:8080/?t=${Date.now()}`, wait: 'complete' })
    await wait(4500)
    const data = JSON.parse(await evalIn(ctx, DUMP))
    console.log(`视口 ${data.vw}x${data.vh}，可见元素 ${data.count} 个\n`)
    console.log('深度 元素                      x    y    宽   高   字号   圆角       背景')
    for (const n of data.nodes) {
      const b = n.box
      console.log(
        `${String(n.d).padStart(2)}  ${(n.t + (n.c ? '.' + n.c : '')).slice(0, 24).padEnd(24)} ${String(b[0]).padStart(4)} ${String(b[1]).padStart(4)} ${String(b[2]).padStart(4)} ${String(b[3]).padStart(4)}  ${n.fs.padStart(6)}  ${n.radius.slice(0, 10).padEnd(10)} ${n.bg}`)
    }
    await send('session.end', {})
  } catch (e) { console.error('失败:', e.message) }
  process.exit(0)
})
setTimeout(() => { console.error('timeout'); process.exit(1) }, 60000)
