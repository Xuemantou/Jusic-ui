<template>
  <v-app-bar color="primary" elevation="1">
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title class="text-truncate">{{ musichouse }}</v-app-bar-title>

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

    <v-btn icon @click="$emit('openShareDialog', true)">
      <v-icon>mdi-share-variant</v-icon>
    </v-btn>
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" temporary width="300">
    <v-card class="mx-auto" max-width="375">
      <v-card-item>
        <template #prepend>
          <v-avatar size="45" color="primary">
            <v-img :src="uicon" cover />
          </v-avatar>
        </template>
        <v-card-title>JumpAlang</v-card-title>
        <v-card-subtitle>Quanzhou, China</v-card-subtitle>
      </v-card-item>
      <v-img :src="flPic" height="200" cover />
      <v-card-text>聊天、斗图、音乐、点播、娱乐</v-card-text>
    </v-card>

    <v-list>
      <v-list-subheader>社交</v-list-subheader>
      <v-list-item href="https://weibo.com/JumpAlang" target="_blank" prepend-icon="mdi-sina-weibo" title="微博" />
      <v-list-item href="http://www.alang.run" target="_blank" prepend-icon="mdi-web" title="博客" />
      <v-divider />
      <v-list-subheader>开源</v-list-subheader>
      <v-list-item
        href="https://github.com/JumpAlang/Jusic-serve"
        target="_blank"
        prepend-icon="mdi-github"
        title="Jusic-serve"
      />
      <v-divider />
      <v-list-subheader>赞赏</v-list-subheader>
    </v-list>
    <v-img :src="aplause" class="pa-2" />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
// v-img 的 src 是普通字符串 prop，Vite 不会处理相对路径，必须 import 才会被打包
import uicon from '@/assets/images/uicon.jpg'
import flPic from '@/assets/images/fl.jpg'
import aplause from '@/assets/images/aplause.jpg'
import {
  activeSeed,
  seedSource,
  setSeedSource,
  setThemeMode,
  themeMode,
  type SeedSource,
  type ThemeMode,
} from '@/theme'

defineProps<{
  musichouse: string
}>()

defineEmits<{
  openShareDialog: [value: boolean]
}>()

const drawer = ref(false)

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
