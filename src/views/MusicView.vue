<template>
  <div>
    <!-- 背景：首页使用可替换的背景图 -->
    <div
      v-if="!isPlay"
      class="page-bg"
      :style="{ backgroundImage: `url(${homeBackground})` }"
    >
      <div class="page-bg-mask" :style="{ opacity: homeBackgroundMask }" />
    </div>
    <!-- 背景：播放页使用当前专辑封面模糊（动态） -->
    <div v-else-if="albumBlurEnabled" class="album-bg">
      <img
        v-if="music.pictureUrl"
        :src="music.pictureUrl"
        alt=""
        :style="{ opacity: albumBlurOpacity }"
      />
    </div>

    <!-- 未播放：首页（房间列表 + 创建） -->
    <div v-if="!isPlay" class="home-page">
      <div class="d-flex justify-space-between pa-4">
        <v-btn color="info" variant="text" prepend-icon="mdi-heart" @click="openLink('https://tx.alang.run/sponsor')">
          赞赏
        </v-btn>
        <v-btn color="info" variant="text" prepend-icon="mdi-android" @click="openLink('https://tx.alang.run/release')">
          APP
        </v-btn>
      </div>

      <div class="d-flex justify-center align-center px-4">
        <v-text-field
          v-model="houseSearch"
          placeholder="房间搜索"
          variant="outlined"
          density="compact"
          hide-details
          class="mr-3"
          style="max-width: 200px"
        />
        <v-switch v-model="houseHide" label="隐藏空房" color="primary" hide-details density="compact" />
      </div>

      <div class="d-flex flex-wrap justify-center px-4 py-4">
        <v-badge
          v-for="house in filteredHomeHouses"
          :key="house.id"
          :content="house.population || '0'"
          color="info"
          class="ma-1"
        >
          <v-chip color="teal" @click="enterHomeHouse(house.id, house.name, house.needPwd)">
            <v-avatar :color="house.needPwd ? 'blue' : 'green'" size="32" start>
              <v-icon>{{ house.needPwd ? 'mdi-lock' : 'mdi-lock-open-variant' }}</v-icon>
            </v-avatar>
            <v-tooltip activator="parent" location="top">{{ house.desc }}</v-tooltip>
            {{ house.name }}
          </v-chip>
        </v-badge>
      </div>

      <div class="text-center px-4 pb-6">
        <div class="d-flex justify-center flex-wrap ga-2" style="max-width: 640px; margin: 0 auto">
          <v-text-field
            v-model="homeHouse.name"
            placeholder="房间名称"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 180px"
          />
          <v-text-field
            v-model="homeHouse.desc"
            placeholder="房间描述"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 180px"
          />
          <v-text-field
            v-if="homeHouse.needPwd"
            v-model="homeHouse.password"
            placeholder="房间密码"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 180px"
          />
        </div>
        <div class="d-flex justify-center align-center mt-3">
          <v-switch v-model="homeHouse.needPwd" label="房间密码" color="primary" hide-details density="compact" class="mr-4" />
          <v-btn color="primary" @click="createHomeHouse">创建房间</v-btn>
          <v-switch
            v-model="homeHouse.enableStatus"
            label="房间永存"
            color="primary"
            hide-details
            density="compact"
            class="ml-4"
          />
        </div>
      </div>
    </div>

    <!-- 播放中：主界面 -->
    <template v-else>
      <Navigation :musichouse="houseStore.musichouse" @open-share-dialog="openShare = true" />

      <v-main class="content-layer">
        <v-container fluid>
          <v-row>
            <!-- 左栏：播放器 + 点歌列表 -->
            <v-col cols="12" md="8">
              <v-row>
                <v-col cols="12" md="5" class="text-center py-6">
                  <v-avatar :size="albumRotateSize" class="album-avatar">
                    <v-img
                      :src="music.pictureUrl || logo"
                      :class="albumRotate ? 'album album-rotate' : 'album'"
                      cover
                    />
                  </v-avatar>
                </v-col>

                <v-col cols="12" md="7">
                  <div class="text-h5 font-weight-regular mb-2 d-flex align-center">
                    <span class="text-truncate">{{ music?.name || '' }}</span>
                    <v-spacer />
                    <v-btn size="small" variant="text" color="teal" prepend-icon="mdi-weather-sunny" @click="searchTop">
                      热歌榜
                    </v-btn>
                    <v-btn size="small" variant="text" color="teal" prepend-icon="mdi-history" @click="openPickHistory = true">
                      点歌历史
                    </v-btn>
                    <v-btn size="small" variant="text" color="red" prepend-icon="mdi-heart" @click="openFavorite = true">
                      我的收藏
                    </v-btn>
                  </div>
                  <div class="text-body-2 mb-4">
                    专辑: {{ music.album ? '《' + music.album.name + '》' : '' }} &nbsp; 歌手:
                    {{ music?.artist || '' }}
                  </div>

                  <div class="text-body-2 mb-1">
                    <span
                      class="cursor-pointer"
                      :style="{ color: openLyrics ? 'orange' : '#009688' }"
                      @click="openLyrics = !openLyrics"
                    >
                      {{ openLyrics ? '↑↑↑' : '↓↓↓' }} {{ lyric }}
                    </span>
                  </div>

                  <v-progress-linear :model-value="progress" color="primary" height="6" rounded class="mb-2" />
                  <div class="text-caption text-right">{{ playerTime }}</div>

                  <div class="d-flex align-center">
                    <v-icon color="teal" class="mr-2">mdi-volume-high</v-icon>
                    <v-slider v-model="volume" color="primary" min="0" max="100" hide-details />
                  </div>
                </v-col>
              </v-row>

              <!-- 歌词 -->
              <div v-if="openLyrics" class="mb-4">
                <Lyrics :lyrics="lyrics" :current-time="currentTime" />
              </div>

              <!-- 点歌列表 -->
              <v-table density="compact" hover>
                <thead>
                  <tr>
                    <th class="text-left">ID</th>
                    <th class="text-left">歌曲</th>
                    <th class="text-center">歌手</th>
                    <th class="text-center">专辑</th>
                    <th class="text-center">点歌人</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in pick" :key="row?.id + '-' + index">
                    <td>{{ index + 1 }}</td>
                    <td>
                      <v-btn
                        :icon="favoriteMap[row?.id] ? 'mdi-heart' : 'mdi-heart-outline'"
                        size="x-small"
                        :color="favoriteMap[row?.id] ? 'red' : 'grey'"
                        variant="text"
                        @click="favoriteMap[row?.id] ? removeCollect(row) : collectMusic(row)"
                      />
                      <v-btn
                        v-if="index !== 0 && socketStore.good"
                        icon="mdi-thumb-up"
                        size="x-small"
                        color="teal"
                        variant="text"
                        @click="goodMusic(row)"
                      />
                      {{ isAdminView ? row?.name + `[${row?.id}]` : row?.name }}
                    </td>
                    <td class="text-center">{{ row?.artist }}</td>
                    <td class="text-center">{{ row?.album ? '《' + row.album.name + '》' : '' }}</td>
                    <td class="text-center">
                      {{
                        isAdminView
                          ? row?.nickName + (row?.sessionId ? `[${row.sessionId}]` : '')
                          : row?.nickName
                      }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-col>

            <!-- 右栏：聊天 -->
            <v-col cols="12" md="4">
              <div class="text-center mb-2">
                <v-btn color="teal" variant="tonal" prepend-icon="mdi-account-balance" @click="openHouse = true">
                  听歌房
                </v-btn>
              </div>
              <ChatPanel
                @open-search="openSearch = true"
                @open-picture-search="openPictureSearch = true"
                @open-song-list="openSongList = true"
                @open-user-search="openUserSearch = true"
                @open-bili="openBili = true"
              />
            </v-col>
          </v-row>
        </v-container>
      </v-main>

      <!-- 音乐搜索弹窗 -->
      <SearchDialog v-model="openSearch" />
      <!-- 斗图搜索弹窗 -->
      <ChatSearchPicture v-model="openPictureSearch" />
      <!-- 歌单搜索弹窗 -->
      <SongListDialog v-model="openSongList" @pick="onPickSongList" />
      <!-- 用户搜索弹窗 -->
      <UserSearchDialog v-model="openUserSearch" @pick-user="onPickUser" />
      <!-- 听歌房抽屉 -->
      <HouseDialog v-model="openHouse" />
      <!-- 分享弹窗 -->
      <ShareDialog v-model="openShare" />
      <!-- B站直播弹幕点歌 -->
      <BiliLive v-model="openBili" :playing-id="music.id" />

      <!-- 我的收藏弹窗 -->
      <v-dialog v-model="openFavorite" max-width="600">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>我的收藏</span>
            <v-spacer />
            <v-btn size="small" variant="text" color="error" @click="removeAllCollect">清空</v-btn>
            <v-btn icon size="small" variant="text" @click="openFavorite = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-list max-height="420" class="overflow-y-auto">
              <v-list-item v-for="(item, key) in favoriteMap" :key="key">
                <v-list-item-title>{{ item.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.artist }}</v-list-item-subtitle>
                <template #append>
                  <v-btn icon size="small" variant="text" color="red" @click="removeCollect(item)">
                    <v-icon>mdi-heart-off</v-icon>
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-dialog>

      <!-- 点歌历史弹窗 -->
      <v-dialog v-model="openPickHistory" max-width="600">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>点歌历史</span>
            <v-spacer />
            <v-btn size="small" variant="text" color="error" @click="clearPickHistory">清空</v-btn>
            <v-btn icon size="small" variant="text" @click="openPickHistory = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-list max-height="420" class="overflow-y-auto">
              <v-list-item v-for="(item, i) in pickHistory" :key="item.id + '-' + i">
                <v-list-item-title>{{ item.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.artist }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-dialog>
    </template>

    <!-- 音频播放器 -->
    <audio
      ref="audioEl"
      :src="music.url || undefined"
      :volume="playerStore.volume / 100"
      preload="auto"
      autoplay
      @timeupdate="musicTimeUpdate"
      @loadedmetadata="syncProgressFromPushTime"
      @canplaythrough="markLoaded"
      style="display: none"
    />
    <!-- 下一首预加载：点歌列表一更新就预热第二首（URL 与随后播放的完全一致，从而命中缓存）。
         这里只负责「预热」，播放仍由服务端 MUSIC 推送驱动——不能在此接续播放，
         因为后端播完 ~500ms 内必推下一首，本地抢先切换会造成重复播放/单曲循环播错歌。 -->
    <audio
      ref="preloadEl"
      :src="music2Url || undefined"
      :volume="playerStore.volume / 100"
      preload="auto"
      style="display: none"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import Navigation from '@/components/Navigation.vue'
import Lyrics from '@/components/Lyrics.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import SearchDialog from '@/components/SearchDialog.vue'
import ChatSearchPicture from '@/components/ChatSearchPicture.vue'
import SongListDialog from '@/components/SongListDialog.vue'
import UserSearchDialog from '@/components/UserSearchDialog.vue'
import HouseDialog from '@/components/HouseDialog.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import BiliLive from '@/components/BiliLive.vue'
import { useSocket } from '@/composables/useSocket'
import http from '@/utils/http'
import { usePlayerStore } from '@/stores/player'
import { useSocketStore } from '@/stores/socket'
import { useHouseStore } from '@/stores/house'
import { useSearchStore } from '@/stores/search'
import { useToast } from '@/composables/useToast'
import { secondsToHH_mm_ss } from '@/utils/timeUtils'
import { SUCCESS_CODE } from '@/types/message'
import {
  albumBlurEnabled,
  albumBlurOpacity,
  homeBackground,
  homeBackgroundMask,
} from '@/config/appearance'
import type { Music, SongList, UserInfo } from '@/types/music'
import type { House } from '@/types/house'
import logo from '@/assets/images/logo.png'

const playerStore = usePlayerStore()
const socketStore = useSocketStore()
const houseStore = useHouseStore()
const searchStore = useSearchStore()
const toast = useToast()
const { connect, send, setCloseHook, markLoaded } = useSocket()

const isPlay = ref(false)
const openShare = ref(false)
const openLyrics = ref(false)
const openSearch = ref(false)
const openPictureSearch = ref(false)
const openSongList = ref(false)
const openUserSearch = ref(false)
const openHouse = ref(false)
const openBili = ref(false)
const houseSearch = ref('')
const houseHide = ref(false)
const albumRotate = ref(false)
const currentTime = ref(0)

// 唱片尺寸响应式（对齐旧代码的 screenWidth 逻辑）
const { width } = useDisplay()
const albumRotateSize = computed(() => {
  const w = width.value
  if (w <= 400) return Math.max(160, w - 100)
  if (w <= 700) return w - 60
  if (w <= 766) return 300
  if (w < 1000) return 160
  return 200
})
const audioEl = ref<HTMLAudioElement | null>(null)
const preloadEl = ref<HTMLAudioElement | null>(null)

const music = computed(() => playerStore.music)
const pick = computed(() => playerStore.pick)
const lyric = computed(() => playerStore.lyric)
const lyrics = computed(() => playerStore.lyrics)
const progress = computed(() => playerStore.progress)
const playerTime = computed(() => playerStore.time)
const music2Url = computed(() => playerStore.music2.url || '')

const isAdminView = computed(() => socketStore.isRoot || socketStore.isAdmin)

const filteredHomeHouses = computed(() => {
  return houseStore.homeHouses.filter((h) => {
    return (
      h.name.toLowerCase().includes(houseSearch.value.toLowerCase()) &&
      (houseHide.value ? (h.population ?? 0) > 0 : true)
    )
  })
})

const homeHouse = computed(() => houseStore.homeHouse)

const volume = computed({
  get: () => playerStore.volume,
  set: (v: number) => {
    // 只改本地：后端 /music/volumn 需要管理员权限且是向全房间广播，普通用户拖滑块不应触发
    playerStore.setLocalVolume(v)
    applyVolume()
    // 预加载的第二首也要同步音量，否则接续播放时会突然变响
    if (preloadEl.value) preloadEl.value.volume = v / 100
  },
})

/** 把当前音量应用到 audio 元素（volume 是 IDL 属性，必须用 JS 赋值） */
function applyVolume() {
  if (audioEl.value) audioEl.value.volume = playerStore.volume / 100
}

const pickHistory = ref<Music[]>(JSON.parse(localStorage.getItem('pickHistory') || '[]'))
const favoriteMap = ref<Record<string, Music>>(JSON.parse(localStorage.getItem('collectMusic') || '{}'))
const openPickHistory = ref(false)
const openFavorite = ref(false)

function goodMusic(row: Music) {
  send(`/music/good/${row.id}`)
  toast.success(`[${row.id}]${row.name} - 已发送点赞请求`)
}

function collectMusic(row: Music) {
  favoriteMap.value[row.id] = { ...row, pickTime: Date.now() }
  localStorage.setItem('collectMusic', JSON.stringify(favoriteMap.value))
}

function removeCollect(row: Music) {
  delete favoriteMap.value[row.id]
  localStorage.setItem('collectMusic', JSON.stringify(favoriteMap.value))
}

function clearPickHistory() {
  localStorage.removeItem('pickHistory')
  pickHistory.value = []
}

function removeAllCollect() {
  localStorage.removeItem('collectMusic')
  favoriteMap.value = {}
}

function onPickSongList(row: SongList) {
  openSongList.value = false
  searchStore.setKeyword('*' + row.id)
  openSearch.value = true
  send('/music/search', {
    name: '*' + row.id,
    sendTime: Date.now(),
    source: 'wy',
    pageIndex: 1,
    pageSize: 10,
  })
}

function onPickUser(row: UserInfo) {
  openUserSearch.value = false
  searchStore.setGdKeyword(row.userId)
  openSongList.value = true
  send('/music/searchsonglist', {
    name: row.userId,
    sendTime: Date.now(),
    source: 'wy_user',
    pageIndex: 1,
    pageSize: 10,
  })
}

function searchTop() {
  openSearch.value = true
  searchStore.setKeyword('*热歌榜')
  send('/music/search', {
    name: '*热歌榜',
    sendTime: Date.now(),
    source: 'wy',
    pageIndex: 1,
    pageSize: 10,
  })
}

function getHomeHouses() {
  http
    .post('/house/search', {})
    .then((response) => {
      if (response.data.code == SUCCESS_CODE) {
        const data = response.data.data as House[]
        if (data?.[0]?.announce?.content) {
          toast.info(data[0].announce.content)
        }
        houseStore.setHomeHouses(data)
      }
    })
    .catch(() => {})
}

function enterHomeHouse(id: string, name: string, needPwd: boolean) {
  if (needPwd) {
    const pwd = window.prompt('请输入房间密码', '')
    if (pwd === null) return
    homeHouseEnter(id, name, pwd)
  } else {
    homeHouseEnter(id, name, '')
  }
}

function homeHouseEnter(id: string, name: string, pwd: string) {
  http
    .post('/house/enter', { id, password: pwd })
    .then((response) => {
      if (response.data.code == SUCCESS_CODE) {
        houseStore.houseId = id
        houseStore.housePwd = pwd
        houseStore.connectType = 'enter'
        houseStore.setMusichouse(name)
        isPlay.value = true
        connect(id, pwd, 'enter')
      } else {
        toast.error(response.data.message)
      }
    })
    .catch(() => {})
}

function createHomeHouse() {
  http
    .post('/house/add', { ...houseStore.homeHouse })
    .then((response) => {
      if (response.data.code == SUCCESS_CODE) {
        houseStore.houseId = response.data.data
        houseStore.housePwd = houseStore.homeHouse.password
        houseStore.connectType = ''
        houseStore.setMusichouse(houseStore.homeHouse.name)
        isPlay.value = true
        connect(houseStore.houseId, houseStore.housePwd, '')
      } else {
        toast.error(response.data.message)
      }
    })
    .catch(() => {})
}

function openLink(url: string) {
  window.open(url, '_blank')
}

function musicTimeUpdate(e: Event) {
  const audio = e.target as HTMLAudioElement
  const current = audio.currentTime
  const duration = audio.duration
  if (!duration) return
  currentTime.value = current
  playerStore.setProgress((current / duration) * 100)
  playerStore.setTime(`${secondsToHH_mm_ss(current)} / ${secondsToHH_mm_ss(duration)}`)
}

/** 音频元数据就绪：按服务端 pushTime 校准进度（中途进房/断线重连后追上房间进度） */
function syncProgressFromPushTime() {
  const audio = audioEl.value
  const m = playerStore.music
  if (!audio || !m.pushTime) return
  const offset = (Date.now() - m.pushTime) / 1000
  // 刚开播（<=3s）不校准
  if (offset <= 3) return
  const duration = audio.duration
  if (Number.isFinite(duration) && duration > 0) {
    // 数据过旧或已超出时长就不跳，避免跳到末尾立刻 ended
    if (offset >= duration - 1) return
  } else if (offset > 3600) {
    // duration 还不可用（NaN/Infinity）时给个兜底上限
    return
  }
  audio.currentTime = offset
}

// 音乐切换时：重新播放 + 唱片转动
let rotateTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => playerStore.music.url,
  () => {
    albumRotate.value = false
    applyVolume()
    if (audioEl.value) audioEl.value.play().catch(() => {})
    // 进度校准不放在这里：pushTime 需要等音频元数据就绪，交给 loadedmetadata
    if (rotateTimer) clearTimeout(rotateTimer)
    rotateTimer = setTimeout(() => {
      rotateTimer = null
      albumRotate.value = true
    }, 1000)
  },
)

// 记录点歌历史
watch(
  () => playerStore.music.id,
  (newId) => {
    if (!newId) return
    const m = playerStore.music
    const idx = pickHistory.value.findIndex((item) => item.id === m.id)
    if (idx !== -1) pickHistory.value.splice(idx, 1)
    pickHistory.value.unshift({ ...m, lyric: '' })
    if (pickHistory.value.length > 400) pickHistory.value.pop()
    localStorage.setItem('pickHistory', JSON.stringify(pickHistory.value))
  },
)

function getUrlKey(name: string): string {
  if (window.location.href.indexOf('?houseId') === -1) return ''
  const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i')
  const r = decodeURIComponent(window.location.search).substr(1).match(reg)
  return r ? r[2] : ''
}

onMounted(() => {
  // 首屏就按本地偏好对齐音量（否则 audio 默认 100%，与滑块显示不一致）
  applyVolume()

  // 解决部分移动端不能自动播放（只影响首曲，切歌后的播放由 watch 负责）
  document.addEventListener(
    'touchstart',
    () => {
      applyVolume()
      audioEl.value?.play().catch(() => {})
    },
    { once: true },
  )

  // 倒计时退出后回到首页
  setCloseHook(() => {
    isPlay.value = false
    getHomeHouses()
  })

  getHomeHouses()

  // 直达房间：URL 带 ?houseId=xxx 时自动进入
  const reachId = getUrlKey('houseId')
  if (reachId) {
    const reachPwd = getUrlKey('housePwd') || ''
    http
      .post('/house/get', { id: reachId })
      .then((response) => {
        if (response.data.code == SUCCESS_CODE) {
          homeHouseEnter(reachId, response.data.data.name, reachPwd)
        }
      })
      .catch(() => {})
  }
})

onUnmounted(() => {
  // 释放模块级单例上的闭包与本地定时器，避免组件反复挂载后残留旧引用
  setCloseHook(null)
  if (rotateTimer) {
    clearTimeout(rotateTimer)
    rotateTimer = null
  }
})
</script>

<style scoped>
/* 首页背景（可替换：内置图 / VITE_BG_IMAGE / localStorage）
 * 注意：不能用负 z-index —— v-application 有不透明背景且不创建 stacking context，
 * 负值会让背景层掉到它下面被遮住。这里用 z-index:0，内容层用 z-index:1。 */
.page-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.page-bg-mask {
  position: absolute;
  inset: 0;
  background: #000;
}

/* 播放页动态背景：当前专辑封面放大 + 模糊 */
.album-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #121212;
}
.album-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(24px);
  transform: scale(1.15);
}

/* 内容层：必须高于背景层 */
.home-page,
.content-layer {
  position: relative;
  z-index: 1;
}

.album-avatar {
  border: 2px solid rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 0 20px 2px #000;
  overflow: hidden;
}

.album {
  width: 100%;
  height: 100%;
  transition-duration: 0.2s;
  border-radius: 50%;
}

.album-rotate {
  animation: rotate 20s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.cursor-pointer {
  cursor: pointer;
}
</style>
