<template>
  <v-menu location="bottom end">
    <template #activator="{ props }">
      <v-btn icon v-bind="props" title="外观设置">
        <v-icon>mdi-palette-outline</v-icon>
      </v-btn>
    </template>
    <v-list min-width="250" density="comfortable">
      <v-list-subheader>明暗模式</v-list-subheader>
      <v-list-item
        v-for="option in MODE_OPTIONS"
        :key="option.value"
        :prepend-icon="option.icon"
        :title="option.title"
        :active="themeMode === option.value"
        @click="setThemeMode(option.value)"
      />
      <v-divider class="my-2" />
      <v-list-subheader>配色来源</v-list-subheader>
      <v-list-item
        v-for="option in SEED_OPTIONS"
        :key="option.value"
        :prepend-icon="option.icon"
        :title="option.title"
        :subtitle="option.hint"
        :active="seedSource === option.value"
        @click="setSeedSource(option.value)"
      />
      <v-divider class="my-2" />
      <!-- 显示当前生效的 seed：跟随背景图取色时，一眼能看出是否提取成功 -->
      <v-list-item prepend-icon="mdi-eyedropper" title="当前主题色" :subtitle="activeSeed">
        <template #append>
          <v-avatar :color="activeSeed" size="24" />
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import {
  activeSeed,
  seedSource,
  setSeedSource,
  setThemeMode,
  themeMode,
  type SeedSource,
  type ThemeMode,
} from '@/theme'

/**
 * 外观设置菜单（MD3 主题切换 / 配色来源）。
 *
 * 抽成独立组件是因为首页与播放页都需要这个入口：
 * 播放页的入口挂在 Navigation 的 app-bar 上，而首页（房间列表）不渲染
 * Navigation，所以它必须能单独放进首页顶部。
 */
const MODE_OPTIONS: { value: ThemeMode; title: string; icon: string }[] = [
  { value: 'dark', title: '深色', icon: 'mdi-weather-night' },
  { value: 'light', title: '浅色', icon: 'mdi-weather-sunny' },
  { value: 'system', title: '跟随系统', icon: 'mdi-theme-light-dark' },
]

const SEED_OPTIONS: { value: SeedSource; title: string; hint: string; icon: string }[] = [
  { value: 'default', title: '品牌配色', hint: 'Jusic 原始 teal 主色', icon: 'mdi-water' },
  { value: 'background', title: '跟随背景图', hint: '从首页背景图提取主色', icon: 'mdi-image-search-outline' },
]
</script>
