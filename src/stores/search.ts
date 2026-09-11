import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Music, SongList, UserInfo } from '@/types/music'

/** 搜索图片项 */
export interface PictureItem {
  url: string
}

/**
 * 搜索状态（对齐旧 Vuex 的 state.search / searchGd / searchUser）
 */
export const useSearchStore = defineStore('search', () => {
  // 音乐搜索
  const keyword = ref('')
  const data = ref<Music[]>([])
  const count = ref(0)

  // 图片搜索（斗图）
  const pictureKeyword = ref('')
  const pictureData = ref<PictureItem[]>([])
  const pictureCount = ref(0)

  // 歌单搜索
  const gdKeyword = ref('')
  const gdData = ref<SongList[]>([])
  const gdCount = ref(0)

  // 用户搜索
  const userKeyword = ref('')
  const userData = ref<UserInfo[]>([])
  const userCount = ref(0)

  function setKeyword(value: string) {
    keyword.value = value
  }
  /** 各列表同样在入口过滤空元素：模板里都是直接访问 row.xxx，一个 null 就会让整页渲染崩掉 */
  function setData(value: Music[]) {
    data.value = Array.isArray(value) ? value.filter((m) => m != null) : []
  }
  function setCount(value: number) {
    count.value = value
  }
  function setPictureKeyword(value: string) {
    pictureKeyword.value = value
  }
  function setPictureData(value: PictureItem[]) {
    pictureData.value = Array.isArray(value) ? value.filter((m) => m != null) : []
  }
  function setPictureCount(value: number) {
    pictureCount.value = value
  }
  function setGdKeyword(value: string) {
    gdKeyword.value = value
  }
  function setGdData(value: SongList[]) {
    gdData.value = Array.isArray(value) ? value.filter((m) => m != null) : []
  }
  function setGdCount(value: number) {
    gdCount.value = value
  }
  function setUserKeyword(value: string) {
    userKeyword.value = value
  }
  function setUserData(value: UserInfo[]) {
    userData.value = Array.isArray(value) ? value.filter((m) => m != null) : []
  }
  function setUserCount(value: number) {
    userCount.value = value
  }

  return {
    keyword,
    data,
    count,
    pictureKeyword,
    pictureData,
    pictureCount,
    gdKeyword,
    gdData,
    gdCount,
    userKeyword,
    userData,
    userCount,
    setKeyword,
    setData,
    setCount,
    setPictureKeyword,
    setPictureData,
    setPictureCount,
    setGdKeyword,
    setGdData,
    setGdCount,
    setUserKeyword,
    setUserData,
    setUserCount,
  }
})
