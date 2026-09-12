// 诊断：收起歌词时封面为什么会"跳"。
// 逐帧记录封面尺寸和窗格溢出量，看跳变发生在哪一帧、跳的是什么量。
// 用法：BIDI_PORT=xxxx node .shot/probe-collapse.mjs
const URL_ = process.env.SHOT_URL || 'http://127.0.0.1:8888/'
const PORT = process.env.BIDI_PORT || '9222'
const W = Number(process.env.VP_W || 375)
const H = Number(process.env.VP_H || 667)
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

// 在页面内逐帧采样：BiDi 往返一次几十毫秒，抓不到跳变那一帧
const RECORD = (ms) => `(() => {
  const cover = document.querySelector('.np-cover')
  const body = document.querySelector('.now-playing')
  const lyrics = document.querySelector('.np-lyrics')
  const pane = document.querySelector('.pane-player')
  if (!cover || !body) return 'NO_EL'
  window.__samples = []
  const t0 = performance.now()
  const tick = () => {
    const r = cover.getBoundingClientRect()
    const lr = lyrics.getBoundingClientRect()
    window.__samples.push({
      t: Math.round(performance.now() - t0),
      cw: Math.round(r.width), ch: Math.round(r.height),
      lh: Math.round(lr.height),
      over: Math.max(0, body.scrollHeight - body.clientHeight),
      paneH: Math.round(pane.getBoundingClientRect().height),
    })
    if (performance.now() - t0 < ${ms}) requestAnimationFrame(tick)
  }
  const btn = [...document.querySelectorAll('.np-actions .v-btn')].find(b => (b.innerText || '').includes('歌词'))
  if (!btn) return 'NO_BTN'
  btn.click()
  requestAnimationFrame(tick)
  return 'RECORDING'
})()`

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', {
      context: ctx,
      viewport: { width: W, height: H },
      devicePixelRatio: 1,
    })
    await send('browsingContext.navigate', {
      context: ctx,
      url: `${URL_}?t=${Date.now()}`,
      wait: 'complete',
    })
    await wait(4500)
    const entered = await evalIn(
      ctx,
      `(() => { const el = document.querySelector('.home-house-list .v-list-item'); if (!el) return 'NO_ROOM'; el.click(); return 'ENTERED' })()`,
    )
    if (entered !== 'ENTERED') throw new Error('进房间失败: ' + entered)
    await wait(7000)

    // 先展开歌词，等动画彻底结束
    await evalIn(
      ctx,
      `(() => { const b = [...document.querySelectorAll('.np-actions .v-btn')].find(x => (x.innerText||'').includes('歌词')); b.click(); return 'ok' })()`,
    )
    await wait(1500)
    const open = await evalIn(
      ctx,
      `JSON.stringify((() => {
        const c = document.querySelector('.np-cover').getBoundingClientRect()
        const l = document.querySelector('.np-lyrics').getBoundingClientRect()
        return { cover: [Math.round(c.width), Math.round(c.height)], lyrics: Math.round(l.height) }
      })())`,
    )
    console.log(`视口 ${W}x${H}，展开稳定后：${open}`)

    // 收起，逐帧采样
    console.log('采样:', await evalIn(ctx, RECORD(900)))
    await wait(1600)
    const raw = await evalIn(ctx, `JSON.stringify(window.__samples)`)
    const samples = JSON.parse(raw)

    console.log('\n  时间  封面宽x高    歌词高   窗格溢出')
    for (const s of samples) {
      const flag = s.ch !== s.cw ? '  ← 封面被压扁' : s.over > 0 ? '  ← 溢出' : ''
      console.log(
        `${String(s.t).padStart(5)}ms  ${String(s.cw).padStart(4)}x${String(s.ch).padEnd(4)}  ${String(s.lh).padStart(6)}  ${String(s.over).padStart(8)}${flag}`,
      )
    }
    const first = samples[0]
    const last = samples[samples.length - 1]
    const maxOver = Math.max(...samples.map((s) => s.over))
    const squashed = samples.filter((s) => Math.abs(s.ch - s.cw) > 1).length
    console.log(
      `\n小结：起点封面 ${first.cw}x${first.ch} → 终点 ${last.cw}x${last.ch}；` +
        `峰值溢出 ${maxOver}px；被压扁的帧 ${squashed}/${samples.length}；共 ${samples.length} 帧`,
    )
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
