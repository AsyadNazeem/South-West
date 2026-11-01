<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  getWebsiteThemes,
  createWebsiteTheme,
  updateWebsiteTheme,
  updateWebsiteThemeStatus,
  deleteWebsiteTheme
} from '../../api/websiteThemeApi'

const themes = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const editingId = ref(null)
const showForm = ref(false)

const defaultConfig = () => ({
  colors: {
    primary: '#a51f2b',
    primaryHover: '#841722',
    primaryLight: '#c43b45',
    accent: '#d5b56a',
    accentDeep: '#b38b39',
    pageBg: '#fffdfb',
    surface: '#ffffff',
    surfaceMuted: '#f8eeee',
    text: '#252020',
    textMuted: '#756565',
    border: '#eadcda',
    focus: '#a51f2b'
  },
  effects: {
    snowfall: false
  },
  decorations: {
    trees: false,
    bells: false,
    lanterns: false,
    crescent: false
  }
})

const emptyForm = () => ({
  name: '',
  slug: '',
  description: '',
  starts_at: '',
  ends_at: '',
  is_active: false,
  config: defaultConfig()
})

const form = reactive(emptyForm())

const colorFields = [
  { key: 'primary', label: 'Primary colour' },
  { key: 'primaryHover', label: 'Primary hover' },
  { key: 'primaryLight', label: 'Primary light' },
  { key: 'accent', label: 'Accent colour' },
  { key: 'accentDeep', label: 'Deep accent' },
  { key: 'pageBg', label: 'Page background' },
  { key: 'surface', label: 'Surface' },
  { key: 'surfaceMuted', label: 'Muted surface' },
  { key: 'text', label: 'Text' },
  { key: 'textMuted', label: 'Muted text' },
  { key: 'border', label: 'Border' },
  { key: 'focus', label: 'Focus colour' }
]

const presets = {
  christmas: {
    name: 'Christmas',
    slug: 'christmas',
    description: 'A festive Christmas theme with red accents and seasonal decorations.',
    colors: {
      primary: '#a51f2b',
      primaryHover: '#841722',
      primaryLight: '#c43b45',
      accent: '#d5b56a',
      accentDeep: '#b38b39',
      pageBg: '#fffdfb',
      surface: '#ffffff',
      surfaceMuted: '#f8eeee',
      text: '#252020',
      textMuted: '#756565',
      border: '#eadcda',
      focus: '#a51f2b'
    },
    effects: { snowfall: true },
    decorations: { trees: true, bells: true, lanterns: false, crescent: false }
  },
  ramadan: {
    name: 'Ramadan',
    slug: 'ramadan',
    description: 'An elegant emerald and gold Ramadan theme.',
    colors: {
      primary: '#075b46',
      primaryHover: '#064735',
      primaryLight: '#168568',
      accent: '#d7b45c',
      accentDeep: '#a98535',
      pageBg: '#fbfcf7',
      surface: '#ffffff',
      surfaceMuted: '#edf5ef',
      text: '#172b23',
      textMuted: '#68796f',
      border: '#dce8dd',
      focus: '#075b46'
    },
    effects: { snowfall: false },
    decorations: { trees: false, bells: false, lanterns: true, crescent: true }
  },
  eid: {
    name: 'Eid',
    slug: 'eid',
    description: 'A celebratory emerald and gold theme for Eid.',
    colors: {
      primary: '#08765a',
      primaryHover: '#065b45',
      primaryLight: '#24a17b',
      accent: '#e2bd63',
      accentDeep: '#bd9138',
      pageBg: '#fcfdf9',
      surface: '#ffffff',
      surfaceMuted: '#eff7f1',
      text: '#1b3028',
      textMuted: '#718078',
      border: '#dce9df',
      focus: '#08765a'
    },
    effects: { snowfall: false },
    decorations: { trees: false, bells: false, lanterns: true, crescent: true }
  },
  valentines: {
    name: "Valentine's Day",
    slug: 'valentines-day',
    description: "A romantic Valentine's Day theme with soft pink and red accents.",
    colors: {
      primary: '#c02e5c',
      primaryHover: '#9e2049',
      primaryLight: '#e15a83',
      accent: '#e9a5b9',
      accentDeep: '#bd6684',
      pageBg: '#fffafb',
      surface: '#ffffff',
      surfaceMuted: '#fff0f4',
      text: '#34212a',
      textMuted: '#856c77',
      border: '#f0dce4',
      focus: '#c02e5c'
    },
    effects: { snowfall: false },
    decorations: { trees: false, bells: false, lanterns: false, crescent: false }
  },
  blackfriday: {
    name: 'Black Friday',
    slug: 'black-friday',
    description: 'A bold dark theme for Black Friday promotions.',
    colors: {
      primary: '#171717',
      primaryHover: '#000000',
      primaryLight: '#3a3a3a',
      accent: '#f5c542',
      accentDeep: '#d49d12',
      pageBg: '#f7f7f7',
      surface: '#ffffff',
      surfaceMuted: '#eeeeee',
      text: '#171717',
      textMuted: '#686868',
      border: '#dedede',
      focus: '#d49d12'
    },
    effects: { snowfall: false },
    decorations: { trees: false, bells: false, lanterns: false, crescent: false }
  },
  newyear: {
    name: 'New Year',
    slug: 'new-year',
    description: 'A festive New Year theme with midnight tones and gold accents.',
    colors: {
      primary: '#26345f',
      primaryHover: '#192344',
      primaryLight: '#435a96',
      accent: '#e3bd62',
      accentDeep: '#b58b35',
      pageBg: '#fafaff',
      surface: '#ffffff',
      surfaceMuted: '#f0f1fa',
      text: '#20243a',
      textMuted: '#72758b',
      border: '#dfe1ee',
      focus: '#26345f'
    },
    effects: { snowfall: false },
    decorations: { trees: false, bells: false, lanterns: false, crescent: false }
  }
}

const previewStyle = computed(() => {
  const c = form.config.colors
  return {
    '--preview-primary': c.primary,
    '--preview-primary-hover': c.primaryHover,
    '--preview-accent': c.accent,
    '--preview-bg': c.pageBg,
    '--preview-surface': c.surface,
    '--preview-muted': c.surfaceMuted,
    '--preview-text': c.text,
    '--preview-text-muted': c.textMuted,
    '--preview-border': c.border
  }
})

const activeCount = computed(() =>
  themes.value.filter(theme => getThemeStatus(theme) === 'Active').length
)

function resetForm() {
  Object.assign(form, emptyForm())
  editingId.value = null
}

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toApiDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getThemeStatus(theme) {
  if (!theme.is_active) return 'Disabled'

  const now = new Date()
  const start = theme.starts_at ? new Date(theme.starts_at) : null
  const end = theme.ends_at ? new Date(theme.ends_at) : null

  if (start && start > now) return 'Scheduled'
  if (end && end < now) return 'Expired'
  return 'Active'
}

function statusClass(theme) {
  return getThemeStatus(theme).toLowerCase()
}

function formatDate(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return date.toLocaleString()
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback
}

async function loadThemes() {
  loading.value = true
  error.value = ''

  try {
    const response = await getWebsiteThemes()
    const data = response.data?.data
    themes.value = Array.isArray(data) ? data : []
  } catch (err) {
    error.value = getErrorMessage(err, 'Unable to load website themes.')
  } finally {
    loading.value = false
  }
}

function openCreateForm() {
  resetForm()
  showForm.value = true
  error.value = ''
  success.value = ''
}

function editTheme(theme) {
  resetForm()

  editingId.value = theme.id
  form.name = theme.name || ''
  form.slug = theme.slug || ''
  form.description = theme.description || ''
  form.starts_at = toLocalDateTime(theme.starts_at)
  form.ends_at = toLocalDateTime(theme.ends_at)
  form.is_active = Boolean(theme.is_active)

  const defaults = defaultConfig()
  const config = theme.config || {}

  form.config = {
    colors: { ...defaults.colors, ...(config.colors || {}) },
    effects: { ...defaults.effects, ...(config.effects || {}) },
    decorations: { ...defaults.decorations, ...(config.decorations || {}) }
  }

  showForm.value = true
  error.value = ''
  success.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function applyPreset(key) {
  const preset = presets[key]
  if (!preset) return

  form.name = preset.name
  form.slug = preset.slug
  form.description = preset.description
  form.config = {
    colors: { ...preset.colors },
    effects: { ...preset.effects },
    decorations: { ...preset.decorations }
  }
}

function generateSlug() {
  if (editingId.value) return

  form.slug = form.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function saveTheme() {
  error.value = ''
  success.value = ''

  if (!form.name.trim()) {
    error.value = 'Please enter a theme name.'
    return
  }

  if (!form.slug.trim()) {
    error.value = 'Please enter a theme slug.'
    return
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    error.value = 'Slug must use lowercase letters, numbers and single hyphens.'
    return
  }

  if (form.starts_at && form.ends_at) {
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      error.value = 'The end date must be later than the start date.'
      return
    }
  }

  const payload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    starts_at: toApiDateTime(form.starts_at),
    ends_at: toApiDateTime(form.ends_at),
    is_active: form.is_active,
    config: JSON.parse(JSON.stringify(form.config))
  }

  saving.value = true

  try {
    if (editingId.value) {
      await updateWebsiteTheme(editingId.value, payload)
      success.value = 'Website theme updated successfully.'
    } else {
      await createWebsiteTheme(payload)
      success.value = 'Website theme created successfully.'
    }

    showForm.value = false
    resetForm()
    await loadThemes()
  } catch (err) {
    error.value = getErrorMessage(err, 'Unable to save website theme.')
  } finally {
    saving.value = false
  }
}

async function toggleTheme(theme) {
  error.value = ''
  success.value = ''

  try {
    await updateWebsiteThemeStatus(theme.id, !theme.is_active)
    success.value = theme.is_active
      ? 'Website theme disabled.'
      : 'Website theme enabled.'
    await loadThemes()
  } catch (err) {
    error.value = getErrorMessage(err, 'Unable to update theme status.')
  }
}

async function removeTheme(theme) {
  const confirmed = window.confirm(
    `Delete "${theme.name}"? This action cannot be undone.`
  )

  if (!confirmed) return

  error.value = ''
  success.value = ''

  try {
    await deleteWebsiteTheme(theme.id)
    success.value = 'Website theme deleted successfully.'
    await loadThemes()
  } catch (err) {
    error.value = getErrorMessage(err, 'Unable to delete website theme.')
  }
}

onMounted(loadThemes)
</script>

<template>
  <div class="themes-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">MARKETING</p>
        <h1>Website Themes</h1>
        <p class="page-description">
          Manage seasonal appearances across the customer storefront.
          Themes are independent of campaign frames and discount campaigns.
        </p>
      </div>

      <button class="primary-button" @click="openCreateForm">
        <span>+</span> Create Theme
      </button>
    </header>

    <div v-if="error" class="notice error-notice">
      {{ error }}
      <button class="notice-close" @click="error = ''">×</button>
    </div>

    <div v-if="success" class="notice success-notice">
      {{ success }}
      <button class="notice-close" @click="success = ''">×</button>
    </div>

    <section class="stats-row">
      <div class="stat-card">
        <span class="stat-label">Total themes</span>
        <strong>{{ themes.length }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Currently active</span>
        <strong>{{ activeCount }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Scheduled</span>
        <strong>{{ themes.filter(t => getThemeStatus(t) === 'Scheduled').length }}</strong>
      </div>
    </section>

    <section v-if="showForm" class="editor-panel">
      <div class="section-heading">
        <div>
          <h2>{{ editingId ? 'Edit Website Theme' : 'Create Website Theme' }}</h2>
          <p>Configure the appearance and schedule for this theme.</p>
        </div>
        <button class="icon-button" aria-label="Close form" @click="showForm = false; resetForm()">
          ×
        </button>
      </div>

      <div class="preset-section">
        <label class="field-label">Start with a preset</label>
        <div class="preset-buttons">
          <button
            v-for="(preset, key) in presets"
            :key="key"
            type="button"
            class="preset-button"
            @click="applyPreset(key)"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>

      <form @submit.prevent="saveTheme">
        <div class="form-grid">
          <div class="form-field">
            <label for="theme-name">Theme name *</label>
            <input
              id="theme-name"
              v-model="form.name"
              type="text"
              maxlength="120"
              placeholder="e.g. Christmas"
              required
              @input="generateSlug"
            />
          </div>

          <div class="form-field">
            <label for="theme-slug">Slug *</label>
            <input
              id="theme-slug"
              v-model="form.slug"
              type="text"
              maxlength="120"
              placeholder="e.g. christmas"
              required
            />
            <small>Lowercase letters, numbers and hyphens only.</small>
          </div>

          <div class="form-field full-width">
            <label for="theme-description">Description</label>
            <textarea
              id="theme-description"
              v-model="form.description"
              rows="2"
              maxlength="500"
              placeholder="Describe this seasonal theme..."
            />
          </div>
        </div>

        <div class="form-section">
          <h3>Schedule</h3>
          <p class="section-help">
            Leave dates empty if the theme should not have a date restriction.
          </p>

          <div class="form-grid">
            <div class="form-field">
              <label for="theme-start">Start date and time</label>
              <input id="theme-start" v-model="form.starts_at" type="datetime-local" />
            </div>
            <div class="form-field">
              <label for="theme-end">End date and time</label>
              <input id="theme-end" v-model="form.ends_at" type="datetime-local" />
            </div>
          </div>

          <label class="toggle-line">
            <input v-model="form.is_active" type="checkbox" />
            <span>
              <strong>Enable this theme</strong>
              <small>
                The theme will be applied on the customer storefront when its schedule is valid.
              </small>
            </span>
          </label>
        </div>

        <div class="form-section">
          <h3>Theme colours</h3>
          <p class="section-help">Choose the colours used across the customer storefront.</p>

          <div class="color-grid">
            <div v-for="field in colorFields" :key="field.key" class="color-field">
              <label :for="`color-${field.key}`">{{ field.label }}</label>
              <div class="color-input-wrap">
                <input
                  :id="`color-${field.key}`"
                  v-model="form.config.colors[field.key]"
                  type="color"
                />
                <code>{{ form.config.colors[field.key] }}</code>
              </div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3>Seasonal effects</h3>
          <p class="section-help">Enable optional effects on the customer storefront.</p>

          <div class="option-grid">
            <label class="option-card">
              <input v-model="form.config.effects.snowfall" type="checkbox" />
              <span>
                <strong>Snowfall</strong>
                <small>Animated falling snow.</small>
              </span>
            </label>
          </div>
        </div>

        <div class="form-section">
          <h3>Decorations</h3>
          <p class="section-help">Choose which seasonal decorations should appear.</p>

          <div class="option-grid">
            <label class="option-card">
              <input v-model="form.config.decorations.trees" type="checkbox" />
              <span><strong>Christmas trees</strong><small>Festive tree decorations.</small></span>
            </label>
            <label class="option-card">
              <input v-model="form.config.decorations.bells" type="checkbox" />
              <span><strong>Bells</strong><small>Christmas bell decorations.</small></span>
            </label>
            <label class="option-card">
              <input v-model="form.config.decorations.lanterns" type="checkbox" />
              <span><strong>Lanterns</strong><small>Ramadan or Eid lanterns.</small></span>
            </label>
            <label class="option-card">
              <input v-model="form.config.decorations.crescent" type="checkbox" />
              <span><strong>Crescent moon</strong><small>Ramadan or Eid decoration.</small></span>
            </label>
          </div>
        </div>

        <div class="form-section preview-section">
          <div>
            <h3>Live storefront preview</h3>
            <p class="section-help">A simplified preview using your current settings.</p>
          </div>

          <div class="store-preview" :style="previewStyle">
            <div class="preview-topbar">
              <span>South West</span>
              <span class="preview-nav">Home&nbsp;&nbsp; Products&nbsp;&nbsp; Contact</span>
            </div>

            <div class="preview-content">
              <div class="preview-decoration">
                <span v-if="form.config.decorations.trees">🎄</span>
                <span v-if="form.config.decorations.bells">🔔</span>
                <span v-if="form.config.decorations.lanterns">🏮</span>
                <span v-if="form.config.decorations.crescent">☾</span>
                <span v-if="form.config.effects.snowfall">❄️ ❄️ ❄️</span>
              </div>

              <span class="preview-tag">{{ form.name || 'Seasonal theme' }}</span>
              <h4>Discover something special</h4>
              <p>Your seasonal storefront appearance preview.</p>
              <button type="button" class="preview-cta">Shop now</button>

              <div class="preview-product-row">
                <div class="preview-product">
                  <div class="preview-product-image">Product</div>
                  <strong>Featured product</strong>
                  <span>Rs. 12,500</span>
                </div>
                <div class="preview-product">
                  <div class="preview-product-image">Product</div>
                  <strong>Popular accessory</strong>
                  <span>Rs. 4,500</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary-button" @click="showForm = false; resetForm()">
            Cancel
          </button>
          <button type="submit" class="primary-button" :disabled="saving">
            {{ saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Theme' }}
          </button>
        </div>
      </form>
    </section>

    <section class="themes-section">
      <div class="section-heading">
        <div>
          <h2>Saved Themes</h2>
          <p>Manage your seasonal storefront themes.</p>
        </div>
        <button class="secondary-button refresh-button" :disabled="loading" @click="loadThemes">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>

      <div v-if="loading && !themes.length" class="empty-state">
        Loading website themes...
      </div>

      <div v-else-if="!themes.length" class="empty-state">
        <div class="empty-icon">✦</div>
        <h3>No website themes yet</h3>
        <p>Create a seasonal theme or start with one of the available presets.</p>
        <button class="primary-button" @click="openCreateForm">Create your first theme</button>
      </div>

      <div v-else class="theme-list">
        <article v-for="theme in themes" :key="theme.id" class="theme-card">
          <div class="theme-card-main">
            <div
              class="theme-color-preview"
              :style="{ background: theme.config?.colors?.primary || '#a51f2b' }"
            >
              <span>{{ theme.name?.charAt(0)?.toUpperCase() || 'T' }}</span>
            </div>

            <div class="theme-info">
              <div class="theme-title-row">
                <h3>{{ theme.name }}</h3>
                <span class="status-pill" :class="statusClass(theme)">
                  {{ getThemeStatus(theme) }}
                </span>
              </div>
              <p>{{ theme.description || 'No description provided.' }}</p>
              <div class="theme-meta">
                <span>Slug: <code>{{ theme.slug }}</code></span>
                <span>Starts: {{ formatDate(theme.starts_at) }}</span>
                <span>Ends: {{ formatDate(theme.ends_at) }}</span>
              </div>
            </div>
          </div>

          <div class="theme-actions">
            <button class="secondary-button small-button" @click="editTheme(theme)">
              Edit
            </button>
            <button
              class="secondary-button small-button"
              :class="theme.is_active ? 'disable-button' : 'enable-button'"
              @click="toggleTheme(theme)"
            >
              {{ theme.is_active ? 'Disable' : 'Enable' }}
            </button>
            <button class="danger-button small-button" @click="removeTheme(theme)">
              Delete
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.themes-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: var(--color-text, #252525);
}

.page-header,
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 7px;
  color: var(--color-primary, #a51f2b);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.4px;
}

.page-header h1 {
  margin: 0;
  font-size: 27px;
  font-weight: 750;
}

.page-description,
.section-heading p,
.section-help {
  color: var(--color-text-muted, #777);
  font-size: 13px;
  line-height: 1.6;
}

.page-description {
  max-width: 650px;
  margin: 8px 0 0;
}

.primary-button,
.secondary-button,
.danger-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 39px;
  padding: 9px 15px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}

.primary-button {
  color: #fff;
  background: var(--color-primary, #a51f2b);
}

.primary-button:hover {
  background: var(--color-primary-hover, #841722);
}

.secondary-button {
  color: var(--color-text, #333);
  background: var(--color-surface, #fff);
  border-color: var(--color-border, #ddd);
}

.secondary-button:hover {
  background: var(--color-surface-muted, #f7f7f7);
}

.danger-button {
  color: #b42318;
  background: #fff;
  border-color: #f0c9c6;
}

.danger-button:hover {
  background: #fff3f2;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.notice {
  position: relative;
  margin-bottom: 16px;
  padding: 12px 40px 12px 14px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 13px;
}

.error-notice {
  color: #a12620;
  background: #fff4f2;
  border-color: #f0cbc6;
}

.success-notice {
  color: #176b42;
  background: #effaf3;
  border-color: #c9e9d4;
}

.notice-close {
  position: absolute;
  top: 5px;
  right: 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 21px;
  cursor: pointer;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 25px;
}

.stat-card,
.editor-panel,
.theme-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 12px;
}

.stat-card {
  padding: 17px 19px;
}

.stat-label {
  display: block;
  margin-bottom: 8px;
  color: var(--color-text-muted, #777);
  font-size: 12px;
}

.stat-card strong {
  font-size: 24px;
  font-weight: 750;
}

.editor-panel {
  margin-bottom: 30px;
  padding: 22px;
}

.section-heading {
  align-items: center;
  margin-bottom: 20px;
}

.section-heading h2,
.themes-section > .section-heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 720;
}

.section-heading p {
  margin: 5px 0 0;
}

.icon-button {
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 8px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #333);
  font-size: 23px;
  cursor: pointer;
}

.preset-section {
  margin-bottom: 22px;
  padding: 15px;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 9px;
  background: var(--color-surface-muted, #fafafa);
}

.field-label,
.form-field label {
  display: block;
  margin-bottom: 7px;
  font-size: 12px;
  font-weight: 650;
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.preset-button {
  padding: 7px 11px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 7px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #333);
  font-size: 12px;
  cursor: pointer;
}

.preset-button:hover {
  border-color: var(--color-primary, #a51f2b);
  color: var(--color-primary, #a51f2b);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-field {
  min-width: 0;
}

.form-field input,
.form-field textarea {
  width: 100%;
  min-height: 40px;
  padding: 10px 11px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 7px;
  outline: none;
  background: var(--color-surface, #fff);
  color: var(--color-text, #333);
  font: inherit;
  font-size: 13px;
}

.form-field textarea {
  resize: vertical;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: var(--color-primary, #a51f2b);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #a51f2b) 13%, transparent);
}

.form-field small,
.toggle-line small,
.option-card small {
  display: block;
  margin-top: 5px;
  color: var(--color-text-muted, #777);
  font-size: 11px;
  line-height: 1.5;
}

.full-width {
  grid-column: 1 / -1;
}

.form-section {
  margin-top: 25px;
  padding-top: 22px;
  border-top: 1px solid var(--color-border, #e5e5e5);
}

.form-section h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.section-help {
  margin: 5px 0 15px;
}

.toggle-line {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 17px;
  cursor: pointer;
}

.toggle-line input,
.option-card input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: var(--color-primary, #a51f2b);
}

.toggle-line strong,
.option-card strong {
  display: block;
  font-size: 12px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 15px;
}

.color-field label {
  display: block;
  margin-bottom: 7px;
  color: var(--color-text-muted, #777);
  font-size: 11px;
}

.color-input-wrap {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 40px;
  padding: 5px 8px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 7px;
}

.color-input-wrap input {
  width: 28px;
  height: 27px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.color-input-wrap code,
.theme-meta code {
  color: var(--color-text-muted, #777);
  font-size: 11px;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.option-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
  cursor: pointer;
}

.option-card:hover {
  background: var(--color-surface-muted, #fafafa);
}

.preview-section {
  display: grid;
  grid-template-columns: 1fr;
}

.store-preview {
  overflow: hidden;
  border: 1px solid var(--preview-border);
  border-radius: 11px;
  background: var(--preview-bg);
  color: var(--preview-text);
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px;
  background: var(--preview-surface);
  border-bottom: 1px solid var(--preview-border);
  color: var(--preview-primary);
  font-size: 13px;
  font-weight: 750;
}

.preview-nav {
  color: var(--preview-text-muted);
  font-size: 10px;
  font-weight: 500;
}

.preview-content {
  padding: 25px 18px;
  text-align: center;
}

.preview-decoration {
  display: flex;
  justify-content: center;
  gap: 12px;
  min-height: 26px;
  margin-bottom: 12px;
  font-size: 20px;
}

.preview-tag {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 20px;
  background: var(--preview-muted);
  color: var(--preview-primary);
  font-size: 10px;
  font-weight: 700;
}

.preview-content h4 {
  margin: 12px 0 5px;
  font-size: 21px;
}

.preview-content > p {
  margin: 0 0 15px;
  color: var(--preview-text-muted);
  font-size: 11px;
}

.preview-cta {
  padding: 9px 18px;
  border: 0;
  border-radius: 6px;
  background: var(--preview-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.preview-product-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 180px));
  justify-content: center;
  gap: 12px;
  margin-top: 22px;
  text-align: left;
}

.preview-product {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px;
  border: 1px solid var(--preview-border);
  border-radius: 8px;
  background: var(--preview-surface);
  font-size: 10px;
}

.preview-product-image {
  display: grid;
  min-height: 65px;
  place-items: center;
  border-radius: 5px;
  background: var(--preview-muted);
  color: var(--preview-text-muted);
}

.preview-product span {
  color: var(--preview-primary);
  font-weight: 700;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 24px;
}

.themes-section {
  margin-top: 10px;
}

.refresh-button {
  min-height: 34px;
}

.theme-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theme-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px;
}

.theme-card-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.theme-color-preview {
  display: grid;
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 10px;
  color: #fff;
  font-size: 21px;
  font-weight: 750;
}

.theme-info {
  min-width: 0;
}

.theme-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}

.theme-title-row h3 {
  margin: 0;
  font-size: 14px;
}

.theme-info > p {
  margin: 5px 0;
  color: var(--color-text-muted, #777);
  font-size: 12px;
}

.status-pill {
  padding: 4px 8px;
  border-radius: 20px;
  background: #f0f0f0;
  color: #555;
  font-size: 10px;
  font-weight: 700;
}

.status-pill.active {
  background: #e7f6ed;
  color: #187342;
}

.status-pill.scheduled {
  background: #fff4df;
  color: #98620c;
}

.status-pill.expired,
.status-pill.disabled {
  background: #f0f0f0;
  color: #686868;
}

.theme-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 14px;
  color: var(--color-text-muted, #888);
  font-size: 10px;
}

.theme-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.small-button {
  min-height: 32px;
  padding: 6px 10px;
  font-size: 11px;
}

.enable-button {
  color: #187342;
  border-color: #c8e6d3;
}

.disable-button {
  color: #98620c;
  border-color: #f0dfb8;
}

.empty-state {
  padding: 45px 20px;
  border: 1px dashed var(--color-border, #ddd);
  border-radius: 12px;
  color: var(--color-text-muted, #777);
  text-align: center;
  font-size: 13px;
}

.empty-icon {
  margin-bottom: 10px;
  color: var(--color-primary, #a51f2b);
  font-size: 30px;
}

.empty-state h3 {
  margin: 0 0 7px;
  color: var(--color-text, #333);
  font-size: 16px;
}

.empty-state p {
  margin: 0 0 17px;
}

@media (max-width: 800px) {
  .themes-page {
    padding: 17px;
  }

  .color-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .theme-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .theme-actions {
    justify-content: flex-start;
    padding-left: 62px;
  }
}

@media (max-width: 560px) {
  .page-header {
    flex-direction: column;
  }

  .stats-row {
    gap: 8px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-card strong {
    font-size: 20px;
  }

  .form-grid,
  .option-grid {
    grid-template-columns: 1fr;
  }

  .color-grid {
    grid-template-columns: 1fr 1fr;
  }

  .theme-meta {
    flex-direction: column;
    gap: 4px;
  }

  .theme-actions {
    padding-left: 0;
  }

  .preview-nav {
    display: none;
  }

  .editor-panel {
    padding: 15px;
  }
}
</style>
