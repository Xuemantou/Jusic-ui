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
  const progress = ref(0)
  const time = ref('00:00 / 00:00')
  const music2 = ref<{ url?: string }>({})

  function setPick(value: Music[]) {
    pick.value = value
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
  function setVolume(value: number) {
    volume.value = value
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
    progress,
    time,
    music2,
    setPick,
    setMusic,
    setLyrics,
    setLyric,
    setVolume,
    setProgress,
    setTime,
    setMusic2,
  }
})
