// 通过 Firefox WebDriver BiDi 获取页面运行时错误
const ws = new WebSocket('ws://127.0.0.1:9222/session')
let id = 0
const pending = new Map()
const logs = []

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(JSON.stringify(msg.error)))
    else resolve(msg.result)
  } else if (msg.method === 'log.entryAdded') {
    const p = msg.params
    logs.push(`[${p.level || p.type}] ${p.text || ''}`)
  }
})

ws.addEventListener('error', (e) => {
  console.error('WebSocket 错误:', e.message || e)
  process.exit(1)
})

ws.addEventListener('open', async () => {
  try {
    await send('session.new', { capabilities: {} })
    console.log('✅ BiDi session 已建立')

    const tree = await send('browsingContext.getTree', {})
    const contextId = tree.contexts[0].context
    console.log('context:', contextId)

    await send('session.subscribe', { events: ['log.entryAdded'] })
    console.log('✅ 已订阅日志')

    console.log('--- 重新加载页面 ---')
    await send('browsingContext.navigate', {
      context: contextId,
      url: 'http://localhost:8080/',
      wait: 'complete',
    })
    await new Promise((r) => setTimeout(r, 4000))

    const res = await send('script.evaluate', {
      expression: `JSON.stringify({
        title: document.title,
        appLen: (document.getElementById('app') || {}).innerHTML ? document.getElementById('app').innerHTML.length : 0,
        jusicErrors: window.__jusicErrors || [],
        bodyText: (document.body.innerText || '').slice(0, 400),
        bg: (function () {
          var el = document.querySelector('.page-bg')
          if (!el) return { present: false }
          var cs = getComputedStyle(el)
          var mask = document.querySelector('.page-bg-mask')
          return {
            present: true,
            backgroundImage: cs.backgroundImage.slice(0, 100),
            backgroundSize: cs.backgroundSize,
            zIndex: cs.zIndex,
            maskOpacity: mask ? getComputedStyle(mask).opacity : null
          }
        })(),
        appBg: (function () {
          var app = document.querySelector('.v-application')
          if (!app) return 'no .v-application'
          var cs = getComputedStyle(app)
          return cs.backgroundColor + ' / position:' + cs.position + ' / z:' + cs.zIndex
        })()
      })`,
      target: { context: contextId },
      awaitPromise: false,
      resultOwnership: 'none',
    })

    console.log('\n=== 页面状态 ===')
    const val = res.result.value
    try {
      const parsed = JSON.parse(val)
      console.log('title:', parsed.title)
      console.log('#app innerHTML 长度:', parsed.appLen)
      console.log('捕获的错误:', JSON.stringify(parsed.jusicErrors, null, 2))
      console.log('body 文本:', JSON.stringify(parsed.bodyText))
      console.log('背景元素:', JSON.stringify(parsed.bg, null, 2))
      console.log('背景层 z-index:', parsed.bg.zIndex, '(负值会被 v-application 背景遮住)')
      console.log('v-app 背景色:', parsed.appBg)
    } catch {
      console.log(val)
    }

    // 截图：判断背景是否真实渲染（纯色 PNG 压缩后极小）
    try {
      const shot = await send('browsingContext.captureScreenshot', { context: contextId })
      const bytes = Math.round((shot.data.length * 3) / 4)
      const fs = await import('node:fs')
      fs.writeFileSync('render-shot.png', Buffer.from(shot.data, 'base64'))
      console.log('\n=== 截图 ===')
      console.log('PNG 大小:', bytes, '字节')
      console.log('判断:', bytes > 40000 ? '✅ 有丰富内容（背景已渲染）' : '⚠️ 疑似纯色/空白（背景未显示）')
      console.log('已保存: render-shot.png')
    } catch (e) {
      console.log('截图失败:', e.message)
    }

    console.log('\n=== 浏览器日志 (' + logs.length + ' 条) ===')
    logs.slice(0, 25).forEach((l) => console.log(' ', l.slice(0, 300)))
  } catch (e) {
    console.error('执行失败:', e.message)
  }
  process.exit(0)
})

setTimeout(() => {
  console.error('超时')
  process.exit(1)
}, 60000)
