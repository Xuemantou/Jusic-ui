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

const { message, visible, color, timeout } = useToast()
</script>
