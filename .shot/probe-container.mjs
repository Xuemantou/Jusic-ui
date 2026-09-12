// 诊断：容器查询到底有没有生效（封面在展开态被压扁的直接原因）
// 用法：BIDI_PORT=xxxx node .shot/probe-container.mjs
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

const DIAG = `JSON.stringify((() => {
  const pane = document.querySelector('.pane-player')
  const np = document.querySelector('.now-playing')
  const cover = document.querySelector('.np-cover')
  const pcs = getComputedStyle(pane)
  const ncs = getComputedStyle(np)
  const ccs = getComputedStyle(cover)
  const pr = pane.getBoundingClientRect()
  const cr = cover.getBoundingClientRect()

  // 探针：造一个同名的容器 + 目标元素，分别用 range 语法和 max- 语法各写一条规则，
  // 看哪条被真的应用了（哪个颜色赢就是哪条生效）
  const probe = document.createElement('div')
  probe.style.cssText = 'container-type:size;container-name:probe;width:100px;height:100px;position:absolute;left:-9999px'
  const a = document.createElement('div'); a.className = 'probe-a'
  const b = document.createElement('div'); b.className = 'probe-b'
  probe.append(a, b)
  const st = document.createElement('style')
  st.textContent = [
    '@container probe (height<=500px){ .probe-a{ color: rgb(1, 2, 3) } }',
    '@container probe (max-height: 500px){ .probe-b{ color: rgb(4, 5, 6) } }',
  ].join('')
  document.head.append(st, probe)
  const rangeOk = getComputedStyle(a).color
  const maxOk = getComputedStyle(b).color
  probe.remove(); st.remove()

  return {
    ua: navigator.userAgent,
    supportsContainer: CSS.supports('container-type: size'),
    rangeSyntaxApplied: rangeOk,
    maxSyntaxApplied: maxOk,
    pane: {
      w: Math.round(pr.width), h: Math.round(pr.height),
      containerType: pcs.containerType, containerName: pcs.containerName,
    },
    vars: {
      cover: ncs.getPropertyValue('--np-cover').trim(),
      coverLyrics: ncs.getPropertyValue('--np-cover-lyrics').trim(),
      gap: ncs.getPropertyValue('--np-gap').trim(),
      album: ncs.getPropertyValue('--np-album').trim(),
    },
    cover: { w: Math.round(cr.width), h: Math.round(cr.height), maxWidth: ccs.maxWidth, flex: ccs.flex },
    lyricsH: Math.round(document.querySelector('.np-lyrics').getBoundingClientRect().height),

    // 变量到底在哪一层解析成了什么
    varsOnCover: {
      cover: ccs.getPropertyValue('--np-cover').trim(),
      coverLyrics: ccs.getPropertyValue('--np-cover-lyrics').trim(),
    },
    // 把所有会设置 max-width 且可能匹配封面的规则连同它的条件一起列出来
    cascade: (() => {
      const out = []
      const walk = (rs, cond) => {
        for (const r of rs) {
          if (r.cssRules && !r.selectorText) {
            walk(r.cssRules, cond + ' > ' + (r.conditionText || r.constructor.name))
            continue
          }
          if (!r.selectorText || !r.style || !r.style.maxWidth) continue
          let m
          try { m = cover.matches(r.selectorText) } catch (e) { m = 'BAD_SELECTOR' }
          out.push({ sel: r.selectorText, mw: r.style.maxWidth, cond, matches: m })
        }
      }
      for (const sh of document.styleSheets) {
        let list
        try { list = sh.cssRules } catch (e) { continue }
        walk(list, sh.href ? sh.href.split('/').pop() : 'inline')
      }
      return out
    })(),
  }
})())`

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

    console.log('【收起态】', await evalIn(ctx, DIAG))
    await evalIn(
      ctx,
      `(() => { const b = [...document.querySelectorAll('.np-actions .v-btn')].find(x => (x.innerText||'').includes('歌词')); b.click(); return 'ok' })()`,
    )
    await wait(1500)
    console.log('【展开态】', await evalIn(ctx, DIAG))
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
