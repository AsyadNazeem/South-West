<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Save,
  X,
} from 'lucide-vue-next'
import api from '@/api/axios'
import { hasPermission } from '@/auth/authorization'
import {
  getHomepageSections,
  updateHomepageSections,
} from '@/api/homepageSectionApi'

const sections = ref([])
const originalSections = ref([])
const categoryRows = ref([])
const categoryRowsError = ref(false)

async function loadCategoryRows() {
  try {
    const response = await api.get('/store/categories')
    const payload = response.data
    const roots = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : (payload?.categories ?? [])

    categoryRows.value = roots
      .filter(category => category.parent_id == null)
      .slice(0, 8)
  } catch (err) {
    console.error('Unable to load homepage category names:', err)
    categoryRowsError.value = true
  }
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const canUpdate = computed(() =>
  hasPermission('homepage_sections.update')
)

const activeCount = computed(() =>
  sections.value.filter(section => section.is_active).length
)

const hasChanges = computed(() =>
  JSON.stringify(sections.value) !==
  JSON.stringify(originalSections.value)
)

const descriptions = {
  hero_banner: 'Main promotional banner carousel.',
  shopping_benefits: 'Delivery, payment, tracking, and warranty benefits.',
  shop_categories: 'Shop by Category section.',
  shop_brands: 'Shop by Brand section.',
  discount_products: 'Discounted products displayed on the homepage.',
  top_rated_products: 'Highest-rated products based on customer reviews.',
  promo_banner_1: 'First promotional banner.',
  category_product_rows: 'Product rows grouped by category.',
  promo_banner_2: 'Second promotional banner.',
  just_for_you: 'Recommended products on the homepage.',
}

function isAdjacentToCategoryRows(index) {
  const current = sections.value[index]
  if (!current || current.section_key === 'category_product_rows') return false

  return (
    sections.value[index - 1]?.section_key === 'category_product_rows' ||
    sections.value[index + 1]?.section_key === 'category_product_rows'
  )
}

function updateRowPosition(section, value) {
  const row = Number(value)

  section.settings = value !== '' && Number.isInteger(row) && row >= 1 && row <= 8
    ? { after_category_row: row }
    : {}

  success.value = ''
}

function normalizeSections(data) {
  return [...data]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(section => ({
      section_key: section.section_key,
      title: section.title,
      is_active: Boolean(section.is_active),
      sort_order: section.sort_order,
      settings: section.settings || {},
    }))
}

function snapshot() {
  return sections.value.map(section => ({
    ...section,
    settings: { ...section.settings },
  }))
}

async function loadSections() {
  if (saving.value) return

  if (
    hasChanges.value &&
    !window.confirm('Discard unsaved changes and reload?')
  ) {
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await getHomepageSections()
    sections.value = normalizeSections(response.data?.data || [])
    originalSections.value = snapshot()
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to load homepage sections.'
  } finally {
    loading.value = false
  }
}

function moveSection(index, direction) {
  if (!canUpdate.value || saving.value || loading.value) return

  const target = index + direction

  if (target < 0 || target >= sections.value.length) return

  const updated = [...sections.value]

  ;[updated[index], updated[target]] = [
    updated[target],
    updated[index],
  ]

  sections.value = updated.map((section, position) => {
    const adjacent =
      updated[position - 1]?.section_key === 'category_product_rows' ||
      updated[position + 1]?.section_key === 'category_product_rows'

    return {
      ...section,
      sort_order: position,
      settings: !adjacent
        ? Object.fromEntries(
            Object.entries(section.settings || {}).filter(
              ([key]) => key !== 'after_category_row'
            )
          )
        : section.settings,
    }
  })

  success.value = ''
}

function discardChanges() {
  if (!hasChanges.value || saving.value) return

  if (!window.confirm('Discard all unsaved changes?')) return

  sections.value = originalSections.value.map(section => ({
    ...section,
    settings: { ...section.settings },
  }))
  error.value = ''
  success.value = ''
}

async function saveChanges() {
  if (!canUpdate.value || !hasChanges.value || saving.value) return

  error.value = ''
  success.value = ''

  const payload = sections.value.map((section, index) => ({
    section_key: section.section_key,
    title: section.title.trim(),
    is_active: section.is_active,
    sort_order: index,
    settings: section.section_key !== 'category_product_rows' &&
      Number.isInteger(section.settings?.after_category_row)
      ? {
          after_category_row: section.settings.after_category_row,
        }
      : {},
  }))

  if (payload.some(section => !section.title)) {
    error.value = 'Every section must have a title.'
    return
  }

  saving.value = true

  try {
    const response = await updateHomepageSections(payload)

    sections.value = normalizeSections(response.data?.data || [])
    originalSections.value = snapshot()

    success.value = 'Homepage sections saved successfully.'
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to save homepage sections.'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSections()
  loadCategoryRows()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1>Homepage Sections</h1>
        <p>Choose which sections appear on your storefront and arrange their order.</p>
      </div>

      <div class="header-actions">
        <button
          class="secondary-button"
          type="button"
          :disabled="loading || saving"
          @click="loadSections"
        >
          <RefreshCw :size="16" :class="{ spinning: loading }" />
          Refresh
        </button>

        <button
          v-if="canUpdate"
          class="primary-button"
          type="button"
          :disabled="!hasChanges || saving || loading"
          @click="saveChanges"
        >
          <Save :size="16" />
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="notice error-state" role="alert">
      <AlertCircle :size="18" />
      <span>{{ error }}</span>
      <button type="button" aria-label="Dismiss error" @click="error = ''">
        <X :size="16" />
      </button>
    </div>

    <div v-if="success" class="notice success-state" role="status">
      <CheckCircle2 :size="18" />
      <span>{{ success }}</span>
      <button type="button" aria-label="Dismiss success" @click="success = ''">
        <X :size="16" />
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span>Total Sections</span>
        <strong>{{ sections.length }}</strong>
      </div>

      <div class="stat-card">
        <span>Visible Sections</span>
        <strong>{{ activeCount }}</strong>
      </div>

      <div class="stat-card">
        <span>Hidden Sections</span>
        <strong>{{ sections.length - activeCount }}</strong>
      </div>
    </div>

    <div class="section-panel">
      <div class="panel-header">
        <div>
          <h2>Homepage Layout</h2>
          <p>Use the arrows to reorder sections. Changes are applied after saving.</p>
        </div>

        <button
          v-if="canUpdate && hasChanges"
          class="secondary-button"
          type="button"
          :disabled="saving"
          @click="discardChanges"
        >
          Discard Changes
        </button>
      </div>

      <div v-if="loading" class="empty-state">
        Loading homepage sections...
      </div>

      <div v-else-if="!sections.length" class="empty-state">
        No homepage sections found.
      </div>

      <div v-else class="section-list">
        <div
          v-for="(section, index) in sections"
          :key="section.section_key"
          class="section-row"
          :class="{ inactive: !section.is_active }"
        >
          <div class="position">{{ index + 1 }}</div>

          <div class="section-info">
            <input
              v-model="section.title"
              class="title-input"
              type="text"
              maxlength="200"
              :aria-label="`Title for ${section.section_key}`"
              :disabled="!canUpdate || saving"
            />

            <p>{{ descriptions[section.section_key] || section.section_key }}</p>

            <label
              v-if="isAdjacentToCategoryRows(index)"
              class="banner-position-setting"
            >
              <span>Move between category product rows</span>
              <select
                class="category-row-select"
                :value="section.settings.after_category_row ?? ''"
                :disabled="!canUpdate || saving"
                @change="updateRowPosition(section, $event.target.value)"
              >
                <option value="">Normal position</option>
                <option
                  v-for="row in (categoryRowsError ? 8 : categoryRows.length)"
                  :key="row"
                  :value="row"
                >
                  After {{ categoryRows[row - 1]?.name || `Row ${row}` }}
                </option>
              </select>
            </label>
          </div>

          <label class="visibility-control">
            <input
              v-model="section.is_active"
              type="checkbox"
              :disabled="!canUpdate || saving"
            />
            <span>{{ section.is_active ? 'Visible' : 'Hidden' }}</span>
          </label>

          <div class="order-controls">
            <button
              type="button"
              :aria-label="`Move ${section.title} up`"
              :disabled="!canUpdate || saving || index === 0"
              @click="moveSection(index, -1)"
            >
              <ChevronUp :size="18" />
            </button>

            <button
              type="button"
              :aria-label="`Move ${section.title} down`"
              :disabled="!canUpdate || saving || index === sections.length - 1"
              @click="moveSection(index, 1)"
            >
              <ChevronDown :size="18" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <p class="help-text">
      Sections immediately above or below Category Product Rows can be
      inserted between category rows using their position dropdown. Search results and category-filtered product listings
      are not controlled by these homepage visibility settings.
    </p>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px;
  color: var(--color-text, #172033);
}

.page-header,
.header-actions,
.panel-header,
.section-row,
.order-controls,
.notice {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header,
.panel-header {
  justify-content: space-between;
  margin-bottom: 22px;
}

.page-header h1 {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 6px;
}

.page-header p,
.panel-header p,
.section-info p,
.help-text {
  color: var(--color-text-secondary, #64748b);
  margin: 0;
  font-size: 13px;
}

.header-actions {
  flex-wrap: wrap;
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  padding: 10px 15px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button {
  background: var(--color-primary, #2563eb);
  color: white;
  border: 1px solid transparent;
}

.secondary-button {
  background: var(--color-surface, white);
  color: inherit;
  border: 1px solid var(--color-border, #e2e8f0);
}

button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.notice {
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.notice span {
  flex: 1;
}

.notice button {
  background: none;
  border: 0;
  cursor: pointer;
  color: inherit;
}

.error-state {
  background: var(--color-error-bg, #fef2f2);
  color: var(--color-error, #b91c1c);
}

.success-state {
  background: var(--color-success-bg, #f0fdf4);
  color: var(--color-success, #15803d);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card,
.section-panel {
  background: var(--color-surface, white);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
}

.stat-card {
  padding: 18px;
}

.stat-card span {
  display: block;
  color: var(--color-text-secondary, #64748b);
  font-size: 13px;
  margin-bottom: 8px;
}

.stat-card strong {
  font-size: 27px;
}

.section-panel {
  padding: 20px;
}

.panel-header h2 {
  font-size: 18px;
  margin: 0 0 6px;
}

.section-list {
  display: grid;
  gap: 10px;
}

.section-row {
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  padding: 14px;
}

.section-row.inactive {
  opacity: .7;
}

.position {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--color-background, #f1f5f9);
  display: grid;
  place-items: center;
  font-weight: 700;
  flex-shrink: 0;
}

.section-info {
  flex: 1;
  min-width: 0;
}

.title-input {
  display: block;
  width: 100%;
  max-width: 400px;
  padding: 7px 9px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  background: var(--color-surface, white);
  color: inherit;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}

.title-input:disabled {
  opacity: 1;
}

.visibility-control {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  cursor: pointer;
  font-size: 13px;
}

.visibility-control input {
  width: 17px;
  height: 17px;
  accent-color: var(--color-primary, #2563eb);
}

.order-controls {
  gap: 5px;
}

.order-controls button {
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 7px;
  background: var(--color-surface, white);
  color: inherit;
  padding: 7px;
  cursor: pointer;
}

.empty-state {
  padding: 35px 12px;
  text-align: center;
  color: var(--color-text-secondary, #64748b);
}

.help-text {
  margin-top: 16px;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .page-container {
    padding: 14px;
  }

  .page-header,
  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .section-row {
    flex-wrap: wrap;
  }

  .section-info {
    flex-basis: calc(100% - 55px);
  }

  .visibility-control {
    margin-left: 46px;
  }

  .order-controls {
    margin-left: auto;
  }
}

/* Category row insertion dropdown */
.banner-position-setting {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--color-background, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
}

.banner-position-setting > span {
  color: var(--color-text-secondary, #64748b);
  font-size: 13px;
  font-weight: 600;
}

.category-row-select {
  appearance: none;
  -webkit-appearance: none;
  min-width: 175px;
  max-width: 100%;
  padding: 10px 38px 10px 13px;
  border: 1px solid var(--color-border, #cbd5e1);
  border-radius: 8px;
  background-color: var(--color-surface, #fff);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  color: var(--color-text, #172033);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s;
}

.category-row-select:hover:not(:disabled) {
  border-color: var(--color-primary, #2563eb);
}

.category-row-select:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}

.category-row-select:disabled {
  opacity: .55;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .banner-position-setting {
    align-items: stretch;
    flex-direction: column;
  }

  .category-row-select {
    width: 100%;
  }
}

</style>
