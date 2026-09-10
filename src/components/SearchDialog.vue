<template>
  <v-dialog :model-value="modelValue" width="auto" max-width="800" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>搜索音乐</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div class="d-flex align-center">
          <v-text-field
            v-model="keyword"
            placeholder="请输入关键字搜索..."
            variant="outlined"
            density="compact"
            hide-details
            class="mr-2"
            @keydown.enter="search"
          />
          <v-btn-toggle v-model="source" mandatory color="primary" variant="outlined" divided>
            <v-btn value="wy" size="small">网易</v-btn>
            <v-btn value="qq" size="small">QQ</v-btn>
            <v-btn value="mg" size="small">咪咕</v-btn>
            <v-btn value="lz" size="small">禁歌</v-btn>
          </v-btn-toggle>
          <v-btn icon color="primary" class="ml-2" @click="search">
            <v-icon>mdi-magnify</v-icon>
          </v-btn>
        </div>

        <v-table density="compact" hover class="mt-4">
          <thead>
            <tr>
              <th class="text-left">ID</th>
              <th class="text-left">歌曲</th>
              <th class="text-center">歌手</th>
              <th class="text-center">专辑</th>
              <th class="text-center">时长</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in searchData" :key="row.id + '-' + index">
              <td>{{ index + 1 }}</td>
              <td>
                <v-btn
                  v-if="showPickButton(row)"
                  icon="mdi-play"
                  size="x-small"
                  color="teal"
                  variant="text"
                  @click="pickMusic(row)"
                />
                <v-tooltip v-else text="当前音乐不能点播">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" size="20" color="grey">mdi-play</v-icon>
                  </template>
                </v-tooltip>
                {{ row.name }}
              </td>
              <td class="text-center">{{ row.artist }}</td>
              <td class="text-center">{{ row.album?.name ? '《' + row.album.name + '》' : '' }}</td>
              <td class="text-center">{{ formatTime(row.duration / 1000) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-pagination
          v-if="searchCount > pageSize"
          v-model="current"
          :length="Math.ceil(searchCount / pageSize)"
          class="mt-2"
          @update:model-value="search"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useSocket } from '@/composables/useSocket'
import { useToast } from '@/composables/useToast'
import { secondsToHH_mm_ss } from '@/utils/timeUtils'
import type { Music } from '@/types/music'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const searchStore = useSearchStore()
const toast = useToast()
const { send } = useSocket()

const source = ref('wy')
const current = ref(1)
const pageSize = 10

const keyword = computed({
  get: () => searchStore.keyword,
  set: (v: string) => searchStore.setKeyword(v),
})
const searchData = computed(() => searchStore.data)
const searchCount = computed(() => searchStore.count)

function search() {
  send('/music/search', {
    name: keyword.value.trim(),
    sendTime: Date.now(),
    source: source.value,
    pageIndex: current.value,
    pageSize,
  })
}

function pickMusic(row: Music) {
  send('/music/pick', {
    name: row.name,
    id: row.id,
    source: source.value,
    quality: '320k',
    sendTime: Date.now(),
  })
  toast.success(`[${row.id}]${row.name} - 已发送点歌请求`)
}

function showPickButton(row: Music) {
  const privilege = row.privilege
  if (!privilege) return true
  if (Number(privilege.st) < 0) return false
  if (Number(privilege.fl) === 0) return false
  return true
}

function formatTime(value: number) {
  return secondsToHH_mm_ss(value)
}
</script>
