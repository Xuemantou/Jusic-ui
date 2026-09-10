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
  })
  /** 首页「创建房间」表单 */
  const homeHouse = ref<HouseForm>({
    name: '',
    desc: '',
    password: '',
    needPwd: false,
    enableStatus: false,
    retainKey: '',
  })

  function setHouses(value: House[]) {
    houses.value = value
  }
  function setHomeHouses(value: House[]) {
    homeHouses.value = value
  }
  function setMusichouse(value: string) {
    musichouse.value = value
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
    setHouses,
    setHomeHouses,
    setMusichouse,
  }
})
