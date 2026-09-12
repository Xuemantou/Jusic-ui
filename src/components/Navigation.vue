<template>
  <!-- MD3 的 top app-bar：中小尺寸用 surface 色承载，只有 filled 变体才整条染主色。
       这里用 surface-container + 底部 outline 分隔线，替代 MD2 的阴影分层。 -->
  <v-app-bar color="surface-container" flat class="app-bar">
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title class="text-h6">{{ musichouse }}</v-app-bar-title>
    <ThemeMenu />
    <v-btn icon title="个人设置" @click="$emit('openProfile', true)">
      <v-icon>mdi-account-cog-outline</v-icon>
    </v-btn>
    <v-btn icon title="房间管理" @click="$emit('openHouseAdmin', true)">
      <v-icon>mdi-cog-outline</v-icon>
    </v-btn>
    <v-btn icon title="分享房间" @click="$emit('openShareDialog', true)">
      <v-icon>mdi-share-variant</v-icon>
    </v-btn>
  </v-app-bar>

  <!-- eager 不能省：v-img 默认走 IntersectionObserver 懒加载，而在 temporary 抽屉里
       这个观察不会触发（实测抽屉打开 5 秒后仍是 v-img--booting、连 <img> 都没插入，
       而同一时刻页面上的其它 v-img 已正常加载）。抽屉里只有两张图，直接立即加载。 -->
  <v-navigation-drawer v-model="drawer" temporary width="300">
    <v-card class="mx-auto" max-width="375">
      <v-card-item>
        <template #prepend>
          <v-avatar size="45" color="primary">
            <v-img :src="avatar" cover eager />
          </v-avatar>
        </template>
        <v-card-title>Xuemantou</v-card-title>
      </v-card-item>
      <v-img :src="banner" height="200" cover eager />
      <v-card-text>聊天、音乐、点播、娱乐</v-card-text>
    </v-card>

    <v-list>
      <v-list-subheader>社交</v-list-subheader>
      <v-list-item href="https://space.bilibili.com/12999146" target="_blank" title="Bilibili">
        <template #prepend>
          <!-- B站官方 favicon 的"形状"做成蒙版，再用 currentColor 着色：
               既是 B 站本来的 logo，又和同区的 mdi-web / mdi-github 一样是单色、跟随主题。
               容器必须是 v-icon —— 这样尺寸与右侧间距都沿用 Vuetify 的图标规则，
               换成普通 span 会丢掉 .v-list-item__prepend > .v-icon 的间距，文字就贴上来了。
               蒙版的生成方式与注意事项见 src/styles/md3-components.css。 -->
          <v-icon class="md3-icon-bilibili" />
        </template>
      </v-list-item>
      <v-list-item
        href="https://www.xuemantou.top"
        target="_blank"
        prepend-icon="mdi-web"
        title="博客"
      />
      <v-divider />
      <v-list-subheader>开源</v-list-subheader>
      <v-list-item
        href="https://github.com/Xuemantou/Jusic-Serve-Houses"
        target="_blank"
        prepend-icon="mdi-github"
        title="Jusic-Serve-Houses"
      />
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
// v-img 的 src 是普通字符串 prop，Vite 不会处理相对路径，必须 import 才会被打包
import avatar from '@/assets/images/avatar.jpg'
import banner from '@/assets/images/image.jpg'
import ThemeMenu from '@/components/ThemeMenu.vue'

defineProps<{
  musichouse: string
}>()

defineEmits<{
  openShareDialog: [value: boolean]
  openHouseAdmin: [value: boolean]
  openProfile: [value: boolean]
}>()

const drawer = ref(false)
</script>

<!-- B站图标用的 .md3-icon-bilibili 定义在 src/styles/md3-components.css（与聊天工具行共用）。
     .app-bar 的 MD3 规格（64 高 / surface-container / 底部 outline 分隔）也在那里，
     首页顶栏与这里共用同一份，避免两处漂移。 -->
