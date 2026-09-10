/**
 * 音乐工具 —— 歌词解析
 * 参考 Akkariin Meiko
 */

/** 解析 LRC 歌词为 { 秒: 歌词 } 结构 */
export function parseLyric(text: string): Record<number, string> {
  const lyrics = text.split('\n')
  const result: Record<number, string> = {}
  const timeReg = /\[\d*:\d*((\.|:)\d*)*\]/g

  for (let i = 0; i < lyrics.length; i++) {
    const lyric = decodeURIComponent(lyrics[i])
    // 无时间戳的纯文本歌词（AI 歌词等）
    const aiMatch = text.match(timeReg)
    if (!aiMatch) {
      result[i + 1000] = lyric
      continue
    }
    const timeRegExpArr = lyric.match(timeReg)
    if (!timeRegExpArr) continue
    const clause = lyric.replace(timeReg, '')
    for (let k = 0, h = timeRegExpArr.length; k < h; k++) {
      const t = timeRegExpArr[k]
      const min = Number(String(t.match(/\[\d*/i)).slice(1))
      const sec = Number(String(t.match(/:\d*/i)).slice(1))
      const time = min * 60 + sec
      result[time] = clause
    }
  }

  return result
}
