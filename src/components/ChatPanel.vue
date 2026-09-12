<template>
  <v-card class="chat-panel">
    <v-card-title class="d-flex align-center py-2">
      <span class="text-h6">实时聊天</span>
      <v-spacer />
      <v-btn variant="text" size="small" title="查看房间用户" @click="houseUser">
        <v-icon size="small" class="mr-1">mdi-account-group</v-icon>
        {{ online }}
      </v-btn>
      <v-btn
        v-if="!isConnected"
        color="warning"
        size="small"
        variant="tonal"
        title="重新连接服务器"
        @click="reconnect"
      >
        <v-icon size="small" class="mr-1">mdi-refresh</v-icon>
        重新连接
      </v-btn>
      <v-btn icon size="small" variant="text" title="清空聊天" @click="clearChat">
        <v-icon size="small">mdi-broom</v-icon>
      </v-btn>
    </v-card-title>

    <!-- 聊天消息 -->
    <div ref="chatContainer" class="chat-container">
      <!-- key 用 store 分配的自增 id：chat 有 300 条上限，裁剪时 index 会整体左移，
           若 key 里含 index 会导致每次新消息重建整串 DOM 节点 -->
      <div v-for="item in chatData" :key="item.id" class="chat-item">
        <div v-if="item.type === 'notice'" class="chat-notice">{{ item.content }}</div>
        <div v-else>
          <div class="chat-user">
            {{ isAdminView ? item.nickName + `[${item.sessionId}]` : item.nickName }}
          </div>
          <div class="chat-content">
            <span>{{ item.content }}</span>
            <img
              v-for="(img, i) in item.images || []"
              :key="i"
              :src="img"
              alt=""
              class="chat-img"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input pa-3">
      <div class="d-flex align-center">
        <v-text-field
          v-model="chatMessage"
          placeholder="Message..."
          variant="outlined"
          density="compact"
          hide-details
          class="mr-1"
          @keydown.enter="onEnter"
        />
        <v-menu :close-on-content-click="false" location="top">
          <template #activator="{ props }">
            <v-btn icon variant="text" v-bind="props" title="表情">
              <span style="font-size: 20px">😃</span>
            </v-btn>
          </template>
          <v-card class="pa-2 emoji-card">
            <div class="emoji-grid">
              <v-btn
                v-for="e in EMOJIS"
                :key="e"
                icon
                size="small"
                variant="text"
                @click="insertEmoji(e)"
              >
                <span style="font-size: 18px">{{ e }}</span>
              </v-btn>
            </div>
          </v-card>
        </v-menu>
      </div>
      <v-btn-toggle v-model="sourceChat" mandatory class="mt-2" color="primary" variant="outlined" divided>
        <v-btn value="wy" size="x-small">网易</v-btn>
        <v-btn value="qq" size="x-small">QQ</v-btn>
        <v-btn value="mg" size="x-small">咪咕</v-btn>
      </v-btn-toggle>
      <v-btn color="primary" block class="mt-2" @click="doSend">发送消息</v-btn>
    </div>

    <!-- 功能按钮 -->
    <v-card-actions class="px-3 pb-3 pt-0 flex-wrap">
      <v-chip size="small" color="primary" variant="tonal" @click="$emit('openPictureSearch')">
        搜索图片
      </v-chip>
      <v-chip size="small" color="primary" variant="tonal" @click="musicSkipVote">投票切歌</v-chip>
      <v-chip size="small" color="primary" variant="tonal" @click="$emit('openSearch')">搜索音乐</v-chip>
      <v-chip size="small" color="primary" variant="tonal" @click="$emit('openSongList')">搜索歌单</v-chip>
      <v-chip size="small" color="primary" variant="tonal" @click="$emit('openUserSearch')">搜索用户</v-chip>
      <v-chip size="small" color="tertiary" variant="tonal" @click="$emit('openBili')">B站直播</v-chip>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useSocketStore } from '@/stores/socket'
import { useSocket } from '@/composables/useSocket'

defineEmits<{
  openPictureSearch: []
  openSearch: []
  openSongList: []
  openUserSearch: []
  openBili: []
}>()

const chatStore = useChatStore()
const socketStore = useSocketStore()
const { sendHandler, musicSkipVote, send, reconnect } = useSocket()

const sourceChat = ref('wy')
const chatContainer = ref<HTMLElement | null>(null)

/** 内置常用表情（避免引入额外的 Vue2-only 表情库） */
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😜', '🤔', '😅',
  '😭', '😡', '😴', '🤡', '👻', '💀', '🤖', '👍', '👎', '🙏',
  '👏', '💪', '🎉', '🎵', '🎶', '❤️', '💔', '🔥', '⭐', '✨',
  '🌹', '🌸', '🌈', '☀️', '🌙', '⛄', '🐶', '🐱', '🍺', '🍻',
  '☕', '🍚', '🍉', '🍎', '🍓', '🍦', '🎂', '🍭', '💯', '🎁',
  '💰', '🚀', '🏆', '⚽', '🏀', '🎮', '🎤', '🎧', '📷', '📱',
]

const chatData = computed(() => chatStore.data)
const online = computed(() => socketStore.online)
const isConnected = computed(() => socketStore.isConnected)
const isAdminView = computed(() => socketStore.isRoot || socketStore.isAdmin)

const chatMessage = computed({
  get: () => chatStore.message,
  set: (v: string) => chatStore.setMessage(v),
})

function onEnter(e: KeyboardEvent) {
  // 避免中文输入法回车误发送
  if (e.key === 'Enter' && !e.shiftKey && !(e as KeyboardEvent & { isComposing?: boolean }).isComposing) {
    doSend()
  }
}

function doSend() {
  sendHandler(chatStore.message, sourceChat.value)
}

function insertEmoji(emoji: string) {
  chatStore.setMessage(chatStore.message + emoji)
}

function clearChat() {
  chatStore.setData([])
}

function houseUser() {
  send('/house/houseuser', {})
}

watch(
  // 监听最后一条而不是长度：超过上限裁剪旧消息时长度可能不变
  () => chatStore.data[chatStore.data.length - 1],
  async () => {
    await nextTick()
    const el = chatContainer.value
    if (el) el.scrollTop = el.scrollHeight
  },
)
</script>

<style scoped>
.chat-container {
  min-height: 300px;
  max-height: 420px;
  overflow-y: auto;
  padding: 8px 12px;
}
.chat-item {
  padding: 6px 0;
}
.chat-notice {
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 12px;
}
.chat-user {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 2px;
}
.chat-content {
  display: inline-block;
  padding: 8px 12px;
  max-width: calc(100% - 5px);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-container-high));
  word-break: break-word;
}
.chat-img {
  width: 100%;
  display: block;
  margin-top: 4px;
  border-radius: 4px;
}
.emoji-card {
  max-width: 320px;
  max-height: 280px;
  overflow-y: auto;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}
</style>
