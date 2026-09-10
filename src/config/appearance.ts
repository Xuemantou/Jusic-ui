import { computed, ref } from 'vue'
import bundledBackground from '@/assets/images/background.jpg'

/**
 * 外观配置 —— 背景资源（可替换）
 *
 * 背景优先级（从高到低）：
 *   1. 运行时自定义：localStorage['JUSIC_BG_IMAGE']（预留设置界面使用）
 *   2. 构建时环境变量：VITE_BG_IMAGE
 *   3. 内置默认：src/assets/images/background.jpg（直接替换该文件即可）
 *
 * 播放页的专辑封面模糊背景可通过环境变量控制：
 *   VITE_BG_ALBUM_BLUR=false     关闭
 *   VITE_BG_ALBUM_OPACITY=0.4    透明度
 */

const STORAGE_KEY = 'JUSIC_BG_IMAGE'

const customBackground = ref<string>(localStorage.getItem(STORAGE_KEY) || '')

/** 首页背景图地址 */
export const homeBackground = computed(
  () => customBackground.value || (import.meta.env.VITE_BG_IMAGE as string) || bundledBackground,
)

/** 运行时设置自定义背景（传空字符串恢复默认） */
export function setHomeBackground(url: string) {
  customBackground.value = url
  if (url) window.localStorage.setItem(STORAGE_KEY, url)
  else window.localStorage.removeItem(STORAGE_KEY)
}

/** 播放页是否启用「专辑封面模糊」动态背景 */
export const albumBlurEnabled = import.meta.env.VITE_BG_ALBUM_BLUR !== 'false'

/** 播放页专辑模糊背景透明度 */
export const albumBlurOpacity = Number(import.meta.env.VITE_BG_ALBUM_OPACITY || 0.35)

/** 首页背景遮罩透明度（保证前景内容可读） */
export const homeBackgroundMask = Number(import.meta.env.VITE_BG_MASK || 0.55)
