<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getWebsiteThemes,
  updateWebsiteThemeStatus
} from '@/api/websiteThemeApi'

const themes = ref([])
const loading = ref(true)
const updatingId = ref(null)
const errorMessage = ref('')
const successMessage = ref('')

const activeTheme = computed(() =>
  themes.value.find(theme => theme.is_active) || null
)

const totalThemes = computed(() => themes.value.length)

const activeCount = computed(() =>
  themes.value.filter(theme => theme.is_active).length
)

const disabledCount = computed(() =>
  totalThemes.value - activeCount.value
)

const themeIcons = {
  christmas: '🎄',
  ramadan: '🌙',
  eid: '☪️',
  'valentines-day': '💝',
  'black-friday': '🛍️',
  'new-year': '🎆'
}

function getThemeColors(theme) {
  const colors = theme.config?.colors || {}

  return [
    colors.primary,
    colors.accent,
    colors.pageBg,
    colors.surface,
    colors.text
  ].filter(color =>
    typeof color === 'string' &&
    /^#[0-9a-fA-F]{3,8}$/.test(color)
  )
}

async function loadThemes() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getWebsiteThemes()

    themes.value = Array.isArray(response.data?.data)
      ? response.data.data
      : []

    return true
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to load website themes.'

    return false
  } finally {
    loading.value = false
  }
}

async function toggleTheme(theme) {
  if (updatingId.value !== null || loading.value) return

  updatingId.value = theme.id
  errorMessage.value = ''
  successMessage.value = ''

  const enable = !theme.is_active

  try {
    await updateWebsiteThemeStatus(theme.id, enable)

    const refreshed = await loadThemes()

    if (refreshed) {
      successMessage.value = enable
        ? `${theme.name} theme enabled successfully.`
        : `${theme.name} disabled. Default appearance restored.`
    }
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to update website theme.'
  } finally {
    updatingId.value = null
  }
}

onMounted(loadThemes)
</script>

<template>
  <div class="website-themes-page">

    <header class="page-heading">
      <div>
        <span class="eyebrow">WEBSITE MANAGEMENT</span>
        <h1>Website Themes</h1>
        <p>Manage the seasonal appearance of your storefront.</p>
      </div>

      <button
        class="refresh-button"
        :disabled="loading || updatingId !== null"
        @click="loadThemes"
      >
        {{ loading ? 'Refreshing...' : 'Refresh themes' }}
      </button>
    </header>

    <div v-if="errorMessage" class="notice notice-error" role="alert">
      {{ errorMessage }}
    </div>

    <div v-if="successMessage" class="notice notice-success" role="status">
      {{ successMessage }}
    </div>

    <div class="stats-grid">
      <article class="stat-card">
        <span>Available themes</span>
        <strong>{{ totalThemes }}</strong>
      </article>

      <article class="stat-card">
        <span>Active themes</span>
        <strong>{{ activeCount }}</strong>
      </article>

      <article class="stat-card">
        <span>Disabled themes</span>
        <strong>{{ disabledCount }}</strong>
      </article>
    </div>

    <section class="current-theme">
      <div class="current-theme-icon">
        {{ activeTheme ? themeIcons[activeTheme.slug] || '🎨' : '🏪' }}
      </div>

      <div class="current-theme-info">
        <span class="eyebrow">CURRENT STOREFRONT APPEARANCE</span>

        <h2>
          {{ loading ? 'Loading...' : activeTheme?.name || 'Default South West' }}
        </h2>

        <p>
          {{ activeTheme
            ? 'A seasonal theme is currently applied to your storefront.'
            : 'The storefront uses its original appearance when no seasonal theme is enabled.'
          }}
        </p>
      </div>

      <span v-if="!loading" class="status-badge status-active">
        Active
      </span>
    </section>

    <section class="themes-section">
      <div class="section-heading">
        <h2>Available themes</h2>
        <p>Enable a theme to apply it to your storefront.</p>
      </div>

      <div v-if="loading" class="empty-state">
        Loading available themes...
      </div>

      <div v-else-if="!themes.length" class="empty-state">
        No developer-registered themes available.
      </div>

      <div v-else class="theme-grid">
        <article
          v-for="theme in themes"
          :key="theme.id"
          class="theme-card"
          :class="{ 'theme-card-active': theme.is_active }"
        >
          <div class="theme-card-header">
            <div class="theme-icon">
              {{ themeIcons[theme.slug] || '🎨' }}
            </div>

            <span
              class="status-badge"
              :class="theme.is_active
                ? 'status-active'
                : 'status-inactive'"
            >
              {{ theme.is_active ? 'Active' : 'Disabled' }}
            </span>
          </div>

          <h3>{{ theme.name }}</h3>

          <p class="theme-description">
            {{ theme.description || 'Seasonal storefront theme.' }}
          </p>

          <div class="theme-palette">
            <span
              v-for="(color, index) in getThemeColors(theme)"
              :key="index"
              class="color-swatch"
              :style="{ backgroundColor: color }"
              :title="color"
            />
          </div>

          <div class="theme-card-footer">
            <div>
              <strong>
                {{ updatingId === theme.id
                  ? 'Updating...'
                  : theme.is_active ? 'Enabled' : 'Enable theme'
                }}
              </strong>

              <small>
                {{ theme.is_active
                  ? 'Applied to storefront'
                  : 'Currently inactive'
                }}
              </small>
            </div>

            <button
              type="button"
              role="switch"
              class="theme-switch"
              :class="{ 'theme-switch-on': theme.is_active }"
              :aria-checked="theme.is_active"
              :aria-label="`${theme.is_active ? 'Disable' : 'Enable'} ${theme.name}`"
              :disabled="loading || updatingId !== null"
              @click="toggleTheme(theme)"
            >
              <span />
            </button>
          </div>
        </article>
      </div>
    </section>

    <div class="management-note">
      <span aria-hidden="true">🔒</span>
      <div>
        <strong>Developer-managed themes</strong>
        <p>
          Theme designs, colors, decorations and animations are
          managed by developers. Only one seasonal theme can be
          enabled at a time.
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.website-themes-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: var(--color-text, #1f2937);
}

.page-heading,
.section-heading {
  margin-bottom: 4px;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: var(--color-text-muted, #64748b);
}

h1, h2, h3, p {
  margin: 0;
}

h1 {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 700;
}

h2 {
  font-size: 18px;
  font-weight: 650;
}

h3 {
  font-size: 17px;
  font-weight: 650;
}

p {
  color: var(--color-text-muted, #64748b);
  font-size: 13px;
  line-height: 1.6;
}

.page-heading p,
.section-heading p {
  margin-top: 5px;
}

.refresh-button {
  border: 1px solid var(--color-border, #e2e8f0);
  background: var(--color-surface, #fff);
  color: inherit;
  border-radius: 8px;
  padding: 10px 16px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.stat-card,
.current-theme,
.theme-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
}

.stat-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-card span {
  color: var(--color-text-muted, #64748b);
  font-size: 13px;
}

.stat-card strong {
  font-size: 30px;
  font-weight: 700;
}

.current-theme {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px;
}

.current-theme-icon,
.theme-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-muted, #f1f5f9);
  border-radius: 12px;
  flex-shrink: 0;
}

.current-theme-icon {
  width: 64px;
  height: 64px;
  font-size: 32px;
}

.current-theme-info {
  flex: 1;
}

.current-theme-info h2 {
  margin: 5px 0;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.theme-card-active {
  border-color: #16a34a;
  box-shadow: 0 0 0 1px #16a34a;
}

.theme-card-header,
.theme-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.theme-icon {
  width: 50px;
  height: 50px;
  font-size: 26px;
}

.status-badge {
  border-radius: 20px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-active {
  background: #dcfce7;
  color: #166534;
}

.status-inactive {
  background: var(--color-surface-muted, #f1f5f9);
  color: var(--color-text-muted, #64748b);
}

.theme-description {
  flex: 1;
  min-height: 44px;
}

.theme-palette {
  display: flex;
  gap: 7px;
  min-height: 26px;
}

.color-swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid #00000015;
}

.theme-card-footer {
  border-top: 1px solid var(--color-border, #e2e8f0);
  padding-top: 16px;
}

.theme-card-footer strong {
  display: block;
  font-size: 13px;
}

.theme-card-footer small {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-muted, #64748b);
}

.theme-switch {
  width: 44px;
  height: 25px;
  padding: 3px;
  border: none;
  border-radius: 20px;
  background: #94a3b8;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}

.theme-switch span {
  display: block;
  width: 19px;
  height: 19px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.theme-switch-on {
  background: #16a34a;
}

.theme-switch-on span {
  transform: translateX(19px);
}

.theme-switch:focus-visible,
.refresh-button:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 3px;
}

.management-note {
  display: flex;
  gap: 12px;
  padding: 18px;
  border-radius: 10px;
  background: var(--color-surface-muted, #f1f5f9);
}

.management-note strong {
  font-size: 13px;
}

.management-note p {
  margin-top: 5px;
}

.notice,
.empty-state {
  padding: 16px;
  border-radius: 8px;
  font-size: 13px;
}

.notice-success {
  background: #dcfce7;
  color: #166534;
}

.notice-error {
  background: #fee2e2;
  color: #991b1b;
}

.empty-state {
  text-align: center;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  color: var(--color-text-muted, #64748b);
  margin-top: 18px;
}

@media (max-width: 600px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .stats-grid {
    gap: 8px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-card span {
    font-size: 11px;
  }

  .stat-card strong {
    font-size: 24px;
  }

  .current-theme {
    flex-wrap: wrap;
    padding: 16px;
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }
}
</style>
