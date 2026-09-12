// 交互入口冒烟测试：模板重排后逐个验证原有入口仍然接得上
// 用法：node .shot/smoke-ui.mjs
const URL_ = process.env.SHOT_URL || 'http://127.0.0.1:8080/'
// Firefox 的 BiDi 只允许一个活动会话，端口可覆盖以便另起实例
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
const evalIn = async (ctx, e) =>
  (await send('script.evaluate', { expression: e, target: { context: ctx }, awaitPromise: false, resultOwnership: 'none' })).result.value

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`)
}

/** 按可见文本找一个按钮并点击 */
const clickByText = (text, scope = 'body') => `(() => {
  const root = document.querySelector('${scope}') || document.body
  const els = [...root.querySelectorAll('button, .v-btn, .v-list-item, .v-chip')]
  const el = els.find(e => (e.innerText || '').trim().includes('${text}'))
  if (!el) return 'NOT_FOUND'
  el.click(); return 'CLICKED'
})()`

const escape = `(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return 'esc'
})()`

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', {
      context: ctx,
      viewport: { width: 1440, height: 900 },
      devicePixelRatio: 1,
    })
    await send('browsingContext.navigate', {
      context: ctx,
      url: `${URL_}?t=${Date.now()}`,
      wait: 'complete',
    })
    await wait(4500)

    // ---------- 1. 首页：创建房间 FAB → 对话框 ----------
    let r = await evalIn(ctx, `(() => {
      const fab = document.querySelector('.home-fab')
      if (!fab) return 'NO_FAB'
      fab.click(); return 'CLICKED'
    })()`)
    await wait(1200)
    let dlg = await evalIn(ctx, `JSON.stringify({
      open: !!document.querySelector('.v-overlay--active'),
      text: (document.querySelector('.v-overlay--active')?.innerText || '').replace(/\\s+/g, ' ').slice(0, 80),
      fields: document.querySelectorAll('.v-overlay--active .v-field').length,
    })`)
    let d = JSON.parse(dlg)
    check('首页 FAB 打开创建房间对话框', r === 'CLICKED' && d.open && d.text.includes('创建房间'), d.text)
    check('创建房间表单字段齐全（名称/描述/密码开关）', d.fields >= 2, `输入框 ${d.fields} 个`)
    await evalIn(ctx, escape)
    await wait(800)

    // ---------- 1b. 首页「下载 APP」→ 占位页（APP 尚未开发，且不再外链原作者） ----------
    r = await evalIn(ctx, `(() => {
      const b = document.querySelector('button[title="下载 APP"]')
      if (!b) return 'NO_BTN'
      b.click(); return 'CLICKED'
    })()`)
    await wait(1500)
    const dl = JSON.parse(await evalIn(ctx, `JSON.stringify({
      text: (() => {
        const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
        return (ds[ds.length - 1]?.innerText || '').replace(/\\s+/g, ' ').slice(0, 70)
      })(),
      legacyLink: document.body.innerHTML.includes('alang.run'),
    })`))
    check('「下载 APP」打开占位页', r === 'CLICKED' && dl.text.includes('开发中'), dl.text || r)
    check('页面已无原作者外链（tx.alang.run）', dl.legacyLink === false, dl.legacyLink ? '仍存在' : '已清除')
    await evalIn(ctx, escape)
    await wait(900)

    // ---------- 2. 进入房间 ----------
    r = await evalIn(ctx, `(() => {
      const el = document.querySelector('.home-house-list .v-list-item')
      if (!el) return 'NO_ROOM'
      el.click(); return 'ENTERED'
    })()`)
    check('首页房间项可点击进入', r === 'ENTERED', r)
    await wait(7000)

    let base = JSON.parse(await evalIn(ctx, `JSON.stringify({
      panes: document.querySelectorAll('.pane').length,
      player: !!document.querySelector('.pane-player'),
      queue: !!document.querySelector('.pane-queue'),
      chat: !!document.querySelector('.pane-chat'),
      queueItems: document.querySelectorAll('.queue-list .v-list-item').length,
      title: (document.querySelector('.np-meta__title')?.innerText || '').slice(0, 40),
    })`))
    check('三窗格渲染', base.panes === 3 && base.player && base.queue && base.chat, `pane=${base.panes}`)
    check('队列有数据且标题正确', base.queueItems > 0 && base.title.length > 0, `${base.queueItems} 首 / ${base.title}`)

    // ---------- 3. 播放窗格：歌词展开 ----------
    // 说明：这个 headless 环境不为「仅类名变化」重算样式（实测连内联 max-width 都不改变
    // offsetWidth），所以这里验证不到动画的视觉效果，只能验证两件能验证的事：
    //   ① DOM 状态确实切到了展开态；② 过渡所需的 CSS 规则确实存在且写对了。
    // 动画的观感需要在真实浏览器里确认。
    r = await evalIn(ctx, clickByText('歌词', '.np-actions'))
    await wait(1200)
    let lyr = JSON.parse(await evalIn(ctx, `JSON.stringify({
      open: !!document.querySelector('.np-lyrics'),
      bodyCls: document.querySelector('.now-playing')?.className || '',
      lyricsCls: document.querySelector('.np-lyrics')?.className || '',
      lyricCls: document.querySelector('.np-lyric')?.className || '',
    })`))
    check(
      '点击「歌词」后进入展开态（DOM 状态）',
      r === 'CLICKED' &&
        lyr.open &&
        lyr.bodyCls.includes('now-playing--lyrics') &&
        lyr.lyricsCls.includes('np-lyrics--open') &&
        lyr.lyricCls.includes('np-lyric--collapsed'),
      `${lyr.lyricsCls} / ${lyr.lyricCls}`,
    )

    const motion = JSON.parse(await evalIn(ctx, `JSON.stringify((() => {
      const rules = []
      for (const s of document.styleSheets) {
        try {
          for (const r of s.cssRules) {
            if (typeof r.selectorText === 'string') rules.push([r.selectorText, r.style.cssText || ''])
          }
        } catch { /* 跨域表忽略 */ }
      }
      const find = (frag) => (rules.find(([sel]) => sel.includes(frag)) || ['', ''])[1]
      const coverBase = find('.np-cover[')
      const coverCollapsed = find('.now-playing--lyrics .np-cover')
      const lyricsBase = find('.np-lyrics[')
      const lyricsOpen = find('.np-lyrics--open')
      const lyricCollapsed = find('.np-lyric--collapsed')
      const ambientBase = find('.np-ambient[')
      const ambientOpen = find('.now-playing--lyrics .np-ambient')
      return {
        coverTransitionsMaxWidth: /transition[^;]*max-width/.test(coverBase),
        coverCollapsedIsSmaller: /max-width:\\s*150px/.test(coverCollapsed),
        // 封面尺寸必须是字面长度：收起时靠 max-width 过渡推平，走 var() 中转会直接跳到终值
        coverWidthIsLiteral: /max-width:\\s*\\d+px/.test(coverBase) && !/max-width:\\s*var\\(/.test(coverBase + coverCollapsed),
        // 不参与 flex 压缩，否则空间不够时高度被压扁、封面变长方形。
        // 源码写的是 flex: none，但 CSSOM 会把简写序列化成等价的长写 0 0 auto，两种都要认。
        coverNotSquashed: /flex:\\s*(none|0 0 auto)/.test(coverBase),
        // 歌词区收起靠 flex: 0 1 0（basis 恒为 0）塌陷，展开靠 flex-grow
        lyricsBaseStartsCollapsed: /flex:\\s*0 1 0/.test(lyricsBase),
        lyricsNeverFallsBackToContentHeight: !/flex:\\s*[01] \\d auto/.test(lyricsBase),
        lyricsOpenExpands: /flex-grow:\\s*1/.test(lyricsOpen),
        lyricsBaseHasTransition: /transition[^;]*flex-grow/.test(lyricsBase),
        lyricCollapsedZeroRow: /grid-template-rows:\\s*0fr/.test(lyricCollapsed),
        ambientBlurred: /blur/.test(ambientBase),
        ambientExpandsOnOpen: /opacity:\\s*1/.test(ambientOpen) && /scale/.test(ambientOpen),
      }
    })())`))
    const motionOk = Object.values(motion).every(Boolean)
    check(
      '展开/收起所需的过渡规则齐备（封面收缩 + 歌词滑出 + 氛围扩散）',
      motionOk,
      Object.entries(motion).filter(([, v]) => !v).map(([k]) => k).join('、') || `${Object.keys(motion).length} 项规则齐全`,
    )

    // 氛围背景层：展开歌词时封面扩散成模糊底，铺在信息栏后面
    const ambient = JSON.parse(await evalIn(ctx, `JSON.stringify((() => {
      const el = document.querySelector('.np-ambient')
      if (!el) return { exists: false }
      const cs = getComputedStyle(el)
      const cover = document.querySelector('.np-cover')
      return {
        exists: true,
        hasBgImage: /background-image/.test(el.getAttribute('style') || ''),
        blurred: /blur/.test(cs.filter),
        ambientZ: cs.zIndex,
        contentZ: cover ? getComputedStyle(cover).zIndex : null,
      }
    })())`))
    check(
      '信息栏有封面氛围背景（且内容压在它之上）',
      ambient.exists &&
        ambient.hasBgImage &&
        ambient.blurred &&
        Number(ambient.contentZ) > Number(ambient.ambientZ),
      ambient.exists
        ? `封面图=${ambient.hasBgImage} 模糊=${ambient.blurred} 层级 内容/氛围=${ambient.contentZ}/${ambient.ambientZ}`
        : '未找到 .np-ambient',
    )

    // ---------- 4. 弹窗类入口 ----------
    // 统一走「先确认没有残留弹窗 → 点击 → 断言新弹窗内容含关键词」。
    // 只断言"有弹窗且文本非空"是不诚实的：上一个弹窗没关掉时会抓到残留内容而假通过
    // （Escape 在 Vuetify 弹窗的打开动画完成前可能被忽略，所以 scrim 点击 + Escape 双保险）。
    const closeAll = `(() => {
      const scrims = [...document.querySelectorAll('.v-overlay__scrim')]
      scrims.forEach(s => s.click())
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return scrims.length
    })()`
    const overlayText = `(document.querySelector('.v-overlay--active')?.innerText || '').replace(/\\s+/g,' ').slice(0, 70)`

    async function expectDialog(label, clickExpr, keywords) {
      await evalIn(ctx, closeAll)
      await wait(900)
      const leftover = await evalIn(ctx, `document.querySelectorAll('.v-overlay--active').length`)
      const clicked = await evalIn(ctx, clickExpr)
      await wait(1800)
      const text = await evalIn(ctx, overlayText)
      const matched = keywords.some((k) => text.includes(k))
      check(
        label,
        clicked === 'CLICKED' && leftover === 0 && matched,
        `${clicked}${leftover ? ` / 残留弹窗 ${leftover}` : ''} / ${text.slice(0, 46) || '（无弹窗）'}`,
      )
      await evalIn(ctx, closeAll)
      await wait(800)
    }

    await expectDialog(
      '队列头部「热歌榜」打开搜索弹窗',
      `(() => {
        const btns = [...document.querySelectorAll('.pane-queue .pane__head .v-btn')]
        if (btns.length < 3) return 'ONLY_' + btns.length
        btns[0].click(); return 'CLICKED'
      })()`,
      ['搜索音乐', '热歌榜'],
    )

    // ---------- 5. 队列项：收藏 ----------
    r = await evalIn(ctx, `(() => {
      const item = document.querySelector('.queue-list .v-list-item')
      if (!item) return 'NO_ITEM'
      const btns = [...item.querySelectorAll('.v-list-item__append .v-btn')]
      if (!btns.length) return 'NO_BTN'
      btns[btns.length - 1].click(); return 'CLICKED'
    })()`)
    await wait(800)
    let fav = await evalIn(ctx, `localStorage.getItem('collectMusic') || ''`)
    check('队列项收藏按钮写入本地收藏', r === 'CLICKED' && fav.length > 10, `${fav.length} 字节`)

    // ---------- 6. 聊天窗格：听歌房 + 工具行入口 ----------
    await expectDialog(
      '聊天窗格「听歌房」入口可用',
      `(() => {
        const el = [...document.querySelectorAll('.pane-chat button, .pane-chat .v-btn')]
          .find(e => (e.innerText || '').includes('听歌房'))
        if (!el) return 'NOT_FOUND'
        el.click(); return 'CLICKED'
      })()`,
      ['隐藏空房', '房间密码', '创建房间'],
    )

    const tools = [
      ['搜索音乐', ['搜索音乐', '禁歌']],
      ['搜索歌单', ['搜索歌单']],
      ['搜索用户', ['搜索用户']],
      ['B站直播', ['B站']],
    ]
    for (const [title, keywords] of tools) {
      await expectDialog(
        `聊天工具「${title}」打开弹窗`,
        `(() => {
          const btn = document.querySelector('.chat-tools .v-btn[title="${title}"]')
          if (!btn) return 'NOT_FOUND'
          btn.click(); return 'CLICKED'
        })()`,
        keywords,
      )
    }

    // ---------- 7. 斗图入口应已彻底移除 ----------
    // 该功能已删除：后端转调的 api.doutub.com 域名易主（TLS 证书不匹配）、
    // 图床 tx.alang.run/doutu 全部返回 400，整条链路两端都不可用。
    const doutu = JSON.parse(await evalIn(ctx, `JSON.stringify({
      btn: !!document.querySelector('.chat-tools .v-btn[title="搜索图片"]'),
      icon: !!document.querySelector('.chat-tools .mdi-image-search'),
    })`))
    check(
      '斗图入口已移除',
      !doutu.btn && !doutu.icon,
      doutu.btn || doutu.icon ? '聊天工具行仍残留入口' : '聊天工具行已无「搜索图片」',
    )

    // ---------- 8. 普通聊天消息仍要正常上屏 ----------
    // 斗图删除动了 useSocket 的 CHAT 分支（原本在里面解析 picture: 前缀），
    // 这条用来确认普通文本消息没有被误伤。
    const NORMAL_MSG = 'smoke-' + Date.now()
    await evalIn(ctx, `(() => {
      const input = document.querySelector('.chat-input__field input')
      if (!input) return 'NO_INPUT'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(NORMAL_MSG)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return 'TYPED'
    })()`)
    await wait(600)
    const sendClicked = await evalIn(ctx, `(() => {
      const btn = document.querySelector('.chat-input__row .v-btn[title="发送"]')
      if (!btn) return 'NO_SEND_BTN'
      btn.click(); return 'CLICKED'
    })()`)
    await wait(3500)
    const echoed = await evalIn(ctx, `(document.querySelector('.chat-container')?.innerText || '').includes(${JSON.stringify(NORMAL_MSG)})`)
    check('删除斗图后普通聊天仍正常上屏', sendClicked === 'CLICKED' && echoed === true, `发送=${sendClicked} 回显=${echoed}`)

    // ---------- 9. 聊天工具行的图标都真的渲染出了内容 ----------
    // 用了 @mdi/font 里不存在的图标名时，Vuetify 不报错、控制台不警告、构建也能过，
    // 图标只是渲染成空白（看起来像"资源没加载出来"）。
    // 图标来源现在有两种：mdi 字体字形（::before 有 content）或品牌蒙版（mask-image 非空）。
    // 只检查真正带 title 的图标按钮：v-btn-toggle 里的「网易/QQ/咪咕」是文字按钮，
    // 它们没有 .v-icon，不排除掉会把断言误判成"图标空白"。
    const icons = JSON.parse(await evalIn(ctx, `JSON.stringify(
      [...document.querySelectorAll('.chat-tools .v-btn')]
        .filter(b => b.getAttribute('title'))
        .map(b => {
          const ic = b.querySelector('.v-icon')
          if (!ic) return { title: b.getAttribute('title'), glyph: false, via: 'no-v-icon' }
          const cs = getComputedStyle(ic)
          const content = getComputedStyle(ic, '::before').content
          const hasGlyph = !!content && content !== 'none' && content !== '""' && content !== 'normal'
          const maskImg = cs.maskImage || cs.webkitMaskImage || ''
          const hasMask = !!maskImg && maskImg !== 'none'
          return {
            title: b.getAttribute('title'),
            glyph: hasGlyph || hasMask,
            via: hasGlyph ? 'mdi' : hasMask ? 'mask' : 'none',
          }
        })
    )`))
    const blank = icons.filter((i) => !i.glyph)
    check(
      '聊天工具行图标均有内容（无静默空白）',
      icons.length >= 5 && blank.length === 0,
      blank.length
        ? `空白图标: ${blank.map((b) => b.title).join('、')}`
        : icons.map((i) => `${i.title}=${i.via}`).join(' '),
    )
    const biliBtn = icons.find((i) => i.title === 'B站直播')
    check('B站直播按钮已改用品牌蒙版图标', biliBtn?.via === 'mask', `B站直播=${biliBtn?.via || '未找到'}`)

    // ---------- 10. 搜索弹窗的音源已移除「禁歌」 ----------
    // 李志歌单（lz）已整体删除：入口、后端搜索分支、兜底逻辑与数据文件
    await evalIn(ctx, closeAll)
    await wait(900)
    await evalIn(ctx, `(() => {
      const btn = document.querySelector('.chat-tools .v-btn[title="搜索音乐"]')
      if (btn) btn.click(); return 'ok'
    })()`)
    await wait(1800)
    const sources = await evalIn(ctx, `(() => {
      const ds = [...document.querySelectorAll('.v-overlay--active')].filter(o => !o.classList.contains('v-snackbar'))
      const root = ds[ds.length - 1]
      return [...(root?.querySelectorAll('.v-btn-toggle .v-btn') || [])].map(b => (b.innerText || '').trim()).join('/')
    })()`)
    check(
      '搜索弹窗已移除「禁歌」音源',
      !!sources && !sources.includes('禁歌'),
      sources ? `音源: ${sources}` : '未取到音源按钮',
    )
    await evalIn(ctx, closeAll)
    await wait(800)

    // ---------- 10b. 音量滑块与滚动条 ----------
    // 滑块几何可以实测（位置/尺寸是布局结果，不依赖运行时样式变更）
    const slider = JSON.parse(await evalIn(ctx, `JSON.stringify((() => {
      const s = document.querySelector('.md3-slider')
      const thumb = s?.querySelector('.v-slider-thumb__surface')
      const track = s?.querySelector('.v-slider-track')
      const inp = s?.querySelector('[role="slider"]')
      if (!thumb || !track) return { err: 'NOT_FOUND' }
      const tr = track.getBoundingClientRect()
      const th = thumb.getBoundingClientRect()
      const val = Number(inp?.getAttribute('aria-valuenow') ?? -1)
      return {
        thumbW: Math.round(th.width), thumbH: Math.round(th.height),
        offBy: Math.round(((th.x + th.width / 2) - (tr.x + (val / 100) * tr.width)) * 10) / 10,
        beforeDisplay: getComputedStyle(thumb, '::before').display,
      }
    })())`))
    check(
      '音量滑块手柄与取值位置对齐（不再偏心）',
      !slider.err && slider.thumbW === 4 && Math.abs(slider.offBy) <= 1,
      slider.err ? slider.err : `手柄 ${slider.thumbW}x${slider.thumbH}，中心偏差 ${slider.offBy}px`,
    )
    check('滑块状态层圆点已移除', slider.beforeDisplay === 'none', `::before display=${slider.beforeDisplay}`)

    // 滚动条：无头环境不重算运行时样式，这里校验规则确实写对了
    const scrollRules = JSON.parse(await evalIn(ctx, `JSON.stringify((() => {
      const rules = []
      for (const s of document.styleSheets) {
        try { for (const r of s.cssRules) { if (typeof r.selectorText === 'string') rules.push([r.selectorText, r.style.cssText || '']) } } catch { /* 跨域表忽略 */ }
      }
      const find = (frag) => (rules.find(([sel]) => sel.includes(frag)) || ['', ''])[1]
      return {
        // 压缩器会把 overflow-x/y 合并成 "overflow: hidden auto"，两种写法都要认
        // 注意：本段代码位于模板字符串内，注释里绝对不能用反引号，否则会提前结束字符串
        paneBodyHidesX: /overflow(-x)?:\\s*hidden/.test(find('.pane__body[')),
        lyricsHidesX: /overflow(-x)?:\\s*hidden/.test(find('.lyrics-container[')),
        lyricsOpenGrows: /flex-grow:\\s*1/.test(find('.np-lyrics--open')),
      }
    })())`))
    check(
      '只保留歌词区一根竖向滚动条（横向已显式隐藏）',
      Object.values(scrollRules).every(Boolean),
      Object.entries(scrollRules).filter(([, v]) => !v).map(([k]) => k).join('、') || '3 项规则齐全',
    )

    // ---------- 11. 投票切歌 + 无异常 ----------
    r = await evalIn(ctx, `(() => {
      const btn = document.querySelector('.pane-player .v-btn')
      const vote = [...document.querySelectorAll('.pane-player .v-btn')].find(b => (b.innerText||'').includes('投票切歌'))
      if (!vote) return 'NOT_FOUND'
      vote.click(); return 'CLICKED'
    })()`)
    await wait(1500)
    const toastText = await evalIn(ctx, `(document.querySelector('.v-snackbar')?.innerText || '').replace(/\\s+/g,' ').slice(0, 40)`)
    check('播放窗格「投票切歌」触发反馈', r === 'CLICKED', toastText || r)

    const errs = await evalIn(ctx, `JSON.stringify((window.__jusicErrors || []).filter(e => !/良性/.test(e)))`)
    check('全程无 JS 错误', errs === '[]', errs)

    // ---------- 12. 浅色主题 ----------
    await evalIn(ctx, `localStorage.setItem('JUSIC_THEME_MODE','light');'ok'`)
    await send('browsingContext.navigate', {
      context: ctx,
      url: `${URL_}?t=${Date.now()}`,
      wait: 'complete',
    })
    await wait(4500)
    await evalIn(ctx, `(() => { const el = document.querySelector('.home-house-list .v-list-item'); if (el) el.click(); return 'ok' })()`)
    await wait(6500)
    const light = JSON.parse(await evalIn(ctx, `JSON.stringify({
      bg: getComputedStyle(document.querySelector('.pane')).backgroundColor,
      color: getComputedStyle(document.body).color,
      panes: document.querySelectorAll('.pane').length,
      queueItems: document.querySelectorAll('.queue-list .v-list-item').length,
      errors: (window.__jusicErrors || []).filter(e => !/良性/.test(e)),
    })`))
    // 浅色主题下 pane 背景必须是亮色（RGB 均值明显高于深色）
    const m = light.bg.match(/[\d.]+/g) || []
    const lum = m.length >= 3 ? (+m[0] + +m[1] + +m[2]) / 3 : 0
    check('浅色主题下窗格背景为亮色', lum > 180, `${light.bg} → 亮度 ${Math.round(lum)}`)
    check('浅色主题下三窗格仍在位', light.panes === 3 && light.queueItems > 0, `pane=${light.panes}, 队列 ${light.queueItems}`)
    await evalIn(ctx, `localStorage.setItem('JUSIC_THEME_MODE','dark');'ok'`)

    const failed = results.filter((x) => !x.ok)
    console.log(`\n结果：${results.length - failed.length}/${results.length} 通过` + (failed.length ? `，失败：${failed.map(f => f.name).join('、')}` : ''))
    await send('session.end', {})
  } catch (e) {
    console.error('异常:', e.message)
  }
  process.exit(0)
})
// 超时也必须结束 BiDi 会话，否则会话会一直占着（Firefox 只允许一个），
// 下一次运行会直接报 "Maximum number of active sessions"。
setTimeout(async () => {
  try {
    await send('session.end')
  } catch {
    /* 会话已失效时忽略 */
  }
  console.error('timeout')
  process.exit(1)
}, 240000)
