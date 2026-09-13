import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * WebSocket 连接与用户权限状态
 * （对齐旧 Vuex 的 state.socket）
 */
export const useSocketStore = defineStore('socket', () => {
  // 连接实例只在 useSocket 内部使用，这里只做透出，避免 any 扩散
  const socketClient = ref<unknown>(null)
  const stompClient = ref<unknown>(null)

  const online = ref(0)
  const isConnected = ref(false)
  const userName = ref<string | null>(localStorage.getItem('USER_NAME'))
  /**
   * 聊天默认音源（wy / qq）。
   * 原来它是 ChatPanel 内部的 ref，刷新即丢，每次进房都要重新选一遍。
   * 已移除咪咕音源：历史存值若是 mg 则回落到 wy，避免界面无选中项、点歌带上无效 source。
   */
  const chatSource = ref<string>(
    localStorage.getItem('JUSIC_CHAT_SOURCE') === 'qq' ? 'qq' : 'wy',
  )
  const isRoot = ref(false)
  const isAdmin = ref(false)
  const good = ref(false)
  const circle = ref(false)

  function setOnline(value: number) {
    online.value = value
  }
  function setIsConnected(value: boolean) {
    isConnected.value = value
  }
  function setUserName(value: string) {
    userName.value = value
    window.localStorage.setItem('USER_NAME', value)
  }
  function setChatSource(value: string) {
    chatSource.value = value
    window.localStorage.setItem('JUSIC_CHAT_SOURCE', value)
  }
  function setRoot(value: boolean) {
    isRoot.value = value
  }
  function setAdmin(value: boolean) {
    isAdmin.value = value
  }
  function setGood(value: boolean) {
    good.value = value
  }
  function setCircle(value: boolean) {
    circle.value = value
  }
  function setSocketClient(value: unknown) {
    socketClient.value = value
  }
  function setStompClient(value: unknown) {
    stompClient.value = value
  }

  return {
    socketClient,
    stompClient,
    online,
    isConnected,
    userName,
    chatSource,
    isRoot,
    isAdmin,
    good,
    circle,
    setOnline,
    setIsConnected,
    setUserName,
    setChatSource,
    setRoot,
    setAdmin,
    setGood,
    setCircle,
    setSocketClient,
    setStompClient,
  }
})
