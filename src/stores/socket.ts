import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * WebSocket 连接与用户权限状态
 * （对齐旧 Vuex 的 state.socket）
 */
export const useSocketStore = defineStore('socket', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketClient = ref<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stompClient = ref<any>(null)

  const online = ref(0)
  const isConnected = ref(false)
  const userName = ref<string | null>(localStorage.getItem('USER_NAME'))
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
    isRoot,
    isAdmin,
    good,
    circle,
    setOnline,
    setIsConnected,
    setUserName,
    setRoot,
    setAdmin,
    setGood,
    setCircle,
    setSocketClient,
    setStompClient,
  }
})
