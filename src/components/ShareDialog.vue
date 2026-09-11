<template>
  <v-dialog :model-value="modelValue" width="auto" max-width="420" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>分享房间</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="text-center">
        <div class="text-subtitle-1 mb-2">{{ houseStore.musichouse }}</div>
        <div v-if="homeDesc" class="text-caption text-grey mb-3">{{ homeDesc }}</div>

        <v-img v-if="qrcodeDataUrl" :src="qrcodeDataUrl" width="250" height="250" class="mx-auto" />

        <div v-if="miniQrcode" class="mt-4">
          <div class="text-caption text-grey mb-2">小程序码</div>
          <v-img :src="miniQrcode" width="200" class="mx-auto" />
        </div>

        <div class="text-caption text-grey mt-4 text-truncate">{{ shareUrl }}</div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="text" @click="copyUrl">复制链接</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useHouseStore } from '@/stores/house'
import { useToast } from '@/composables/useToast'
import http from '@/utils/http'
import { SUCCESS_CODE } from '@/types/message'

const props = defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// 打开即生成二维码/小程序码。
// 不用 @after-enter：过渡动画被打断（快速开关）时该事件可能不触发。
watch(
  () => props.modelValue,
  (visible) => {
    if (visible) loadShare()
  },
)

const houseStore = useHouseStore()
const toast = useToast()

const qrcodeDataUrl = ref('')
const miniQrcode = ref('')
const homeDesc = ref('')
const shareUrl = ref('')

function joinUrl() {
  const queryString = `houseId=${houseStore.houseId}&housePwd=${houseStore.housePwd}`
  const index = location.href.replace('//', '||').indexOf('/')
  return location.href.substring(0, index + 1) + '?' + encodeURIComponent(queryString)
}

function loadShare() {
  homeDesc.value = ''
  shareUrl.value = joinUrl()
  QRCode.toDataURL(shareUrl.value, { width: 250, margin: 1 })
    .then((url) => {
      qrcodeDataUrl.value = url
    })
    .catch(() => {})

  // 房间描述
  http
    .post('/house/get', { id: houseStore.houseId })
    .then((response) => {
      if (response.data.code == SUCCESS_CODE) {
        homeDesc.value = response.data.data.desc
      }
    })
    .catch(() => {})

  // 小程序码
  http
    .post('/house/getMiniCode', { id: houseStore.houseId })
    .then((response) => {
      if (response.data.code == SUCCESS_CODE) {
        miniQrcode.value = 'data:image/jpeg;base64,' + response.data.data
      }
    })
    .catch(() => {})
}

function copyUrl() {
  navigator.clipboard
    ?.writeText(shareUrl.value)
    .then(() => toast.success('链接已复制'))
    .catch(() => toast.error('复制失败'))
}
</script>
