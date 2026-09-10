/** 房间信息 */
export interface House {
  id: string
  name: string
  desc: string
  /** 在线人数 */
  population?: number
  /** 是否需要密码 */
  needPwd: boolean
  password?: string
  /** 房间永存 */
  enableStatus?: boolean
  /** 赞赏订单号 */
  retainKey?: string
  /** 房间公告 */
  announce?: {
    content?: string
  }
}

/** 创建房间表单 */
export interface HouseForm {
  name: string
  desc: string
  password: string
  needPwd: boolean
  enableStatus: boolean
  retainKey: string
}

/** 聊天消息 */
export interface ChatMessage {
  type: 'chat' | 'notice'
  content: string
  nickName?: string
  sessionId?: string
  images?: string[]
  sendTime?: number
}
