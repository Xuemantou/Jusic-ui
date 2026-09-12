# Jusic-ui-v3

「一起听歌吧」点歌房前端的 **Vue 3 + Vuetify 4 + TypeScript** 重构版，
基于原 Vue 2 + Muse-UI 版本（`origin/jusic-ui-houses`）功能等价重写，UI 升级为 Material Design 3。

## 技术栈

| 维度 | 版本 |
|---|---|
| Vue / Vuetify | 3.5 / 4.x（MD3） |
| TypeScript / 构建 | 5.9 / Vite 8 |
| 状态 / 路由 | Pinia / Vue Router 5（hash 模式） |
| 实时通信 | `@stomp/stompjs` + `sockjs-client`（STOMP over SockJS） |
| 配色 | `@material/material-color-utilities`（Google 官方 MD3 实现，负责 HCT 取色与色调板） |
| 其他 | axios、qrcode、brotli（B站弹幕解压）、@mdi/font |

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:8080
npm run build    # vue-tsc 类型检查 + 生产构建（产物 dist/）
npm run preview  # 预览构建产物
npm run verify:theme  # 校验 MD3 配色（角色齐全性 / 对比度 / 非法 seed 回退）
```

`npm run dev` 只提供前端页面，联调需要后端在跑（见下节）。后端默认端口 **8888**。

## 部署到后端（三步）

```bash
# ① 构建
npm run build

# ② 产物拷进后端 static（旧 js/css/img 是 Vue2 时代遗留，必须删；favicon.ico 保留）
rm -rf ../src/main/resources/static/{index.html,assets,js,css,img}
cp -r dist/* ../src/main/resources/static/

# ③ 打包（前端必须在 package 之前进去，否则 jar 里是旧前端）
cd .. && mvn clean package -DskipTests
```

## 与后端联调

- **后端地址**：生产构建 `baseUrl = ''`（同源，由后端 8888 提供）；开发模式可用
  `VITE_API_BASE` 覆盖（写进 `.env.local`），例如 `VITE_API_BASE=http://127.0.0.1:8888`。
- **改前端不重打包**：把静态资源指到外部目录，改完只需覆盖该目录 + 刷新浏览器：

  ```bash
  java -jar target/jusic-serve.jar \
    --spring.resources.static-locations=file:/path/to/webroot/,classpath:/static/
  ```

  外部目录优先、jar 内兜底，两者都要写。此方式同时避免 dev server 的跨域问题。
- **端口冲突**：Vite 的 8080 与 docker-compose 里后端的宿主映射端口（8080:8888）相同，别同时开。

### 通信协议要点

- 连接：`SockJS(${baseUrl}/server?houseId=xx&housePwd=xx&connectType=xx)`
- 发送：STOMP SEND 帧；后端推送的是**伪 STOMP 帧**（`类型\ncontent-type:...\n\nJSON`），
  因此前端拦截底层 `socket.onmessage` 自行解析（首行=类型，末行=JSON），不走 `subscribe` 回调
- 切换/创建房间在同一连接内完成（后端更新 session 的 `houseId`），无需重连
- 断线重连最多 5 次（444ms×n 退避），用尽后聊天区提示并显示「重新连接」按钮

## 环境变量（构建期，`.env.example` 有完整说明）

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_BASE` | 开发 `http://127.0.0.1:8080`，生产空 | 后端地址，留空即同源 |
| `VITE_BG_IMAGE` | 内置图 | 首页背景图 URL |
| `VITE_BG_MASK` | `0.55` | 首页背景遮罩透明度 |
| `VITE_BG_ALBUM_BLUR` | `true` | 播放页专辑封面模糊背景开关 |
| `VITE_BG_ALBUM_OPACITY` | `0.35` | 模糊背景透明度 |

首页背景优先级：`localStorage['JUSIC_BG_IMAGE']` > `VITE_BG_IMAGE` > 内置 `background.jpg`。

## 主题（Material You / MD3）

配色不是手挑的固定色值，而是由**一个 seed color** 经 HCT 色彩空间派生的色调板生成。
这带来两点实际差别，而不是风格偏好：

- 明暗两套配色是同一色调板的两种映射，**对比度由色调差保证**。原 MD2 的 `primary #009688`
  配白字只有 **3.67:1**，低于 WCAG AA 的 4.5（`secondary #4DB6AC` 更是 2.44:1）；
  派生后为 **7.73**（深色）/ **6.50**（浅色）。
- 换一个 seed 即得到一整套协调配色——这就是 Material You 的动态取色。

导航栏的调色板图标可切换，两项均持久化到 `localStorage`：

| 设置项 | 可选值 | 存储键 |
|---|---|---|
| 明暗模式 | 深色 / 浅色 / 跟随系统 | `JUSIC_THEME_MODE` |
| 配色来源 | 品牌配色 / 跟随背景图 | `JUSIC_THEME_SEED_SOURCE` |

「跟随背景图」用 Celebi 量化 + Score 从首页背景图提取主色；**跨域或提取失败时回退到品牌色**，
取色失败不会影响界面可用性。

- **换品牌色**：改 `src/theme/md3.ts` 的 `DEFAULT_SEED`，62 个 MD3 角色会整套重算。
- **校验**：`npm run verify:theme` —— 断言角色齐全性、对比度、非法 seed 回退。
- **实现要点**：颜色角色表由 `MaterialDynamicColors` **枚举生成**而非手写映射，库升级时自动跟进、
  不会漏项。运行时切换靠改 `theme.themes.value.*.colors`——Vuetify 的 `styles` 是 computed，
  变更后会重新生成 CSS 变量并写回 `<style id="vuetify-theme-stylesheet">`，故无需刷新页面。
- **状态层与形状**：MD3 规范值（hover 8% / focus 10% / pressed 10% / dragged 16%）与
  shape scale（`--v-shape-xs/sm/md/lg/xl` = 4/8/12/16/28）走 Vuetify 的 `theme.variables`。

## 功能对照

| 模块 | 状态 |
|---|---|
| 房间系统（列表/搜索/创建/密码/永存/直达分享） | ✅ |
| 同步播放（进度校准/多音源/音质/下一首预加载） | ✅ |
| 点歌（聊天指令/搜索点歌/点赞/收藏/历史） | ✅ |
| 聊天（文字/表情/斗图/在线人数/房间用户/公告/清空） | ✅ |
| 搜索（音乐/歌单/用户/图片/热歌榜） | ✅ |
| 滚动歌词、B站直播弹幕点歌、分享（二维码/小程序码） | ✅ |
| Material You 主题（明暗切换 / 动态取色 / 完整 MD3 角色） | ✅ |

聊天指令 44 条、消息类型 21 种，均与旧版 `sendHandler` / `messageHandler` 逐条比对**零差异**。

## 踩坑速查

| 现象 | 原因与解法 |
|---|---|
| 白屏，`Failed to resolve component: v-app` | Vuetify 4 的 `createVuetify()` 不再自动注册组件，必须显式传 `components`/`directives`（见 `plugins/vuetify.ts`） |
| 白屏，`ReferenceError: global is not defined` | `sockjs-client` 等 CJS 依赖引用 Node 的 `global`；`vite.config.ts` 里 `define: { global: 'globalThis' }` |
| 改了 `vite.config.ts` 不生效 | `vue-tsc -b` 会生成 `vite.config.js`，而 Vite 优先读 `.js`；本项目 build 用 `--noEmit` 规避，并在 `.gitignore` 忽略该产物 |
| 只能通过 IPv6 访问 | Vite 默认 host 为 `localhost`；设 `server.host: true` 同时监听 IPv4/IPv6 |
| 背景图不显示、页面纯色 | 背景层用了负 z-index，被 `.v-application` 的不透明背景盖住；改 `z-index: 0`，内容层 `1` |
| 抽屉图片 404（200 但返回 HTML） | `<v-img src="../assets/x.jpg">` 的 `src` 是普通字符串 prop，Vite 不会重写相对路径；必须 `import` 后 `:src` 绑定 |
| 弹窗数据不加载 | `@after-open` 不是 Vuetify 事件（`VDialog` 只 emit `afterEnter`/`afterLeave`），回调永不执行；改 `watch(() => props.modelValue)` |
| 音量只对本机生效 | 后端 `/music/volumn` 需管理员权限且成功后全房间广播，故滑块刻意只改本地音量 |
| 「下一首预加载」没效果 | 预加载 URL 必须与随后播放的 URL 完全一致（时间戳/域名重写每次都变），故 `cleanMusicUrl` 对同一原始地址做短时缓存 |
| 断线后再也不重连 | SockJS 用自研 EventTarget，事件对象**没有 `target` 属性**；判断当前连接要在闭包里比较 `socket === sockJS`，不能用 `e.target` |
| 自定义颜色角色取不到值 | Vuetify 把 `colors` 的 key **原样**拼成 `--v-theme-<key>`（不做 kebab 转换），所以 key 要自己写成 `primary-container`；消费端是 `rgb(var(--v-theme-x))`，值是 `R,G,B` 逗号分隔、不带 `rgb()` |
| 组件样式莫名塌掉 | Vuetify 组件内部仍引用 MD2 遗留角色——`surface-light`（24 处）、`on-surface-light`、`on-surface-bright`，MD3 规范里没有，必须显式映射到最接近的角色，否则静默取到空值 |
| 给 `theme.colors` 赋值报类型错 | Vuetify 的 `Colors` 接口未对外导出，且 `Record<string, string>` 无法向 TS 证明含必需字段；给返回值标一个精确的交叉类型即可结构化匹配，无需 `as` |
| `Cannot find module .../dynamic_color` | `material-color-utilities` 0.4.0 的 `color_spec_2025.js` 漏写 `.js` 扩展名（同文件其他 import 都有）。Vite/Rolldown 会补扩展名，只有 Node 原生 ESM 会失败，故校验脚本先经 esbuild 打包再跑 |

## 目录结构

```
src/
├── views/MusicView.vue      # 主界面（首页房间列表 + 播放页）
├── components/              # Navigation / ChatPanel / Lyrics / 各类搜索弹窗 / HouseDialog / ShareDialog / BiliLive
├── composables/             # useSocket（通信层）/ useToast
├── stores/                  # Pinia：socket / player / chat / search / house
├── config/                  # environment（后端地址）、appearance（背景）
├── theme/                   # md3（颜色角色派生）/ extractSeed（背景取色）/ state（明暗与 seed）
└── utils/                   # send / message / time / music 工具 + http
```

`scripts/render-verify.mjs` 可在无头 Firefox（WebDriver BiDi）下捕获页面运行时错误与渲染结果。
`scripts/verify-theme.ts` 校验 MD3 配色（`npm run verify:theme`）。
