// 房间管理面板端到端验证：创建房间（带管理员密码）→ 打开管理面板 → 改名 → 保存
// 用法：BIDI_PORT=xxxx node .shot/verify-admin.mjs
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
const evalIn = async (ctx, e) =>
  (await send('script.evaluate', { expression: e, target: { context: ctx }, awaitPromise: false, resultOwnership: 'none' })).result.value

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`)
}

const ROOM_NAME = '__ui_admin_test__'
const NEW_NAME = '__ui_renamed__'
const ADMIN_PWD = 'uitest1234'

/** 给对话框里第 index 个输入框填值（原生 setter + input 事件，才能触发 v-model） */
const fillInput = (index, value) => `(() => {
  const dialogs = [...document.querySelectorAll('.v-overlay--active')]
  const dlg = dialogs[dialogs.length - 1]
  if (!dlg) return 'NO_DIALOG'
  const inputs = [...dlg.querySelectorAll('input')]
  const el = inputs[${index}]
  if (!el) return 'NO_INPUT_' + inputs.length
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, ${JSON.stringify(value)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return 'OK'
})()`

const clickByText = (text) => `(() => {
  const dialogs = [...document.querySelectorAll('.v-overlay--active')]
  const root = dialogs.length ? dialogs[dialogs.length - 1] : document
  const els = [...root.querySelectorAll('button, .v-btn')]
  const el = els.find(e => (e.innerText || '').trim() === ${JSON.stringify(text)})
                || els.find(e => (e.innerText || '').includes(${JSON.stringify(text)}))
  if (!el) return 'NOT_FOUND'
  el.click(); return 'CLICKED'
})()`

const activeDialogText = `(() => {
  const dialogs = [...document.querySelectorAll('.v-overlay--active')]
  const dlg = dialogs[dialogs.length - 1]
  return (dlg?.innerText || '').replace(/\\s+/g, ' ').slice(0, 200)
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
    await send('browsingContext.navigate', { context: ctx, url: `${URL_}?t=${Date.now()}`, wait: 'complete' })
    await wait(4500)

    // ---------- 1. 首页创建房间：先试不带密码 ----------
    let r = await evalIn(ctx, `(() => { const f = document.querySelector('.home-fab'); if (!f) return 'NO_FAB'; f.click(); return 'CLICKED' })()`)
    await wait(1500)
    check('首页 FAB 打开创建房间对话框', r === 'CLICKED', r)

    await evalIn(ctx, fillInput(0, ROOM_NAME))
    await wait(400)
    r = await evalIn(ctx, clickByText('创建房间'))
    await wait(2500)
    let txt = await evalIn(ctx, activeDialogText)
    check(
      '未填管理员密码时被拦下（后端校验生效）',
      txt.includes('管理员密码'),
      txt.slice(0, 70),
    )

    // ---------- 2. 填管理员密码后创建 ----------
    await evalIn(ctx, fillInput(2, ADMIN_PWD))
    await wait(400)
    r = await evalIn(ctx, clickByText('创建房间'))
    await wait(7000)

    const entered = JSON.parse(await evalIn(ctx, `JSON.stringify({
      panes: document.querySelectorAll('.pane').length,
      title: (document.querySelector('.v-app-bar-title')?.innerText || '').trim(),
      adminBtn: !!document.querySelector('button[title="房间管理"]'),
    })`))
    check('带管理员密码创建成功并进房', entered.panes === 3, `窗格 ${entered.panes} 个 / 标题「${entered.title}」`)
    check('app bar 有「房间管理」入口', entered.adminBtn === true)
    check('房间名正确', entered.title === ROOM_NAME, entered.title)

    // ---------- 3. 打开管理面板（创建者应免密进入表单） ----------
    await evalIn(ctx, `(() => { const b = document.querySelector('button[title="房间管理"]'); if (b) b.click(); return 'ok' })()`)
    await wait(3000)
    txt = await evalIn(ctx, activeDialogText)
    check('管理面板打开', txt.includes('房间管理'), txt.slice(0, 60))
    check(
      '创建者免密进入表单（自动用创建时的密码提权）',
      txt.includes('基本信息') && txt.includes('默认点歌歌单'),
      txt.slice(0, 110),
    )

    // ---------- 4. 改名并保存 ----------
    r = await evalIn(ctx, fillInput(0, NEW_NAME))
    await wait(400)
    r = await evalIn(ctx, clickByText('保存修改'))
    await wait(3000)
    const renamed = JSON.parse(await evalIn(ctx, `JSON.stringify({
      title: (document.querySelector('.v-app-bar-title')?.innerText || '').trim(),
      // 只统计对话框：v-snackbar（toast）也带 .v-overlay--active，
      // 不排除掉的话「保存成功」的提示会被误判成「面板没关」
      dialogs: [...document.querySelectorAll('.v-overlay--active')]
        .filter(o => !o.classList.contains('v-snackbar')).length,
    })`))
    check('改名后 app bar 标题同步更新', renamed.title === NEW_NAME, `标题「${renamed.title}」`)
    check('保存后管理面板关闭', renamed.dialogs === 0, `剩余对话框 ${renamed.dialogs}`)

    // ---------- 5. 默认歌单区域可查数量 ----------
    await evalIn(ctx, `(() => { const b = document.querySelector('button[title="房间管理"]'); if (b) b.click(); return 'ok' })()`)
    await wait(2500)
    txt = await evalIn(ctx, activeDialogText)
    check('管理面板含默认点歌歌单区域', txt.includes('默认点歌歌单'), txt.slice(0, 90))
    check('默认歌单数量已加载', /当前\s*\d+\s*首/.test(txt), (txt.match(/当前\s*\d+\s*首/) || ['未找到'])[0])
    await evalIn(ctx, clickByText('取消'))
    await wait(1200)

    // ---------- 6. 无 JS 错误 ----------
    const errs = await evalIn(ctx, `JSON.stringify((window.__jusicErrors || []).filter(e => !/良性/.test(e)))`)
    check('全程无 JS 错误', errs === '[]', errs)

    const failed = results.filter((x) => !x.ok)
    console.log(`\n结果：${results.length - failed.length}/${results.length} 通过` + (failed.length ? `，失败：${failed.map((f) => f.name).join('、')}` : ''))
    await send('session.end', {})
  } catch (e) {
    console.error('异常:', e.message)
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
}, 180000)
