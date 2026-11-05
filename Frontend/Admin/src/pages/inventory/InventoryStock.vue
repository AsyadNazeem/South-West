<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/api/axios'
import {
  hasPermission as authorization,
  ensureAuthorization
} from '@/auth/authorization.js'

// Base path of the inventory stock pages in your router
const STOCK_BASE = '/admin/inventory/stock'

// Start with every item open when there are only a few
const AUTO_EXPAND_LIMIT = 10

const stocks = ref([])
const loading = ref(true)
const errorMessage = ref('')
const actionError = ref('')
const forbidden = ref(false)
const deletingId = ref(null)

const search = ref('')
const statusFilter = ref('all')
const levelFilter = ref('all')

// Keys of the item groups that are open
const expanded = ref(new Set())

const showActions = computed(() =>
    authorization('inventory.update') ||
    authorization('inventory.delete')
)

/*
|--------------------------------------------------------------------------
| Stock helpers
|--------------------------------------------------------------------------
*/

const getAvailableQuantity = (stock) =>
    Number(stock.quantity_on_hand || 0) -
    Number(stock.quantity_reserved || 0)

// 'out' | 'low' | 'ok'
const getStockLevel = (stock) => {
  const available = getAvailableQuantity(stock)
  const reorderLevel = Number(stock.reorder_level || 0)

  if (available <= 0) return 'out'

  if (reorderLevel > 0 && available <= reorderLevel) return 'low'

  return 'ok'
}

const getStockStatusClass = (stock) => {
  const level = getStockLevel(stock)

  if (level === 'out') return 'out-of-stock'
  if (level === 'low') return 'low-stock'

  return 'in-stock'
}

const formatQuantity = (quantity) => {
  const value = Number(quantity || 0)

  return Number.isInteger(value) ? value.toString() : value.toFixed(3)
}

/*
|--------------------------------------------------------------------------
| Filtering and grouping
|--------------------------------------------------------------------------
*/

const filteredStocks = computed(() => {
  const term = search.value.toLowerCase().trim()

  return stocks.value.filter((stock) => {
    const matchesSearch =
        !term ||
        String(stock.item?.item_code || '').toLowerCase().includes(term) ||
        String(stock.item?.item_name || '').toLowerCase().includes(term) ||
        String(stock.variant?.variant_sku || '').toLowerCase().includes(term) ||
        String(stock.variant?.variant_name || '').toLowerCase().includes(term) ||
        String(stock.location?.code || '').toLowerCase().includes(term) ||
        String(stock.location?.name || '').toLowerCase().includes(term)

    const matchesStatus =
        statusFilter.value === 'all' ||
        (statusFilter.value === 'active' && stock.is_active) ||
        (statusFilter.value === 'inactive' && !stock.is_active)

    const matchesLevel =
        levelFilter.value === 'all' ||
        getStockLevel(stock) === levelFilter.value

    return matchesSearch && matchesStatus && matchesLevel
  })
})

// One group per item, with its stock records and totals
const groupedStocks = computed(() => {
  const map = new Map()

  for (const stock of filteredStocks.value) {
    const itemId = stock.item_id ?? stock.item?.id ?? null
    const key = itemId ?? `unknown-${stock.id}`

    if (!map.has(key)) {
      map.set(key, { key, itemId, item: stock.item || null, rows: [] })
    }

    map.get(key).rows.push(stock)
  }

  return [...map.values()]
      .map((group) => {
        const rows = [...group.rows].sort((a, b) =>
            String(a.variant?.variant_sku || '').localeCompare(
                String(b.variant?.variant_sku || ''),
                undefined,
                { numeric: true }
            ) ||
            String(a.location?.code || '').localeCompare(
                String(b.location?.code || ''),
                undefined,
                { numeric: true }
            )
        )

        return {
          ...group,
          rows,
          onHand: rows.reduce((sum, row) => sum + Number(row.quantity_on_hand || 0), 0),
          reserved: rows.reduce((sum, row) => sum + Number(row.quantity_reserved || 0), 0),
          available: rows.reduce((sum, row) => sum + getAvailableQuantity(row), 0),
          lowCount: rows.filter(row => getStockLevel(row) === 'low').length,
          outCount: rows.filter(row => getStockLevel(row) === 'out').length
        }
      })
      .sort((a, b) =>
          String(a.item?.item_code || '').localeCompare(
              String(b.item?.item_code || ''),
              undefined,
              { numeric: true }
          )
      )
})

/*
|--------------------------------------------------------------------------
| Open / close groups
|--------------------------------------------------------------------------
*/

const isExpanded = (group) => expanded.value.has(group.key)

const toggleGroup = (group) => {
  const next = new Set(expanded.value)

  if (next.has(group.key)) {
    next.delete(group.key)
  } else {
    next.add(group.key)
  }

  expanded.value = next
}

const allExpanded = computed(() =>
    groupedStocks.value.length > 0 &&
    groupedStocks.value.every(group => expanded.value.has(group.key))
)

const toggleAll = () => {
  expanded.value = allExpanded.value
      ? new Set()
      : new Set(groupedStocks.value.map(group => group.key))
}

// Searching opens every matching item so the results are visible
watch(search, (term) => {
  if (term.trim()) {
    expanded.value = new Set(groupedStocks.value.map(group => group.key))
  }
})

/*
|--------------------------------------------------------------------------
| Load and delete
|--------------------------------------------------------------------------
*/

const loadStocks = async () => {
  try {
    loading.value = true
    errorMessage.value = ''
    actionError.value = ''

    const response = await api.get('/inventory-stock')

    stocks.value = response.data.data || []

    if (groupedStocks.value.length <= AUTO_EXPAND_LIMIT) {
      expanded.value = new Set(groupedStocks.value.map(group => group.key))
    }
  } catch (error) {
    console.error('Failed to load inventory stock:', error)

    const status = error.response?.status

    errorMessage.value =
        error.response?.data?.message ||
        (status === 404
            ? 'Inventory stock endpoint not found (404). Check that the backend mounts /api/inventory-stock.'
            : 'Failed to load inventory stock.')
  } finally {
    loading.value = false
  }
}

const deleteStock = async (stock) => {
  if (
      !confirm(
          `Are you sure you want to delete the stock record for "${stock.item?.item_name || 'this item'}"` +
          `${stock.variant?.variant_sku ? ` (${stock.variant.variant_sku})` : ''}` +
          ` at "${stock.location?.name || 'this location'}"?`
      )
  ) {
    return
  }

  try {
    deletingId.value = stock.id
    actionError.value = ''

    await api.delete(`/inventory-stock/${stock.id}`)

    stocks.value = stocks.value.filter(item => item.id !== stock.id)
  } catch (error) {
    console.error('Failed to delete inventory stock:', error)

    actionError.value =
        error.response?.data?.message ||
        'Failed to delete inventory stock.'
  } finally {
    deletingId.value = null
  }
}

onMounted(async () => {
  // Wait for the user's permissions before checking them
  try {
    await ensureAuthorization()
  } catch (error) {
    console.error('Failed to load authorization:', error)
  }

  if (!authorization('inventory.view')) {
    forbidden.value = true
    loading.value = false
    errorMessage.value =
        'You do not have permission to view inventory stock.'
    return
  }

  loadStocks()
})
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Inventory Stock</h1>

        <p>
          View and manage stock quantities across inventory locations, grouped by item.
        </p>
      </div>

      <router-link
          v-if="authorization('inventory.create')"
          :to="`${STOCK_BASE}/create`"
          class="primary-button"
      >
        + Add Stock
      </router-link>

    </div>


    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
        role="alert"
    >
      <span>{{ errorMessage }}</span>

      <button
          v-if="!forbidden"
          type="button"
          class="action-button"
          @click="loadStocks"
      >
        Try Again
      </button>
    </div>

    <div
        v-if="actionError"
        class="error-state"
        role="alert"
    >
      <span>{{ actionError }}</span>

      <button
          type="button"
          class="action-button"
          @click="actionError = ''"
      >
        Dismiss
      </button>
    </div>


    <template v-if="!forbidden">

      <!-- Filters -->
      <div class="filter-card">

        <div class="search-box">

          <input
              v-model="search"
              type="search"
              placeholder="Search item, variant or location..."
              aria-label="Search stock"
          />

        </div>


        <select v-model="statusFilter" aria-label="Filter by status">

          <option value="all">
            All Status
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>

        </select>


        <select v-model="levelFilter" aria-label="Filter by stock level">

          <option value="all">
            All Stock Levels
          </option>

          <option value="low">
            Low Stock
          </option>

          <option value="out">
            Out of Stock
          </option>

        </select>


        <button
            type="button"
            class="action-button refresh"
            :disabled="loading || !groupedStocks.length"
            @click="toggleAll"
        >
          {{ allExpanded ? 'Collapse All' : 'Expand All' }}
        </button>


        <button
            type="button"
            class="action-button refresh"
            :disabled="loading"
            @click="loadStocks"
        >
          Refresh
        </button>

      </div>


      <p
          v-if="!loading && groupedStocks.length"
          class="results-summary"
      >
        {{ groupedStocks.length }} item(s) · {{ filteredStocks.length }} stock record(s)
      </p>


      <!-- Loading -->
      <div
          v-if="loading"
          class="table-card"
          aria-busy="true"
      >
        <div class="empty-state">
          <span class="spinner" aria-hidden="true"></span>
          Loading inventory stock...
        </div>
      </div>


      <!-- Empty -->
      <div
          v-else-if="!groupedStocks.length"
          class="table-card"
      >
        <div class="empty-state">
          No inventory stock found.
        </div>
      </div>


      <!-- Items with their stock records -->
      <div
          v-else
          class="group-list"
      >

        <section
            v-for="group in groupedStocks"
            :key="group.key"
            class="item-group"
        >

          <!-- Item header -->
          <header class="group-header">

            <button
                type="button"
                class="group-toggle"
                :aria-expanded="isExpanded(group)"
                :aria-controls="`stock-group-${group.key}`"
                @click="toggleGroup(group)"
            >

              <svg
                  class="chevron"
                  :class="{ open: isExpanded(group) }"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
              >
                <path
                    d="m9 6 6 6-6 6"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
              </svg>

              <span class="group-title">

                <strong>
                  {{ group.item?.item_code || '-' }}
                </strong>

                <small>
                  {{ group.item?.item_name || 'Unknown Item' }}
                </small>

              </span>

            </button>


            <div class="group-summary">

              <span class="summary-pill">
                <em>Records</em>
                {{ group.rows.length }}
              </span>

              <span class="summary-pill">
                <em>On hand</em>
                {{ formatQuantity(group.onHand) }}
              </span>

              <span class="summary-pill">
                <em>Available</em>
                {{ formatQuantity(group.available) }}
              </span>

              <span
                  v-if="group.lowCount"
                  class="summary-pill low-stock"
              >
                {{ group.lowCount }} low
              </span>

              <span
                  v-if="group.outCount"
                  class="summary-pill out-of-stock"
              >
                {{ group.outCount }} out
              </span>

            </div>


            <div
                v-if="group.itemId"
                class="group-actions"
            >

              <router-link
                  v-if="authorization('inventory.create')"
                  :to="{ path: `${STOCK_BASE}/create`, query: { item_id: group.itemId } }"
                  class="action-button"
              >
                Add Stock
              </router-link>

              <router-link
                  v-if="authorization('inventory.update')"
                  :to="`${STOCK_BASE}/edit-item/${group.itemId}`"
                  class="action-button edit"
              >
                Bulk Edit
              </router-link>

            </div>

          </header>


          <!-- Stock records of this item -->
          <div
              v-if="isExpanded(group)"
              :id="`stock-group-${group.key}`"
              class="table-container"
          >

            <table>

              <thead>

              <tr>

                <th>Variant</th>

                <th>Location</th>

                <th>On Hand</th>

                <th>Reserved</th>

                <th>Available</th>

                <th>Reorder Level</th>

                <th>Status</th>

                <th v-if="showActions">Actions</th>

              </tr>

              </thead>


              <tbody>

              <tr
                  v-for="stock in group.rows"
                  :key="stock.id"
              >

                <!-- Variant -->
                <td data-label="Variant">

                  <div class="cell-info">

                    <strong>
                      {{ stock.variant?.variant_sku || 'No variant' }}
                    </strong>

                    <small v-if="stock.variant?.variant_name">
                      {{ stock.variant.variant_name }}
                    </small>

                  </div>

                </td>


                <!-- Location -->
                <td data-label="Location">

                  <div class="cell-info">

                    <strong>
                      {{ stock.location?.code || '-' }}
                    </strong>

                    <small>
                      {{ stock.location?.name || 'Unknown Location' }}
                    </small>

                  </div>

                </td>


                <td data-label="On Hand">

                  <strong>
                    {{ formatQuantity(stock.quantity_on_hand) }}
                  </strong>

                </td>


                <td data-label="Reserved">
                  {{ formatQuantity(stock.quantity_reserved) }}
                </td>


                <td data-label="Available">

                  <span
                      class="quantity-badge"
                      :class="getStockStatusClass(stock)"
                  >
                    {{ formatQuantity(getAvailableQuantity(stock)) }}
                  </span>

                </td>


                <td data-label="Reorder Level">
                  {{ formatQuantity(stock.reorder_level) }}
                </td>


                <td data-label="Status">

                  <span
                      class="status-badge"
                      :class="stock.is_active ? 'active' : 'inactive'"
                  >
                    {{ stock.is_active ? 'Active' : 'Inactive' }}
                  </span>

                </td>


                <td
                    v-if="showActions"
                    data-label="Actions"
                >

                  <div class="action-buttons">

                    <router-link
                        v-if="authorization('inventory.update')"
                        :to="`${STOCK_BASE}/edit/${stock.id}`"
                        class="action-button edit"
                    >
                      Edit
                    </router-link>


                    <button
                        v-if="authorization('inventory.delete')"
                        type="button"
                        class="action-button delete"
                        :disabled="deletingId === stock.id"
                        @click="deleteStock(stock)"
                    >
                      {{ deletingId === stock.id ? 'Deleting...' : 'Delete' }}
                    </button>

                  </div>

                </td>

              </tr>

              </tbody>

            </table>

          </div>

        </section>

      </div>

    </template>

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
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--transition-fast);
}

.primary-button:hover {
  background: var(--color-primary-hover);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.action-button {
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
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.action-button.edit:hover:not(:disabled) {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.action-button.delete:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
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

.action-button:focus-visible,
.primary-button:focus-visible,
.group-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* =========================
   Filters
   ========================= */

.filter-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.search-box {
  flex: 1;
  min-width: 0;
  max-width: 420px;
}

.search-box input,
.filter-card select {
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

.search-box input {
  width: 100%;
  box-sizing: border-box;
  padding: 0 var(--spacing-lg);
}

.search-box input::placeholder {
  color: var(--color-text-muted);
}

.filter-card select {
  min-width: 150px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-box input:focus,
.filter-card select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.results-summary {
  margin: 0 0 var(--spacing-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* =========================
   Item groups
   ========================= */

.group-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.item-group {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md) var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-hover-bg);
}

.group-toggle {
  display: flex;
  align-items: center;
  flex: 1 1 260px;
  gap: var(--spacing-md);
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.chevron {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
  transition: transform var(--transition-fast);
}

.chevron.open {
  transform: rotate(90deg);
}

.group-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.group-title strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.group-title small {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}

.group-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.summary-pill em {
  color: var(--color-text-secondary);
  font-style: normal;
  font-weight: var(--font-weight-regular, 400);
}

.summary-pill.low-stock {
  border-color: transparent;
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
}

.summary-pill.out-of-stock {
  border-color: transparent;
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.group-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.table-container {
  overflow-x: auto;
  border-top: 1px solid var(--color-border-light);
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
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
}

td {
  padding: 14px var(--spacing-lg);
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

.cell-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cell-info small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* =========================
   Badges
   ========================= */

.quantity-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.quantity-badge.in-stock,
.status-badge.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.quantity-badge.low-stock {
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
}

.quantity-badge.out-of-stock {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.status-badge.inactive {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* =========================
   States
   ========================= */

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

/* =========================
   Touch devices
   ========================= */

@media (pointer: coarse) {
  .action-button {
    min-height: 40px;
  }

  .search-box input,
  .filter-card select {
    height: 44px;
    font-size: 16px; /* stops iOS zooming into the field */
  }

  .group-toggle {
    min-height: 44px;
  }
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 900px) {
  .filter-card {
    flex-wrap: wrap;
  }

  .search-box {
    flex-basis: 100%;
    max-width: none;
  }
}

@media (max-width: 700px) {
  .page-header,
  .filter-card {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header {
    align-items: flex-start;
  }

  .filter-card select {
    width: 100%;
  }

  .error-state {
    flex-direction: column;
    align-items: flex-start;
  }

  .group-header {
    padding: var(--spacing-md);
  }

  .group-actions {
    width: 100%;
  }

  .group-actions .action-button {
    flex: 1;
    justify-content: center;
  }

  /* Stock records become stacked cards */
  .table-container {
    overflow-x: visible;
  }

  table,
  thead,
  tbody,
  tr,
  td {
    display: block;
  }

  thead {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  tbody tr {
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  tbody tr:last-child {
    border-bottom: none;
  }

  td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: 6px var(--spacing-md);
    border-bottom: none;
    text-align: right;
  }

  td::before {
    content: attr(data-label);
    flex-shrink: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .cell-info {
    align-items: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chevron,
  tbody tr {
    transition: none;
  }

  .spinner {
    animation-duration: 1.6s;
  }
}
</style>