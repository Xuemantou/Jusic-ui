import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Music } from '@/types/music'

/**
 * 播放器状态（对齐旧 Vuex 的 state.player）
 */
export const usePlayerStore = defineStore('player', () => {
  const pick = ref<Music[]>([])
  const music = ref<Music>({} as Music)
  const lyrics = ref<Record<number, string>>({})
  const lyric = ref('')
  const volume = ref<number>(
    localStorage.getItem('VOLUME') ? Number(localStorage.getItem('VOLUME')) : 10,
  )
  /** 用户自己设定的音量偏好：只在用户拖动滑块时更新，服务端下发的音量不会覆盖它 */
  const localVolume = ref<number>(volume.value)
  const progress = ref(0)
  const time = ref('00:00 / 00:00')
  const music2 = ref<{ url?: string }>({})

  /**
   * 设置点歌列表。
   * 后端推送的 data 里可能出现 null/undefined 元素（列表并发增删时尤其容易），
   * 而列表是用 v-for 直接渲染的，`row.id` 一访问就会抛 TypeError 让整页白屏，故在入口过滤。
   */
  function setPick(value: Music[]) {
    const list = Array.isArray(value) ? value : []
    const cleaned = list.filter((m) => m != null)
    if (cleaned.length !== list.length) {
      console.warn(`[jusic] 点歌列表含 ${list.length - cleaned.length} 个空元素，已丢弃（后端数据异常）`)
    }
    pick.value = cleaned
  }
  function setMusic(value: Music) {
    music.value = value
  }
  function setLyrics(value: Record<number, string>) {
    lyrics.value = value
  }
  function setLyric(value: string) {
    lyric.value = value
  }
  /** 应用音量（服务端推送或用户操作），不写本地偏好 */
  function setVolume(value: number) {
    volume.value = value
  }
  /** 用户主动调整：同时持久化为本地偏好 */
  function setLocalVolume(value: number) {
    volume.value = value
    localVolume.value = value
    window.localStorage.setItem('VOLUME', String(value))
  }
  function setProgress(value: number) {
    progress.value = value
  }
  function setTime(value: string) {
    time.value = value
  }
  function setMusic2(value: { url?: string }) {
    music2.value = value
  }

  return {
    pick,
    music,
    lyrics,
    lyric,
    volume,
    localVolume,
    progress,
    time,
    music2,
    setPick,
    setMusic,
    setLyrics,
    setLyric,
    setVolume,
    setLocalVolume,
    setProgress,
    setTime,
    setMusic2,
  }
})
