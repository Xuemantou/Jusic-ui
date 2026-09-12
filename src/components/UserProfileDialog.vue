<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-account-cog-outline</v-icon>
        <span>个人设置</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <p class="text-subtitle-2 on-surface-variant mb-2">昵称</p>
        <div class="d-flex align-center ga-2">
          <v-text-field
            v-model="nameInput"
            label="你的昵称"
            variant="outlined"
            density="comfortable"
            hide-details
            maxlength="33"
            @keydown.enter="saveName"
          />
          <v-btn color="primary" variant="flat" @click="saveName">保存</v-btn>
        </div>
        <p class="text-body-2 on-surface-variant mt-2">
          {{
            inHouse
              ? '保存后立刻生效，并记在这台设备上，下次进房自动使用。'
              : '会记在这台设备上，进房后自动生效，不用再设一次。'
          }}
        </p>

        <v-divider class="my-5" />

        <p class="text-subtitle-2 on-surface-variant mb-2">默认音源</p>
        <v-btn-toggle v-model="source" mandatory variant="outlined" divided color="primary">
          <v-btn value="wy">网易</v-btn>
          <v-btn value="qq">QQ</v-btn>
          <v-btn value="mg">咪咕</v-btn>
        </v-btn-toggle>
        <p class="text-body-2 on-surface-variant mt-2">
          聊天框点歌 / 搜歌时优先使用的音源，同样会自动记住。
        </p>

        <v-divider class="my-5" />

        <p class="text-body-2 on-surface-variant">
          昵称、默认音源、音量、主题与配色、我的收藏、点歌历史都会自动保存在这台设备的浏览器里，
          关掉页面也不会丢。清空浏览器数据会一并清除。
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSocketStore } from '@/stores/socket'
import { useSocket } from '@/composables/useSocket'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const socketStore = useSocketStore()
const { settingName } = useSocket()
const toast = useToast()

const nameInput = ref('')
/** 已在房间里时，保存昵称可以立刻同步给服务器（未连接时只能先存本地） */
const inHouse = computed(() => socketStore.isConnected)

const source = computed({
  get: () => socketStore.chatSource,
  set: (v: string) => socketStore.setChatSource(v),
})

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) nameInput.value = socketStore.userName ?? ''
  },
)

function saveName() {
  const name = nameInput.value.trim()
  if (!name) {
    toast.error('昵称不能为空')
    return
  }
  // 先落本地：即便此刻没连上服务器，下次进房也会自动带上
  socketStore.setUserName(name)
  if (socketStore.isConnected) {
    // 成功与否由 SETTING_NAME 消息回执决定，它会自己弹提示
    settingName(name)
  } else {
    toast.success('已保存，进房后自动生效')
  }
}
</script>
