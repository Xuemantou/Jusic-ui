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
import { computed, ref, watch, nextTick } from 'vue'

const props = defineProps<{
  lyrics: Record<number, string>
  currentTime: number
  lineHeight?: number
}>()

const container = ref<HTMLElement | null>(null)
const lastNumber = ref(0)

const activeLine = computed(() => {
  const { lyrics, currentTime } = props
  const number = Math.floor(currentTime)
  if (Object.keys(lyrics).length === 0) return lastNumber.value
  if (lyrics[number] !== undefined && lyrics[number] !== '') {
    lastNumber.value = number
    return number
  }
  return lastNumber.value
})

watch(activeLine, async () => {
  await nextTick()
  const el = container.value?.querySelector('.lyrics-active')
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})
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
