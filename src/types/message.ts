/**
 * 服务端消息类型（与多房间版 utils.js 的 messageType 对齐）
 *
 * 服务端推送的消息格式为：
 *   第一行 —— 消息类型字符串（如 "MUSIC"、"CHAT"）
 *   最后一行 —— JSON 字符串（{ code, message, data }）
 */

export const MessageType = {
  NOTICE: 'NOTICE',
  ONLINE: 'ONLINE',
  CHAT: 'CHAT',
  PICK: 'PICK',
  MUSIC: 'MUSIC',
  SETTING_NAME: 'SETTING_NAME',
  AUTH: 'AUTH',
  AUTH_ROOT: 'AUTH_ROOT',
  AUTH_ADMIN: 'AUTH_ADMIN',
  SEARCH: 'SEARCH',
  VOLUMN: 'VOLUMN',
  GOODMODEL: 'GOODMODEL',
  SEARCH_HOUSE: 'SEARCH_HOUSE',
  ENTER_HOUSE: 'ENTER_HOUSE',
  ENTER_HOUSE_START: 'ENTER_HOUSE_START',
  ADD_HOUSE: 'ADD_HOUSE',
  ADD_HOUSE_START: 'ADD_HOUSE_START',
  SEARCH_SONGLIST: 'SEARCH_SONGLIST',
  SEARCH_USER: 'SEARCH_USER',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  HOUSE_USER: 'HOUSE_USER',
  EDIT_HOUSE: 'EDIT_HOUSE',
  HOUSE_INFO: 'HOUSE_INFO',
  HOUSE_DESTROYED: 'HOUSE_DESTROYED',
  DEFAULT_PLAYLIST: 'DEFAULT_PLAYLIST',
  CIRCLEMODEL: 'CIRCLEMODEL',
  LISTMODEL: 'LISTMODEL',
} as const

export type MessageType = (typeof MessageType)[keyof typeof MessageType]

/** 服务端统一响应结构 */
export interface MessageResponse<T = unknown> {
  code: string | number
  message: string
  data: T
}

/** 成功码（与原项目一致） */
export const SUCCESS_CODE = 20000
