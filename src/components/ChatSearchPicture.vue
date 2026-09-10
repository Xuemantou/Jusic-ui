<template>
  <v-dialog :model-value="modelValue" width="auto" max-width="900" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>搜索图片（斗图）</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div class="d-flex align-center">
          <v-text-field
            v-model="keyword"
            placeholder="请输入关键字搜索..."
            variant="outlined"
            density="compact"
            hide-details
            class="mr-2"
            @keydown.enter="search"
          />
          <v-btn icon color="primary" @click="search">
            <v-icon>mdi-magnify</v-icon>
          </v-btn>
        </div>

        <v-row class="mt-4">
          <v-col
            v-for="(item, index) in displayedPictures"
            :key="index"
            cols="6"
            sm="4"
            md="3"
            class="position-relative"
          >
            <v-img
              :src="getPictureUrl(item)"
              :key="item.errorKey || 'img-' + index"
              class="rounded"
              aspect-ratio="1"
              cover
              @error="handleImageError(index)"
            />
            <div
              v-if="item.error"
              class="picture-overlay"
            >
              <v-btn icon size="small" @click="reloadImage(index)">
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
            </div>
            <div class="picture-action">
              <v-btn icon size="small" color="primary" @click="sendPicture(getPictureUrl(item))">
                <v-icon>mdi-send</v-icon>
              </v-btn>
            </div>
          </v-col>
        </v-row>

        <v-pagination
          v-if="searchCount > pageSize"
          v-model="current"
          :length="Math.ceil(searchCount / pageSize)"
          class="mt-2"
          @update:model-value="search"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useSearchStore, type PictureItem } from '@/stores/search'
import { useSocket } from '@/composables/useSocket'

defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const searchStore = useSearchStore()
const { send } = useSocket()

const current = ref(1)
const pageSize = 6
const displayedPictures = ref<Array<PictureItem & { error?: boolean; errorKey?: string }>>([])
const remainingPictures = ref<Array<PictureItem & { error?: boolean; errorKey?: string }>>([])
let intervalTimer: ReturnType<typeof setInterval> | null = null

const keyword = computed({
  get: () => searchStore.pictureKeyword,
  set: (v: string) => searchStore.setPictureKeyword(v),
})
const searchCount = computed(() => searchStore.pictureCount)

function search() {
  send('/chat/picture/search', {
    content: keyword.value,
    sendTime: Date.now(),
    pageSize,
    pageIndex: current.value,
  })
}

function getPictureUrl(item: { url: string }) {
  return `https://tx.alang.run/doutu${item.url.slice(item.url.lastIndexOf('/'))}`
}

function startLoadingPictures(newData: PictureItem[]) {
  displayedPictures.value = []
  remainingPictures.value = newData.map((item) => ({ ...item, error: false, errorKey: '' }))
  if (intervalTimer) clearInterval(intervalTimer)
  intervalTimer = setInterval(() => {
    if (remainingPictures.value.length === 0) {
      if (intervalTimer) clearInterval(intervalTimer)
      intervalTimer = null
      return
    }
    displayedPictures.value.push(remainingPictures.value.splice(0, 1)[0])
  }, 1000)
}

function handleImageError(index: number) {
  displayedPictures.value[index].error = true
}

function reloadImage(index: number) {
  displayedPictures.value[index].error = false
  displayedPictures.value[index].errorKey = `reload-${Date.now()}`
}

function sendPicture(pictureUrl: string) {
  send('/chat', { content: `picture:${pictureUrl}`, sendTime: Date.now() })
}

watch(
  () => searchStore.pictureData,
  (newData) => startLoadingPictures(newData),
  { deep: true },
)

onBeforeUnmount(() => {
  if (intervalTimer) clearInterval(intervalTimer)
})
</script>

<style scoped>
.position-relative {
  position: relative;
}
.picture-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.6);
}
.picture-action {
  position: absolute;
  bottom: 8px;
  right: 8px;
}
</style>
