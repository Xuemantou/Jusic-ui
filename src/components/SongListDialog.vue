<template>
  <v-dialog :model-value="modelValue" width="auto" max-width="800" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>搜索歌单</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div class="d-flex align-center">
          <v-text-field
            v-model="keyword"
            placeholder="歌单搜索（留空可查看默认歌单）"
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
              <th class="text-left">歌单</th>
              <th class="text-center">创建者</th>
              <th class="text-center">曲数</th>
              <th class="text-center">播放量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in gdData" :key="row.id + '-' + index" class="cursor-pointer" @click="pick(row)">
              <td>
                <v-avatar size="32" class="mr-2" rounded>
                  <v-img :src="row.pictureUrl" cover />
                </v-avatar>
                {{ row.name }}
              </td>
              <td class="text-center">{{ row.creator }}</td>
              <td class="text-center">{{ row.songCount }}</td>
              <td class="text-center">{{ row.playCount }}</td>
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
import type { SongList } from '@/types/music'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  pick: [value: SongList]
}>()

const searchStore = useSearchStore()
const { send } = useSocket()

const source = ref('wy')
const current = ref(1)
const pageSize = 10

const keyword = computed({
  get: () => searchStore.gdKeyword,
  set: (v: string) => searchStore.setGdKeyword(v),
})
const gdData = computed(() => searchStore.gdData)

function search() {
  send('/music/searchsonglist', {
    name: (keyword.value + '').trim(),
    sendTime: Date.now(),
    source: source.value,
    pageIndex: current.value,
    pageSize,
  })
}

function pick(row: SongList) {
  emit('pick', row)
}
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
