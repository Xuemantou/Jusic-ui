// 截图当前 dev server 页面（可指定视口尺寸）
const URL_ = process.env.SHOT_URL || 'http://127.0.0.1:8080/'
const OUT = process.env.SHOT_OUT || '.shot/home.png'
const W = Number(process.env.SHOT_W || 1280)
const H = Number(process.env.SHOT_H || 900)
const THEME = process.env.SHOT_THEME || 'dark'

const ws = new WebSocket('ws://127.0.0.1:9222/session')
let id = 0
const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej })
  ws.send(JSON.stringify({ id: i, method: m, params: p }))
})
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result) }
})
const wait = ms => new Promise(r => setTimeout(r, ms))
const evalIn = async (ctx, expr) => {
  const r = await send('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: false, resultOwnership: 'none' })
  return r.result.value
}

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', { context: ctx, viewport: { width: W, height: H }, devicePixelRatio: 1 })
    await send('browsingContext.navigate', { context: ctx, url: `${URL_}${URL_.includes('?') ? '&' : '?'}t=${Date.now()}`, wait: 'complete' })
    await wait(2000)
    // 设定主题与配色来源
    await evalIn(ctx, `localStorage.setItem('JUSIC_THEME_MODE','${THEME}');localStorage.removeItem('JUSIC_THEME_SEED_SOURCE');localStorage.removeItem('JUSIC_THEME_BG_SEED');'ok'`)
    await send('browsingContext.navigate', { context: ctx, url: `${URL_}?t=${Date.now()}`, wait: 'complete' })
    await wait(4500)
    const info = await evalIn(ctx, `JSON.stringify({cls:document.querySelector('.v-application')?.className, text:(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,160)})`)
    const shot = await send('browsingContext.captureScreenshot', { context: ctx })
    const fs = await import('node:fs')
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'))
    console.log('已保存', OUT, '|', Math.round(shot.data.length * 3 / 4), '字节')
    console.log(info)
    await send('session.end', {})
  } catch (e) { console.error('失败:', e.message) }
  process.exit(0)
})
setTimeout(() => { console.error('timeout'); process.exit(1) }, 60000)
