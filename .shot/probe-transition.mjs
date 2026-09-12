// 最小实验：max-width 的过渡在"值来自 CSS 变量"和"字面值"两种写法下是否都可靠。
// 背景：封面收起时跳变，而这一轮恰好把封面的 max-width 从字面值改成了 var()。
// 用法：BIDI_PORT=xxxx node .shot/probe-transition.mjs
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

// A 组：max-width: var(--w)，靠切换 --w 驱动
// B 组：max-width 直接写字面值
// 两组从同一个宽度开始、同一个宽度结束，过渡参数相同。
const HTML = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 20px; display: flex; gap: 40px; background: #fff }
  .wrap { width: 320px }
  .box { width: 100%; aspect-ratio: 1; background: #4a90d9 }
  .a { --w: 260px; max-width: var(--w); transition: max-width .38s linear }
  .wrap.on .a { --w: 100px }
  .b { max-width: 260px; transition: max-width .38s linear }
  .wrap.on .b { max-width: 100px }
</style>
<div class="wrap" id="wa"><div class="box a"></div></div>
<div class="wrap" id="wb"><div class="box b"></div></div>`

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', {
      context: ctx,
      viewport: { width: 800, height: 500 },
      devicePixelRatio: 1,
    })
    await send('browsingContext.navigate', {
      context: ctx,
      url: 'data:text/html;charset=utf-8,' + encodeURIComponent(HTML),
      wait: 'complete',
    })
    await wait(800)

    // 先看起始值是否已经按变量解析出来
    const before = await evalIn(
      ctx,
      `JSON.stringify((() => {
        const a = document.querySelector('.a'), b = document.querySelector('.b')
        return {
          aW: Math.round(a.getBoundingClientRect().width),
          aMax: getComputedStyle(a).maxWidth,
          aVar: getComputedStyle(a).getPropertyValue('--w').trim(),
          bW: Math.round(b.getBoundingClientRect().width),
          bMax: getComputedStyle(b).maxWidth,
        }
      })())`,
    )
    console.log('切换前:', before)

    await evalIn(
      ctx,
      `(() => {
        window.__log = []
        const t0 = performance.now()
        const tick = () => {
          window.__log.push({
            t: Math.round(performance.now() - t0),
            a: Math.round(document.querySelector('.a').getBoundingClientRect().width),
            b: Math.round(document.querySelector('.b').getBoundingClientRect().width),
          })
          if (performance.now() - t0 < 700) requestAnimationFrame(tick)
        }
        document.getElementById('wa').classList.add('on')
        document.getElementById('wb').classList.add('on')
        requestAnimationFrame(tick)
        return 'ok'
      })()`,
    )
    await wait(1200)
    const log = JSON.parse(await evalIn(ctx, `JSON.stringify(window.__log)`))

    console.log('\n  时间   A(var驱动)   B(字面值)')
    for (const s of log) console.log(`${String(s.t).padStart(5)}ms ${String(s.a).padStart(10)} ${String(s.b).padStart(11)}`)

    const mid = (k) => log.filter((s) => s[k] > 101 && s[k] < 259).length
    console.log(
      `\nA(var) 中间帧 ${mid('a')} 帧 / 共 ${log.length} 帧，取值 ${[...new Set(log.map((s) => s.a))].join(',')}`,
    )
    console.log(
      `B(字面) 中间帧 ${mid('b')} 帧 / 共 ${log.length} 帧，取值 ${[...new Set(log.map((s) => s.b))].join(',')}`,
    )
    console.log(
      mid('a') > 1 && mid('b') > 1
        ? '结论：两种写法都有过渡，环境可信'
        : '结论：这个无头环境根本不跑该过渡（两种写法都只有首尾值），它的测量不可当证据',
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
}, 90000)
