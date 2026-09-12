<template>
  <v-dialog
    :model-value="modelValue"
    max-width="680"
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-cog-outline</v-icon>
        <span>房间管理</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <!-- 未鉴权：房间管理员密码 -->
        <div v-if="!authed" class="admin-gate">
          <v-icon size="44" class="mb-3">mdi-shield-lock-outline</v-icon>
          <p class="text-subtitle-1 mb-1">需要房间管理员密码</p>
          <p class="text-body-2 on-surface-variant mb-5">
            就是创建这个房间时设置的那个密码
          </p>
          <v-text-field
            v-model="pwdInput"
            type="password"
            label="管理员密码"
            variant="outlined"
            density="comfortable"
            hide-details
            autofocus
            class="admin-gate__field"
            @keydown.enter="verify()"
          />
          <v-btn color="primary" variant="flat" size="large" class="mt-4" @click="verify()">
            进入管理面板
          </v-btn>
        </div>

        <!-- 已鉴权：管理表单 -->
        <div v-else class="admin-form">
          <p class="text-subtitle-2 on-surface-variant mb-2">基本信息</p>
          <v-text-field
            v-model="form.name"
            label="房间名称"
            variant="outlined"
            density="comfortable"
            hide-details
            class="mb-3"
          />
          <v-text-field
            v-model="form.desc"
            label="房间描述"
            variant="outlined"
            density="comfortable"
            hide-details
          />

          <v-divider class="my-5" />
          <p class="text-subtitle-2 on-surface-variant mb-2">访问与留存</p>
          <v-switch
            v-model="form.needPwd"
            label="需要房间密码"
            color="primary"
            hide-details
            density="compact"
          />
          <v-text-field
            v-if="form.needPwd"
            v-model="form.password"
            label="房间密码（留空则不修改）"
            variant="outlined"
            density="comfortable"
            hide-details
            class="mt-1"
          />
          <v-switch
            v-model="form.enableStatus"
            label="房间永存（不会被自动清理）"
            color="primary"
            hide-details
            density="compact"
            class="mt-2"
          />

          <v-divider class="my-5" />
          <p class="text-subtitle-2 on-surface-variant mb-2">管理员密码</p>
          <v-text-field
            v-model="newAdminPwd"
            label="新管理员密码（留空则不修改）"
            type="password"
            variant="outlined"
            density="comfortable"
            hide-details
            hint="至少 4 位，不能含空格 ? % # & = +"
            persistent-hint
          />

          <v-divider class="my-5" />
          <p class="text-subtitle-2 on-surface-variant mb-1">默认点歌歌单</p>
          <p class="text-body-2 on-surface-variant mb-3">
            点歌列表没有下一首时，会从这个歌单里选歌推送。当前
            <strong>{{ defaultPlaylistSize }}</strong> 首。
          </p>
          <div class="d-flex align-center flex-wrap ga-2 mb-3">
            <v-btn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-playlist-plus"
              @click="openSongList = true"
            >
              搜索歌单添加
            </v-btn>
            <v-btn variant="text" prepend-icon="mdi-refresh" @click="refreshPlaylistSize">
              刷新数量
            </v-btn>
            <v-btn
              variant="text"
              color="error"
              prepend-icon="mdi-playlist-remove"
              @click="clearPlaylist"
            >
              清空默认歌单
            </v-btn>
          </div>
          <div class="d-flex align-center flex-wrap ga-2">
            <v-text-field
              v-model="playlistId"
              label="或直接粘贴歌单 ID（多个用逗号或空格隔开）"
              variant="outlined"
              density="compact"
              hide-details
              class="admin-form__id"
            />
            <v-btn-toggle
              v-model="playlistSource"
              mandatory
              density="comfortable"
              variant="outlined"
              divided
              color="primary"
            >
              <v-btn value="wy" size="small">网易</v-btn>
              <v-btn value="qq" size="small">QQ</v-btn>
            </v-btn-toggle>
            <v-btn color="primary" variant="flat" @click="addPlaylist">添加</v-btn>
          </div>

          <v-divider class="my-5" />
          <p class="text-subtitle-2 text-error mb-2">危险操作</p>
          <v-btn
            color="error"
            variant="tonal"
            prepend-icon="mdi-delete-forever"
            @click="confirmDestroy = true"
          >
            销毁房间
          </v-btn>
        </div>
      </v-card-text>

      <v-card-actions v-if="authed" class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">取消</v-btn>
        <v-btn color="primary" variant="flat" @click="save">保存修改</v-btn>
      </v-card-actions>
    </v-card>

    <!-- 歌单搜索：直接复用现成组件，它自带搜索与音源选择 -->
    <SongListDialog v-model="openSongList" @pick="onPickSongList" />

    <!-- 销毁二次确认 -->
    <v-dialog v-model="confirmDestroy" max-width="420">
      <v-card>
        <v-card-title class="text-error">销毁房间</v-card-title>
        <v-card-text>
          房间会被立即删除，房间里的所有人都会被退回首页，且**无法恢复**。确定要销毁
          「{{ form.name }}」吗？
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDestroy = false">取消</v-btn>
          <v-btn color="error" variant="flat" @click="destroy">确认销毁</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SongListDialog from '@/components/SongListDialog.vue'
import { useHouseStore } from '@/stores/house'
import { useSocketStore } from '@/stores/socket'
import { useSocket } from '@/composables/useSocket'
import { useToast } from '@/composables/useToast'
import type { SongList } from '@/types/music'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const houseStore = useHouseStore()
const socketStore = useSocketStore()
const { send } = useSocket()
const toast = useToast()

/**
 * 是否已具备本房间的管理权限。
 *
 * 房间创建者进房时后端就把 role 设为 admin（session.getId().equals(houseId)），
 * 所以创建者打开面板是免密的；其他人要用创建时设的密码走 /auth/admin 提权。
 */
const authed = computed(() => socketStore.isRoot || socketStore.isAdmin)

const pwdInput = ref('')
const newAdminPwd = ref('')
const playlistId = ref('')
const playlistSource = ref('wy')
const openSongList = ref(false)
const confirmDestroy = ref(false)

const defaultPlaylistSize = computed(() => houseStore.defaultPlaylistSize)

const form = ref({
  name: '',
  desc: '',
  password: '',
  needPwd: false,
  enableStatus: false,
})

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    pwdInput.value = ''
    newAdminPwd.value = ''
    playlistId.value = ''
    confirmDestroy.value = false
    if (authed.value) {
      loadHouse()
    } else if (houseStore.adminPwdCache) {
      // 自己是创建者：用创建时记下的密码自动提权，省一次手输
      verify(houseStore.adminPwdCache)
    }
  },
)

// 房间信息回来时回填表单（密码不回传明文，改密码时留空即不改）
watch(
  () => houseStore.houseInfo,
  (info) => {
    if (!info) return
    form.value = {
      name: info.name ?? '',
      desc: info.desc ?? '',
      password: '',
      needPwd: info.needPwd ?? false,
      enableStatus: info.enableStatus ?? false,
    }
  },
)

// 密码验证通过后自动载入
watch(authed, (ok) => {
  if (ok && props.modelValue) loadHouse()
})

function loadHouse() {
  send('/house/info', {})
  refreshPlaylistSize()
}

function verify(cached?: string) {
  const pwd = (typeof cached === 'string' ? cached : pwdInput.value).trim()
  if (!pwd) {
    toast.error('请输入管理员密码')
    return
  }
  // 结果由 AUTH_ADMIN 消息返回，成功后 socketStore.isAdmin 变 true，上面的 watch 会自动载入
  send('/auth/admin', { password: pwd, sendTime: Date.now() })
  pwdInput.value = ''
}

function save() {
  send('/house/edit', {
    name: form.value.name,
    desc: form.value.desc,
    needPwd: form.value.needPwd,
    // 留空表示不改密码：undefined 在序列化时会被丢掉，后端按「未传」处理
    password: form.value.password.trim() || undefined,
    enableStatus: form.value.enableStatus,
  })
  const pwd = newAdminPwd.value.trim()
  if (pwd) {
    send(`/auth/adminpwd/${encodeURIComponent(pwd)}`, '')
    newAdminPwd.value = ''
  }
  emit('update:modelValue', false)
}

function refreshPlaylistSize() {
  send('/music/playlistSize', '')
}

function addPlaylist() {
  const id = playlistId.value.trim()
  if (!id) {
    toast.error('请输入歌单 ID')
    return
  }
  send('/music/setDefaultPlaylist', { id, source: playlistSource.value })
  playlistId.value = ''
  // 后端加歌是异步的，稍等一下再问数量，否则拿到的还是旧值
  setTimeout(refreshPlaylistSize, 1500)
}

function onPickSongList(row: SongList) {
  openSongList.value = false
  const id = String(row?.id ?? '').trim()
  if (!id) {
    toast.error('这个歌单没有 id，无法添加')
    return
  }
  send('/music/setDefaultPlaylist', { id, source: playlistSource.value })
  toast.info(`正在把歌单「${row.name}」加入默认列表…`)
  setTimeout(refreshPlaylistSize, 1500)
}

function clearPlaylist() {
  send('/music/clearDefaultPlayList', '')
  setTimeout(refreshPlaylistSize, 1200)
}

function destroy() {
  confirmDestroy.value = false
  // 后端销毁后广播 HOUSE_DESTROYED，useSocket 会调用回首页钩子
  send('/house/edit', { canDestroy: true })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.admin-gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 8px 16px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
}
.admin-gate__field {
  width: min(100%, 280px);
}

.admin-form__id {
  flex: 1 1 220px;
  min-width: 0;
}
</style>
