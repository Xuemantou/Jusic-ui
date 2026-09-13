import SockJS from 'sockjs-client'
import { Stomp, type CompatClient } from '@stomp/stompjs'
import { baseUrl } from '@/config/environment'
import { MessageType, SUCCESS_CODE, type MessageResponse } from '@/types/message'
import { isKnownMessageType, parseMessageContent, parseMessageType } from '@/utils/messageUtils'
import { parseContent, parseInstruction } from '@/utils/sendUtils'
import { parseLyric } from '@/utils/musicUtils'
import { useSocketStore } from '@/stores/socket'
import { usePlayerStore } from '@/stores/player'
import { useChatStore } from '@/stores/chat'
import { useSearchStore } from '@/stores/search'
import { useHouseStore } from '@/stores/house'
import { useToast } from '@/composables/useToast'

/**
 * WebSocket 通信层（模块级单例）。
 *
 * 协议要点（与后端对齐）：
 * - 连接：SockJS 到 `/server?houseId=...&housePwd=...&connectType=...`
 * - 发送：STOMP SEND 帧（stompClient.send）
 * - 接收：后端直接 sendMessage 推送"伪 STOMP 帧"（`类型\nheaders\n\nJSON`），
 *   需拦截底层 socket 的 onmessage 自行解析（第一行=类型，最后一行=JSON）
 */

let sockJS: WebSocket | null = null
let stompClient: CompatClient | null = null

/** 无缝切歌：待预加载的下一首 URL（= cleanMusicUrl 后的地址，与真正播放的地址一致） */
let secondUrl = ''

/**
 * 音乐地址清洗结果缓存（原始地址 → 清洗后地址）。
 * 目的：让「预加载的第二首」与「后端随后推送播放的第二首」落到同一个 URL，
 * 否则时间戳/域名重写每次都会变，预加载等于白下。
 * 加 TTL 是因为清洗结果里带 timestamp，过旧可能被音源拒。
 */
const URL_CACHE_TTL = 5 * 60 * 1000
const URL_CACHE_MAX = 50
const cleanedUrlCache = new Map<string, { url: string; time: number }>()

/** 倒计时退出 */
let closeClock: ReturnType<typeof setTimeout> | null = null
let onCloseHook: (() => void) | null = null

/** 断线重连控制：最多尝试 5 次，间隔指数退避，避免服务不可达时自激循环 */
const RECONNECT_MAX = 5
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
/** 主动断开标记：用户/倒计时触发的 disconnect 不应再触发自动重连 */
let manualClose = false

export function useSocket() {
  const socketStore = useSocketStore()
  const playerStore = usePlayerStore()
  const chatStore = useChatStore()
  const searchStore = useSearchStore()
  const houseStore = useHouseStore()
  const toast = useToast()

  /** 建立连接 */
  function connect(houseId: string, housePwd: string, connectType: string) {
    // 复用一条连接：换房 / 重复调用时先断旧连接，避免多个 socket 与重复订阅
    if (stompClient) disconnect()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    // 主动关闭的是「旧」socket；旧 socket 的 onclose 是异步派发的，
    // 靠 manualClose 区分不了（见 onclose 里的 socket === sockJS 校验），这里必须复位
    manualClose = false
    // 注意：这里不能重置 reconnectAttempt —— 自动重连走的就是「onclose → 延时 → connect()」，
    // 一旦在此归零，退避次数永远累计不到上限，就成了无限重连。
    // 计数只在连接成功时归零，以及用户手动重连时清空。

    // 换房时清掉上一个房间的播放与状态残留，避免继续播旧歌、列表显示旧房间的点歌
    secondUrl = ''
    playerStore.setMusic2({})
    playerStore.setPick([])
    playerStore.setLyric('')
    playerStore.setLyrics({})
    playerStore.setProgress(0)
    playerStore.setTime('00:00 / 00:00')
    socketStore.setOnline(0)
    socketStore.setRoot(false)
    socketStore.setAdmin(false)
    socketStore.setGood(false)

    const socket = new SockJS(
      `${baseUrl}/server?houseId=${houseId}&housePwd=${housePwd}&connectType=${connectType}`,
    )
    sockJS = socket
    stompClient = Stomp.over(socket)

    stompClient.connect(
      {},
      () => {
        socketStore.setIsConnected(true)
        reconnectAttempt = 0

        // 拦截底层 onmessage，自行解析服务端推送的"伪 STOMP 帧"
        const afterOnMessage = socket.onmessage
        socket.onmessage = (message: MessageEvent) => {
          if (socket === sockJS) messageHandler(message)
          if (afterOnMessage) afterOnMessage.call(socket, message)
        }

        // 拦截 onclose，断线有限重试（指数退避）
        const afterOnclose = socket.onclose
        socket.onclose = (e: CloseEvent) => {
          // 只处理「当前活跃连接」的事件。
          // 被 connect() 主动关掉的旧 socket 也会异步派发 onclose（sockjs-client 在 _close() 里 setTimeout 派发），
          // 不区分就会在新连接刚建立后触发一次多余重连（掐断新连接 + 误报「网络异常」）。
          // 注意：不能用 e.target 判断 —— SockJS 用的是自研 EventTarget，事件对象没有 target 属性。
          if (e.type === 'close' && socket === sockJS) {
            socketStore.setIsConnected(false)
            scheduleReconnect()
          }
          if (afterOnclose) afterOnclose.call(socket, e)
        }

        // 恢复昵称
        const userName = window.localStorage.getItem('USER_NAME')
        if (userName) settingName(userName)

        subscribe()
      },
      () => {
        // 连接失败回调
        socketStore.setIsConnected(false)
        scheduleReconnect()
      },
    )

    socketStore.setSocketClient(sockJS)
    socketStore.setStompClient(stompClient)
  }

  /** 断线重连：有限次数 + 指数退避；用尽后提示用户手动重连，不再无限建连 */
  function scheduleReconnect() {
    if (manualClose || socketStore.isConnected) return
    if (reconnectAttempt >= RECONNECT_MAX) {
      chatStore.pushData({
        type: 'notice',
        content: `已尝试重连 ${RECONNECT_MAX} 次仍未成功，请点击「重新连接」或刷新页面`,
      })
      toast.error('重连失败，请手动重连')
      return
    }
    reconnectAttempt += 1
    if (reconnectAttempt === 1) {
      chatStore.pushData({ type: 'notice', content: '网络异常, 请尝试重新连接服务器!' })
      toast.error('网络异常, 请尝试重新连接服务器!')
    }
    const delay = 444 * reconnectAttempt
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!socketStore.isConnected) {
        connect(houseStore.houseId, houseStore.housePwd, houseStore.connectType)
      }
    }, delay)
  }

  /** 用户手动重连（清空重试计数后立即发起） */
  function reconnect() {
    reconnectAttempt = 0
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    connect(houseStore.houseId, houseStore.housePwd, houseStore.connectType)
  }

  /** 断开连接（主动断开不触发自动重连） */
  function disconnect() {
    manualClose = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    // 不重置 reconnectAttempt：connect() 内部也会先 disconnect()，
    // 在这里归零会让自动重连的退避计数永远回到 0（即无限重连）
    if (stompClient) stompClient.disconnect()
    if (sockJS) sockJS.close()
    sockJS = null
    stompClient = null
    socketStore.setIsConnected(false)
    socketStore.setSocketClient(null)
    socketStore.setStompClient(null)
  }

  /** 注册断开后的回调（用于回到首页等） */
  function setCloseHook(hook: (() => void) | null) {
    onCloseHook = hook
  }

  /** 当前歌曲加载完成：兜底再确认一次预加载已就位（正常情况下 PICK/MUSIC 分支已设好） */
  function markLoaded() {
    if (secondUrl && playerStore.music2.url !== secondUrl) {
      playerStore.setMusic2({ url: secondUrl })
    }
  }

  /** 倒计时退出（分钟，0 表示取消） */
  function setTimeToClose(minutes: number) {
    if (closeClock) clearTimeout(closeClock)
    closeClock = null
    if (minutes !== 0) {
      closeClock = setTimeout(() => {
        disconnect()
        onCloseHook?.()
      }, minutes * 60 * 1000)
    }
  }

  /** 订阅 topic（与旧代码一致） */
  function subscribe() {
    if (!stompClient) return
    stompClient.subscribe('/topic/chat', (response) => {
      try {
        const body = JSON.parse(response.body)
        if (body.code == SUCCESS_CODE) {
          toast.info(`系统通知：${body.data}`)
        }
      } catch {
        // ignore
      }
    })
    stompClient.subscribe('/topic/music/order', () => {
      // 占位，与旧代码一致
    })
  }

  /** 发送 STOMP 消息 */
  function send(destination: string, body?: unknown) {
    if (!stompClient) return
    stompClient.send(destination, {}, body ? JSON.stringify(body) : '')
  }

  /** 设置昵称 */
  function settingName(name: string) {
    send('/setting/name', { name, sendTime: Date.now() })
  }

  /** 投票切歌 */
  function musicSkipVote() {
    send('/music/skip/vote')
  }

  /** 解析并发送聊天指令 */
  function sendHandler(chatMessage: string, sourceChat: string) {
    if (!stompClient) return
    const instruction = parseInstruction(chatMessage)
    let content = ''

    switch (instruction) {
      case '点歌':
        content = parseContent(instruction, chatMessage)
        if (content !== '') {
          send('/music/pick', { name: content, source: sourceChat, sendTime: Date.now() })
        }
        break
      case '投票切歌':
        musicSkipVote()
        break
      case '设置昵称':
        content = parseContent(instruction, chatMessage)
        if (content !== '') settingName(content)
        break
      case '通知':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send(`/chat/notice/${content}`, {})
        break
      case '公告':
        content = parseContent(instruction, chatMessage)
        send('/chat/announce', { content })
        break
      case 'root':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/auth/root', { password: content, sendTime: Date.now() })
        break
      case 'admin':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/auth/admin', { password: content, sendTime: Date.now() })
        break
      case '置顶音乐':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/music/top', { id: content, sendTime: Date.now() })
        break
      case '删除音乐':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/music/delete', { id: content, sendTime: Date.now() })
        break
      case '设置默认列表':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/music/setDefaultPlaylist', { id: content, source: sourceChat })
        break
      case '清空列表':
        send('/music/clear', '')
        break
      case '清空默认列表':
        send('/music/clearDefaultPlayList', '')
        break
      case '音乐黑名单':
        send('/music/blackmusic', '')
        break
      case '默认列表歌曲数':
        send('/music/playlistSize', '')
        break
      case '用户黑名单':
        send('/chat/blackuser', '')
        break
      case '调整音量':
        content = parseContent(instruction, chatMessage)
        if (content === '') content = '0'
        send(`/music/volumn/${content}`, '')
        break
      case '倒计时退出':
        content = parseContent(instruction, chatMessage)
        if (!/^\d+$/.test(content)) {
          toast.info('请输入要在几分钟后退出')
        } else {
          setTimeToClose(Number(content))
          toast.info(`设置成功，将在${content}分钟后退出`)
        }
        break
      case '取消退出':
        setTimeToClose(0)
        toast.info('取消成功')
        break
      case '修改密码':
        content = parseContent(instruction, chatMessage)
        send(`/auth/adminpwd/${content}`, '')
        break
      case '修改root密码':
        content = parseContent(instruction, chatMessage)
        send(`/auth/rootpwd/${content}`, '')
        break
      case '投票切歌率':
        content = parseContent(instruction, chatMessage)
        send(`/music/vote/${content}`, '')
        break
      case '点赞模式':
        send('/music/goodmodel/true', '')
        break
      case '退出点赞模式':
        send('/music/goodmodel/false', '')
        break
      case '单曲循环':
        send('/music/musiccirclemodel/true', '')
        break
      case '列表循环':
        send('/music/musiclistmodel/true', '')
        break
      case '退出单曲循环':
        send('/music/musiccirclemodel/false', '')
        break
      case '退出列表循环':
        send('/music/musiclistmodel/false', '')
        break
      case '随机模式':
        send('/music/randommodel/true', '')
        break
      case '退出随机模式':
        send('/music/randommodel/false', '')
        break
      case '留存房间':
        send('/house/retain/true', '')
        break
      case '不留存房间':
        send('/house/retain/false', '')
        break
      case '禁止点歌':
        send('/music/banchoose/true', '')
        break
      case '禁止切歌':
        send('/music/banswitch/true', '')
        break
      case '启用切歌':
        send('/music/banswitch/false', '')
        break
      case '启用点歌':
        send('/music/banchoose/false', '')
        break
      case '拉黑用户':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/chat/black', { sessionId: content, sendTime: Date.now() })
        break
      case '漂白用户':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/chat/unblack', { sessionId: content, sendTime: Date.now() })
        break
      case '设置点歌人':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send(`/auth/setPicker/${content}`, '')
        break
      case '取消点歌人':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send(`/auth/setNoPicker/${content}`, '')
        break
      case '设置切歌人':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send(`/auth/setVoter/${content}`, '')
        break
      case '取消切歌人':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send(`/auth/setNoVoter/${content}`, '')
        break
      case '拉黑音乐':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/music/black', { id: content, sendTime: Date.now() })
        break
      case '漂白音乐':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/music/unblack', { id: content, sendTime: Date.now() })
        break
      case '@管理员':
        content = parseContent(instruction, chatMessage)
        if (content !== '') send('/mail/send', { content, sendTime: Date.now() })
        break
      default:
        if (chatMessage && chatMessage.length > 0) {
          send('/chat', { content: chatMessage, sendTime: Date.now() })
        }
        break
    }

    chatStore.setMessage('')
  }

  /** 处理服务端推送的消息 */
  function messageHandler(source: MessageEvent) {
    const raw = source.data as string
    if (!isKnownMessageType(raw)) return
    const type = parseMessageType(raw)
    const msg = parseMessageContent(raw)
    if (!msg) return
    handleMessage(type, msg)
  }

  function handleMessage(type: string, msg: MessageResponse<any>) {
    switch (type) {
      case MessageType.ONLINE: {
        const count = msg.data?.count
        if (count !== undefined && count !== null && count !== '') {
          socketStore.setOnline(count)
        }
        break
      }
      case MessageType.HOUSE_USER: {
        const users = msg.data as Array<{ nickName: string; sessionId: string }>
        users?.forEach((u, i) => {
          chatStore.pushData({ type: 'notice', content: `${i + 1}.${u.nickName}[${u.sessionId}]` })
        })
        break
      }
      case MessageType.NOTICE: {
        if (msg.message) {
          chatStore.pushData({ type: 'notice', content: msg.message })
          if (msg.message === '点歌成功') toast.info(msg.message)
          else toast.info(msg.message)
        }
        break
      }
      case MessageType.ANNOUNCEMENT: {
        const content = msg.data?.content
        if (content) toast.info(`公告：${content}`)
        break
      }
      case MessageType.CHAT: {
        chatStore.pushData({ ...msg.data })
        break
      }
      case MessageType.GOODMODEL: {
        socketStore.setGood(msg.data === 'GOOD')
        break
      }
      case MessageType.PICK: {
        if (msg.message === 'goodlist') socketStore.setGood(true)
        playerStore.setPick(msg.data ?? [])
        // 预加载下一首（无缝切歌）：点歌列表一到就预热第二首
        refreshPreload()
        break
      }
      case MessageType.VOLUMN: {
        // 服务端下发的音量只影响当前播放，不覆盖本地偏好（本地偏好由用户拖动滑块写入）
        playerStore.setVolume(Number(msg.data))
        break
      }
      case MessageType.MUSIC: {
        playerStore.setLyric('')
        if (msg.data) {
          let url = cleanMusicUrl(msg.data.url)
          msg.data.url = url
          playerStore.setMusic(msg.data)
          document.title = msg.data.name
          if (!msg.data.lyric) {
            playerStore.setLyrics({})
          } else {
            playerStore.setLyrics(parseLyric(msg.data.lyric))
          }
          // 不能在这里清空预加载：点歌后端是先推 PICK 再推 MUSIC，
          // 清空会把刚预热的第二首丢掉。改为按当前列表重新预热（URL 走缓存，命中同一地址）
          refreshPreload()
        }
        break
      }
      case MessageType.AUTH_ROOT: {
        chatStore.pushData({ type: 'notice', content: msg.message })
        socketStore.setRoot(Number(msg.code) === SUCCESS_CODE)
        break
      }
      case MessageType.AUTH_ADMIN: {
        chatStore.pushData({ type: 'notice', content: msg.message })
        socketStore.setAdmin(Number(msg.code) === SUCCESS_CODE)
        break
      }
      case MessageType.SETTING_NAME: {
        chatStore.pushData({ type: 'notice', content: msg.message })
        socketStore.setUserName(msg.data?.name ?? '')
        break
      }
      case MessageType.SEARCH: {
        searchStore.setCount(msg.data?.totalSize ?? 0)
        searchStore.setData(msg.data?.data ?? [])
        break
      }
      case MessageType.SEARCH_SONGLIST: {
        searchStore.setGdCount(msg.data?.totalSize ?? 0)
        searchStore.setGdData(msg.data?.data ?? [])
        break
      }
      case MessageType.SEARCH_USER: {
        searchStore.setUserCount(msg.data?.totalSize ?? 0)
        searchStore.setUserData(msg.data?.data ?? [])
        break
      }
      case MessageType.SEARCH_HOUSE: {
        houseStore.setHouses(sortByPopulation(msg.data ?? []))
        break
      }
      case MessageType.EDIT_HOUSE: {
        // 房间信息被（自己或别人）改动后广播给全房间：app bar 上显示的就是房间名，要跟着更新
        const edited = msg.data as { name?: string } | null
        if (Number(msg.code) === SUCCESS_CODE) {
          if (edited?.name) houseStore.setMusichouse(edited.name)
          toast.success(msg.message)
        } else {
          toast.error(msg.message)
        }
        break
      }
      case MessageType.HOUSE_DESTROYED: {
        toast.info(msg.message)
        houseStore.setHouseInfo(null)
        // 房间没了，所有人都得退回首页：复用「倒计时退出」注册的回首页钩子
        onCloseHook?.()
        break
      }
      case MessageType.HOUSE_INFO: {
        if (Number(msg.code) === SUCCESS_CODE) {
          houseStore.setHouseInfo((msg.data as never) ?? null)
        } else {
          toast.error(msg.message)
        }
        break
      }
      case MessageType.DEFAULT_PLAYLIST: {
        houseStore.setDefaultPlaylistSize(Number(msg.data ?? 0))
        break
      }
      case MessageType.ENTER_HOUSE_START:
      case MessageType.ADD_HOUSE_START: {
        if (Number(msg.code) === SUCCESS_CODE) playerStore.setPick([])
        break
      }
      case MessageType.ENTER_HOUSE: {
        if (Number(msg.code) === SUCCESS_CODE) {
          houseStore.houseId = houseStore.houseIdNoAction
          houseStore.housePwd = houseStore.housePwdNoAction
          houseStore.connectType = houseStore.connectTypeNoAction
          houseStore.setMusichouse(houseStore.houseForward)
          const userName = window.localStorage.getItem('USER_NAME')
          if (userName) settingName(userName)
        } else {
          toast.error(msg.message)
        }
        break
      }
      case MessageType.ADD_HOUSE: {
        if (Number(msg.code) === SUCCESS_CODE) {
          houseStore.setMusichouse(houseStore.house.name)
          houseStore.houseId = msg.data
          houseStore.housePwd = houseStore.house.password
          houseStore.connectType = ''
          // 记下这次创建用的管理员密码：本次会话内开管理面板就不必再手输
          houseStore.setAdminPwdCache(houseStore.house.adminPwd)
          const userName = window.localStorage.getItem('USER_NAME')
          if (userName) settingName(userName)
        } else {
          toast.error(msg.message)
        }
        break
      }
      default:
        break
    }
  }

  /**
   * 按当前点歌列表刷新「下一首」预加载。
   *
   * 关键点：secondUrl 必须是 cleanMusicUrl 之后、与真正播放时完全一致的地址，
   * 否则预加载下载的是另一个资源（http/https、域名重写、timestamp 都不同），收益为零。
   * cleanMusicUrl 内部对原始地址做了短时缓存，因此这里与 MUSIC 分支会得到同一个 URL。
   */
  function refreshPreload() {
    const nextRaw = playerStore.pick?.[1]?.url ?? ''
    secondUrl = nextRaw ? cleanMusicUrl(nextRaw) : ''
    playerStore.setMusic2(secondUrl ? { url: secondUrl } : {})
  }

  /** 音乐 URL 清洗（对齐旧代码，处理网易的地址） */
  function cleanMusicUrl(url: string): string {
    if (!url) return url
    // 同一原始地址在短时间内复用同一结果：保证「预加载的那一份」就是「即将播放的那一份」
    const hit = cleanedUrlCache.get(url)
    if (hit && Date.now() - hit.time < URL_CACHE_TTL) return hit.url
    let result = url
    result += result.indexOf('?') !== -1 ? `&timestamp=${Date.now()}` : `?timestamp=${Date.now()}`
    if (result.indexOf('/ymusic/') !== -1) {
      result = result.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
    }
    result = result.replace('http://', 'https://')
    cleanedUrlCache.set(url, { url: result, time: Date.now() })
    if (cleanedUrlCache.size > URL_CACHE_MAX) {
      const oldest = cleanedUrlCache.keys().next().value
      if (oldest !== undefined) cleanedUrlCache.delete(oldest)
    }
    return result
  }

  /** 按在线人数冒泡排序（对齐旧代码） */
  function sortByPopulation<T extends { needPwd: boolean; population?: number }>(houseList: T[]): T[] {
    const arr = [...houseList]
    const size = arr.length
    for (let i = 0; i < size - 1; i++) {
      for (let j = 0; j < size - i - 1; j++) {
        if (compareLessThan(arr, j, j + 1)) {
          const temp = arr[j]
          arr[j] = arr[j + 1]
          arr[j + 1] = temp
        }
      }
    }
    return arr
  }

  function compareLessThan<T extends { needPwd: boolean; population?: number }>(
    houseList: T[],
    x: number,
    y: number,
  ): boolean {
    const a = houseList[x]
    const b = houseList[y]
    if (a.needPwd !== b.needPwd) {
      if (a.needPwd) {
        if (b.population! > 0) return true
        else if (a.population! > 0) return false
        else return true
      } else {
        if (a.population! > 0) return false
        else if (b.population! > 0) return true
        else return false
      }
    } else {
      return (a.population ?? 0) < (b.population ?? 0)
    }
  }

  return {
    connect,
    disconnect,
    reconnect,
    setCloseHook,
    setTimeToClose,
    markLoaded,
    send,
    settingName,
    musicSkipVote,
    sendHandler,
    getSocketClient: () => sockJS,
    getStompClient: () => stompClient,
  }
}
