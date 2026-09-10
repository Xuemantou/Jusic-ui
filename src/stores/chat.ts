import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage } from '@/types/house'

/**
 * 聊天状态（对齐旧 Vuex 的 state.chat）
 */
export const useChatStore = defineStore('chat', () => {
  const data = ref<ChatMessage[]>([])
  const message = ref('')

  function pushData(value: ChatMessage) {
    data.value.push(value)
  }
  function setData(value: ChatMessage[]) {
    data.value = value
  }
  function setMessage(value: string) {
    message.value = value
  }

  return { data, message, pushData, setData, setMessage }
})
