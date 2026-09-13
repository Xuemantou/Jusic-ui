<template>
  <!-- 聊天窗格：MD3 里窗格本身就是"面"，不再套一层卡片，避免面中面 -->
  <div class="chat-panel">
    <header class="chat-head">
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
      <v-btn icon variant="text" title="清空聊天" @click="clearChat">
        <v-icon size="small">mdi-broom</v-icon>
      </v-btn>
    </header>

    <!-- 聊天消息 -->
    <div ref="chatContainer" class="chat-container">
      <!-- key 用 store 分配的自增 id：chat 有 300 条上限，裁剪时 index 会整体左移，
           若 key 里含 index 会导致每次新消息重建整串 DOM 节点 -->
      <div v-for="item in chatData" :key="item.id" class="chat-item">
        <div v-if="item.type === 'notice'" class="chat-notice">{{ item.content }}</div>
        <div v-else class="chat-msg">
          <div class="chat-user">
            {{ isAdminView ? item.nickName + `[${item.sessionId}]` : item.nickName }}
          </div>
          <div class="chat-content">{{ item.content }}</div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input">
      <div class="chat-input__row">
        <v-text-field
          v-model="chatMessage"
          placeholder="说点什么…"
          variant="outlined"
          density="compact"
          hide-details
          class="chat-input__field"
          @keydown.enter="onEnter"
        />
        <v-menu :close-on-content-click="false" location="top">
          <template #activator="{ props }">
            <v-btn icon variant="text" v-bind="props" title="表情">
              <span class="chat-emoji-trigger">😃</span>
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
                <span class="chat-emoji-item">{{ e }}</span>
              </v-btn>
            </div>
          </v-card>
        </v-menu>
        <!-- MD3：发送是 filled 图标按钮（配合 Enter 键）。
             原来整行的大按钮会吃掉本就不多的消息区高度 -->
        <v-btn icon color="primary" variant="flat" title="发送" @click="doSend">
          <v-icon>mdi-send</v-icon>
        </v-btn>
      </div>

      <!-- 工具行：图标按钮而非会自动换行的 chips，窄窗格里也不会堆成三行 -->
      <div class="chat-tools">
        <v-btn-toggle
          v-model="sourceChat"
          mandatory
          density="comfortable"
          variant="outlined"
          divided
          color="primary"
        >
          <v-btn value="wy" size="small">网易</v-btn>
          <v-btn value="qq" size="small">QQ</v-btn>
        </v-btn-toggle>
        <v-spacer />
        <v-btn icon size="small" variant="text" title="投票切歌" @click="musicSkipVote">
          <v-icon>mdi-skip-next</v-icon>
        </v-btn>
        <v-btn icon size="small" variant="text" title="搜索音乐" @click="$emit('openSearch')">
          <v-icon>mdi-music-note-plus</v-icon>
        </v-btn>
        <v-btn icon size="small" variant="text" title="搜索歌单" @click="$emit('openSongList')">
          <v-icon>mdi-playlist-music</v-icon>
        </v-btn>
        <v-btn icon size="small" variant="text" title="搜索用户" @click="$emit('openUserSearch')">
          <v-icon>mdi-account-search</v-icon>
        </v-btn>
        <v-btn icon size="small" variant="text" title="B站直播" @click="$emit('openBili')">
          <!-- 官方 logo 的单色蒙版（.md3-icon-bilibili 见 md3-components.css），
               与同排其它 mdi 图标同色同尺寸；原来这里是 mdi-television-classic。
               刻意不带 color —— 那排图标本来就该是统一的前景色。 -->
          <v-icon class="md3-icon-bilibili" />
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useSocketStore } from '@/stores/socket'
import { useSocket } from '@/composables/useSocket'

defineEmits<{
  openSearch: []
  openSongList: []
  openUserSearch: []
  openBili: []
}>()

const chatStore = useChatStore()
const socketStore = useSocketStore()
const { sendHandler, musicSkipVote, send, reconnect } = useSocket()

/** 音源偏好存到 store 并持久化：原先这里是组件内 ref，刷新就丢 */
const sourceChat = computed({
  get: () => socketStore.chatSource,
  set: (v: string) => socketStore.setChatSource(v),
})
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
/* 高度由父级窗格决定，这里只保证内部滚动区能正确收缩 */
.chat-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 头部：与队列窗格的 pane__head 保持同一套规格（MD3 的窗格标题行） */
.chat-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 8px 12px 20px;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}

.chat-container {
  flex: 1 1 auto;
  /* 必须能收缩，否则窄屏窗格里会把输入区挤出可视范围 */
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
  /* 滚动到底部时的呼吸空间，最后一条不会贴着输入区 */
  scroll-padding-bottom: 8px;
}

.chat-item {
  padding: 4px 0;
}

.chat-notice {
  margin: 6px 0;
  padding: 6px 12px;
  border-radius: var(--v-shape-sm);
  text-align: center;
  font-size: var(--v-type-body-small-size);
  line-height: var(--v-type-body-small-height);
  color: rgb(var(--v-theme-on-surface-variant));
  background: rgb(var(--v-theme-surface-container));
}

/* 发言人：MD3 label-medium，用主色与正文区分 */
.chat-user {
  margin-bottom: 2px;
  font-size: var(--v-type-label-medium-size, 0.75rem);
  font-weight: 500;
  line-height: var(--v-type-label-medium-height, 1rem);
  color: rgb(var(--v-theme-primary));
}
.chat-msg + .chat-msg .chat-user {
  margin-top: 4px;
}

.chat-content {
  display: inline-block;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: var(--v-shape-md);
  background: rgb(var(--v-theme-surface-container-high));
  font-size: var(--v-type-body-medium-size);
  line-height: var(--v-type-body-medium-height);
  word-break: break-word;
}

/* 输入区：与消息区之间用一条 outline 划界（MD3 用分隔而非阴影） */
.chat-input {
  padding: 12px 16px 16px;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}
.chat-input__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chat-input__field {
  flex: 1 1 auto;
  min-width: 0;
}
.chat-emoji-trigger {
  font-size: 20px;
}
.chat-emoji-item {
  font-size: 18px;
}

.chat-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
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
