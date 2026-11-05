import { ref, computed } from 'vue'
import api from '@/services/api'

const activeTheme = ref(null)
const isThemeLoading = ref(false)
const themeError = ref('')

let initialized = false
let loadingPromise = null

const COLOR_VARIABLES = {
  primary: '--color-primary',
  primaryHover: '--color-primary-hover',
  primaryLight: '--color-primary-light',
  accent: '--color-accent',
  accentDeep: '--color-accent-deep',
  pageBg: '--color-page-bg',
  surface: '--color-surface',
  surfaceMuted: '--color-surface-muted',
  text: '--color-text',
  textMuted: '--color-text-muted',
  border: '--color-border',
  focus: '--color-focus',
}

function isSafeColor(value) {
  if (typeof value !== 'string') return false

  return (
    /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    /^rgba?\([\d\s.,%]+\)$/.test(value) ||
    /^hsla?\([\d\s.,%]+\)$/.test(value)
  )
}

function resetThemeStyles() {
  Object.values(COLOR_VARIABLES).forEach((variable) => {
    document.documentElement.style.removeProperty(variable)
  })

  document.documentElement.removeAttribute('data-website-theme')
}

function applyTheme(theme) {
  resetThemeStyles()

  if (!theme || typeof theme !== 'object') {
    activeTheme.value = null
    return
  }

  const config = theme.config && typeof theme.config === 'object'
    ? theme.config
    : {}

  const colors = config.colors && typeof config.colors === 'object'
    ? config.colors
    : {}

  Object.entries(COLOR_VARIABLES).forEach(([configKey, cssVariable]) => {
    const value = colors[configKey]

    if (isSafeColor(value)) {
      document.documentElement.style.setProperty(cssVariable, value)
    }
  })

  document.documentElement.setAttribute(
    'data-website-theme',
    theme.slug || ''
  )

  activeTheme.value = theme
}

async function loadActiveTheme(force = false) {
  if (loadingPromise && !force) {
    return loadingPromise
  }

  if (initialized && !force) {
    return activeTheme.value
  }

  isThemeLoading.value = true
  themeError.value = ''

  loadingPromise = (async () => {
    try {
      const response = await api.get('/store/website-theme/active')
      const theme = response?.data?.data ?? null

      applyTheme(theme)
      initialized = true

      return theme
    } catch (error) {
      console.error('Failed to load website theme:', error)

      themeError.value = 'Unable to load the website theme.'
      applyTheme(null)

      return null
    } finally {
      isThemeLoading.value = false
      loadingPromise = null
    }
  })()

  return loadingPromise
}

const themeSlug = computed(() => activeTheme.value?.slug || '')

const themeConfig = computed(() => {
  const config = activeTheme.value?.config

  return config && typeof config === 'object' ? config : {}
})

const decorations = computed(() => {
  const value = themeConfig.value.decorations

  return value && typeof value === 'object' ? value : {}
})

const effects = computed(() => {
  const value = themeConfig.value.effects

  return value && typeof value === 'object' ? value : {}
})

export function useWebsiteTheme() {
  return {
    activeTheme,
    isThemeLoading,
    themeError,
    themeSlug,
    themeConfig,
    decorations,
    effects,
    loadActiveTheme,
  }
}
