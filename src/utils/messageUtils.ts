import { MessageType, type MessageResponse } from '@/types/message'

/**
 * 解析来自服务端的消息。
 * 服务端消息格式：第一行是类型，最后一行是 JSON。
 */

export function parseMessageType(source: string): string {
  if (!source || source.length === 0) return ''
  const strings = source.split('\n')
  return strings.length > 0 ? strings[0] : ''
}

export function isKnownMessageType(source: string): boolean {
  if (!source || source.length === 0) return false
  const strings = source.split('\n')
  const type = strings.length > 0 ? strings[0] : ''
  if (type === '') return false
  return (Object.values(MessageType) as string[]).includes(type)
}

export function parseMessageContent<T = unknown>(source: string): MessageResponse<T> | null {
  if (!source || source.length === 0) return null
  const strings = source.split('\n')
  if (strings.length === 0) return null
  try {
    // 服务端帧按 STOMP 规范以 NULL 结尾，解析前先剥掉
    return JSON.parse(strings[strings.length - 1].replace(/\0+$/, '')) as MessageResponse<T>
  } catch {
    return null
  }
}
