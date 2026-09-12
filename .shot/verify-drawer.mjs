// 侧边栏（navigation drawer）内容验证：作者信息 / 链接 / 图片是否都换成了新的
// 用法：BIDI_PORT=xxxx node .shot/verify-drawer.mjs
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
  // BiDi 出错时可能没有 result 字段，直接 .result.value 会抛出难以定位的
  // "Cannot read properties of undefined"，这里显式暴露出来
  if (!r || r.result === undefined) {
    throw new Error('evaluate 无结果: ' + JSON.stringify(r).slice(0, 200))
  }
  return r.result.value
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`)
}

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    const tree = await send('browsingContext.getTree', {})
    const ctx = tree.contexts[0].context
    await send('browsingContext.setViewport', { context: ctx, viewport: { width: 1440, height: 900 }, devicePixelRatio: 1 })
    await send('browsingContext.navigate', { context: ctx, url: `${URL_}?t=${Date.now()}`, wait: 'complete' })
    await wait(4500)

    const entered = await evalIn(ctx, `(() => {
      const el = document.querySelector('.home-house-list .v-list-item')
      if (!el) return 'NO_ROOM'
      el.click(); return 'ENTERED'
    })()`)
    await wait(7000)
    check('进入房间', entered === 'ENTERED', entered)

    // 打开左侧抽屉
    await evalIn(ctx, `(() => { const b = document.querySelector('.v-app-bar-nav-icon'); if (b) b.click(); return 'ok' })()`)
    await wait(1800)

    const drawer = JSON.parse(await evalIn(ctx, `JSON.stringify((() => {
      const d = document.querySelector('.v-navigation-drawer')
      if (!d) return { found: false }
      const links = [...d.querySelectorAll('a.v-list-item')].map(a => ({
        title: (a.innerText || '').replace(/\\s+/g, ' ').trim(),
        href: a.getAttribute('href') || '',
      }))
      // v-img 渲染出来的真实 <img>：naturalWidth > 0 才算真的加载成功
      // （小图会被 Vite 内联成 data URI，此时 src 里没有文件名，故做区分显示）
      const imgs = [...d.querySelectorAll('img')].map(i => {
        const raw = i.getAttribute('src') || ''
        return {
          src: raw.startsWith('data:') ? '(内联)' : raw.split('/').pop(),
          w: i.naturalWidth,
          h: i.naturalHeight,
        }
      })
      return {
        found: true,
        text: (d.innerText || '').replace(/\\s+/g, ' ').trim(),
        links, imgs,
      }
    })())`))

    check('抽屉已打开', drawer.found === true)
    const t = drawer.text || ''

    check('作者名已改为 Xuemantou', t.includes('Xuemantou'), t.slice(0, 40))
    check('地点已移除', !t.includes('Quanzhou'), t.includes('Quanzhou') ? '仍含 Quanzhou' : '无地点')
    check('赞赏栏已移除', !t.includes('赞赏'), t.includes('赞赏') ? '仍含赞赏' : '无赞赏')

    const byTitle = (kw) => drawer.links.find((l) => l.title.includes(kw))
    const bili = byTitle('Bilibili')
    check('微博已改为 Bilibili 并指向正确', !!bili && bili.href === 'https://space.bilibili.com/12999146', bili ? bili.href : '未找到')
    const blog = byTitle('博客')
    check('博客指向 xuemantou.top', !!blog && blog.href.includes('xuemantou.top'), blog ? blog.href : '未找到')
    const gh = byTitle('Jusic-Serve-Houses')
    check(
      '开源指向新仓库',
      !!gh && gh.href === 'https://github.com/Xuemantou/Jusic-Serve-Houses',
      gh ? gh.href : '未找到',
    )
    check('已无微博/原仓库残留链接', !drawer.links.some((l) => /weibo|JumpAlang/i.test(l.href + l.title)), `${drawer.links.length} 个链接`)

    const badImg = (drawer.imgs || []).filter((i) => !i.w)
    check(
      '抽屉内图片全部加载成功（头像 / 配图）',
      (drawer.imgs || []).length >= 2 && badImg.length === 0,
      (drawer.imgs || []).map((i) => `${i.src}(${i.w}x${i.h})`).join(' ') || '无图片',
    )

    // B 站图标：形状用官方 favicon 的蒙版，但着色要与同区块的 mdi 图标一致
    // （同尺寸、同左边界、同前景色），否则一排图标里会出现一个彩色异类。
    const style = JSON.parse(await evalIn(ctx, `JSON.stringify((() => {
      const items = [...document.querySelectorAll('.v-navigation-drawer a.v-list-item')]
      const bili = items.find(a => (a.innerText || '').includes('Bilibili'))
      const blog = items.find(a => (a.innerText || '').includes('博客'))
      if (!bili || !blog) return { err: 'NOT_FOUND' }
      const mark = bili.querySelector('.md3-icon-bilibili')
      const mdi = blog.querySelector('.v-icon')
      if (!mark || !mdi) return { err: 'NO_ICON', mark: !!mark, mdi: !!mdi }
      const m = getComputedStyle(mark)
      const i = getComputedStyle(mdi)
      const mr = mark.getBoundingClientRect()
      const ir = mdi.getBoundingClientRect()
      // 两种颜色写法要归一化再比：mask 用 rgb()，mdi 图标可能是 color(srgb …)。
      // 刻意不用正则 —— 这里的字符串位于模板字符串中，\s / \d 会被 JS 当转义序列吃掉。
      const toRgb = (c) => {
        const s = String(c).trim()
        if (s.startsWith('color(srgb')) {
          const nums = s
            .replace('color(srgb', '')
            .replace(')', '')
            .trim()
            .split(' ')
            .filter(Boolean)
            .map(Number)
          return 'rgb(' + nums.slice(0, 3).map((x) => Math.round(x * 255)).join(', ') + ')'
        }
        return s
      }
      const appEl = document.querySelector('.v-application') || document.documentElement
      const root = getComputedStyle(appEl)
      const maskImg = m.maskImage || m.webkitMaskImage || ''
      return {
        hasMask: !!maskImg && maskImg !== 'none',
        markColor: toRgb(m.backgroundColor),
        mdiColor: toRgb(i.color),
        themeOnSurface: root.getPropertyValue('--v-theme-on-surface').trim(),
        themeOnSurfaceVariant: root.getPropertyValue('--v-theme-on-surface-variant').trim(),
        markW: Math.round(mr.width), mdiW: Math.round(ir.width),
        markX: Math.round(mr.x), mdiX: Math.round(ir.x),
        usesMdiGlyph: !!bili.querySelector('.mdi'),
        // 两个条目的标题文字左边界：图标间距若不一致，这里就能看出来
        biliTitleX: Math.round(bili.querySelector('.v-list-item-title')?.getBoundingClientRect().x ?? -999),
        blogTitleX: Math.round(blog.querySelector('.v-list-item-title')?.getBoundingClientRect().x ?? -999),
      }
    })())`))
    check(
      'B站图标用蒙版着色（非彩色位图、非 mdi 字形）',
      style.hasMask === true && style.usesMdiGlyph === false,
      style.err || `mask=${style.hasMask} mdi字形=${style.usesMdiGlyph}`,
    )
    check(
      'B站图标与同区 mdi 图标风格一致（同尺寸/同左对齐/同前景色）',
      style.markColor !== undefined &&
        style.markColor === style.mdiColor &&
        style.markW === style.mdiW &&
        style.markX === style.mdiX,
      `颜色 ${style.markColor} vs ${style.mdiColor} / 宽 ${style.markW} vs ${style.mdiW} / x ${style.markX} vs ${style.mdiX}`,
    )
    check(
      'B站条目的文字与其他条目左对齐（图标间距一致）',
      Number.isFinite(style.biliTitleX) &&
        Number.isFinite(style.blogTitleX) &&
        Math.abs(style.biliTitleX - style.blogTitleX) <= 1,
      `文字 x: Bilibili ${style.biliTitleX} vs 博客 ${style.blogTitleX}`,
    )

    const errs = await evalIn(ctx, `JSON.stringify((window.__jusicErrors || []).filter(e => !/良性/.test(e)))`)
    check('全程无 JS 错误', errs === '[]', errs)

    const failed = results.filter((x) => !x.ok)
    console.log(`\n结果：${results.length - failed.length}/${results.length} 通过` + (failed.length ? `，失败：${failed.map((f) => f.name).join('、')}` : ''))
    await send('session.end', {})
  } catch (e) {
    console.error('异常:', e.message)
    // 异常路径也要释放会话，否则下次直接报 "session not created"
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
  console.error('timeout')
  process.exit(1)
}, 150000)
