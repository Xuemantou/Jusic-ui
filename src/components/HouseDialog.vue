<template>
  <v-dialog :model-value="modelValue" width="auto" max-width="700" @update:model-value="$emit('update:modelValue', $event)" @after-open="getHouses">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>听歌房</span>
        <v-spacer />
        <v-btn size="small" variant="text" @click="innerHouseHide = !innerHouseHide">
          {{ innerHouseHide ? '显示空房' : '隐藏空房' }}
        </v-btn>
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <!-- 创建房间表单 -->
        <v-row dense align="center">
          <v-col cols="12" sm="4">
            <v-text-field v-model="house.name" placeholder="房间名称" variant="outlined" density="compact" hide-details />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field v-model="house.desc" placeholder="房间描述" variant="outlined" density="compact" hide-details />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-if="house.needPwd"
              v-model="house.password"
              placeholder="房间密码"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>
        <v-row dense align="center" class="mt-2">
          <v-col cols="auto">
            <v-switch v-model="house.needPwd" label="房间密码" hide-details density="compact" />
          </v-col>
          <v-col class="text-center">
            <v-btn color="primary" @click="createHouse">创建房间</v-btn>
          </v-col>
          <v-col cols="auto">
            <v-switch v-model="house.enableStatus" label="房间永存" hide-details density="compact" />
          </v-col>
        </v-row>

        <v-divider class="my-3" />

        <!-- 房间列表 -->
        <v-row dense align="center" class="mb-2">
          <v-col>
            <v-text-field v-model="houseSearch" placeholder="房间搜索" variant="outlined" density="compact" hide-details />
          </v-col>
        </v-row>

        <v-list max-height="360" class="overflow-y-auto bg-transparent">
          <v-list-item
            v-for="houseItem in filteredHouses"
            :key="houseItem.id"
            @click="enterHouse(houseItem.id, houseItem.name, houseItem.needPwd)"
          >
            <template #prepend>
              <v-badge :content="houseItem.population || '0'" color="info">
                <v-avatar :color="houseItem.needPwd ? 'blue' : 'green'" size="32">
                  <v-icon>{{ houseItem.needPwd ? 'mdi-lock' : 'mdi-lock-open-variant' }}</v-icon>
                </v-avatar>
              </v-badge>
            </template>
            <v-list-item-title>{{ houseItem.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ houseItem.desc }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- 密码输入弹窗 -->
    <v-dialog v-model="pwdDialog" width="360">
      <v-card>
        <v-card-title>请输入房间密码</v-card-title>
        <v-card-text>
          <v-text-field v-model="pwdInput" variant="outlined" density="compact" hide-details autofocus />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pwdDialog = false">取消</v-btn>
          <v-btn color="primary" @click="confirmPwd">确定</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHouseStore } from '@/stores/house'
import { useSocket } from '@/composables/useSocket'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const houseStore = useHouseStore()
const { send } = useSocket()

const houseSearch = ref('')
const innerHouseHide = ref(false)
const pwdDialog = ref(false)
const pwdInput = ref('')
const pendingEnter = ref<{ id: string; name: string } | null>(null)

const house = computed(() => houseStore.house)
const houses = computed(() => houseStore.houses)

const filteredHouses = computed(() => {
  return houses.value.filter((h) => {
    return (
      h.name.toLowerCase().includes(houseSearch.value.toLowerCase()) &&
      (innerHouseHide.value ? (h.population ?? 0) > 0 : true)
    )
  })
})

function getHouses() {
  send('/house/search', {})
}

function createHouse() {
  send('/house/add', {
    name: house.value.name,
    desc: house.value.desc,
    needPwd: house.value.needPwd,
    password: house.value.password,
    enableStatus: house.value.enableStatus,
    retainKey: house.value.retainKey,
  })
}

function enterHouse(id: string, name: string, needPwd: boolean) {
  if (needPwd) {
    pendingEnter.value = { id, name }
    pwdInput.value = ''
    pwdDialog.value = true
  } else {
    doEnter(id, name, '')
  }
}

function confirmPwd() {
  if (!pendingEnter.value) return
  doEnter(pendingEnter.value.id, pendingEnter.value.name, pwdInput.value)
  pwdDialog.value = false
}

function doEnter(id: string, name: string, pwd: string) {
  houseStore.houseIdNoAction = id
  houseStore.housePwdNoAction = pwd
  houseStore.connectTypeNoAction = 'enter'
  houseStore.houseForward = name
  send('/house/enter', { id, password: pwd })
  emit('update:modelValue', false)
}
</script>
