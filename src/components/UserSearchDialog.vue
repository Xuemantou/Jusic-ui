<template>
  <v-dialog :model-value="modelValue" width="auto" max-width="700" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>搜索用户</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div class="d-flex align-center">
          <v-text-field
            v-model="keyword"
            placeholder="请输入用户昵称..."
            variant="outlined"
            density="compact"
            hide-details
            class="mr-2"
            @keydown.enter="search"
          />
          <v-btn-toggle v-model="source" mandatory color="primary" variant="outlined" divided>
            <v-btn value="wy" size="small">网易</v-btn>
            <v-btn value="qq" size="small">QQ</v-btn>
          </v-btn-toggle>
          <v-btn icon color="primary" class="ml-2" @click="search">
            <v-icon>mdi-magnify</v-icon>
          </v-btn>
        </div>

        <v-table density="compact" hover class="mt-4">
          <thead>
            <tr>
              <th class="text-left">昵称</th>
              <th class="text-center">用户ID</th>
              <th class="text-left">签名</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in userData" :key="row.userId + '-' + index" class="cursor-pointer" @click="pick(row)">
              <td>
                <v-avatar size="32" class="mr-2">
                  <v-img :src="row.avatarUrl" cover />
                </v-avatar>
                {{ row.nickname }}
              </td>
              <td class="text-center">{{ row.userId }}</td>
              <td class="text-truncate" style="max-width: 240px">{{ row.signature }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useSocket } from '@/composables/useSocket'
import type { UserInfo } from '@/types/music'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  pickUser: [value: UserInfo]
}>()

const searchStore = useSearchStore()
const { send } = useSocket()

const source = ref('wy')
const current = ref(1)
const pageSize = 10

const keyword = computed({
  get: () => searchStore.userKeyword,
  set: (v: string) => searchStore.setUserKeyword(v),
})
const userData = computed(() => searchStore.userData)

function search() {
  send('/music/searchuser', {
    nickname: keyword.value.trim(),
    sendTime: Date.now(),
    source: source.value,
    pageIndex: current.value,
    pageSize,
  })
}

function pick(row: UserInfo) {
  emit('pickUser', row)
}
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
