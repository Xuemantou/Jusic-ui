import { computed, ref, watch } from 'vue'
import { DEFAULT_SEED } from './md3'
import { extractSeed } from './extractSeed'
import { homeBackground } from '@/config/appearance'

/**
 * 主题状态（明暗模式 + seed 来源）。
 *
 * 采用与 config/appearance.ts 一致的模块级 ref 模式：
 * 主题与背景图强耦合（seed 可以从背景图提取），放在同一套状态风格里最自然，
 * 也避免为一个全局单例再引入一个 Pinia store。
 */

const MODE_KEY = 'JUSIC_THEME_MODE'
const SEED_SOURCE_KEY = 'JUSIC_THEME_SEED_SOURCE'
const BG_SEED_KEY = 'JUSIC_THEME_BG_SEED'

export type ThemeMode = 'dark' | 'light' | 'system'
export type SeedSource = 'default' | 'background'

const MODES: readonly ThemeMode[] = ['dark', 'light', 'system']
const SEED_SOURCES: readonly SeedSource[] = ['default', 'background']

/** 读取持久化值，非法或缺失则回退默认 */
function restore<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = localStorage.getItem(key)
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

export const themeMode = ref<ThemeMode>(restore(MODE_KEY, MODES, 'dark'))
export const seedSource = ref<SeedSource>(restore(SEED_SOURCE_KEY, SEED_SOURCES, 'default'))

/**
 * 从背景图提取出的 seed；为空表示未启用或尚未提取成功。
 *
 * 初始值取自上次提取结果的缓存。取色必须等图片加载完成（异步），
 * 若从空值起步，选了「跟随背景图」的用户每次刷新都会先看到品牌 teal、
 * 几百毫秒后才跳成提取色。用缓存当首帧值，可让这次跳变只在首次启用时发生。
 */
const backgroundSeed = ref(localStorage.getItem(BG_SEED_KEY) || '')

/** 实际生效的 seed：跟随背景图且提取成功时用它，否则用品牌默认色 */
export const activeSeed = computed(() =>
  seedSource.value === 'background' && backgroundSeed.value ? backgroundSeed.value : DEFAULT_SEED,
)

/** 系统明暗偏好 */
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', e => (systemDark.value = e.matches))

/** 解析后的实际明暗（system 模式跟随系统） */
export const isDark = computed(() =>
  themeMode.value === 'system' ? systemDark.value : themeMode.value === 'dark',
)

export function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode
  localStorage.setItem(MODE_KEY, mode)
}

export function setSeedSource(source: SeedSource) {
  seedSource.value = source
  localStorage.setItem(SEED_SOURCE_KEY, source)
}

/**
 * 背景图或 seed 来源变化时重新取色。
 *
 * 取色是异步的（需等图片加载），期间沿用已有值（缓存值或品牌默认色），
 * 因此不会出现空白，但首次提取完成时会有一次颜色过渡。
 *
 * 取色失败（跨域 canvas 被污染、图片加载失败）时保留原值而非清空：
 * 沿用上一个有效配色，比突然退回品牌色更不显眼。
 */
watch(
  [homeBackground, seedSource],
  async ([url, source]) => {
    if (source !== 'background' || !url) {
      backgroundSeed.value = ''
      return
    }
    const seed = await extractSeed(url)
    if (seed) {
      backgroundSeed.value = seed
      localStorage.setItem(BG_SEED_KEY, seed)
    }
  },
  { immediate: true },
)
