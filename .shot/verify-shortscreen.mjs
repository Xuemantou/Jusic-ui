// 短屏歌词可见性验证：
//   1) 容器查询按「窗格可用高度」选对了档位（矮屏要给歌词让出空间）
//   2) 正在播放这一格不该出现滚动条（一屏内没有第二屏内容）
//   3) 展开歌词后歌词区仍有若干行可见，且封面是正方形
//
// 关于环境：无头 Firefox 不会给「已经渲染过的元素」重算容器查询样式
// （实测同一个封面：页面上原有的元素 max-width 停在 260px，新插入的克隆是 160px），
// 所以布局类断言先做环境自检，不可信就明确跳过，而不是报成失败。
// 用法：BIDI_PORT=xxxx node .shot/verify-shortscreen.mjs
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
  if (!r || r.result === undefined) throw new Error('evaluate 无结果: ' + JSON.stringify(r).slice(0, 200))
  return r.result.value
}

const results = []
let skipped = 0
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`)
}

// 一行歌词的参考高度：.lyrics-line 是 padding 6+6 + body-1 行高 24 = 36px
const LINE_H = 36

// 环境探针，回答两个问题：
//   1) 容器查询按当前窗格高度选中的档位值是多少（用新插入的克隆读，它一定会被重算）
//   2) 这个环境会不会给「页面上原有的元素」重算容器查询样式
//      —— 做法是临时注入一条必然命中的 @container 规则，给 .now-playing 挂个类，
//      看原有元素的 max-width 会不会跟着变。不变就说明后面所有布局测量都不可信。
const ENV_PROBE = `JSON.stringify((() => {
  const pane = document.querySelector('.pane-player')
  const np = document.querySelector('.now-playing')
  const cover = document.querySelector('.np-cover')
  if (!pane || !np || !cover) return { ok: false, reason: 'NO_PANE' }

  const c = cover.cloneNode(true)
  c.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  pane.append(c)
  const cloneMw = getComputedStyle(c).maxWidth
  const origMw = getComputedStyle(cover).maxWidth
  const paneH = Math.round(pane.getBoundingClientRect().height)
  c.remove()

  const st = document.createElement('style')
  st.textContent = '@container player (max-height: 99999px){ .now-playing.env-probe-on .np-cover{ max-width: 7px } }'
  document.head.append(st)
  np.classList.add('env-probe-on')
  const afterAddClass = getComputedStyle(cover).maxWidth
  np.classList.remove('env-probe-on')
  st.remove()

  const expect = paneH > 680 ? '260px' : paneH > 520 ? '200px' : '160px'
  return { ok: true, paneH, cloneMw, origMw, afterAddClass, expect }
})())`

const DUMP = `JSON.stringify((() => {
  const body = document.querySelector('.now-playing')
  const cover = document.querySelector('.np-cover')
  const lyrics = document.querySelector('.np-lyrics')
  const lyricBody = document.querySelector('.np-lyrics__body')
  if (!body || !cover) return { err: 'NO_PANE' }
  const cs = getComputedStyle(body)
  const rect = (el) => (el ? el.getBoundingClientRect() : null)
  return {
    overflowY: cs.overflowY,
    scrollOver: Math.max(0, body.scrollHeight - body.clientHeight),
    bodyH: Math.round(rect(body).height),
    coverW: Math.round(rect(cover).width),
    coverH: Math.round(rect(cover).height),
    lyricsH: lyrics ? Math.round(rect(lyrics).height) : -1,
    lyricBodyH: lyricBody ? Math.round(rect(lyricBody).height) : -1,
    pageOver: Math.max(0, document.scrollingElement.scrollHeight - window.innerHeight),
  }
})())`

const VIEWPORTS = [
  { label: 'iPhone SE 375x667', w: 375, h: 667 },
  { label: '极矮 320x568', w: 320, h: 568 },
  { label: '窄屏宽裕 414x896', w: 414, h: 896 },
  { label: '宽屏 1440x900', w: 1440, h: 900 },
]

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context

    for (const vp of VIEWPORTS) {
      await send('browsingContext.setViewport', {
        context: ctx,
        viewport: { width: vp.w, height: vp.h },
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
        `(() => {
          const el = document.querySelector('.home-house-list .v-list-item')
          if (!el) return 'NO_ROOM'
          el.click(); return 'ENTERED'
        })()`,
      )
      if (entered !== 'ENTERED') {
        check(`${vp.label}: 进入房间`, false, entered)
        continue
      }
      await wait(7000)

      // ---- 规则类断言：不依赖已渲染元素的样式重算，任何环境都应通过 ----
      const env = JSON.parse(await evalIn(ctx, ENV_PROBE))
      if (!env.ok) {
        check(`${vp.label}: 找到播放窗格`, false, env.reason)
        continue
      }
      check(
        `${vp.label}: 窗格可用高 ${env.paneH}，容器查询选中 ${env.expect}`,
        env.cloneMw === env.expect,
        `新元素解出 ${env.cloneMw}`,
      )
      const reliable = env.afterAddClass === '7px'
      if (!reliable) {
        skipped += 4
        console.log(
          `       跳过 4 项布局断言：本环境不给已渲染元素重算容器查询样式` +
            `（给原有元素挂类后 max-width 仍是 ${env.afterAddClass}，应为 7px；` +
            `新插入的元素则能正确解出 ${env.cloneMw}）`,
        )
        continue
      }

      // ---- 布局类断言：只有环境确认可信时才测 ----
      const closed = JSON.parse(await evalIn(ctx, DUMP))
      check(
        `${vp.label}: 收起歌词时无滚动条（overflow-y=${closed.overflowY}）`,
        closed.overflowY === 'hidden' && closed.scrollOver === 0,
        `溢出=${closed.scrollOver}px 面板高=${closed.bodyH}`,
      )
      check(`${vp.label}: 歌词区收起时高度为 0`, closed.lyricsH <= 1, `${closed.lyricsH}px`)

      await evalIn(
        ctx,
        `(() => {
          const btn = [...document.querySelectorAll('.np-actions .v-btn')].find(b => (b.innerText || '').includes('歌词'))
          if (btn) btn.click(); return btn ? 'ok' : 'NO_BTN'
        })()`,
      )
      await wait(1200)
      const open = JSON.parse(await evalIn(ctx, DUMP))
      const lines = Math.floor(open.lyricBodyH / LINE_H)
      check(
        `${vp.label}: 展开后窗格无滚动条`,
        open.overflowY === 'hidden' && open.scrollOver === 0,
        `溢出=${open.scrollOver}px 面板高=${open.bodyH}`,
      )
      check(
        `${vp.label}: 歌词至少可见 3 行（实测 ${lines} 行 / ${open.lyricBodyH}px）`,
        open.lyricBodyH >= LINE_H * 3,
        `歌词区 ${open.lyricsH}px，封面 ${open.coverW}x${open.coverH}`,
      )
      check(
        `${vp.label}: 封面是正方形且已按档位收缩`,
        Math.abs(open.coverW - open.coverH) <= 1 && open.coverW > 0 && open.coverW < 260,
        `${open.coverW}x${open.coverH}`,
      )
      check(`${vp.label}: 页面整体不产生滚动`, open.pageOver === 0, `溢出=${open.pageOver}px`)
    }

    const errs = await evalIn(
      ctx,
      `JSON.stringify((window.__jusicErrors || []).filter(e => !/良性/.test(e)))`,
    )
    check('全程无 JS 错误', errs === '[]', errs)

    const failed = results.filter((x) => !x.ok)
    console.log(
      `\n结果：${results.length - failed.length}/${results.length} 通过` +
        (skipped ? `，跳过 ${skipped} 项（环境不重算样式）` : '') +
        (failed.length ? `，失败：${failed.map((f) => f.name).join('、')}` : ''),
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
}, 300000)
