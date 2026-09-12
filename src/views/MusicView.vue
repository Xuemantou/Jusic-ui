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

    <!-- ============================ 首页 ============================ -->
    <!-- MD3 small top app bar + 大标题 + search bar + 房间列表 + 创建 FAB -->
    <div v-if="!isPlay" class="home-page content-layer">
      <header class="home-appbar">
        <v-icon color="primary" size="28" class="mr-3">mdi-music-circle</v-icon>
        <span class="text-h6">一起听歌吧</span>
        <v-spacer />
        <!-- 首页不渲染 Navigation（那是播放页的 app-bar），故外观入口需单独放一份 -->
        <ThemeMenu />
        <v-btn icon variant="text" title="个人设置" @click="openProfile = true">
          <v-icon>mdi-account-cog-outline</v-icon>
        </v-btn>
        <v-btn icon variant="text" title="下载 APP" @click="openDownload = true">
          <v-icon>mdi-android</v-icon>
        </v-btn>
      </header>

      <main class="home-main">
        <div class="home-hero">
          <h1 class="text-h2">一起听歌吧</h1>
          <p class="text-body-1 on-surface-variant">
            和朋友在同一个房间同步听歌、点歌、聊天
          </p>
        </div>

        <div class="home-filters">
          <v-text-field
            v-model="houseSearch"
            placeholder="搜索房间…"
            prepend-inner-icon="mdi-magnify"
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="md3-search-bar home-filters__search"
          />
          <v-switch v-model="houseHide" label="隐藏空房" color="primary" hide-details density="compact" />
        </div>

        <section class="home-section">
          <div class="home-section__head">
            <span class="text-subtitle-1">加入房间</span>
            <span class="text-body-2 on-surface-variant">
              {{ filteredHomeHouses.length }} 个房间可选
            </span>
          </div>

          <v-list v-if="filteredHomeHouses.length" class="md3-list home-house-list" lines="two">
            <v-list-item
              v-for="house in filteredHomeHouses"
              :key="house.id"
              class="home-house"
              @click="enterHomeHouse(house.id, house.name, house.needPwd)"
            >
              <template #prepend>
                <v-avatar
                  :color="house.needPwd ? 'tertiary-container' : 'primary-container'"
                  size="40"
                >
                  <v-icon :color="house.needPwd ? 'on-tertiary-container' : 'on-primary-container'">
                    {{ house.needPwd ? 'mdi-lock' : 'mdi-lock-open-variant' }}
                  </v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="text-subtitle-1">{{ house.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ house.desc || '暂无描述' }}</v-list-item-subtitle>
              <template #append>
                <v-chip size="small" variant="tonal" color="primary" prepend-icon="mdi-account">
                  {{ house.population || 0 }}
                </v-chip>
                <v-icon class="ml-1" color="on-surface-variant">mdi-chevron-right</v-icon>
              </template>
            </v-list-item>
          </v-list>

          <div v-else class="home-empty">
            <v-icon size="48" class="mb-3">mdi-music-note-off</v-icon>
            <p class="text-subtitle-2">还没有可选房间</p>
            <p class="text-body-2 on-surface-variant">点右下角的按钮创建一个吧</p>
          </div>
        </section>
      </main>

      <!-- MD3 主操作：FAB（一屏一主操作，创建房间是首页唯一的主操作） -->
      <v-fab
        icon="mdi-plus"
        size="large"
        color="primary-container"
        class="home-fab"
        title="创建房间"
        @click="openCreateHouse = true"
      />

      <v-dialog v-model="openCreateHouse" max-width="560">
        <v-card>
          <v-card-item class="pt-4">
            <template #prepend>
              <v-avatar color="tertiary-container" size="40">
                <v-icon color="on-tertiary-container">mdi-plus</v-icon>
              </v-avatar>
            </template>
            <v-card-title class="text-h6">创建房间</v-card-title>
            <v-card-subtitle>新建一个听歌房，邀请朋友一起听</v-card-subtitle>
          </v-card-item>

          <v-card-text class="pt-2">
            <v-text-field
              v-model="homeHouse.name"
              label="房间名称"
              variant="outlined"
              density="comfortable"
              hide-details
              class="mb-4"
            />
            <v-text-field
              v-model="homeHouse.desc"
              label="房间描述"
              variant="outlined"
              density="comfortable"
              hide-details
              class="mb-4"
            />
            <v-text-field
              v-if="homeHouse.needPwd"
              v-model="homeHouse.password"
              label="房间密码"
              type="password"
              variant="outlined"
              density="comfortable"
              hide-details
              class="mb-4"
            />
            <!-- 管理员密码：进入本房间管理面板用，创建时必填 -->
            <v-text-field
              v-model="homeHouse.adminPwd"
              label="房间管理员密码（至少4位）"
              type="password"
              variant="outlined"
              density="comfortable"
              hide-details
              hint="用于进入该房间的管理面板，请记牢"
              persistent-hint
              class="mb-4"
            />
            <div class="d-flex align-center flex-wrap ga-6">
              <v-switch
                v-model="homeHouse.needPwd"
                label="房间密码"
                color="primary"
                hide-details
                density="compact"
              />
              <v-switch
                v-model="homeHouse.enableStatus"
                label="房间永存"
                color="primary"
                hide-details
                density="compact"
              />
            </div>
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="openCreateHouse = false">取消</v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="large"
              prepend-icon="mdi-plus"
              @click="createHomeHouse"
            >
              创建房间
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>

    <!-- ========================== 播放页 ========================== -->
    <!-- 宽屏：三窗格常驻；窄屏：单窗格 + 底部导航栏 + mini player -->
    <template v-else>
      <Navigation
        :musichouse="houseStore.musichouse"
        @open-share-dialog="openShare = true"
        @open-house-admin="openHouseAdmin = true"
        @open-profile="openProfile = true"
      />

      <v-main class="content-layer">
        <div class="page-panes" :class="lgAndUp ? 'page-panes--wide' : 'page-panes--compact'">
          <!-- 窗格一：正在播放 -->
          <section v-show="lgAndUp || activePane === 'player'" class="pane pane-player">
            <div
              class="pane__body now-playing"
              :class="{ 'now-playing--lyrics': openLyrics }"
            >
              <!-- 氛围背景：展开歌词时，封面扩散成一层模糊底铺在信息栏后面。
                   注意力此时该让给歌词，封面从"主体"退成"氛围"，但曲子的色彩记忆还在。
                   用 background-image 而不是再加个 <v-img>，省一层 DOM 和一次懒加载。 -->
              <div
                v-if="music.pictureUrl"
                class="np-ambient"
                aria-hidden="true"
                :style="{ backgroundImage: `url(${music.pictureUrl})` }"
              />
              <div class="np-cover" :class="{ 'np-cover--playing': albumRotate }">
                <v-img :src="music.pictureUrl || logo" cover class="np-cover__img" />
              </div>

              <div class="np-meta">
                <h2 class="text-h4 np-meta__title">{{ music?.name || '暂无播放' }}</h2>
                <p class="text-body-1 on-surface-variant">{{ music?.artist || '—' }}</p>
                <p v-if="music.album" class="text-body-2 on-surface-variant np-meta__album">
                  《{{ music.album.name }}》
                </p>
              </div>

              <div class="np-progress">
                <v-progress-linear :model-value="progress" color="primary" height="6" rounded />
                <div class="text-caption on-surface-variant text-right mt-1">{{ playerTime }}</div>
              </div>

              <div class="np-actions">
                <v-btn color="primary" variant="tonal" prepend-icon="mdi-skip-next" @click="voteSkip">
                  投票切歌
                </v-btn>
                <v-btn
                  :color="openLyrics ? 'primary' : undefined"
                  :variant="openLyrics ? 'tonal' : 'text'"
                  :prepend-icon="openLyrics ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                  @click="openLyrics = !openLyrics"
                >
                  歌词
                </v-btn>
              </div>

              <!-- 未展开歌词时顺带显示当前唱到哪一句。
                   外层负责 grid 过渡，文字放内层才能被压到 0 高度。 -->
              <div class="np-lyric" :class="{ 'np-lyric--collapsed': openLyrics }">
                <p class="np-lyric__text text-body-1">{{ lyric || '—' }}</p>
              </div>

              <div class="np-volume">
                <v-icon color="primary">mdi-volume-high</v-icon>
                <v-slider
                  v-model="volume"
                  class="md3-slider"
                  color="primary"
                  min="0"
                  max="100"
                  hide-details
                />
              </div>

              <div class="np-lyrics" :class="{ 'np-lyrics--open': openLyrics }">
                <div class="np-lyrics__body">
                  <Lyrics :lyrics="lyrics" :current-time="currentTime" />
                </div>
              </div>
            </div>
          </section>

          <!-- 窗格二：点歌队列 -->
          <section v-show="lgAndUp || activePane === 'queue'" class="pane pane-queue">
            <header class="pane__head">
              <div class="pane__title">
                <span class="text-h6">点歌队列</span>
                <span class="text-body-2 on-surface-variant">{{ pick.length }} 首待播</span>
              </div>
              <v-btn icon variant="text" title="热歌榜" @click="searchTop">
                <v-icon>mdi-weather-sunny</v-icon>
              </v-btn>
              <v-btn icon variant="text" title="点歌历史" @click="openPickHistory = true">
                <v-icon>mdi-history</v-icon>
              </v-btn>
              <v-btn icon variant="text" title="我的收藏" @click="openFavorite = true">
                <v-icon>mdi-heart-outline</v-icon>
              </v-btn>
            </header>

            <div class="pane__body">
              <v-list v-if="pick.length" class="md3-list queue-list" lines="three">
                <v-list-item
                  v-for="(row, index) in pick"
                  :key="row?.id + '-' + index"
                  :class="{ 'v-list-item--playing': index === 0 }"
                >
                  <template #prepend>
                    <div class="queue-index">
                      <v-icon v-if="index === 0" size="20">mdi-volume-high</v-icon>
                      <span v-else class="text-body-2">{{ index + 1 }}</span>
                    </div>
                  </template>

                  <v-list-item-title class="text-subtitle-2">
                    {{ isAdminView ? row?.name + `[${row?.id}]` : row?.name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ row?.artist || '—' }}
                    <template v-if="row?.album"> · 《{{ row.album.name }}》</template>
                  </v-list-item-subtitle>
                  <v-list-item-subtitle class="queue-picker">
                    <v-icon size="14" class="mr-1">mdi-account-outline</v-icon>
                    {{
                      isAdminView
                        ? row?.nickName + (row?.sessionId ? `[${row.sessionId}]` : '')
                        : row?.nickName
                    }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      v-if="index !== 0 && socketStore.good"
                      icon
                      size="small"
                      variant="text"
                      color="primary"
                      title="点赞"
                      @click="goodMusic(row)"
                    >
                      <v-icon>mdi-thumb-up-outline</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      :color="favoriteMap[row?.id] ? 'error' : undefined"
                      :title="favoriteMap[row?.id] ? '取消收藏' : '收藏'"
                      @click="favoriteMap[row?.id] ? removeCollect(row) : collectMusic(row)"
                    >
                      <v-icon>{{ favoriteMap[row?.id] ? 'mdi-heart' : 'mdi-heart-outline' }}</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>

              <div v-else class="pane-empty">
                <v-icon size="48" class="mb-3">mdi-playlist-music</v-icon>
                <p class="text-subtitle-2">队列是空的</p>
                <p class="text-body-2 on-surface-variant">
                  在聊天里输入「点歌 歌名」，或点右下角搜索点歌
                </p>
              </div>
            </div>

            <!-- 窗格主操作：点歌 -->
            <v-fab
              icon="mdi-magnify"
              color="primary-container"
              class="pane-fab"
              title="点歌"
              @click="openSearch = true"
            />
          </section>

          <!-- 窗格三：聊天（ChatPanel 自身即窗格内容） -->
          <section v-show="lgAndUp || activePane === 'chat'" class="pane pane-chat">
            <div class="pane-chat__bar">
              <v-btn
                color="primary"
                variant="tonal"
                block
                prepend-icon="mdi-home-group"
                @click="openHouse = true"
              >
                听歌房
              </v-btn>
            </div>
            <ChatPanel
              @open-search="openSearch = true"
              @open-song-list="openSongList = true"
              @open-user-search="openUserSearch = true"
              @open-bili="openBili = true"
            />
          </section>
        </div>

        <!-- 窄屏 mini player：切到队列/聊天窗格时仍能看到在播什么，并可投票切歌 -->
        <div v-if="!lgAndUp" class="mini-player">
          <v-img
            :src="music.pictureUrl || logo"
            cover
            width="40"
            height="40"
            class="mini-player__cover"
          />
          <div class="mini-player__meta">
            <div class="text-subtitle-2 text-truncate">{{ music?.name || '暂无播放' }}</div>
            <div class="text-caption on-surface-variant text-truncate">{{ music?.artist || '—' }}</div>
          </div>
          <v-btn icon variant="text" title="投票切歌" @click="voteSkip">
            <v-icon>mdi-skip-next</v-icon>
          </v-btn>
        </div>
      </v-main>

      <!-- 窄屏底部导航（MD3 navigation bar）：窗格切换的载体 -->
      <v-bottom-navigation v-if="!lgAndUp" v-model="activePane" :height="80" class="md3-navbar">
        <v-btn value="player">
          <span class="md3-nav-item">
            <span class="md3-nav-indicator"><v-icon>mdi-music-circle-outline</v-icon></span>
            <span class="md3-nav-label">正在播放</span>
          </span>
        </v-btn>
        <v-btn value="queue">
          <span class="md3-nav-item">
            <span class="md3-nav-indicator"><v-icon>mdi-playlist-music</v-icon></span>
            <span class="md3-nav-label">点歌队列</span>
          </span>
        </v-btn>
        <v-btn value="chat">
          <span class="md3-nav-item">
            <span class="md3-nav-indicator">
              <v-badge
                :content="unread"
                :model-value="unread > 0"
                color="error"
                offset-x="4"
                offset-y="2"
              >
                <v-icon>mdi-chat-outline</v-icon>
              </v-badge>
            </span>
            <span class="md3-nav-label">聊天</span>
          </span>
        </v-btn>
      </v-bottom-navigation>

      <!-- 音乐搜索弹窗 -->
      <SearchDialog v-model="openSearch" />
      <!-- 歌单搜索弹窗 -->
      <SongListDialog v-model="openSongList" @pick="onPickSongList" />
      <!-- 用户搜索弹窗 -->
      <UserSearchDialog v-model="openUserSearch" @pick-user="onPickUser" />
      <!-- 听歌房抽屉 -->
      <HouseDialog v-model="openHouse" @open-admin="openHouseAdmin = true" />
      <!-- 房间管理面板 -->
      <HouseAdminDialog v-model="openHouseAdmin" />
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
                  <v-btn icon size="small" variant="text" color="error" @click="removeCollect(item)">
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

    <!-- 个人设置：首页与播放页都能打开，故放在两个分支之外 -->
    <UserProfileDialog v-model="openProfile" />
    <!-- 「下载 APP」占位页（APP 开发中，先给说明） -->
    <AppDownloadDialog v-model="openDownload" />

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
      @ended="onAudioEnded"
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
import ThemeMenu from '@/components/ThemeMenu.vue'
import Lyrics from '@/components/Lyrics.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import SearchDialog from '@/components/SearchDialog.vue'
import SongListDialog from '@/components/SongListDialog.vue'
import UserSearchDialog from '@/components/UserSearchDialog.vue'
import HouseDialog from '@/components/HouseDialog.vue'
import HouseAdminDialog from '@/components/HouseAdminDialog.vue'
import UserProfileDialog from '@/components/UserProfileDialog.vue'
import AppDownloadDialog from '@/components/AppDownloadDialog.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import BiliLive from '@/components/BiliLive.vue'
import { useSocket } from '@/composables/useSocket'
import http from '@/utils/http'
import { usePlayerStore } from '@/stores/player'
import { useSocketStore } from '@/stores/socket'
import { useHouseStore } from '@/stores/house'
import { useSearchStore } from '@/stores/search'
import { useChatStore } from '@/stores/chat'
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
const chatStore = useChatStore()
const { connect, send, setCloseHook, markLoaded, musicSkipVote } = useSocket()

const isPlay = ref(false)
/** 窄屏单窗格布局下的当前窗格；宽屏三窗格常驻，此状态不参与渲染 */
const activePane = ref<'player' | 'queue' | 'chat'>('player')
/** 窄屏时聊天不在前台期间的未读消息数，作为底部导航的徽标 */
const unread = ref(0)
/** 首页「创建房间」对话框：MD3 里创建是 FAB 主操作，不再是常驻表单 */
const openCreateHouse = ref(false)
const openShare = ref(false)
const openLyrics = ref(false)
const openSearch = ref(false)
const openSongList = ref(false)
const openUserSearch = ref(false)
const openHouse = ref(false)
/** 房间管理面板（宽屏 app bar 与听歌房抽屉都能打开） */
const openHouseAdmin = ref(false)
/** 个人设置（昵称 / 默认音源，均持久化在本机） */
const openProfile = ref(false)
/** 「下载 APP」占位弹窗（APP 尚未开发，先给个说明页） */
const openDownload = ref(false)
const openBili = ref(false)
const houseSearch = ref('')
const houseHide = ref(false)
const albumRotate = ref(false)
const currentTime = ref(0)

// 布局断点：宽屏（≥1280）三窗格常驻，窄屏切换为底部导航 + 单窗格。
// 唱片尺寸改由 CSS 控制（封面在窗格内自适应），不再需要 JS 参与算尺寸。
const { lgAndUp } = useDisplay()
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

/**
 * 投票切歌。
 *
 * 后端没有「直接切歌」端点，只有 /music/skip/vote（与聊天框的「投票切歌」指令同一条），
 * 所以按钮复用的就是这个已有指令——UI 只是把原本只能靠打字触发的入口露出来，
 * 不新增任何协议能力。同一首歌重复点也安全：后端按投票率自行裁决。
 */
function voteSkip() {
  musicSkipVote()
  toast.info('已发起投票切歌')
}

/**
 * 窄屏未读计数。
 *
 * 单窗格布局下聊天默认不在前台，没有徽标就会整场错过消息。
 * 只统计「新增」，所以在切窗格/清空记录导致的长度跳变不会误加；
 * 进入聊天窗格或处于宽屏（聊天常驻可见）时一律清零。
 */
watch(
  () => chatStore.data.length,
  (len, prev) => {
    if (lgAndUp.value || activePane.value === 'chat') return
    if (len > (prev ?? 0)) unread.value += len - (prev ?? 0)
  },
)
watch([activePane, lgAndUp], () => {
  if (lgAndUp.value || activePane.value === 'chat') unread.value = 0
})

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
        // 记下管理员密码：本次会话内打开管理面板不必再手输
        houseStore.setAdminPwdCache(houseStore.homeHouse.adminPwd)
        houseStore.setMusichouse(houseStore.homeHouse.name)
        isPlay.value = true
        connect(houseStore.houseId, houseStore.housePwd, '')
      } else {
        toast.error(response.data.message)
      }
    })
    .catch(() => {})
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

/**
 * 「播完兜底」。
 *
 * 后端（MusicJob，每 500ms 一次）靠 `pushTime + duration` 自己算播放是否结束，
 * 完全不依赖前端上报。而音源 API 返回的 duration 是**完整歌曲**时长：
 * 没配会员 cookie 时实际只能拿到试听片段（约 30 秒），于是歌早播完了、
 * 后端却还要等完整时长到点才推下一首 —— 表现为「播完卡住不切」。
 *
 * 处理策略（宽限期按是否试听片段区分）：
 *   ① 待播队列里有下一首 → 本地直接接续，不必打扰后端；
 *   ② 队列为空（下一首由后端从默认歌单随机挑，前端无法预知）→ 请后端切歌。
 * 正常歌曲仍给 3 秒宽限，等后端自己的推送，避免与之撞车。
 */
let endedFallbackTimer: ReturnType<typeof setTimeout> | null = null

function clearEndedFallback() {
  if (endedFallbackTimer) {
    clearTimeout(endedFallbackTimer)
    endedFallbackTimer = null
  }
}

/**
 * 判断当前播放的是否为「试听片段」。
 * 后端记录的时长明显长于音频实际时长时即可判定 —— 这种情况后端要等很久才会推下一首，
 * 不必再等满宽限期。
 */
function isClipPlaying(): boolean {
  const audio = audioEl.value
  const claimed = Number(playerStore.music.duration || 0) / 1000
  const actual = audio && Number.isFinite(audio.duration) ? audio.duration : 0
  return claimed > 0 && actual > 0 && claimed - actual > 15
}

function onAudioEnded() {
  clearEndedFallback()
  const clip = isClipPlaying()
  endedFallbackTimer = setTimeout(
    () => {
      endedFallbackTimer = null
      // ① 先本地接续，避免出现静默空档（队列为空时接续不了，交给 ②）
      const resumed = playNextFromQueue()
      // ② 试听场景必须同时请后端切歌。
      //    本地接续只是前端行为：服务端仍认为在播上一首，不会执行 pickToPlaying，
      //    因此点歌列表不会前移（那首歌会一直挂在队列里），后端也要等完整时长才推下一首。
      //    发一次投票切歌能让服务端把状态与列表都推进到正确位置。
      if (clip) {
        send('/music/skip/vote')
        if (!resumed) toast.info('试听片段已播完，已请求切歌')
      }
    },
    clip ? 300 : 3000,
  )
}

/**
 * 本地接续待播队列的下一首，接续成功返回 true。
 * 后端 getPickList 返回的列表中 pick[0] 是「正在播放」、pick[1] 才是下一首，
 * 与后端 musicSwitch → pickToPlaying 取的是同一首。
 */
function playNextFromQueue(): boolean {
  const next = playerStore.pick?.[1]
  const url = music2Url.value
  // 没有下一首、或地址与当前相同（单曲循环）时不接续，交给后端推送
  if (!next || !url || url === playerStore.music.url) return false
  // 用完整对象接续，保证歌名/封面/歌词正确；pushTime 取当前时间，
  // 否则 loadedmetadata 的进度校准会按旧推送时间把进度跳到接近结尾
  playerStore.setMusic({ ...next, url, pushTime: Date.now() })
  return true
}

// 音乐切换时：重新播放 + 唱片转动
let rotateTimer: ReturnType<typeof setTimeout> | null = null
/** 上一次真正播放过的地址，用于识别「同一首歌被再次推送」（单曲循环） */
let lastPlayedUrl = ''

watch(
  // 监听整个 music 对象而不是 url：单曲循环时后端推的是同一首、url 完全相同，
  // 只监听 url 的话回调不会触发，就会出现「播完停住」。
  () => playerStore.music,
  () => {
    // 后端已推来新歌，取消「播完兜底」
    clearEndedFallback()
    albumRotate.value = false
    applyVolume()
    const audio = audioEl.value
    const url = playerStore.music.url
    if (audio) {
      // 同一地址再次推送有两种情况，必须区分：
      //   ① 单曲循环：音频确实已播完 → 回到开头重播
      //   ② 本地兜底刚接续、后端随后补推同一首 → 音频正在播，绝不能打断它
      if (url && url === lastPlayedUrl) {
        const finished =
          Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 1
        if (finished) {
          try {
            audio.currentTime = 0
          } catch {
            /* 元数据未就绪时忽略 */
          }
        }
      }
      lastPlayedUrl = url
      // flush: 'post' 保证此时 DOM 的 src 已更新，play() 作用在新资源上
      audio.play().catch(() => {})
    }
    // 进度校准不放在这里：pushTime 需要等音频元数据就绪，交给 loadedmetadata
    if (rotateTimer) clearTimeout(rotateTimer)
    rotateTimer = setTimeout(() => {
      rotateTimer = null
      albumRotate.value = true
    }, 1000)
  },
  { flush: 'post' },
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
  clearEndedFallback()
  if (rotateTimer) {
    clearTimeout(rotateTimer)
    rotateTimer = null
  }
})
</script>

<style scoped>
/* ==========================================================================
   背景层
   ========================================================================== */
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
  background: rgb(var(--v-theme-scrim));
}

/* 播放页动态背景：当前专辑封面放大 + 模糊 */
.album-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: rgb(var(--v-theme-background));
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

/* ==========================================================================
   首页：MD3 small app bar + 大标题 + search bar + 列表 + FAB
   ========================================================================== */
.home-appbar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 64px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 8px 0 16px;
}

.home-main {
  max-width: 1100px;
  margin: 0 auto;
  /* 底部留出 FAB 的空间，避免最后一项被压住 */
  padding: 0 16px 96px;
}

.home-hero {
  padding: 24px 0 20px;
}
.home-hero h1 {
  margin-bottom: 8px;
}

.home-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 24px;
}
.home-filters__search {
  flex: 1 1 260px;
  max-width: 420px;
}

.home-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px 8px;
}

/* 房间列表：半透明 surface 容器，既保证文字对比度又留住背景氛围 */
.home-house-list {
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(18px);
}
.home-house {
  cursor: pointer;
}

.home-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 16px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
}

.home-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 5;
}

/* ==========================================================================
   播放页：窗格（pane）骨架
   ========================================================================== */
/* 高度 = 视口 - 顶栏 - 底栏。--v-layout-top/bottom 由 Vuetify 写在 v-main 上，
   本元素是 v-main 的子节点，直接继承，无需自己算 app bar 高度。 */
.page-panes {
  display: grid;
  height: calc(100vh - var(--v-layout-top, 64px) - var(--v-layout-bottom, 0px));
  height: calc(100dvh - var(--v-layout-top, 64px) - var(--v-layout-bottom, 0px));
}
/* 宽屏：正在播放 | 队列 | 聊天 三窗格常驻（MD3 supporting-pane 布局） */
.page-panes--wide {
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr) minmax(320px, 400px);
}
/* 窄屏：单窗格 + 底部导航；底部再留出 mini player 的高度 */
.page-panes--compact {
  grid-template-columns: minmax(0, 1fr);
  padding-bottom: 64px;
}

/* 播放窗格作为容器查询的参照。量的是"窗格可用高度"，而不是视口高度——
   窄屏还要减掉底部导航和 mini player，同样的视口高度下可用空间差 144px，
   按视口判断会得出错误结论（见 .now-playing 的矮屏档）。 */
.pane-player {
  container-type: size;
  container-name: player;
}

.pane {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  /* 半透明 surface：MD3 的内容面必须保证文字对比度，
     0.92 的不透明度只让背景氛围透出来一点，不牺牲可读性。 */
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(18px);
}
/* 窗格之间用 outline 分隔，而不是卡片间距——MD3 的窗格是面，不是卡 */
.page-panes--wide .pane + .pane {
  border-left: 1px solid rgb(var(--v-theme-outline-variant));
}

.pane__head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 8px 12px 20px;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
.pane__title {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}
.pane__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* 必须显式写 overflow-x：按 CSS 规范，只声明 overflow-y:auto 时
     overflow-x 会被一并计算成 auto，于是内容稍宽就多出一条横向滚动条。 */
  overflow-x: hidden;
}
/* 正在播放这一格例外：它的内容高度是按窗格高度分配的（见 .now-playing 的分档），
   一屏之内没有第二屏内容，所以这里不该有滚动条。用更高特异性写，
   免得将来有人调整上面 .pane__body 的顺序时把这条盖掉。 */
.pane__body.now-playing {
  overflow: hidden;
}
.pane-fab {
  position: absolute;
  right: 20px;
  bottom: 20px;
}

.pane-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* ==========================================================================
   窗格一：正在播放
   ========================================================================== */
.now-playing {
  /* 展开歌词时这块地方要留给歌词，所以固定块得按可用高度自己让位。
     下面这组是唯一的调节旋钮：三档（默认 / 矮屏 / 极矮）只改变量值，规则体共用。
     封面尺寸刻意不走变量 —— 见 .np-cover 的说明。 */
  --np-gap: 16px;
  --np-pad-y: 24px;
  --np-pad-x: 20px;
  --np-pad-b: 32px;
  --np-title: var(--v-type-headline-medium-size);
  --np-line-pad: 12px;
  --np-album: block;

  display: flex;
  flex-direction: column;
  gap: var(--np-gap);
  padding: var(--np-pad-y) var(--np-pad-x) var(--np-pad-b);
  /* 氛围背景的定位上下文 */
  position: relative;

  /* 一屏之内没有"第二屏"内容，超出部分只有背景 —— 所以这里不该有滚动条。
     空间不够靠下面两档收缩解决，不靠滚。 */
  overflow: hidden;

  /* ↓↓↓ 展开歌词时的信息栏氛围背景，观感微调就改这三个值 ↓↓↓ */
  /* 模糊度：越大越"化开"，太小会看出原图轮廓而干扰文字 */
  --np-ambient-blur: 20px;
  /* 蒙版不透明度：越大文字越清楚、氛围越弱。低于 ~0.7 就要重新检查对比度 */
  --np-ambient-scrim: 0.72;
  /* 扩散幅度：展开时背景的缩放倍率，营造"从封面扩散开"的感觉 */
  --np-ambient-spread: 1.5;
}

/* 氛围层：默认完全透明，展开歌词时淡入。
   刻意不用 backdrop-filter —— .pane 上已经有一层 blur(18px)，
   再嵌一层模糊要重算整条祖先链，切歌/滚动时容易掉帧；
   改为"预先模糊好的图 + 半透明 surface 叠加"，观感几乎一致但便宜得多。 */
.np-ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  background-size: cover;
  background-position: center;
  filter: blur(var(--np-ambient-blur)) saturate(1.4);
  /* 放大一点，避免模糊后四周出现透明羽化边 */
  transform: scale(1.15);
  transition:
    opacity 0.45s cubic-bezier(0.2, 0, 0, 1),
    transform 0.6s cubic-bezier(0.2, 0, 0, 1);
}
.now-playing--lyrics .np-ambient {
  opacity: 1;
  transform: scale(calc(1.15 * var(--np-ambient-spread)));
}
/* 可读性蒙版：压在氛围层之上、内容之下。用 surface 色而非纯黑/纯白，
   这样浅色主题下也是同一套逻辑，不用写两遍。 */
.np-ambient::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(var(--v-theme-surface), var(--np-ambient-scrim));
}

/* 内容统一抬到氛围层之上（氛围层是 absolute，否则会盖住后面的兄弟节点） */
.now-playing > *:not(.np-ambient) {
  position: relative;
  z-index: 1;
}

/* 封面：MD3 用大圆角承载媒体，而不是 MD2 的圆盘/拟物 */
.np-cover {
  /* 用 width:100% + max-width 而不是 min(100%, Npx)：max-width 是普通长度，
     过渡时能可靠插值；min() 的插值各家实现不一致，容易出现"卡一下再跳"。
     这里的 max-width 一律写具体长度、不经 var() 中转 —— 变量虽然也能解析出长度，
     但收起/展开时要靠 max-width 过渡来推平，"值从变量来"会多一层解析时机，
     实测收起时封面会直接跳到终值而不是滑过去。各档位的值写在下面的 @container 里。 */
  width: 100%;
  max-width: 260px;
  aspect-ratio: 1;
  margin: 0 auto;
  overflow: hidden;
  border-radius: var(--v-shape-xl);
  /* 不参与 flex 压缩。主轴上它的尺寸本该由 aspect-ratio 从宽度推出，
     但空间不够时 flex 会直接把高度压扁（宽度不变），封面就成了长方形。 */
  flex: none;
  transition:
    max-width 0.38s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.3s cubic-bezier(0.2, 0, 0, 1),
    transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}
/* 播放中：抬升一档（tonal elevation），作为"正在播放"的非颜色提示 */
.np-cover--playing {
  transform: translateY(-2px);
  box-shadow:
    0 1px 3px 0 rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)),
    0 4px 8px 3px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
}
.np-cover__img {
  width: 100%;
  height: 100%;
}

.np-meta {
  text-align: center;
}
.np-meta__title {
  margin-bottom: 4px;
  overflow-wrap: anywhere;
  /* 字号按档位缩小；行高必须一起覆盖，否则只缩字号、省不下高度 */
  font-size: var(--np-title);
  line-height: 1.25;
  /* 最多两行：这块高度是按"给歌词让位"算过的，不能被超长歌名无限撑高 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
/* 专辑名是这一屏里最次要的信息，空间不够时它先走 */
.np-meta__album {
  display: var(--np-album);
}

.np-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

/* 当前唱到的那句：用主色标出，替代原来挤在芯片旁的灰字 */
/* 当前唱到的那一句：展开歌词时平滑收起。
   用 grid-template-rows 的 1fr→0fr 做过渡，而不是 max-height——
   实测在 Firefox 里 max-height 的过渡会卡在起始值（取消 transition 立刻正常），
   而 grid-template-rows 是目前唯一能可靠"过渡到内容高度"的做法。 */
.np-lyric {
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
  transition:
    grid-template-rows 0.38s cubic-bezier(0.2, 0, 0, 1),
    opacity 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.np-lyric--collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
.np-lyric__text {
  min-height: 0;
  overflow: hidden;
  padding: var(--np-line-pad) 0;
  text-align: center;
  color: rgb(var(--v-theme-primary));
  overflow-wrap: anywhere;
}

.np-volume {
  display: flex;
  align-items: center;
  gap: 12px;
}
.np-volume .v-slider {
  flex: 1 1 auto;
}

/* 歌词区：收起时为 0 高度，展开时吃掉窗格剩余空间。
   高度全程由 flex-grow 过渡驱动，flex-basis 恒为 0。
   原来收起态写的是 flex: 0 0 auto —— basis:auto 取的是「内容高度」，
   而收起动画刚开始那一帧，歌词内容还停在最大高度，
   于是这一格会突然要占上千像素、把封面等兄弟一起压扁，
   看起来就是封面"跳"了一下（展开方向没有这个问题，所以只有收起时看得见）。 */
.np-lyrics {
  display: flex;
  flex: 0 1 0;
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    flex-grow 0.38s cubic-bezier(0.2, 0, 0, 1),
    opacity 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.np-lyrics--open {
  /* basis 保持 0：用 auto 会退回按内容高度算，把外层窗格撑高、
     平白多出一条竖向滚动条（歌词有几行就有多高）。
     这样滚动只发生在歌词内部，外层窗格不需要滚动条。 */
  flex-grow: 1;
  /* 下限约三行。分档收缩已经能保证正常情况下有这么多，
     这条只是兜底：宁可底下被裁一点，也不要被压成 0 高度、一行都看不见。 */
  min-height: 96px;
  opacity: 1;
}
.np-lyrics__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  /* 歌词最多占这么高，再多就在 Lyrics 组件内部滚动 */
  max-height: 42vh;
  overflow: hidden;
}
.np-lyrics__body > * {
  flex: 1 1 auto;
  min-height: 0;
}
/* 展开歌词时封面收缩。max-width 一旦变化，封面高度跟着 aspect-ratio 变，
   下方内容被顺势顶上去 —— 这就是那段"滑上去"的观感，不需要 JS 参与。 */
.now-playing--lyrics .np-cover {
  max-width: 150px;
}

/* ---- 窗格不够高时，固定块按档位收缩，把高度让给歌词 --------------------------
   为什么必须收缩：收起歌词时整块内容本来就只有一屏（封面 260 + 信息 + 进度 +
   按钮 + 音量 + 间距 ≈ 520px），展开歌词等于要在同一个盒子里再塞进一个滚动区。
   实测 iPhone SE（375×667，单窗格布局）的播放窗格可用高只有 ~460px：
   固定块原封不动就要 ~460px，歌词区被挤到 0 —— 一行都看不到，正是这个原因。

   阈值用 container query 而不是 @media：判断的是窗格自己有多高。
   同一个视口高度下，窄屏要再减掉底部导航(80)和 mini player(64)，
   按视口判断会把"其实已经很挤"的情况误判成宽裕。

   两档的取值是"够用"而非"好看"：极矮档下固定块合计约 320px，
   还能给歌词留下 4 行左右。 */
@container player (max-height: 680px) {
  .now-playing {
    --np-gap: 12px;
    --np-pad-y: 16px;
    --np-pad-b: 20px;
    --np-title: var(--v-type-headline-small-size);
    --np-line-pad: 8px;
    --np-album: none;
  }
  .np-cover {
    max-width: 200px;
  }
  .now-playing--lyrics .np-cover {
    max-width: 120px;
  }
}
@container player (max-height: 520px) {
  .now-playing {
    --np-gap: 8px;
    --np-pad-y: 12px;
    --np-pad-x: 16px;
    --np-pad-b: 12px;
    --np-title: var(--v-type-title-large-size);
  }
  .np-cover {
    max-width: 160px;
  }
  .now-playing--lyrics .np-cover {
    max-width: 88px;
  }
}

/* ==========================================================================
   窗格二：点歌队列
   ========================================================================== */
.queue-list {
  background: transparent;
}
.queue-index {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-right: 8px;
  border-radius: 50%;
  color: rgb(var(--v-theme-on-surface-variant));
  font-variant-numeric: tabular-nums;
}
.queue-picker {
  display: flex;
  align-items: center;
  opacity: 0.8;
}

/* ==========================================================================
   窗格三：聊天
   ========================================================================== */
.pane-chat__bar {
  padding: 12px 16px 0;
}
.pane-chat :deep(.chat-panel) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

/* ==========================================================================
   窄屏：mini player + 底部导航（MD3 navigation bar）
   ========================================================================== */
.mini-player {
  position: fixed;
  right: 0;
  left: 0;
  /* 紧贴在底部导航之上；变量继承自 v-main，宽屏无底部导航时为 0 */
  bottom: var(--v-layout-bottom, 80px);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 8px 0 12px;
  background: rgba(var(--v-theme-surface-container), 0.96);
  backdrop-filter: blur(18px);
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}
.mini-player__cover {
  flex: none;
  border-radius: var(--v-shape-sm);
}
.mini-player__meta {
  flex: 1 1 auto;
  min-width: 0;
}
</style>

