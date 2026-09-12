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

/** 从背景图提取出的 seed；为空表示未启用或提取失败 */
const backgroundSeed = ref('')

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
 * 取色是异步的（要等图片加载），所以在结果回来前先沿用默认 seed，界面不会闪烁成空白。
 */
watch(
  [homeBackground, seedSource],
  async ([url, source]) => {
    if (source !== 'background' || !url) {
      backgroundSeed.value = ''
      return
    }
    backgroundSeed.value = (await extractSeed(url)) || ''
  },
  { immediate: true },
)
