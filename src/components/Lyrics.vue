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

// 只滚动歌词容器自身。
// 不能用 scrollIntoView：它会把「所有可滚动祖先」都滚一遍，于是整个页面也被滚到
// 让高亮行居中的位置——展开歌词时页面会莫名其妙跳走。
// flush: 'post' 保证 DOM 已更新、位置测量准确。
watch(
  activeLine,
  () => {
    const box = container.value
    if (!box) return
    const active = box.querySelector<HTMLElement>('.lyrics-active')
    if (!active) return
    // 容器是 static 定位，不是 offsetParent，故用两者的相对位置算偏移
    const delta =
      active.getBoundingClientRect().top -
      box.getBoundingClientRect().top -
      (box.clientHeight - active.offsetHeight) / 2
    if (Math.abs(delta) < 1) return
    box.scrollTo({ top: box.scrollTop + delta, behavior: 'smooth' })
  },
  { flush: 'post' },
)
</script>

<style scoped>
.lyrics-container {
  /* 高度交给父窗格（MusicView 的 .np-lyrics 是 flex 容器）。
     原来写死 max-height: 250px，在三窗格布局里宽屏下只占窗格的一小块，白留大片空白。 */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* 同 .pane__body：不显式写 overflow-x 的话，它会跟着 overflow-y 一起变成 auto，
     长句歌词稍宽就多冒一条横向滚动条。这里只保留竖向这一根。 */
  overflow-x: hidden;
  text-align: center;
  padding: 8px 0;
}
.lyrics-line {
  padding: 6px 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  transition: color 0.2s, transform 0.2s;
  /* 超长句（尤其没有空格的外文或连续符号）要能断行，否则会横向溢出 */
  overflow-wrap: anywhere;
}
.lyrics-active {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 600;
  transform: scale(1.05);
}
</style>
