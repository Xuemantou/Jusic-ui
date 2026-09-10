/** 专辑信息 */
export interface Album {
  name: string
}

/** 音乐（播放/点歌列表项） */
export interface Music {
  id: string
  name: string
  artist: string
  album: Album
  pictureUrl: string
  url: string
  lyric?: string
  duration: number
  source?: string
  quality?: string
  /** 点歌人昵称 */
  nickName?: string
  /** 点歌人 sessionId */
  sessionId?: string
  /** 点赞数 */
  good?: number
  /** 服务端推送时间戳，用于进度校准 */
  pushTime?: number
  /** 资源权限（搜索结果显示是否可点播） */
  privilege?: {
    st: number
    fl: number
  }
  /** 收藏时间 */
  pickTime?: number
}

/** 歌单搜索项 */
export interface SongList {
  id: string
  name: string
  pictureUrl?: string
  desc?: string
  creator?: string
  creatorUid?: string
  playCount?: number
  songCount?: number
}

/** 用户搜索项 */
export interface UserInfo {
  userId: string
  nickname: string
  avatarUrl?: string
  signature?: string
  description?: string
  gender?: number
}

/** 搜索分页结果 */
export interface PageResult<T> {
  totalSize: number
  data: T[]
}
