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
| 上次提取的 seed（内部缓存） | — | `JUSIC_THEME_BG_SEED` |

「跟随背景图」用 Celebi 量化 + Score 从首页背景图提取主色。取色要等图片加载（异步），
故上次结果会缓存下来作为下次的首帧值——否则每次刷新都会先显示品牌 teal、几百毫秒后才跳成提取色。
**跨域或提取失败时保留上一个有效配色**，不会退回品牌色，更不会影响界面可用性。

- **换品牌色**：改 `src/theme/md3.ts` 的 `DEFAULT_SEED`，62 个 MD3 角色会整套重算。
- **校验**：`npm run verify:theme` —— 断言角色齐全性、对比度、非法 seed 回退。
- **实现要点**：颜色角色表由 `MaterialDynamicColors` **枚举生成**而非手写映射，库升级时自动跟进、
  不会漏项。运行时切换靠改 `theme.themes.value.*.colors`——Vuetify 的 `styles` 是 computed，
  变更后会重新生成 CSS 变量并写回 `<style id="vuetify-theme-stylesheet">`，故无需刷新页面。
- **状态层**：MD3 规范值（hover 8% / focus 10% / pressed 10% / dragged 16%），走 Vuetify 的 `theme.variables`。
- **形状**：MD3 shape scale（`--v-shape-xs/sm/md/lg/xl` = 4 / 8 / 12 / 16 / 28）。
- **高度**：Vuetify 4 的阴影规格（`$shadow-key` / `$shadow-ambient`）已与 MD3 spec 逐条一致，
  无需干预；真正缺的是 **tonal elevation**——MD3 要求抬升表面叠加 `surface-tint`（由 primary 派生）
  而非中性黑白，故把 `--v-elevation-overlay-color` 设为 `surface-tint`，并随 seed 一起重建。
- **排版**：`src/styles/typography.css` 按 MD3 type scale 补齐 `.text-h1` ~ `.text-caption` 等类，
  尺寸与行高抽成 `--v-type-*` 令牌（30 个）。**Vuetify 4 已移除这些工具类**，详见踩坑表。

## 界面布局（MD3 自适应窗格）

布局不是"卡片堆叠 + 12 栅格"，而是 MD3 的**窗格（pane）**：面与面之间用 outline 分隔线划分，
内容不再层层套卡片。

| 视口 | 结构 |
|---|---|
| 宽屏（≥1280，`lgAndUp`） | 三窗格常驻：**正在播放**（300–360）\| **点歌队列**（自适应）\| **聊天**（320–400） |
| 窄屏（<1280） | 单窗格 + MD3 **底部导航栏**（正在播放 / 点歌队列 / 聊天）+ 常驻 **mini player** |

- **窗格切换靠一个状态**：`activePane`。底部导航要切窗格，纯 CSS 做不到，
  所以这是窄屏布局无法避免的一点状态；窗格用 `v-show` 而非 `v-if`，
  切回来时聊天/队列的滚动位置与输入内容都还在。
- **未读徽标**：窄屏聊天不在前台时累计新消息数（只统计新增，切窗格/清空导致的长度跳变不误加），
  进入聊天窗格或宽屏（聊天常驻可见）时清零。没有它，单窗格布局下会整场错过消息。
- **高度**：`height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom))`。
  这两个变量由 Vuetify 写在 `v-main` 上，窗格是其子节点直接继承，
  所以 app bar 高度变化（或窄屏多出底部导航）时不需要改任何数字。
- **公共契约**：窗格、导航栏、列表、滑块等 MD3 规格集中在 `src/styles/md3-components.css`，
  组件里不再散落硬编码；改规格先改那里。
- **首页**：MD3 的「一屏一主操作」——大标题 + search bar + 房间列表（`v-list`），
  创建房间收敛为右下角 FAB + 对话框，不再是与房间列表并列的常驻表单。

### 播放区为什么没有播放/暂停与进度拖拽

不是遗漏，是**后端没有对应端点**。`src/main/java` 里与播放相关的映射只有
`/music/skip/vote`（投票切歌）、`/music/order`、`/music/volumn/{volumn}`、`/music/good/{musicId}`，
**没有 pause / play / next / seek**；`useSocket.ts` 的 44 条指令里也只有「投票切歌」。
房间是后端同步广播的，客户端单方面暂停即脱同步。

因此播放区提供的是**真实存在**的能力：投票切歌（复用已有指令，原生入口是聊天框打字）、
歌词展开、音量（刻意只改本地）、热歌榜/点歌历史/收藏、点歌。进度条保持只读。

## 功能对照

| 模块 | 状态 |
|---|---|
| 房间系统（列表/搜索/创建/密码/永存/直达分享） | ✅ |
| 同步播放（进度校准/多音源/音质/下一首预加载） | ✅ |
| 点歌（聊天指令/搜索点歌/点赞/收藏/历史） | ✅ |
| 聊天（文字/表情/在线人数/房间用户/公告/清空） | ✅ |
| 搜索（音乐/歌单/用户/热歌榜） | ✅ |
| 滚动歌词、B站直播弹幕点歌、分享（二维码/小程序码） | ✅ |
| Material You 主题（明暗切换 / 动态取色 / 完整 MD3 角色） | ✅ |
| MD3 自适应窗格布局（宽屏三窗格 / 窄屏底部导航 + mini player） | ✅ |
| 房间管理（创建时设管理员密码 / 面板改房间信息与默认点歌歌单 / 销毁房间） | ✅ |
| 个人设置（昵称、默认音源持久化到本机，进房自动同步） | ✅ |

> **斗图（搜索表情包）已整体移除**，前后端与测试代码一并删除。原因是它的外部依赖两端都已失效，
> 且失败是静默的：后端转调的第三方接口 `api.doutub.com` 域名已易主——DNS 指向的服务器出示的是
> `jiusanedu.com` 证书，TLS 校验直接失败；配套图床 `tx.alang.run/doutu` 也已对所有路径返回 400。
> 后端当时把异常 `catch` 掉后照常推送空结果，前端又没有空态，用户看到的是"搜不到"而非"服务挂了"。
> 若将来要恢复，需要同时替换数据源与图床，并让失败可观测。

> **李志歌单（搜索弹窗里的「禁歌」音源）已整体移除**：前端音源按钮、后端 `searchLZ` / `getLZMusic`、
> `musicJson` 配置与 `src/main/resources/lizhimusic.json` 数据文件全部删除。
> 该音源的价值在于歌单里的直链不依赖任何音乐平台 API，所以原作者把它当作**最终兜底**——
> `musicSwitch` 在「默认列表里的歌全取不到播放地址」时会拿它顶上。移除后这个兜底没有了，
> 因此 `musicSwitch` 改为返回 `null`，并同步让调用方 `MusicJob.processHouse` 提前返回
> （**必须处理**：紧接着就会访问 `music.getDuration()`，不判空会 NPE）。
> 数据文件里另有 7 首歌的音频托管在原作者的 `tx.alang.run` 上，一并不再引用。

聊天指令 44 条不变，与旧版 `sendHandler` 逐条比对**零差异**；消息类型中的 `SEARCH_PICTURE`
已随斗图功能移除。

## 踩坑速查

| 现象 | 原因与解法 |
|---|---|
| 白屏，`Failed to resolve component: v-app` | Vuetify 4 的 `createVuetify()` 不再自动注册组件，必须显式传 `components`/`directives`（见 `plugins/vuetify.ts`） |
| 白屏，`ReferenceError: global is not defined` | `sockjs-client` 等 CJS 依赖引用 Node 的 `global`；`vite.config.ts` 里 `define: { global: 'globalThis' }` |
| 改了 `vite.config.ts` 不生效 | `vue-tsc -b` 会生成 `vite.config.js`，而 Vite 优先读 `.js`；本项目 build 用 `--noEmit` 规避，并在 `.gitignore` 忽略该产物 |
| 只能通过 IPv6 访问 | Vite 默认 host 为 `localhost`；设 `server.host: true` 同时监听 IPv4/IPv6 |
| 背景图不显示、页面纯色 | 背景层用了负 z-index，被 `.v-application` 的不透明背景盖住；改 `z-index: 0`，内容层 `1` |
| 抽屉图片 404（200 但返回 HTML） | `<v-img src="../assets/x.jpg">` 的 `src` 是普通字符串 prop，Vite 不会重写相对路径；必须 `import` 后 `:src` 绑定 |
| 抽屉里的图片干脆不显示（不是 404） | `v-img` 默认靠 IntersectionObserver 懒加载，在 `temporary` 的 `v-navigation-drawer` 里这个观察**不触发**：元素永远停在 `.v-img--booting`，连 `<img>` 都不插入（同时刻页面其它 `v-img` 正常，故非环境问题）。抽屉内的 `v-img` 要加 `eager` |
| 弹窗数据不加载 | `@after-open` 不是 Vuetify 事件（`VDialog` 只 emit `afterEnter`/`afterLeave`），回调永不执行；改 `watch(() => props.modelValue)` |
| 音量只对本机生效 | 后端 `/music/volumn` 需管理员权限且成功后全房间广播，故滑块刻意只改本地音量 |
| 「下一首预加载」没效果 | 预加载 URL 必须与随后播放的 URL 完全一致（时间戳/域名重写每次都变），故 `cleanMusicUrl` 对同一原始地址做短时缓存 |
| 断线后再也不重连 | SockJS 用自研 EventTarget，事件对象**没有 `target` 属性**；判断当前连接要在闭包里比较 `socket === sockJS`，不能用 `e.target` |
| 自定义颜色角色取不到值 | Vuetify 把 `colors` 的 key **原样**拼成 `--v-theme-<key>`（不做 kebab 转换），所以 key 要自己写成 `primary-container`；消费端是 `rgb(var(--v-theme-x))`，值是 `R,G,B` 逗号分隔、不带 `rgb()` |
| 组件样式莫名塌掉 | Vuetify 组件内部仍引用 MD2 遗留角色——`surface-light`（24 处）、`on-surface-light`、`on-surface-bright`，MD3 规范里没有，必须显式映射到最接近的角色，否则静默取到空值 |
| 给 `theme.colors` 赋值报类型错 | Vuetify 的 `Colors` 接口未对外导出，且 `Record<string, string>` 无法向 TS 证明含必需字段；给返回值标一个精确的交叉类型即可结构化匹配，无需 `as` |
| `Cannot find module .../dynamic_color` | `material-color-utilities` 0.4.0 的 `color_spec_2025.js` 漏写 `.js` 扩展名（同文件其他 import 都有）。Vite/Rolldown 会补扩展名，只有 Node 原生 ESM 会失败，故校验脚本先经 esbuild 打包再跑 |
| `class="text-h5"` 毫无效果 | Vuetify 4 **移除了全部排版工具类**——`.text-h1` ~ `.text-caption`、`.text-body-*` 在 `vuetify/lib/styles/main.css` 里 grep 计数为 0。本项目沿用这些类名，导致它们此前静默失效（文字尺寸只受继承影响）。需按 MD3 type scale 自行补齐（`src/styles/typography.css`） |
| 自定义 `on-*` 颜色类名不对 | Vuetify 为普通角色生成 `.text-<key>`，但对 `on-` 前缀**只生成 `.on-<key>`**（`theme.js:250` 走的是另一个分支），所以应写 `class="on-surface-variant"` 而非 `text-on-surface-variant` |
| 定义了令牌却没人用 | `npm run verify:theme` 会检查 `--v-type-*` 是否都被引用。MD3 共 15 个排版类别而 Vuetify 类名只覆盖 13 个，缺的 `display-medium` / `label-medium` 需单独命名，否则令牌变死代码 |
| 白屏 + `Invalid color: undefined` | 运行时改主题若这样写：`theme.themes.value.dark.variables = 新对象`，会把 Vuetify 默认 variables **整体替换**掉，丢失其中的 `theme-on-dark` / `theme-on-light`。而 `genOnColors` 正是靠这两个变量给自动补齐的 `on-*` 角色取值，取不到就写入 `undefined` 混进 colors，随后 `genCssVariables` 在 `parseColor` 上抛错，应用在 mount 阶段直接白屏。**必须合并**：`{ ...现有, ...新的 }`。注意离线断言测不出来——它不经过运行时切换那条路径 |
| `file://` 下重复验证结果不变 | 浏览器会缓存 bundle，堆栈里的文件名不更新，看起来像"改动没生效"。给导航 URL 加时间戳；`browsingContext.reload` 在当前 Firefox 的 BiDi 实现里不被支持，用再次 `navigate` 代替 |
| 无头环境里量到的样式跟产物 CSS 对不上 | 它**不给「页面上已经渲染过的元素」重算容器查询样式**：同一个 `.np-cover`，原有元素 `max-width` 停在基础值 260px，往同一个容器里新插一个克隆却是正确的档位值 160px；给原有元素临时挂个类、注入一条必然命中的 `@container` 规则，它的 `max-width` **也不会变**。所以任何"读老元素样式/几何"的断言在这种环境下都是假的。`verify-shortscreen.mjs` 因此先跑一遍这个探针，环境不可信就明确**跳过**布局断言并说明原因，而不是报成失败 |
| 断言 `flex: none` 永远匹配不上 | CSSOM 的 `style.cssText` 会把简写序列化成等价长写，`flex: none` 读出来是 `flex: 0 0 auto`。断言要两种都认（`/flex:\s*(none\|0 0 auto)/`） |
| 浏览器验证连跑两次报 `session not created` | WebDriver BiDi 的 session 是一次性的，脚本结束前必须 `session.end`，否则下一次连接会被拒 |
| 连跑报 `Maximum number of active sessions` | 同上，但**超时/异常退出**也会留下占用（`session.end` 没走到）。除了在超时路径补 `session.end`，还可以换端口 + 换 profile 另起一个 Firefox 实例（两个实例不能用同一个 profile，否则新实例直接退出） |
| 底部导航不是 MD3 的样子 | Vuetify 的 `v-bottom-navigation` 是 MD2 规格（56 高 / 抬升阴影 / 整项染主色）。MD3 的 navigation bar 是 80 高、`surface-container` 面、无阴影，选中语义由 64×32 的**指示器药丸**承载而不是给文字上色——`md3-components.css` 里逐条覆盖 |
| `.pane` 背景写成 `rgb(var(--v-theme-surface) / 0.88)` 无效 | Vuetify 的颜色变量是**逗号分隔**的 `R,G,B`，逗号语法与斜杠 alpha 不能混用；要半透明得写 `rgba(var(--v-theme-surface), 0.92)` |
| 窗格高度写死 100vh 会盖住底部导航 | 用 `calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom))`：这两个变量由 Vuetify 写在 `v-main` 上，窗格作为其子节点直接继承，底部导航一出现高度自动跟上 |
| 封面尺寸改由 CSS 控制后 build 失败 | `noUnusedLocals: true`，模板里删掉 `:size="albumRotateSize"` 后那个 computed 连同 `useDisplay().width` 一起成了死代码，必须一并删除 |
| 房间创建者进房后不是管理员 | 后端的判断是 `session.getId().equals(houseId)`（`SessionServiceImpl.putSession`），而左侧是 **WebSocket session id**、右侧是**房间 id**（由创建者 HTTP session id 派生）——两者永不相等，所以**所有人进房后 role 都是 `default`**，包括创建者。管理面板因此对创建者也走密码验证；前端用「创建时把密码暂存内存、开面板时自动提权」来补这个体验 |
| `/house/edit` 用创建者 session 鉴权必然失败 | 该接口不在 Spring Security 的 `permitAll` 名单里，Basic 认证成功会触发 **session fixation 保护换掉 session id**，创建者的 session 与房间 id 永远对不上。改用**房间管理员密码**作为凭证（密码放请求体，与 session 无关） |
| 管理面板保存后「面板没关」 | 断言写成统计 `.v-overlay--active` 会把 **`v-snackbar`（toast）也算进去**——Vuetify 的 snackbar 同样带 overlay 与 `--active` 类。判断对话框是否关闭要排除 `.v-snackbar` |
| 底部导航的选中指示器药丸不显示 | Vuetify 4 的选中态类名是 **`.v-btn--active`**，**没有 `.v-btn--selected`**。写错类名不会报任何错，只是那条 `background` 永远不生效——MD3 navigation bar 的 64×32 药丸会一直是透明的。同理，任何依赖「选中态」的自定义样式都要用 `--active` |
| 某个按钮「图标没加载出来」/ 一片空白 | `@mdi/font` 里并不存在所有你在别处见过的 `mdi-*` 名字（本项目踩到过 `mdi-music-box-search`、`mdi-account-balance`）。用了不存在的名字，Vuetify 不报错、控制台不警告、构建也能过，**图标只是渲染成空白**。`npm run verify:icons` 会扫出全部无效图标名 |
| 混进第三方 logo 后，一排图标里就它最突兀 | 想保留 logo 的形状又要和 mdi 图标风格统一，做法是**把形状做成蒙版**：`convert logo.png -alpha extract -strip logo-mask.png`，再用 `mask: url(logo-mask.png) center / contain no-repeat` + `background-color: rgb(var(--v-theme-on-surface))` 渲染成单色。关键是颜色要对齐 mdi 的**实际**取值——列表项里的 mdi 图标是**纯 `on-surface`、不带 `medium-emphasis` 透明度**，凭印象加透明度会让新图标明显偏淡 |
| 测试脚本报 `Cannot read properties of undefined (reading 'value')` | WebDriver BiDi 出错时的响应**没有 `result` 字段**，而 `evalIn` 里直接 `.result.value` 就会抛出这个难以定位的错误。封装 `evalIn` 时要显式检查 `result === undefined` 并把原始响应打出来。另外异常路径也必须 `session.end`，否则下次运行直接报 `session not created` |
| 断言"看起来通过了"其实什么都没测 | 别用 `a === b` 直接比对两个取值——元素没找到时双方都是 `undefined`，`undefined === undefined` 为 `true`，断言会**假通过**（本项目就这么漏过一次：改了类名、断言找的是旧类名，却显示 ok）。要么先判 `!== undefined`，要么用 `Number.isFinite()` 之类的存在性检查 |
| 测试脚本里塞进模板字符串的代码报语法错 | 这些脚本把待求值的代码写在**模板字符串**里，于是有两种静默/难查的坑：① 正则里的 `\s`、`\d` 会被 JS 当转义序列吃掉（写作 `s`、`d`），正则悄悄失效；② 代码注释里用**反引号**包词（Markdown 习惯）会**提前结束模板字符串**，报一个与真实原因无关的 `missing ) after argument list`。模板字符串里写正则要用 `\\s`，注释里不要用反引号 |
| 滑块手柄的圆心不在轨道上 | Vuetify 把 `--v-slider-thumb-size` 通过**内联样式**设在 `.v-slider-thumb` 上，并用它算位置偏移（`left: calc(position - size/2)`）。把 handle 改成 4px 宽的竖条后，它仍按默认 20px 偏移，圆心会整体偏左约 8px。内联样式普通 CSS 覆盖不了，只能 `.md3-slider .v-slider-thumb { --v-slider-thumb-size: 4px !important }` |
| 只想要一根滚动条，却冒出三条 | ① 横向那条是 CSS 规范所致：只声明 `overflow-y: auto` 时 `overflow-x` **会被一并计算成 auto**，内容稍宽就出横向滚动条——要显式写 `overflow-x: hidden`（压缩后是 `overflow: hidden auto`）。② 多出的竖向那条是因为歌词区没吃满剩余空间（缺 `flex: 1 1 0`），它按内容高度撑高了外层窗格。注意 `flex-basis` 必须是 `0`，写 `auto` 会退回按内容计算 |
| 品牌图标边缘发虚 | 源图分辨率不够：B 站官方 favicon 只有 32×32，在 Retina 屏上按 24 CSS px 显示需要 48 物理像素，等于放大 1.5 倍。官方没有更大尺寸的公开资源（`apple-touch-icon.png` 等均 404），只能高质量重采样放大：`convert logo.ico -fill white -colorize 100% -filter Lanczos -resize 400% mask.png`。判据是 alpha 的灰阶级数——原始二值图只有 2 级（硬边），处理后 249 级（边缘有真实过渡） |
| 展开歌词的过渡动画写对了却看不到效果（测试里量不出来） | 无头环境不为「仅类名变化」重算样式：实测在同一个元素引用上设 `style.maxWidth = '100px'`，`offsetWidth`/`clientWidth`/`getBoundingClientRect()` **全都不变**（这本身就不符合 CSS 规则）。所以布局类断言在这里只能验证「DOM 状态切换」与「CSS 规则齐备」，**动画观感必须在真实浏览器里确认**。另外注意：模板字符串里写正则要用 `\\s`，写成 `\s` 会被 JS 当转义序列吃掉，正则静默失效 |

## 目录结构

```
src/
├── views/MusicView.vue      # 主界面（首页房间列表 + 播放页三窗格骨架）
├── components/              # Navigation / ChatPanel / Lyrics / 各类搜索弹窗 / HouseDialog / ShareDialog / BiliLive
├── composables/             # useSocket（通信层）/ useToast
├── stores/                  # Pinia：socket / player / chat / search / house
├── config/                  # environment（后端地址）、appearance（背景）
├── styles/                  # typography（MD3 type scale）/ md3-components（形状与窗格、导航栏契约）
├── theme/                   # md3（颜色角色派生）/ extractSeed（背景取色）/ state（明暗与 seed）
└── utils/                   # send / message / time / music 工具 + http
```

`scripts/render-verify.mjs` 可在无头 Firefox（WebDriver BiDi）下捕获页面运行时错误与渲染结果。
`scripts/verify-theme.ts` 校验 MD3 配色（`npm run verify:theme`）。
`.shot/verify-ui.mjs` 与 `.shot/smoke-ui.mjs` 校验布局与交互入口（见文末）。

## 主题的验证方式

两条互补的验证路径，都能在无 dev server 的情况下跑：

**① 离线断言**（`npm run verify:theme`）——覆盖配色生成与设计令牌：
MD3 角色齐全性、明暗对比度（含 24 个色相 × 明暗共 48 套配色的回归）、
非法 seed 回退、Vuetify 默认主题键覆盖、五类令牌、死代码检查，
以及在 Node 内直接驱动 Vuetify 响应式 theme 以证明"改 colors 会重算 CSS 变量"。

**② 浏览器端到端**（`scripts/verify-theme-runtime.mjs`）——覆盖离线断言够不到的部分：
CSS 变量是否真的写进 DOM、排版类是否真的生效（`getComputedStyle` 探针）、
点击切换是否热更新、真实渲染出的前景/背景对比度。

后者不需要 dev server，做法是用相对路径构建一份产物再由 `file://` 打开：

```bash
# ① 构建（--base=./ 使资源引用变成相对路径；不影响 dist/ 与 vite 配置）
npx vite build --base=./ --outDir=dist-verify --emptyOutDir

# ② 启动无头 Firefox（需放宽 file:// 同源策略以便加载 ES module）
mkdir -p ../.ffverify-profile
printf 'user_pref("security.fileuri.strict_origin_policy", false);\n' > ../.ffverify-profile/user.js
firefox --headless --no-remote --remote-debugging-port 9222 --profile "$PWD/../.ffverify-profile" about:blank &

# ③ 跑验证
THEME_VERIFY_URL="file://$PWD/dist-verify/index.html" node scripts/verify-theme-runtime.mjs
```

脚本每次运行前会清空 `JUSIC_*` 的 localStorage，保证从「深色 + 品牌配色」起步——
否则上一次跑完残留的 light/background 会让"点击浅色"无事发生，看起来像热更新失效。

## 布局的验证方式

`.shot/` 下两个脚本，对着**真实 dev server**（需要后端在跑，房间列表才有数据）驱动无头 Firefox：

```bash
firefox --headless --no-remote --remote-debugging-port 9222 \
  --profile "$PWD/.shot/ff-profile" about:blank &
BIDI_PORT=9222 node .shot/verify-ui.mjs   # 宽屏三窗格 / 窄屏单窗格 + 底部导航 + mini player
BIDI_PORT=9222 node .shot/smoke-ui.mjs    # 逐个点开原有入口，验证模板重排没有漏挂事件
```

- `verify-ui.mjs` 断言窗格的实际几何（宽屏 360 / 自适应 / 400，窄屏 420×652 与底部导航 80、mini player 64 严丝合缝）
  以及三种窗格的切换，并落盘 `v2-*.png` 截图。
- `smoke-ui.mjs` 覆盖首页 FAB→创建房间、进房、歌词展开、队列收藏、热歌榜、聊天窗格 5 个工具弹窗、
  投票切歌（会拿到后端真实响应）、浅色主题，共 18 项断言。
- **窄屏必须重新加载而不是在宽屏上 resize**：Vuetify 的断点是 JS 计算的，
  CDP 改视口后要等 resize 回流，重新加载验证的才是手机用户真实看到的样子。
- **Firefox 的 BiDi 只允许一个活动会话**，且脚本异常退出会留下占用的会话
  （下一次直接报 `Maximum number of active sessions`）。两个脚本都在超时路径上补了 `session.end`；
  真遇到占用就换端口 + 换 profile 另起实例，或用 `BIDI_PORT` 指到新实例。
- `verify-shortscreen.mjs` 覆盖矮屏适配：在 375×667 / 320×568 / 414×896 / 1440×900 四个视口下，
  断言容器查询按**窗格可用高度**（而不是视口高度）选中了正确档位，并逐项检查收起态无滚动条、
  歌词区可见行数、封面是否仍是正方形。布局类断言依赖环境会重算样式，脚本会先自检再决定跑还是跳过。
- 截图与 profile 已在 `.gitignore` 中排除（`ff-profile*` / `*.png` / `*.log`），脚本本身保留。
