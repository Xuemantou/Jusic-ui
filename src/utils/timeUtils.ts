/** 时间工具 */

function stringFormat(i: number): string {
  return i < 10 ? `0${Math.floor(i)}` : `${Math.floor(i)}`
}

/** 秒钟转时分秒：60 -> 00:01:00 */
export function secondsToHH_mm_ss(seconds: number): string {
  let timeStr = ''
  if (seconds < 60) {
    timeStr = `00:${stringFormat(seconds)}`
  } else if (seconds >= 60 && seconds < 3600) {
    const minuteTime = Math.floor(seconds / 60)
    const secondTime = seconds % 60
    timeStr = `${stringFormat(minuteTime)}:${stringFormat(secondTime)}`
  } else if (seconds >= 3600) {
    const _t = Math.floor(seconds % 3600)
    const hourTime = Math.floor(seconds / 3600)
    const minuteTime = Math.floor(_t / 60)
    const secondTime = Math.floor(_t % 60)
    timeStr = `${stringFormat(hourTime)}:${stringFormat(minuteTime)}:${stringFormat(secondTime)}`
  }
  return timeStr
}

/** 秒钟转时分秒厘秒：00:06.45 / 02:54.41 */
export function secondsToHH_mm_ss_cs(seconds: number): string {
  let timeStr = ''
  let centisecond = 0
  if (seconds < 60) {
    centisecond = Number(String(Math.floor(seconds * 100) / 100).replace(/\d+\./, ''))
    timeStr = `00:${stringFormat(seconds)}.${centisecond}`
  } else if (seconds >= 60 && seconds < 3600) {
    const minuteTime = Math.floor(seconds / 60)
    centisecond = Number(String(Math.floor(seconds * 100) / 100).replace(/\d+\./, ''))
    const secondTime = Math.floor(seconds % 60)
    timeStr = `${stringFormat(minuteTime)}:${stringFormat(secondTime)}.${centisecond}`
  } else if (seconds >= 3600) {
    const _t = Math.floor(seconds % 3600)
    const hourTime = Math.floor(seconds / 3600)
    const minuteTime = Math.floor(_t / 60)
    centisecond = Number(String(Math.floor(seconds * 100) / 100).replace(/\d+\./, ''))
    const secondTime = Math.floor(_t % 60)
    timeStr = `${stringFormat(hourTime)}:${stringFormat(minuteTime)}:${stringFormat(secondTime)}.${centisecond}`
  }
  return timeStr
}

/** 时间戳转 时:分:秒 */
export function secondsToYYYY_HH_mm_ss(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
}

/** 当前时间转 YYYY-MM-DD_HH:mm:ss */
export function nowToYYYY_MM_dd_HH_mm_ss(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`
}
