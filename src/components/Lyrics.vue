<template>
  <div class="lyrics-container" ref="container">
    <div
      v-for="(value, key) in lyrics"
      :key="key"
      class="lyrics-line"
      :class="{ 'lyrics-active': activeLine === Number(key) }"
    >
      {{ value }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  lyrics: Record<number, string>
  currentTime: number
  lineHeight?: number
}>()

const container = ref<HTMLElement | null>(null)
/** 当前高亮行（computed 里不应写状态，改为在 watch 中推进） */
const activeLine = ref(0)

// 已有歌词就按秒定位；换歌（歌词清空）时归零，避免残留上一首的高亮行
watch(
  [() => props.currentTime, () => props.lyrics],
  ([time, lyrics]) => {
    if (Object.keys(lyrics).length === 0) {
      activeLine.value = 0
      return
    }
    const number = Math.floor(time)
    if (lyrics[number] !== undefined && lyrics[number] !== '') {
      activeLine.value = number
    }
  },
  { immediate: true },
)

// flush: 'post' 保证 DOM 已更新，无需再手动 nextTick
watch(activeLine, () => {
  const el = container.value?.querySelector('.lyrics-active')
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}, { flush: 'post' })
</script>

<style scoped>
.lyrics-container {
  max-height: 250px;
  overflow-y: auto;
  text-align: center;
  padding: 8px 0;
}
.lyrics-line {
  padding: 6px 16px;
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.2s, transform 0.2s;
}
.lyrics-active {
  color: #fff;
  font-weight: 600;
  transform: scale(1.05);
}
</style>
