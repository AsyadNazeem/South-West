<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  BarChart3,
  CreditCard,
  Package,
  Warehouse,
  Download,
  Search,
  RefreshCw,
  CalendarDays,
  FileSpreadsheet
} from 'lucide-vue-next'

import {
  reportDefinitions,
  fetchReport,
  exportReport
} from '@/api/reportApi'

const categories = [
  { id: 'sales', label: 'Sales', icon: BarChart3, description: 'How much you sold' },
  { id: 'payments', label: 'Payments', icon: CreditCard, description: 'Money received and refunds' },
  { id: 'products', label: 'Products', icon: Package, description: 'Best and worst sellers' },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, description: 'Stock you have and stock moves' }
]

const activeCategory = ref('sales')
const activeReportId = ref('summary')

const startDate = ref('')
const endDate = ref('')
const activePreset = ref('month')

const searchTerm = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const reportData = ref({})
const loading = ref(false)
const exporting = ref(false)
const errorMessage = ref('')

const currentReports = computed(
  () => reportDefinitions[activeCategory.value] || []
)

const activeReport = computed(
  () => currentReports.value.find(item => item.id === activeReportId.value)
)

const activeCategoryInfo = computed(
  () => categories.find(item => item.id === activeCategory.value)
)

const rows = computed(() => {
  if (Array.isArray(reportData.value?.rows)) {
    return reportData.value.rows
  }

  if (Array.isArray(reportData.value?.data)) {
    return reportData.value.data
  }

  return []
})

const totals = computed(() => {
  const value = reportData.value?.totals

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  return Object.entries(value).filter(
    ([, amount]) => amount !== null && amount !== undefined &&
      typeof amount !== 'object'
  )
})

const columns = computed(() => {
  if (!rows.value.length) return []

  return Object.keys(rows.value[0]).filter(
    key => !['id'].includes(key)
  )
})

const filteredRows = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  if (!term) return rows.value

  return rows.value.filter(row =>
    Object.values(row).some(value =>
      String(
        value && typeof value === 'object'
          ? JSON.stringify(value)
          : value ?? ''
      ).toLowerCase().includes(term)
    )
  )
})

const totalPages = computed(
  () => Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value))
)

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

const pageStart = computed(() =>
  filteredRows.value.length
    ? (currentPage.value - 1) * pageSize.value + 1
    : 0
)

const pageEnd = computed(() =>
  Math.min(currentPage.value * pageSize.value, filteredRows.value.length)
)

const reportTitle = computed(
  () => activeReport.value?.label || 'Report'
)

const isInventory = computed(
  () => activeCategory.value === 'inventory'
)

// ==========================================
// Dates
// ==========================================

function localDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDate(value) {
  if (!value) return ''

  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const datePresets = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' }
]

function presetRange(id) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  if (id === 'today') return [today, today]

  if (id === 'yesterday') {
    const yesterday = new Date(year, month, today.getDate() - 1)
    return [yesterday, yesterday]
  }

  if (id === 'week') {
    return [new Date(year, month, today.getDate() - 6), today]
  }

  if (id === 'lastMonth') {
    return [new Date(year, month - 1, 1), new Date(year, month, 0)]
  }

  // This month
  return [new Date(year, month, 1), today]
}

function applyPreset(id) {
  const [start, end] = presetRange(id)

  startDate.value = localDateString(start)
  endDate.value = localDateString(end)
  activePreset.value = id

  loadReport()
}

function onDateChange() {
  activePreset.value = 'custom'
  loadReport()
}

function setDefaultDates() {
  const [start, end] = presetRange('month')

  startDate.value = localDateString(start)
  endDate.value = localDateString(end)
  activePreset.value = 'month'
}

const dateRangeLabel = computed(() => {
  if (!activeReport.value?.dated) return ''

  if (startDate.value === endDate.value) {
    return displayDate(startDate.value)
  }

  return `${displayDate(startDate.value)} – ${displayDate(endDate.value)}`
})

const reportDescription = computed(() => {
  if (isInventory.value) {
    return activeReport.value?.dated
      ? 'Every stock movement in the dates you picked.'
      : 'What you have in stock right now.'
  }

  return 'Your online business numbers for the dates you picked.'
})

// ==========================================
// Formatting
// ==========================================

function formatLabel(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function formatValue(value, key) {
  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  const moneyKeys = [
    'amount', 'sales', 'subtotal', 'discount', 'tax',
    'shipping', 'revenue', 'collected', 'recorded',
    'gross', 'net', 'total'
  ]

  const isMoney = moneyKeys.some(part =>
    key.toLowerCase().includes(part)
  )

  if (isMoney && typeof value === 'number') {
    return `LKR ${Number(value).toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  if (typeof value === 'number') {
    return Number(value).toLocaleString('en-LK', {
      maximumFractionDigits: 3
    })
  }

  return String(value)
}

function getError(error) {
  if (error.response?.data instanceof Blob) {
    return 'The report request failed. Please check the selected filters and try again.'
  }

  return error.response?.data?.message ||
    error.message ||
    'Unable to load the report. Please try again.'
}

// ==========================================
// Load / export
// ==========================================

async function loadReport() {
  if (!activeReport.value) return

  if (activeReport.value.dated) {
    if (!startDate.value || !endDate.value) {
      errorMessage.value = 'Please select both a start date and an end date.'
      return
    }

    if (startDate.value > endDate.value) {
      errorMessage.value = 'The start date cannot be after the end date.'
      return
    }
  }

  loading.value = true
  errorMessage.value = ''
  searchTerm.value = ''
  currentPage.value = 1
  reportData.value = {}

  try {
    const params = activeReport.value.dated
      ? {
          startDate: startDate.value,
          endDate: endDate.value
        }
      : {}

    reportData.value = await fetchReport(
      activeReport.value.endpoint,
      params
    )
  } catch (error) {
    errorMessage.value = getError(error)
  } finally {
    loading.value = false
  }
}

async function downloadExcel() {
  if (!activeReport.value || exporting.value) return

  if (activeReport.value.dated) {
    if (!startDate.value || !endDate.value || startDate.value > endDate.value) {
      errorMessage.value = 'Please select a valid date range before exporting.'
      return
    }
  }

  exporting.value = true
  errorMessage.value = ''

  try {
    const params = activeReport.value.dated
      ? {
          startDate: startDate.value,
          endDate: endDate.value
        }
      : {}

    await exportReport(activeReport.value.endpoint, params)
  } catch (error) {
    errorMessage.value = getError(error)
  } finally {
    exporting.value = false
  }
}

// ==========================================
// Selection / paging
// ==========================================

function selectCategory(category) {
  activeCategory.value = category
  activeReportId.value = reportDefinitions[category][0].id
  searchTerm.value = ''
  reportData.value = {}
  errorMessage.value = ''
  currentPage.value = 1
}

function selectReport(reportId) {
  activeReportId.value = reportId
  searchTerm.value = ''
  reportData.value = {}
  errorMessage.value = ''
  currentPage.value = 1
}

function changePage(page) {
  currentPage.value = Math.min(Math.max(1, page), totalPages.value)
}

watch([searchTerm, pageSize], () => {
  currentPage.value = 1
})

watch([activeCategory, activeReportId], () => {
  loadReport()
})

onMounted(() => {
  setDefaultDates()
  loadReport()
})
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Reports</h1>

        <p>Choose a report, pick the dates, and see your numbers.</p>
      </div>

      <button
        type="button"
        class="primary-button"
        :disabled="loading || exporting"
        @click="downloadExcel"
      >
        <Download :size="17" />
        {{ exporting ? 'Downloading...' : 'Download Excel' }}
      </button>

    </div>


    <!-- Report picker -->
    <section class="picker-card">

      <!-- Step 1 -->
      <div class="step">

        <div class="step-title">
          <span class="step-number">1</span>

          <div>
            <h2>What do you want to see?</h2>
            <p>Pick a topic.</p>
          </div>
        </div>

        <div class="category-grid">

          <button
            v-for="category in categories"
            :key="category.id"
            type="button"
            class="category-button"
            :class="{ selected: activeCategory === category.id }"
            :aria-pressed="activeCategory === category.id"
            @click="selectCategory(category.id)"
          >
            <span class="category-icon">
              <component :is="category.icon" :size="22" />
            </span>

            <span class="category-text">
              <strong>{{ category.label }}</strong>
              <small>{{ category.description }}</small>
            </span>
          </button>

        </div>

      </div>

      <!-- Step 2 -->
      <div class="step">

        <div class="step-title">
          <span class="step-number">2</span>

          <div>
            <h2>Which report?</h2>
            <p>Pick one of the {{ activeCategoryInfo?.label }} reports.</p>
          </div>
        </div>

        <div class="pill-list">

          <button
            v-for="report in currentReports"
            :key="report.id"
            type="button"
            class="pill"
            :class="{ active: activeReportId === report.id }"
            :aria-pressed="activeReportId === report.id"
            @click="selectReport(report.id)"
          >
            {{ report.label }}
          </button>

        </div>

      </div>

      <!-- Step 3 -->
      <div
        v-if="activeReport?.dated"
        class="step"
      >

        <div class="step-title">
          <span class="step-number">3</span>

          <div>
            <h2>Which dates?</h2>
            <p>Tap a shortcut, or choose your own dates.</p>
          </div>
        </div>

        <div class="pill-list">

          <button
            v-for="preset in datePresets"
            :key="preset.id"
            type="button"
            class="pill small"
            :class="{ active: activePreset === preset.id }"
            :aria-pressed="activePreset === preset.id"
            :disabled="loading"
            @click="applyPreset(preset.id)"
          >
            {{ preset.label }}
          </button>

        </div>

        <div class="date-fields">

          <label>
            <span>From</span>

            <input
              v-model="startDate"
              type="date"
              :max="endDate || undefined"
              @change="onDateChange"
            />
          </label>

          <span class="date-arrow" aria-hidden="true">→</span>

          <label>
            <span>To</span>

            <input
              v-model="endDate"
              type="date"
              :min="startDate || undefined"
              :max="localDateString(new Date())"
              @change="onDateChange"
            />
          </label>

        </div>

      </div>

    </section>


    <!-- Results heading -->
    <div class="results-header">

      <div>
        <h2>{{ reportTitle }}</h2>

        <p>
          {{ reportDescription }}
          <span
            v-if="dateRangeLabel"
            class="date-chip"
          >
            <CalendarDays :size="14" />
            {{ dateRangeLabel }}
          </span>
        </p>
      </div>

      <button
        type="button"
        class="action-button refresh"
        :disabled="loading"
        @click="loadReport"
      >
        <RefreshCw :size="16" :class="{ spinning: loading }" />
        Refresh
      </button>

    </div>


    <!-- Error -->
    <div
      v-if="errorMessage"
      class="error-state"
    >
      <span>{{ errorMessage }}</span>

      <button
        type="button"
        class="action-button"
        @click="loadReport"
      >
        Try Again
      </button>
    </div>


    <!-- Summary -->
    <div
      v-if="totals.length"
      class="summary-grid"
    >

      <div
        v-for="[key, value] in totals"
        :key="key"
        class="summary-card"
      >
        <span>{{ formatLabel(key) }}</span>

        <strong>{{ formatValue(value, key) }}</strong>
      </div>

    </div>


    <!-- Table -->
    <div class="table-card">

      <div class="table-toolbar">

        <div>
          <strong>Details</strong>

          <span class="record-count">
            {{ filteredRows.length }}
            record{{ filteredRows.length === 1 ? '' : 's' }}
          </span>
        </div>

        <div class="toolbar-controls">

          <label class="search-box">
            <Search :size="16" />

            <input
              v-model="searchTerm"
              type="search"
              placeholder="Type to search..."
              aria-label="Search records"
            />
          </label>

          <select
            v-model.number="pageSize"
            aria-label="Rows per page"
          >
            <option :value="10">Show 10</option>
            <option :value="25">Show 25</option>
            <option :value="50">Show 50</option>
            <option :value="100">Show 100</option>
          </select>

        </div>

      </div>


      <!-- Loading -->
      <div
        v-if="loading"
        class="empty-state"
      >
        <RefreshCw :size="26" class="spinning" />

        <strong>Getting your report...</strong>

        <span>This only takes a moment.</span>
      </div>


      <!-- No data -->
      <div
        v-else-if="!rows.length"
        class="empty-state"
      >
        <FileSpreadsheet :size="30" />

        <strong>Nothing to show</strong>

        <span>
          {{
            activeReport?.dated
              ? 'There are no records for these dates. Try a different date range.'
              : 'There are no records for this report yet.'
          }}
        </span>
      </div>


      <!-- No search matches -->
      <div
        v-else-if="!filteredRows.length"
        class="empty-state"
      >
        <Search :size="28" />

        <strong>No matches</strong>

        <span>Try typing something different.</span>
      </div>


      <!-- Rows -->
      <div
        v-else
        class="table-container"
      >

        <table>

          <thead>
          <tr>
            <th v-for="column in columns" :key="column">
              {{ formatLabel(column) }}
            </th>
          </tr>
          </thead>

          <tbody>
          <tr
            v-for="(row, index) in paginatedRows"
            :key="row.id ?? index"
          >
            <td v-for="column in columns" :key="column">
              {{ formatValue(row[column], column) }}
            </td>
          </tr>
          </tbody>

        </table>

      </div>


      <!-- Pagination -->
      <div
        v-if="!loading && filteredRows.length"
        class="pagination"
      >

        <span>
          Showing {{ pageStart }}–{{ pageEnd }}
          of {{ filteredRows.length }}
        </span>

        <div class="pagination-buttons">

          <button
            type="button"
            class="action-button"
            :disabled="currentPage <= 1"
            @click="changePage(currentPage - 1)"
          >
            Previous
          </button>

          <span>Page {{ currentPage }} of {{ totalPages }}</span>

          <button
            type="button"
            class="action-button"
            :disabled="currentPage >= totalPages"
            @click="changePage(currentPage + 1)"
          >
            Next
          </button>

        </div>

      </div>

    </div>


    <!-- Footnote -->
    <div class="report-footnote">
      <span>Time zone: Asia/Colombo</span>

      <span v-if="!isInventory || activeReport?.dated">Currency: LKR</span>

      <span v-if="activeCategory === 'sales' || activeCategory === 'products'">
        Online orders only
      </span>
    </div>

  </div>
</template>

<style scoped>
.page-container {
  width: 100%;
  font-family: var(--font-family);
}

/* =========================
   Page Header
   ========================= */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Buttons
   ========================= */

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 10px var(--spacing-lg);
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.primary-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button:hover:not(:disabled) {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button.refresh {
  height: 40px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-md);
}

/* =========================
   Picker card (3 steps)
   ========================= */

.picker-card {
  margin-bottom: var(--spacing-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.step {
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-light);
}

.step:last-child {
  border-bottom: none;
}

.step-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.step-number {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.step-title h2 {
  font-size: var(--font-size-lg, 18px);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.step-title p {
  margin-top: 2px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Step 1: topics */

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.category-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 0;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast),
  background var(--transition-fast),
  box-shadow var(--transition-fast);
}

.category-button:hover:not(.selected) {
  background: var(--color-hover-bg);
}

.category-button.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.category-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

.category-button.selected .category-icon {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.category-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.category-text strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.category-button.selected .category-text strong {
  color: var(--color-primary);
}

.category-text small {
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-secondary);
}

/* Steps 2 & 3: pills */

.pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.pill {
  padding: 10px var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.pill.small {
  padding: 7px var(--spacing-md);
  font-size: var(--font-size-sm);
}

.pill:hover:not(.active):not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.pill.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-light);
}

.pill:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pill:focus-visible,
.category-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Dates */

.date-fields {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.date-fields label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 180px;
}

.date-fields label span {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.date-fields input {
  box-sizing: border-box;
  height: 40px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.date-fields input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.date-arrow {
  padding-bottom: 10px;
  color: var(--color-text-muted);
}

/* =========================
   Results heading
   ========================= */

.results-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.results-header h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.results-header p {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.date-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

/* =========================
   Summary cards
   ========================= */

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.summary-card span {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.summary-card strong {
  overflow-wrap: anywhere;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
}

/* =========================
   Table
   ========================= */

.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.table-toolbar > div:first-child strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.record-count {
  margin-left: var(--spacing-sm);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.toolbar-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  height: 40px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-muted);
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.search-box:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.search-box input {
  width: 190px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
}

.search-box input::placeholder {
  color: var(--color-text-muted);
}

.toolbar-controls select {
  height: 40px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-md);
  cursor: pointer;
  outline: none;
}

.toolbar-controls select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
}

th {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: var(--color-hover-bg);
  border-bottom: 1px solid var(--color-border-light);
}

td {
  max-width: 300px;
  padding: 14px var(--spacing-lg);
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
}

tbody tr {
  transition: background var(--transition-fast);
}

tbody tr:hover {
  background: var(--color-surface-hover);
}

tbody tr:last-child td {
  border-bottom: none;
}

/* =========================
   States
   ========================= */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-state strong {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.error-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* =========================
   Pagination / footnote
   ========================= */

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-hover-bg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.report-footnote {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 1000px) {
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .page-header,
  .results-header {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header {
    align-items: flex-start;
  }

  .category-grid {
    grid-template-columns: 1fr;
  }

  .step {
    padding: var(--spacing-lg);
  }

  .date-fields {
    flex-direction: column;
    align-items: stretch;
  }

  .date-fields label {
    min-width: 0;
  }

  .date-arrow {
    display: none;
  }

  .toolbar-controls,
  .search-box,
  .toolbar-controls select {
    width: 100%;
  }

  .search-box input {
    flex: 1;
    width: auto;
  }

  .pagination {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>