const ws = new WebSocket('ws://127.0.0.1:9222/session')
let id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result) } })
const wait = ms => new Promise(r => setTimeout(r, ms))
const evalIn = async (ctx, e) => (await send('script.evaluate', { expression: e, target: { context: ctx }, awaitPromise: false, resultOwnership: 'none' })).result.value

const DUMP = `JSON.stringify((() => {
  const out = []
  const sel = ['.v-app-bar', '.v-main', '.v-container', '.v-row', '.v-col',
    '.album-avatar', '.lyrics-container', '.chat-container', '.chat-content',
    '.v-table', '.v-card', '.v-btn', '.v-btn-toggle', '.v-text-field']
  for (const s of sel) {
    const els = [...document.querySelectorAll(s)]
    if (!els.length) continue
    const first = els[0]
    const r = first.getBoundingClientRect()
    const cs = getComputedStyle(first)
    out.push({ sel: s, n: els.length, box: [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
      radius: cs.borderRadius, bg: cs.backgroundColor, fs: cs.fontSize, pad: cs.padding })
  }
  return { vw: innerWidth, vh: innerHeight, shell: out,
    textSizes: (() => { const m = {}; document.querySelectorAll('*').forEach(el => { const t = (el.textContent||'').trim(); if (t && el.children.length === 0) { const fs = getComputedStyle(el).fontSize; m[fs] = (m[fs]||0)+1 } }); return m })() }
})())`

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 900 }, devicePixelRatio: 1 })
    await send('browsingContext.navigate', { context: ctx, url: `http://127.0.0.1:8080/?t=${Date.now()}`, wait: 'complete' })
    await wait(4500)
    await evalIn(ctx, `(() => { const c = document.querySelector('.home-page .v-chip'); if (c) c.click(); return 1 })()`)
    await wait(6500)
    const d = JSON.parse(await evalIn(ctx, DUMP))
    console.log(`视口 ${d.vw}x${d.vh}\n`)
    console.log('选择器                     个数         x     y     宽    高   圆角        背景')
    for (const s of d.shell) {
      const b = s.box
      console.log(`${s.sel.padEnd(18)} ${String(s.n).padStart(4)}  ${String(b[0]).padStart(5)} ${String(b[1]).padStart(5)} ${String(b[2]).padStart(5)} ${String(b[3]).padStart(5)}  ${s.radius.slice(0,9).padEnd(9)} ${s.bg}`)
    }
    console.log('\n字号分布（字号: 文本节点数）:', JSON.stringify(d.textSizes))
    await send('session.end', {})
  } catch (e) { console.error('失败:', e.message) }
  process.exit(0)
})
setTimeout(() => { console.error('timeout'); process.exit(1) }, 90000)
