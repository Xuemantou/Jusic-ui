<template>
  <v-dialog :model-value="modelValue" width="auto" max-width="480" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>B站直播弹幕点歌</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-text-field v-model="roomId" label="请输入B站直播间房间号或链接" variant="outlined" density="compact" hide-details />
        <v-text-field
          v-model.number="switchLimit"
          label="超过多少人投票切歌"
          type="number"
          variant="outlined"
          density="compact"
          hide-details
          class="mt-3"
        />
        <v-btn :color="connected ? 'error' : 'primary'" block class="mt-4" @click="connected ? disconnectBiliBili() : connectBiliBili()">
          {{ connected ? '断开连接' : '连接直播间' }}
        </v-btn>

        <div class="text-caption text-grey mt-4">
          <div>1. 弹幕发送「点歌 歌曲名」即可点歌（默认网易云）</div>
          <div>2. 弹幕发送「点歌qq 歌曲名」切换到 QQ 曲源</div>
          <div>3. 弹幕发送「切歌」或「投票切歌」发起投票切歌</div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import decompress from 'brotli/decompress'
import { baseUrl } from '@/config/environment'
import { useSocket } from '@/composables/useSocket'

const props = defineProps<{
  modelValue: boolean
  playingId?: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { send } = useSocket()

const roomId = ref('')
const connected = ref(false)
const switchLimit = ref(3)
const switchUsers = ref<Record<number, string>>({})
let socket: WebSocket | null = null
let timer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.playingId,
  (newValue, oldValue) => {
    if (newValue && newValue !== oldValue) {
      switchUsers.value = {}
    }
  },
)

async function getRoomId(id: string) {
  const response = await fetch(`${baseUrl}/bili/room_init/${id}`)
  const text = await response.json()
  if (text.code == '20000') return text.data.data
  return {}
}

async function getWebSocketHost(roomid: string) {
  const response = await fetch(`${baseUrl}/bili/getDanmuInfo/${roomid}`)
  const text = await response.json()
  if (text.code == '20000') return text.data.data
  return {}
}

async function connectBiliBili() {
  let room = roomId.value
  if (room.indexOf('h5/') !== -1) room = room.replace('h5/', '')
  const numberStrArray = room.match(/\d+/)
  if (numberStrArray) room = numberStrArray[0]
  else return

  const realRoom = await getRoomId(room)
  const realRoomId = realRoom.room_id
  const realData = await getWebSocketHost(realRoomId)
  if (!realData?.host_list?.length) return

  socket = new WebSocket(`wss://${realData.host_list[0].host}/sub`)
  socket.binaryType = 'arraybuffer'
  socket.onopen = () => {
    connected.value = true
    const joinData = {
      uid: 0,
      roomid: realRoomId,
      protover: 3,
      platform: 'web',
      type: 2,
      key: realData.token,
    }
    socket!.send(getCertification(JSON.stringify(joinData)).buffer)

    timer = setInterval(() => {
      const n1 = new ArrayBuffer(16)
      const i = new DataView(n1)
      i.setUint32(0, 16)
      i.setUint16(4, 16)
      i.setUint16(6, 1)
      i.setUint32(8, 2)
      i.setUint32(12, 1)
      socket!.send(i.buffer)
    }, 30000)
  }
  socket.onmessage = (evt) => onMessage(evt)
}

function onMessage(evt: MessageEvent) {
  const data = convertToObject(evt.data as ArrayBuffer)
  if (Array.isArray(data)) {
    data.forEach((d) => onMessage({ data: d } as MessageEvent))
  } else if (data instanceof Object) {
    switch (data.op) {
      case 5:
        onMessageReply(data.body)
        break
    }
  }
}

function onMessageReply(data: any) {
  try {
    if (Array.isArray(data)) {
      data.forEach((d) => onMessageReply(d))
    } else if (data.cmd == 'DANMU_MSG') {
      const chatContent: string = data.info[1]
      if (chatContent.startsWith('点歌qq')) {
        send('/music/pick', {
          name: chatContent.slice(4).trim().replace(/\s+/, '+'),
          source: 'qq',
          sendTime: Date.now(),
        })
      } else if (chatContent.startsWith('点歌')) {
        let content = chatContent.trim()
        let quality = '320k'
        if (content.endsWith(' flac') || content.endsWith(' FLAC')) {
          quality = 'flac'
          content = content.slice(0, -5)
        }
        send('/music/pick', {
          name: content.slice(2),
          source: 'wy',
          sendTime: Date.now(),
          quality,
        })
      } else if (chatContent.startsWith('切歌') || chatContent.startsWith('投票切歌')) {
        switchUsers.value[data.info[2][0]] = data.info[2][1]
        if (Object.keys(switchUsers.value).length > switchLimit.value) {
          send('/music/skip/vote')
        }
      }
    }
  } catch (e) {
    console.error('On Message Resolve Error: ', e)
  }
}

function getCertification(json: string) {
  const bytes = str2bytes(json)
  const n1 = new ArrayBuffer(bytes.length + 16)
  const i = new DataView(n1)
  i.setUint32(0, bytes.length + 16)
  i.setUint16(4, 16)
  i.setUint16(6, 1)
  i.setUint32(8, 7)
  i.setUint32(12, 1)
  for (let r = 0; r < bytes.length; r++) {
    i.setUint8(16 + r, bytes[r])
  }
  return i
}

function str2bytes(str: string): number[] {
  const bytes: number[] = []
  let c: number
  const len = str.length
  for (let i = 0; i < len; i++) {
    c = str.charCodeAt(i)
    if (c >= 0x010000 && c <= 0x10ffff) {
      bytes.push(((c >> 18) & 0x07) | 0xf0)
      bytes.push(((c >> 12) & 0x3f) | 0x80)
      bytes.push(((c >> 6) & 0x3f) | 0x80)
      bytes.push((c & 0x3f) | 0x80)
    } else if (c >= 0x000800 && c <= 0x00ffff) {
      bytes.push(((c >> 12) & 0x0f) | 0xe0)
      bytes.push(((c >> 6) & 0x3f) | 0x80)
      bytes.push((c & 0x3f) | 0x80)
    } else if (c >= 0x000080 && c <= 0x0007ff) {
      bytes.push(((c >> 6) & 0x1f) | 0xc0)
      bytes.push((c & 0x3f) | 0x80)
    } else {
      bytes.push(c & 0xff)
    }
  }
  return bytes
}

function convertToObject(buf: ArrayBufferLike): any {
  const dataView = new DataView(buf)
  const data: any = { body: [] }

  data.packetLen = dataView.getInt32(0)
  data.headerLen = dataView.getInt16(4)
  data.ver = dataView.getInt16(6)
  data.op = dataView.getInt32(8)
  data.seq = dataView.getInt32(12)

  let u: any = null
  for (let i = 0, s = data.packetLen; i < buf.byteLength; i += s) {
    s = dataView.getInt32(i)
    const a = dataView.getInt16(i + 4)
    try {
      if (data.ver === 0) {
        const c = new TextDecoder().decode(buf.slice(i + a, i + s))
        u = c.length !== 0 ? JSON.parse(c) : null
      } else if (data.ver === 3) {
        const l = buf.slice(i + a, i + s)
        const h = decompress(new Uint8Array(l))
        u = convertToObject(h.buffer).body
      }
      if (u) data.body.push(u)
    } catch (err) {
      console.log('decode body error:', err)
    }
  }
  return data
}

function disconnectBiliBili() {
  if (timer) clearInterval(timer)
  socket?.close()
  connected.value = false
}

onBeforeUnmount(() => {
  disconnectBiliBili()
})
</script>
