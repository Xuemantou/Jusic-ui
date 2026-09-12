<template>
  <!--
    「下载 APP」的占位页。

    这里刻意用弹窗而不是独立路由页：跳路由会卸载 MusicView，
    正在播的歌和 WebSocket 连接都会断。等 APP 真的做出来，
    把卡片内容换成下载二维码/安装包链接即可，入口无需再动。
  -->
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-text class="text-center pa-7">
        <v-icon size="56" color="primary" class="mb-4">mdi-cellphone-arrow-down</v-icon>
        <h2 class="text-h6 mb-3">移动端 APP 正在开发中</h2>
        <p class="text-body-2 on-surface-variant mb-0">
          敬请期待。目前直接用手机浏览器打开本站即可，功能与 APP 完全一致，
          同样支持后台播放与锁屏控制。
        </p>
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="$emit('update:modelValue', false)">
          知道了
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
