# Jusic-ui-v3

「一起听歌吧」多房间版前端的 **Vue 3 + Vuetify 3 + TypeScript** 重构版。

基于原 `Jusic-ui`（`jusic-ui-houses` 分支，Vue 2 + Muse-UI）**功能等价重写**，UI 升级为 Material Design 3 风格。

## 技术栈

| 维度 | 版本 |
|---|---|
| Vue | 3.5 |
| Vuetify | 4.x（Material Design 3） |
| TypeScript | 5.9 |
| 构建 | Vite 8 |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 实时通信 | `@stomp/stompjs` + `sockjs-client`（STOMP over SockJS） |
| HTTP | axios |
| 其他 | qrcode（二维码）、brotli（B站弹幕解压） |

## 目录结构

```
src/
├── components/          # UI 组件
│   ├── Navigation.vue        # 顶栏 + 抽屉
│   ├── ChatPanel.vue         # 聊天面板（表情/斗图/音源/清空）
│   ├── Lyrics.vue            # 滚动歌词
│   ├── SearchDialog.vue      # 音乐搜索
│   ├── SongListDialog.vue    # 歌单搜索
│   ├── UserSearchDialog.vue  # 用户搜索
│   ├── ChatSearchPicture.vue # 斗图搜索（懒加载）
│   ├── HouseDialog.vue       # 听歌房（列表/创建/进入）
│   ├── ShareDialog.vue       # 分享（二维码/小程序码）
│   └── BiliLive.vue          # B站直播弹幕点歌
├── composables/
│   ├── useSocket.ts          # 通信层（连接/指令/消息分发）
│   └── useToast.ts           # 全局 toast
├── stores/              # Pinia：socket / player / chat / search / house
├── types/               # TS 类型定义
├── utils/               # send/message/time/music 工具 + http
├── config/environment.ts
├── plugins/vuetify.ts   # MD3 主题
└── views/MusicView.vue  # 主界面
```

## 开发与构建

```bash
npm install
npm run dev      # 开发服务器（默认 http://localhost:8080）
npm run build    # 类型检查 + 生产构建（产物在 dist/）
npm run preview  # 预览构建产物
```

## 背景与外观配置

项目有两层背景，且**背景资源可替换**：

| 位置 | 实现 | 相关开关 |
|---|---|---|
| 首页 | 全屏背景图（`cover`）+ 半透明遮罩 | `VITE_BG_IMAGE` / `VITE_BG_MASK` |
| 播放页 | 当前专辑封面放大 + `blur(24px)` 动态背景 | `VITE_BG_ALBUM_BLUR` / `VITE_BG_ALBUM_OPACITY` |

首页背景按以下优先级生效（从高到低）：

1. **运行时**：`localStorage['JUSIC_BG_IMAGE']`（通过 `setHomeBackground(url)` 写入，已为后续设置界面预留）
2. **构建时**：环境变量 `VITE_BG_IMAGE`
3. **内置默认**：直接替换 `src/assets/images/background.jpg`

配置项见 `.env.example`（复制为 `.env.local` 后生效）：

```bash
VITE_BG_IMAGE=            # 背景图 URL，留空则用内置图
VITE_BG_MASK=0.55         # 首页背景遮罩透明度（越大背景越暗、前景越清晰）
VITE_BG_ALBUM_BLUR=true   # 播放页专辑模糊背景开关
VITE_BG_ALBUM_OPACITY=0.35
```

实现代码：`src/config/appearance.ts`（配置）与 `src/views/MusicView.vue`（渲染）。

## 与后端联调

后端为 `Jusic-Serve-Houses`（Spring Boot，**本次重构未改动**，协议完全兼容）。

1. 启动后端依赖：Redis + 音乐 API（见后端 README）
2. 启动后端：默认端口 `8888`
3. 前端联调：`src/config/environment.ts`
   - 开发环境默认 `baseUrl = 'http://127.0.0.1:8080'`，请按后端实际地址调整
   - 生产环境 `baseUrl = ''`（同源，构建产物放入后端 `src/main/resources/static/`）

### 通信协议要点

- 连接：`SockJS(${baseUrl}/server?houseId=xx&housePwd=xx&connectType=xx)`
- 发送：STOMP SEND 帧（`stompClient.send(destination, {}, body)`）
- 接收：后端直接推送**伪 STOMP 帧**（`类型\ncontent-type:...\n\nJSON`，见后端 `SessionServiceImpl.getPayload`），
  因此前端拦截底层 `socket.onmessage` 自行解析（第一行=类型，最后一行=JSON），而非依赖 STOMP `subscribe` 回调
- 切换/创建房间在同一连接内完成（后端更新 session 的 `houseId`），**无需重连**

## 功能对照

| 模块 | 状态 |
|---|---|
| 房间系统（列表/搜索/创建/密码/永存/直达分享） | ✅ |
| 同步播放（进度校准/多音源/音质/下一首预加载） | ✅ |
| 点歌（聊天指令/搜索点歌/点赞/收藏） | ✅ |
| 聊天（文字/表情/斗图/在线人数/房间用户/公告/清空） | ✅ |
| 搜索（音乐/歌单/用户/图片/热歌榜） | ✅ |
| 滚动歌词（展开收起） | ✅ |
| B站直播弹幕点歌 | ✅ |
| 分享（二维码/小程序码/直达链接） | ✅ |
| 点歌历史 / 我的收藏 | ✅ |
| 聊天指令（43 条，与旧版逐条对齐） | ✅ |

### 功能对齐验证方式

- 聊天指令：43 条，与旧版 `sendHandler` 逐条比对，**零差异**
- 消息类型：定义与 `messageHandler` 处理覆盖，与旧版**完全一致**
- API 端点：STOMP 端点与后端 `@MessageMapping` 对应；HTTP 端点与旧版一致

## 常见问题（踩坑记录）

### 1. 页面白屏、`v-*` 组件全部无法解析

**现象**：控制台报 `[Vue warn]: Failed to resolve component: v-app / v-btn / ...`，页面空白。

**原因**：Vuetify **4.x 的 `createVuetify()` 不再自动注册组件**——其实现中 `components` / `directives` 默认为空对象，必须显式传入：

```ts
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const vuetify = createVuetify({ components, directives, /* ... */ })
```

（Vuetify 3.x 会自动注册，升级到 4.x 时这是破坏性变更。）

### 2. 白屏并报 `ReferenceError: global is not defined`

**原因**：`sockjs-client` 等 CJS 依赖引用了 Node 的 `global`，浏览器中不存在。

**解决**：在 `vite.config.ts` 中映射：

```ts
define: { global: 'globalThis' }
```

### 3. 修改 `vite.config.ts` 后配置不生效

**原因**：`vue-tsc -b`（build 模式）会在项目根目录生成编译产物 `vite.config.js`，而 **Vite 的配置查找顺序中 `.js` 优先于 `.ts`**，导致真正编辑的 `vite.config.ts` 被忽略。

**解决**：`build` 脚本使用 `vue-tsc --noEmit`（本项目已改），并在 `.gitignore` 中忽略 `vite.config.js` / `*.tsbuildinfo`。若已生成，直接删除。

### 4. 只能通过 IPv6 访问，`127.0.0.1` 连不上

**原因**：Vite 默认 host 为 `localhost`；当系统 `/etc/hosts` 中 `localhost` 仅解析到 `::1` 时，服务只监听 IPv6 回环。

**解决**：`server.host: true`（同时监听 IPv4/IPv6），或 `host: '0.0.0.0'`（仅 IPv4）。

### 5. 背景图设置了却不显示，页面仍是纯色

**原因**：给背景层用了**负 z-index**。Vuetify 的 `.v-application` 本身带有不透明背景（`background: rgb(var(--v-theme-background))`），且它是 `position: static`、**不创建 stacking context**；此时负 z-index 的后代元素会掉到它的背景**下面**被完全遮住。

**解决**：背景层用 `z-index: 0`，内容层用 `z-index: 1`（见 `MusicView.vue` 的 `.page-bg` / `.content-layer`）。

**排查技巧**：设置 `backgroundImage` 成功 ≠ 背景可见——务必检查是否被遮挡。无头环境下可用截图大小快速判断：纯色页面的 PNG 极小（约 6KB），正常渲染含背景的页面约 1MB。

### 无 GUI 环境下的渲染验证

`scripts/render-verify.mjs` 可通过 Firefox 的 WebDriver BiDi 在无头环境下捕获页面的运行时错误与渲染结果：

```bash
# 1. 启动带调试端口的 Firefox（home 只读时需指定可写的 profile 路径）
firefox --headless --no-remote --profile "$PWD/.firefox-profile" --remote-debugging-port 9222 http://localhost:8080/
# 2. 运行验证脚本
node scripts/render-verify.mjs
```

输出包含：页面标题、`#app` 渲染长度、捕获的 JS 错误、浏览器 console 日志。

## 说明

- 表情选择器使用内置常用表情面板（原 `v-emoji-picker` 为 Vue 2 专用，未引入新的 emoji 依赖）
- 端到端联调需在具备 Redis + 音乐 API 的环境中验证
