<template>
  <v-app-bar color="primary" elevation="1">
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title class="text-truncate">{{ musichouse }}</v-app-bar-title>
    <v-btn icon @click="$emit('openShareDialog', true)">
      <v-icon>mdi-share-variant</v-icon>
    </v-btn>
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" temporary width="300">
    <v-card class="mx-auto" max-width="375">
      <v-card-item>
        <template #prepend>
          <v-avatar size="45" color="primary">
            <v-img src="../assets/images/uicon.jpg" cover />
          </v-avatar>
        </template>
        <v-card-title>JumpAlang</v-card-title>
        <v-card-subtitle>Quanzhou, China</v-card-subtitle>
      </v-card-item>
      <v-img src="../assets/images/fl.jpg" height="200" cover />
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
    <v-img src="../assets/images/aplause.jpg" class="pa-2" />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  musichouse: string
}>()

defineEmits<{
  openShareDialog: [value: boolean]
}>()

const drawer = ref(false)
</script>
