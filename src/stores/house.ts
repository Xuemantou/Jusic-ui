import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { House, HouseForm } from '@/types/house'

/**
 * 房间状态（对齐旧 Music.vue 中与房间相关的 data）
 */
export const useHouseStore = defineStore('house', () => {
  /** 当前房间的房间列表 */
  const houses = ref<House[]>([])
  /** 首页（未连接时）的房间列表 */
  const homeHouses = ref<House[]>([])
  /** 当前房间名 */
  const musichouse = ref('一起听歌吧')
  /** 当前房间 id / 密码 / 连接类型 */
  const houseId = ref('')
  const housePwd = ref('123')
  const connectType = ref('')
  /** 进入房间前的临时值（进入成功后回填） */
  const houseIdNoAction = ref('')
  const housePwdNoAction = ref('123')
  const connectTypeNoAction = ref('')
  /** 待进入房间的名字 */
  const houseForward = ref('')
  /** 播放中「创建房间」表单 */
  const house = ref<HouseForm>({
    name: '',
    desc: '',
    password: '',
    needPwd: false,
    enableStatus: false,
    retainKey: '',
    adminPwd: '',
  })
  /** 首页「创建房间」表单 */
  const homeHouse = ref<HouseForm>({
    name: '',
    desc: '',
    password: '',
    needPwd: false,
    enableStatus: false,
    retainKey: '',
    adminPwd: '',
  })
  /** 当前房间的默认点歌列表歌曲数（管理面板显示；由 DEFAULT_PLAYLIST 消息更新） */
  const defaultPlaylistSize = ref(0)
  /** 当前房间的完整信息（管理面板回填表单；由 HOUSE_INFO 消息更新） */
  const houseInfo = ref<House | null>(null)
  /**
   * 刚创建房间时记下的管理员密码。
   *
   * 只存在内存里（不持久化），用途是让创建者在本次会话内免密打开管理面板：
   * 后端的「创建者自动成为 admin」判断是 `WebSocket sessionId == houseId`，
   * 而 houseId 派生自 HTTP session —— 两者永不相等，所以创建者进房后其实也是 default，
   * 不缓存的话每次开面板都得手输一遍密码。
   */
  const adminPwdCache = ref('')

  function setHouses(value: House[]) {
    houses.value = value
  }
  function setHomeHouses(value: House[]) {
    homeHouses.value = value
  }
  function setMusichouse(value: string) {
    musichouse.value = value
  }
  function setDefaultPlaylistSize(value: number) {
    defaultPlaylistSize.value = Number.isFinite(value) ? value : 0
  }
  function setHouseInfo(value: House | null) {
    houseInfo.value = value
  }
  function setAdminPwdCache(value: string) {
    adminPwdCache.value = value
  }

  return {
    houses,
    homeHouses,
    musichouse,
    houseId,
    housePwd,
    connectType,
    houseIdNoAction,
    housePwdNoAction,
    connectTypeNoAction,
    houseForward,
    house,
    homeHouse,
    defaultPlaylistSize,
    houseInfo,
    adminPwdCache,
    setHouses,
    setHomeHouses,
    setMusichouse,
    setDefaultPlaylistSize,
    setHouseInfo,
    setAdminPwdCache,
  }
})
