import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage } from '@/types/house'

/** 聊天记录上限：超出后丢弃最旧消息，避免长时间开着页面导致 DOM 无限增长 */
const MAX_MESSAGES = 300

/**
 * 聊天状态（对齐旧 Vuex 的 state.chat）
 */
export const useChatStore = defineStore('chat', () => {
  const data = ref<ChatMessage[]>([])
  const message = ref('')

  /** 单调递增的消息 id：作为列表 key，裁剪旧消息时不会像 index 那样整体位移 */
  let nextId = 0

  function pushData(value: ChatMessage) {
    data.value.push({ ...value, id: ++nextId })
    if (data.value.length > MAX_MESSAGES) {
      data.value.splice(0, data.value.length - MAX_MESSAGES)
    }
  }
  function setData(value: ChatMessage[]) {
    data.value = value
  }
  function setMessage(value: string) {
    message.value = value
  }

  return { data, message, pushData, setData, setMessage }
})
