<template>
  <v-app>
    <router-view />
    <v-snackbar v-model="visible" :color="color" :timeout="timeout" location="top">
      {{ message }}
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { syncVuetifyTheme } from '@/theme'

const { message, visible, color, timeout } = useToast()

// 把主题状态（明暗模式 / seed 来源）接到 Vuetify 运行时主题上
syncVuetifyTheme()
</script>
