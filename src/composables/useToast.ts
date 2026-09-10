import { ref } from 'vue'

/**
 * 轻量全局 toast（模块级单例状态）
 * 由 App.vue 中的 v-snackbar 消费渲染。
 */
const message = ref('')
const visible = ref(false)
const color = ref<'success' | 'error' | 'info' | 'warning'>('info')
const timeout = ref(2000)

function show(msg: string, c: 'success' | 'error' | 'info' | 'warning' = 'info', t = 2000) {
  message.value = msg
  color.value = c
  timeout.value = t
  visible.value = true
}

export function useToast() {
  return {
    message,
    visible,
    color,
    timeout,
    show,
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    info: (msg: string) => show(msg, 'info'),
    warning: (msg: string) => show(msg, 'warning'),
    hide: () => {
      visible.value = false
    },
  }
}
