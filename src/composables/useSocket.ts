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

/** 播放器无缝切歌预加载状态 */
let firstLoaded = 0
let secondUrl = ''

/** 倒计时退出 */
let closeClock: ReturnType<typeof setTimeout> | null = null
let onCloseHook: (() => void) | null = null

export function useSocket() {
  const socketStore = useSocketStore()
  const playerStore = usePlayerStore()
  const chatStore = useChatStore()
  const searchStore = useSearchStore()
  const houseStore = useHouseStore()
  const toast = useToast()

  /** 建立连接 */
  function connect(houseId: string, housePwd: string, connectType: string) {
    const socket = new SockJS(
      `${baseUrl}/server?houseId=${houseId}&housePwd=${housePwd}&connectType=${connectType}`,
    )
    sockJS = socket
    stompClient = Stomp.over(socket)

    stompClient.connect(
      {},
      () => {
        socketStore.setIsConnected(true)

        // 拦截底层 onmessage，自行解析服务端推送的"伪 STOMP 帧"
        const afterOnMessage = socket.onmessage
        socket.onmessage = (message: MessageEvent) => {
          messageHandler(message)
          if (afterOnMessage) afterOnMessage.call(socket, message)
        }

        // 拦截 onclose，断线自动重连
        const afterOnclose = socket.onclose
        socket.onclose = (e: CloseEvent) => {
          if (e.type === 'close') {
            socketStore.setIsConnected(false)
            chatStore.pushData({ type: 'notice', content: '网络异常, 请尝试重新连接服务器!' })
            toast.error('网络异常, 请尝试重新连接服务器!')
            setTimeout(() => {
              if (!socketStore.isConnected) {
                connect(houseStore.houseId, houseStore.housePwd, houseStore.connectType)
              }
            }, 444)
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
      },
    )

    socketStore.setSocketClient(sockJS)
    socketStore.setStompClient(stompClient)
  }

  /** 断开连接 */
  function disconnect() {
    if (stompClient) stompClient.disconnect()
    if (sockJS) sockJS.close()
    socketStore.setIsConnected(false)
  }

  /** 注册断开后的回调（用于回到首页等） */
  function setCloseHook(hook: () => void) {
    onCloseHook = hook
  }

  /** 当前歌曲加载完成，触发下一首预加载（无缝切歌） */
  function markLoaded() {
    firstLoaded = 1
    if (secondUrl) playerStore.setMusic2({ url: secondUrl })
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
        const data = { ...msg.data }
        const imgList: string[] = []
        const matchUrlList = data.content?.match(/\[picture\].*?:\/\/[^\s]*/gi) ?? null
        if (matchUrlList !== null) {
          for (const url of matchUrlList) {
            imgList.push(url.replace('picture:', ''))
            data.content = data.content.replace(url, '')
          }
        }
        data.images = imgList
        chatStore.pushData(data)
        break
      }
      case MessageType.GOODMODEL: {
        socketStore.setGood(msg.data === 'GOOD')
        break
      }
      case MessageType.PICK: {
        if (msg.message === 'goodlist') socketStore.setGood(true)
        playerStore.setPick(msg.data ?? [])
        // 预加载下一首（无缝切歌）
        if (msg.data?.length > 1) {
          secondUrl = msg.data[1].url
          if (firstLoaded === 1) playerStore.setMusic2({ url: secondUrl })
        }
        break
      }
      case MessageType.VOLUMN: {
        playerStore.setVolume(Number(msg.data))
        break
      }
      case MessageType.MUSIC: {
        playerStore.setLyric('')
        firstLoaded = 0
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
      case MessageType.SEARCH_PICTURE: {
        searchStore.setPictureCount(msg.data?.totalSize ?? 0)
        searchStore.setPictureData(msg.data?.data ?? [])
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

  /** 音乐 URL 清洗（对齐旧代码，处理酷我/网易的地址） */
  function cleanMusicUrl(url: string): string {
    if (!url) return url
    let result = url
    if (result.indexOf('kuwo.cn') !== -1 && result.indexOf('-') === -1) {
      const urls = result.split('.sycdn.')
      if (urls.length === 2) {
        const headUrls = urls[0].replace('http://', '').split('.')
        const lastHeadUrl = headUrls[headUrls.length - 1]
        result = `https://${lastHeadUrl}-sycdn.${urls[1]}&timestamp=${Date.now()}`
      }
    } else {
      result += result.indexOf('?') !== -1 ? `&timestamp=${Date.now()}` : `?timestamp=${Date.now()}`
      if (result.indexOf('/ymusic/') !== -1) {
        result = result.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
      }
    }
    return result.replace('http://', 'https://')
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
