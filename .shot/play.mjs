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
    await send('browsingContext.navigate', { context: ctx, url: `http://127.0.0.1:8080/?t=${Date.now()}`, wait: 'complete' })
    await wait(4500)
    // 点击第一个房间 chip 进入播放页
    const clicked = await evalIn(ctx, `(() => {
      const chip = document.querySelector('.home-page .v-chip')
      if (!chip) return 'NO_CHIP'
      chip.click(); return 'CLICKED'
    })()`)
    console.log('进入房间:', clicked)
    await wait(6000)
    const info = await evalIn(ctx, `JSON.stringify({
      cls: document.querySelector('.v-application')?.className,
      hasAppBar: !!document.querySelector('.v-app-bar'),
      hasPlayer: !!document.querySelector('.album-avatar'),
      bodyText: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 400)
    })`)
    console.log(info)
    const shot = await send('browsingContext.captureScreenshot', { context: ctx })
    const fs = await import('node:fs')
    fs.writeFileSync('.shot/play-dark.png', Buffer.from(shot.data, 'base64'))
    console.log('已保存 .shot/play-dark.png |', Math.round(shot.data.length*3/4), '字节')
    await send('session.end', {})
  } catch (e) { console.error('失败:', e.message) }
  process.exit(0)
})
setTimeout(() => { console.error('timeout'); process.exit(1) }, 90000)
