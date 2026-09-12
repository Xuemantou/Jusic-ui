import { QuantizerCelebi, Score, hexFromArgb } from '@material/material-color-utilities'

/**
 * 从图片提取 Material You 的 seed color（动态取色）。
 *
 * 这是 Material You 的招牌能力：整套配色由一张图的主色推导而来。
 * 本项目天然契合——首页背景图本就允许用户替换。
 */

/** 降采样边长。统计主色 64×64 足够，避免遍历原图上百万像素 */
const SAMPLE_SIZE = 64

/** Celebi 量化输出的颜色数上限 */
const MAX_COLORS = 128

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 跨域图片必须声明 crossOrigin，否则 canvas 被标记为 tainted，getImageData 会抛 SecurityError
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/**
 * 提取 seed color。任何失败（跨域、图片加载失败、canvas 被污染）都返回 null，
 * 由调用方回退到默认品牌色——取色失败绝不能影响界面可用性。
 */
export async function extractSeed(src: string): Promise<string | null> {
  try {
    const img = await loadImage(src)

    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

    const pixels: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 255) continue // 跳过半透明像素，它们不反映画面主色
      pixels.push((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
    }
    if (!pixels.length) return null

    // Celebi 量化是 Google 为 Material You 实现的图像取色算法；
    // Score 再从量化结果中挑出「最适合作为主题色」的那个，而不是出现频率最高的那个
    // （高频色往往是灰白背景，直接拿来当主题色会很脏）。
    const ranked = Score.score(QuantizerCelebi.quantize(pixels, MAX_COLORS))
    return ranked.length ? hexFromArgb(ranked[0]) : null
  } catch {
    return null
  }
}
