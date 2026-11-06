<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import deliveryAreaApi from '@/api/deliveryAreaApi'
import deliveryDistrictApi from '@/api/deliveryDistrictApi'
import { hasPermission } from '@/auth/authorization'
import { createRequestSequence } from '@/composables/useServerPagination.js'
const paginationRequestSequence = createRequestSequence()

const router = useRouter()

// =========================================================
// STATE
// =========================================================

const deliveryAreas = ref([])
const districts = ref([])

const loading = ref(false)
const error = ref('')

const canViewPrepaidPricing = hasPermission('delivery_charges.view')
const canUpdatePrepaidPricing = hasPermission('delivery_charges.update')

const prepaidPricing = ref({
  colombo_first_kg_charge: 450,
  outside_colombo_first_kg_charge: 550,
  additional_kg_charge: 100
})

const prepaidPricingLoading = ref(false)
const prepaidPricingSaving = ref(false)
const prepaidPricingError = ref('')
const prepaidPricingSuccess = ref('')

const search = ref('')
const districtFilter = ref('')
const statusFilter = ref('')

// Pagination
const pageSizeOptions = [10, 25, 50, 100]
const pageSize = ref(10)
const currentPage = ref(1)
const pagination = ref({ total: 0, totalPages: 1 })

// =========================================================
// LOAD DATA
// =========================================================

const loadDistricts = async () => {
  try {
    const response = await deliveryDistrictApi.getDistricts()

    districts.value = response?.data || response || []
  } catch (err) {
    console.error('Failed to load delivery districts:', err)

    districts.value = []
  }
}

const loadPrepaidPricing = async () => {
  if (!canViewPrepaidPricing) return

  prepaidPricingLoading.value = true
  prepaidPricingError.value = ''

  try {
    const response = await deliveryAreaApi.getPrepaidPricing()
    const data = response?.data || response

    prepaidPricing.value = {
      colombo_first_kg_charge: Number(data.colombo_first_kg_charge),
      outside_colombo_first_kg_charge: Number(data.outside_colombo_first_kg_charge),
      additional_kg_charge: Number(data.additional_kg_charge)
    }
  } catch (err) {
    console.error('Failed to load prepaid delivery pricing:', err)
    prepaidPricingError.value =
      err?.response?.data?.message ||
      err?.message ||
      'Failed to load prepaid delivery pricing.'
  } finally {
    prepaidPricingLoading.value = false
  }
}

const loadDeliveryAreas = async () => {
  const requestId = paginationRequestSequence.begin()
  loading.value = true
  error.value = ''

  try {
    const response = await deliveryAreaApi.getDeliveryAreas({
      page: currentPage.value,
      pageSize: pageSize.value,
      search: search.value.trim(),
      district_id: districtFilter.value || undefined,
      status: statusFilter.value
    })
  if (!paginationRequestSequence.isCurrent(requestId)) return

    if (response?.pagination) {
      const totalPages = Math.max(1, Number(response.pagination.totalPages) || 1)
      if (currentPage.value > totalPages) {
        currentPage.value = totalPages
        return
      }
      pagination.value = response.pagination
      currentPage.value = Number(response.pagination.page) || 1
    }
    deliveryAreas.value = response?.data || response || []
  } catch (err) {
    if (!paginationRequestSequence.isCurrent(requestId)) return
    console.error('Failed to load delivery areas:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load delivery areas.'
  } finally {
    if (!paginationRequestSequence.isCurrent(requestId)) return
    loading.value = false
  }
}

// =========================================================
// FILTER OPTIONS
// =========================================================

const districtOptions = computed(() =>
    districts.value
        .map(district => ({
          id: district.id,
          name: district.district_name
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
)

// =========================================================
// FILTERED LIST
// =========================================================

const filteredAreas = computed(() => {
  return deliveryAreas.value
})

// =========================================================
// PAGINATION
// =========================================================

const totalPages = computed(() =>
    Math.max(1, Number(pagination.value.totalPages) || 1)
)

const paginatedAreas = computed(() => {
  return filteredAreas.value
})

const rangeStart = computed(() =>
    pagination.value.total === 0
        ? 0
        : (currentPage.value - 1) * pageSize.value + 1
)

const rangeEnd = computed(() =>
    Math.min(currentPage.value * pageSize.value, pagination.value.total)
)

// Page buttons with ellipsis, e.g. 1 ... 4 5 6 ... 20
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) pages.push('...')

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (end < total - 1) pages.push('...')

  pages.push(total)

  return pages
})

const goToPage = (page) => {
  if (typeof page !== 'number') return

  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
}

// Back to page 1 when filters or page size change
watch([search, districtFilter, statusFilter, pageSize], () => {
  if (currentPage.value !== 1) currentPage.value = 1
  else loadDeliveryAreas()
})

watch(currentPage, () => loadDeliveryAreas())

// Keep the page valid (e.g. after deleting the last row on the last page)
watch(totalPages, (total) => {
  if (currentPage.value > total) {
    currentPage.value = total
  }
})

// =========================================================
// ACTIONS
// =========================================================

const addDeliveryArea = () => {
  router.push('/admin/sales/delivery-chargers/create')
}

const editDeliveryArea = (area) => {
  router.push(`/admin/sales/delivery-chargers/edit/${area.id}`)
}

const deleteDeliveryArea = async (area) => {
  const districtName =
      area.district?.district_name ||
      area.district_name ||
      ''

  const confirmed = window.confirm(
      `Are you sure you want to delete the delivery area "${area.area_name}" in ${districtName}?`
  )

  if (!confirmed) {
    return
  }

  try {
    await deliveryAreaApi.deleteDeliveryArea(area.id)

    await loadDeliveryAreas()
  } catch (err) {
    console.error('Delete delivery area error:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete delivery area.'
  }
}

const savePrepaidPricing = async () => {
  if (!canUpdatePrepaidPricing || prepaidPricingSaving.value) return

  prepaidPricingError.value = ''
  prepaidPricingSuccess.value = ''

  const fields = [
    'colombo_first_kg_charge',
    'outside_colombo_first_kg_charge',
    'additional_kg_charge'
  ]

  for (const field of fields) {
    const value = Number(prepaidPricing.value[field])

    if (!Number.isFinite(value) || value < 0 || !/^\d{1,10}(\.\d{1,2})?$/.test(String(prepaidPricing.value[field]))) {
      prepaidPricingError.value = 'Enter valid non-negative amounts with up to two decimal places.'
      return
    }
  }

  prepaidPricingSaving.value = true

  try {
    const response = await deliveryAreaApi.updatePrepaidPricing({
      colombo_first_kg_charge: Number(prepaidPricing.value.colombo_first_kg_charge),
      outside_colombo_first_kg_charge: Number(prepaidPricing.value.outside_colombo_first_kg_charge),
      additional_kg_charge: Number(prepaidPricing.value.additional_kg_charge)
    })

    const data = response?.data || response

    prepaidPricing.value = {
      colombo_first_kg_charge: Number(data.colombo_first_kg_charge),
      outside_colombo_first_kg_charge: Number(data.outside_colombo_first_kg_charge),
      additional_kg_charge: Number(data.additional_kg_charge)
    }

    prepaidPricingSuccess.value =
      response?.message || 'Prepaid delivery pricing updated successfully.'
  } catch (err) {
    console.error('Failed to save prepaid delivery pricing:', err)
    prepaidPricingError.value =
      err?.response?.data?.message ||
      err?.message ||
      'Failed to update prepaid delivery pricing.'
  } finally {
    prepaidPricingSaving.value = false
  }
}

const clearFilters = () => {
  search.value = ''
  districtFilter.value = ''
  statusFilter.value = ''
}

// =========================================================
// FORMATTERS
// =========================================================

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

// =========================================================
// INITIAL LOAD
// =========================================================

onMounted(async () => {
  loading.value = true

  try {
    await Promise.all([
      loadDistricts(),
      loadDeliveryAreas(),
      canViewPrepaidPricing ? loadPrepaidPricing() : Promise.resolve()
    ])
  } finally {
    loading.value = false
  }
})
</script>


<template>
  <div class="delivery-areas-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Delivery Areas</h1>
        <p>Manage delivery areas and their delivery charges.</p>
      </div>

      <button
          v-if="hasPermission('delivery_charges.create')"
          type="button"
          class="btn-primary"
          @click="addDeliveryArea"
      >
        + Add Delivery Area
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Prepaid Delivery Pricing -->
    <section v-if="canViewPrepaidPricing" class="prepaid-pricing-card">
      <div class="prepaid-pricing-header">
        <div>
          <h2>Prepaid Delivery Pricing</h2>
          <p>Rates applied to Card, KOKO and Mintpay orders. COD continues using the delivery-area rates below.</p>
        </div>
        <span class="pricing-status">Prepaid methods</span>
      </div>

      <div v-if="prepaidPricingLoading" class="pricing-loading">
        Loading prepaid delivery rates...
      </div>

      <template v-else>
        <div class="prepaid-pricing-grid">
          <div class="pricing-field">
            <label for="prepaid-colombo">Colombo first 1 KG</label>
            <div class="pricing-input-wrap">
              <span>Rs.</span>
              <input
                id="prepaid-colombo"
                v-model="prepaidPricing.colombo_first_kg_charge"
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                :disabled="!canUpdatePrepaidPricing || prepaidPricingSaving"
              />
            </div>
          </div>

          <div class="pricing-field">
            <label for="prepaid-outside">Outside Colombo first 1 KG</label>
            <div class="pricing-input-wrap">
              <span>Rs.</span>
              <input
                id="prepaid-outside"
                v-model="prepaidPricing.outside_colombo_first_kg_charge"
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                :disabled="!canUpdatePrepaidPricing || prepaidPricingSaving"
              />
            </div>
          </div>

          <div class="pricing-field">
            <label for="prepaid-additional">Every additional 1 KG</label>
            <div class="pricing-input-wrap">
              <span>Rs.</span>
              <input
                id="prepaid-additional"
                v-model="prepaidPricing.additional_kg_charge"
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                :disabled="!canUpdatePrepaidPricing || prepaidPricingSaving"
              />
            </div>
          </div>
        </div>

        <p class="pricing-help">
          Additional weight is rounded up to the next kilogram. These rates do not affect Cash on Delivery.
        </p>

        <div v-if="prepaidPricingError" class="error-message pricing-feedback">
          {{ prepaidPricingError }}
        </div>

        <div v-if="prepaidPricingSuccess" class="pricing-success">
          {{ prepaidPricingSuccess }}
        </div>

        <div v-if="canUpdatePrepaidPricing" class="pricing-actions">
          <button
            type="button"
            class="btn-primary"
            :disabled="prepaidPricingSaving"
            @click="savePrepaidPricing"
          >
            {{ prepaidPricingSaving ? 'Saving...' : 'Save Prepaid Rates' }}
          </button>
        </div>
      </template>
    </section>

    <!-- Summary -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Areas</div>
        <div class="stat-value">{{ deliveryAreas.length }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Showing</div>
        <div class="stat-value">{{ pagination.total }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Districts</div>
        <div class="stat-value">{{ districtOptions.length }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-card">

      <div class="filter-group filter-search">
        <label for="search">Search</label>

        <input
            id="search"
            v-model="search"
            type="text"
            placeholder="Search district or area..."
        />
      </div>

      <div class="filter-group">
        <label for="district">District</label>

        <select id="district" v-model="districtFilter">
          <option value="">All Districts</option>

          <option
              v-for="district in districtOptions"
              :key="district.id"
              :value="district.id"
          >
            {{ district.name }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label for="status">Status</label>

        <select id="status" v-model="statusFilter">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="clearFilters"
      >
        Clear
      </button>

    </div>

    <!-- Table -->
    <div class="table-card">

      <div class="table-wrapper">
        <table>

          <thead>
          <tr>
            <th>#</th>
            <th>District</th>
            <th>Area</th>
            <th>First 1 KG</th>
            <th>Additional 1 KG</th>
            <th>Status</th>
            <th class="actions-column">Actions</th>
          </tr>
          </thead>

          <tbody>

          <tr v-if="loading">
            <td colspan="7" class="empty-state">
              Loading delivery areas...
            </td>
          </tr>

          <tr v-else-if="pagination.total === 0">
            <td colspan="7" class="empty-state">
              <strong>No delivery areas found</strong>
              <span>Try changing your search or filters.</span>
            </td>
          </tr>

          <tr
              v-for="(area, index) in paginatedAreas"
              :key="area.id"
          >
            <td>{{ (currentPage - 1) * pageSize + index + 1 }}</td>

            <td>
              <strong>
                {{ area.district?.district_name || area.district_name || '-' }}
              </strong>
            </td>

            <td>{{ area.area_name }}</td>

            <td class="amount">Rs. {{ formatCurrency(area.first_kg_charge) }}</td>

            <td class="amount">Rs. {{ formatCurrency(area.additional_kg_charge) }}</td>

            <td>
              <span
                  class="status-badge"
                  :class="area.status ? 'status-active' : 'status-inactive'"
              >
                {{ area.status ? 'Active' : 'Inactive' }}
              </span>
            </td>

            <td class="actions-column">
              <div class="action-buttons">

                <button
                    v-if="hasPermission('delivery_charges.update')"
                    type="button"
                    class="table-action edit"
                    @click="editDeliveryArea(area)"
                >
                  Edit
                </button>

                <button
                    v-if="hasPermission('delivery_charges.delete')"
                    type="button"
                    class="table-action delete"
                    @click="deleteDeliveryArea(area)"
                >
                  Delete
                </button>

              </div>
            </td>
          </tr>

          </tbody>

        </table>
      </div>

      <!-- Pagination -->
      <div
          v-if="!loading && pagination.total > 0"
          class="pagination-bar"
      >

        <div class="rows-per-page">
          <label for="page-size">Rows per page</label>

          <select id="page-size" v-model.number="pageSize">
            <option
                v-for="size in pageSizeOptions"
                :key="size"
                :value="size"
            >
              {{ size }}
            </option>
          </select>
        </div>

        <div class="range-text">
          {{ rangeStart }}–{{ rangeEnd }} of {{ pagination.total }}
        </div>

        <div class="pagination-controls">

          <button
              type="button"
              class="page-button"
              :disabled="currentPage === 1"
              @click="goToPage(currentPage - 1)"
          >
            Previous
          </button>

          <template v-for="(page, i) in visiblePages" :key="`${page}-${i}`">
            <span v-if="page === '...'" class="page-ellipsis">…</span>

            <button
                v-else
                type="button"
                class="page-button page-number"
                :class="{ active: page === currentPage }"
                :aria-current="page === currentPage ? 'page' : undefined"
                @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </template>

          <button
              type="button"
              class="page-button"
              :disabled="currentPage === totalPages"
              @click="goToPage(currentPage + 1)"
          >
            Next
          </button>

        </div>

      </div>

    </div>

  </div>
</template>


<style scoped>
.delivery-areas-page {
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

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

/* =========================
   Summary
   ========================= */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.stat-card {
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.stat-label {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

/* =========================
   Filters
   ========================= */

.filter-card {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 180px;
}

.filter-search {
  flex: 1;
  max-width: 360px;
}

.filter-group label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.filter-group input,
.filter-group select,
.rows-per-page select {
  box-sizing: border-box;
  height: 40px;
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

.filter-group input {
  padding: 0 var(--spacing-lg);
}

.filter-group input::placeholder {
  color: var(--color-text-muted);
}

.filter-group select {
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.filter-group input:focus,
.filter-group select:focus,
.rows-per-page select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
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

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: var(--color-hover-bg);
  border-bottom: 1px solid var(--color-border-light);
}

td {
  padding: 14px var(--spacing-lg);
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

td strong {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
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

.amount {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.actions-column {
  text-align: right;
}

/* =========================
   Status Badges
   ========================= */

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.status-active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-inactive {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* =========================
   Row Actions
   ========================= */

.action-buttons {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-sm);
}

.table-action {
  display: inline-flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.table-action.edit:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.table-action.delete:hover {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

/* =========================
   Pagination
   ========================= */

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-surface);
}

.rows-per-page {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.rows-per-page label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.rows-per-page select {
  height: 34px;
  padding: 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.range-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.page-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.page-button:hover:not(:disabled):not(.active) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.page-button.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-text-light);
  cursor: default;
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-ellipsis {
  min-width: 24px;
  text-align: center;
  color: var(--color-text-muted);
}

/* =========================
   States
   ========================= */

.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  white-space: normal;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-state strong {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.empty-state span {
  display: block;
}

.error-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

/* =========================
   Prepaid Delivery Pricing
   ========================= */

.prepaid-pricing-card {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.prepaid-pricing-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.prepaid-pricing-header h2 {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.prepaid-pricing-header p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.pricing-status {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.prepaid-pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.pricing-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.pricing-field label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.pricing-input-wrap {
  display: flex;
  align-items: center;
  height: 42px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.pricing-input-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.pricing-input-wrap span {
  margin-right: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.pricing-input-wrap input {
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
}

.pricing-input-wrap input:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.pricing-help {
  margin: var(--spacing-md) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.pricing-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-lg);
}

.pricing-actions button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.pricing-feedback {
  margin-top: var(--spacing-md);
  margin-bottom: 0;
}

.pricing-success {
  margin-top: var(--spacing-md);
  color: var(--color-success);
  font-size: var(--font-size-sm);
}

.pricing-loading {
  padding: var(--spacing-lg) 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 900px) {
  .filter-card {
    flex-wrap: wrap;
  }

  .filter-group {
    flex: 1;
    min-width: 180px;
  }

  .filter-search {
    flex: 1 1 100%;
    max-width: none;
  }
}

@media (max-width: 700px) {
  .prepaid-pricing-header {
    flex-direction: column;
  }

  .prepaid-pricing-grid {
    grid-template-columns: 1fr;
  }

  .pricing-actions button {
    width: 100%;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-header .btn-primary {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .filter-card {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    width: 100%;
  }

  .filter-card .btn-secondary {
    width: 100%;
  }

  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .rows-per-page,
  .pagination-controls {
    justify-content: center;
  }
}
</style>
