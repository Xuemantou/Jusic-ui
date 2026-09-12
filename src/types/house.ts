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
  /** 房间管理员密码：创建时设置，用于进入本房间的管理面板（/auth/admin 提权） */
  adminPwd: string
}

/** 聊天消息（后端 Chat 默认 type='chat'，系统提示为本地构造的 'notice'） */
export interface ChatMessage {
  /** 前端分配的自增 id，仅用于列表 key */
  id?: number
  type?: 'chat' | 'notice'
  content?: string
  nickName?: string
  sessionId?: string
  sendTime?: number
}
