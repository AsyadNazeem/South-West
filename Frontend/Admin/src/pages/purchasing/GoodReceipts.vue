<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../../api/axios.js'
import {
  hasPermission,
  ensureAuthorization
} from '../../auth/authorization.js'

// Base paths of the goods receipt pages (change here if your routes differ)
const GOODS_RECEIPT_BASE = '/admin/purchasing/goods-receipts'
const PURCHASE_ORDER_BASE = '/purchase-orders'

const API_PATH = '/goods-receipts'

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' }
]

// ==========================================
// State
// ==========================================

const goodsReceipts = ref([])
const loading = ref(false)
const error = ref('')

const search = ref('')
const statusFilter = ref('')

// "<action>-<id>" of the request currently running
const busyKey = ref(null)

const isBusy = (action, receipt) => busyKey.value === `${action}-${receipt.id}`

// ==========================================
// Load
// ==========================================

const fetchGoodsReceipts = async () => {
  loading.value = true
  error.value = ''

  try {
    const params = {}

    if (statusFilter.value) {
      params.status = statusFilter.value
    }

    const response = await api.get(API_PATH, { params })

    goodsReceipts.value = response.data.data || []
  } catch (err) {
    console.error('Failed to load goods receipts:', err)

    error.value =
        err.response?.data?.message ||
        'Failed to load goods receipts.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Wait for the user's permissions before showing permission-based buttons
  try {
    await ensureAuthorization()
  } catch (err) {
    console.error('Failed to load authorization:', err)
  }

  fetchGoodsReceipts()
})

// ==========================================
// Search
// ==========================================

const filteredGoodsReceipts = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  if (!keyword) {
    return goodsReceipts.value
  }

  return goodsReceipts.value.filter(receipt =>
      [
        receipt.receipt_number,
        receipt.purchaseOrder?.po_number,
        receipt.supplier?.name,
        receipt.purchaseOrder?.supplier?.name,
        receipt.location?.name,
        receipt.supplier_delivery_note
      ].some(value =>
          String(value || '').toLowerCase().includes(keyword)
      )
  )
})

const resetFilters = () => {
  search.value = ''
  statusFilter.value = ''

  fetchGoodsReceipts()
}

// ==========================================
// Formatting
// ==========================================

const getStatusLabel = (status) =>
    statuses.find(item => item.value === status)?.label || status || '-'

const formatDate = (date) => {
  if (!date) return '-'

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleDateString('en-GB')
}

// ==========================================
// Actions
// ==========================================

const runAction = async (action, receipt, confirmMessage, request, fallback) => {
  if (!window.confirm(confirmMessage)) return

  busyKey.value = `${action}-${receipt.id}`
  error.value = ''

  try {
    await request()

    await fetchGoodsReceipts()
  } catch (err) {
    console.error(fallback, err)

    error.value = err.response?.data?.message || fallback
  } finally {
    busyKey.value = null
  }
}

const receiveGoodsReceipt = (receipt) =>
    runAction(
        'receive',
        receipt,
        `Are you sure you want to receive ${receipt.receipt_number}?`,
        () => api.post(`${API_PATH}/${receipt.id}/receive`),
        'Failed to receive goods receipt.'
    )

const cancelGoodsReceipt = (receipt) =>
    runAction(
        'cancel',
        receipt,
        `Are you sure you want to cancel ${receipt.receipt_number}?`,
        () => api.post(`${API_PATH}/${receipt.id}/cancel`),
        'Failed to cancel goods receipt.'
    )

// Moves a cancelled receipt back to draft
const activateGoodsReceipt = (receipt) =>
    runAction(
        'activate',
        receipt,
        `Reactivate ${receipt.receipt_number}? It will return to Draft.`,
        () => api.post(`${API_PATH}/${receipt.id}/activate`),
        'Failed to activate goods receipt.'
    )

const deleteGoodsReceipt = (receipt) =>
    runAction(
        'delete',
        receipt,
        `Are you sure you want to delete ${receipt.receipt_number}?`,
        () => api.delete(`${API_PATH}/${receipt.id}`),
        'Failed to delete goods receipt.'
    )
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Goods Receipts</h1>

        <p>Manage goods received from suppliers.</p>
      </div>

      <router-link
          v-if="hasPermission('products.create')"
          :to="`${GOODS_RECEIPT_BASE}/create`"
          class="primary-button"
      >
        + New Goods Receipt
      </router-link>

    </div>


    <!-- Error -->
    <div
        v-if="error"
        class="error-state"
    >
      <span>{{ error }}</span>

      <button
          type="button"
          class="action-button"
          @click="fetchGoodsReceipts"
      >
        Try Again
      </button>
    </div>


    <!-- Filters -->
    <div class="filter-card">

      <div class="search-box">
        <input
            v-model="search"
            type="text"
            placeholder="Search receipt, PO, supplier, location..."
        />
      </div>

      <select
          v-model="statusFilter"
          @change="fetchGoodsReceipts"
      >
        <option value="">
          All Statuses
        </option>

        <option
            v-for="status in statuses"
            :key="status.value"
            :value="status.value"
        >
          {{ status.label }}
        </option>
      </select>

      <button
          type="button"
          class="action-button refresh"
          :disabled="loading"
          @click="resetFilters"
      >
        Reset
      </button>

    </div>


    <!-- Table -->
    <div class="table-card">

      <!-- Loading -->
      <div
          v-if="loading"
          class="empty-state"
      >
        Loading goods receipts...
      </div>


      <!-- Empty -->
      <div
          v-else-if="filteredGoodsReceipts.length === 0"
          class="empty-state"
      >
        <strong>No goods receipts found</strong>

        <span>There are no goods receipts matching your search.</span>

        <router-link
            v-if="hasPermission('products.create')"
            :to="`${GOODS_RECEIPT_BASE}/create`"
            class="primary-button"
        >
          Create Goods Receipt
        </router-link>
      </div>


      <!-- Table -->
      <div
          v-else
          class="table-container"
      >

        <table>

          <thead>
          <tr>
            <th>#</th>
            <th>Receipt No.</th>
            <th>Purchase Order</th>
            <th>Supplier</th>
            <th>Location</th>
            <th>Receipt Date</th>
            <th>Delivery Note</th>
            <th>Items</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
          </thead>

          <tbody>

          <tr
              v-for="(receipt, index) in filteredGoodsReceipts"
              :key="receipt.id"
              :class="{ 'row-cancelled': receipt.status === 'cancelled' }"
          >

            <td>{{ index + 1 }}</td>

            <!-- Receipt Number -->
            <td>
              <strong>{{ receipt.receipt_number }}</strong>
            </td>

            <!-- Purchase Order -->
            <td>
              <router-link
                  v-if="receipt.purchaseOrder?.id"
                  :to="`${PURCHASE_ORDER_BASE}/${receipt.purchaseOrder.id}`"
                  class="table-link"
              >
                {{ receipt.purchaseOrder.po_number }}
              </router-link>

              <span v-else>-</span>
            </td>

            <!-- Supplier -->
            <td>
              {{
                receipt.supplier?.name ||
                receipt.purchaseOrder?.supplier?.name ||
                '-'
              }}
            </td>

            <!-- Location -->
            <td>{{ receipt.location?.name || '-' }}</td>

            <!-- Receipt Date -->
            <td class="nowrap">{{ formatDate(receipt.receipt_date) }}</td>

            <!-- Delivery Note -->
            <td>{{ receipt.supplier_delivery_note || '-' }}</td>

            <!-- Items -->
            <td>{{ receipt.items?.length || 0 }}</td>

            <!-- Status -->
            <td>
              <span
                  class="status-badge"
                  :class="receipt.status"
              >
                {{ getStatusLabel(receipt.status) }}
              </span>
            </td>

            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <!-- View -->
                <router-link
                    :to="`${GOODS_RECEIPT_BASE}/${receipt.id}`"
                    class="action-button"
                >
                  View
                </router-link>

                <!-- Edit (drafts only) -->
                <router-link
                    v-if="
                      receipt.status === 'draft' &&
                      hasPermission('products.update')
                    "
                    :to="`${GOODS_RECEIPT_BASE}/edit/${receipt.id}`"
                    class="action-button edit"
                >
                  Edit
                </router-link>

                <!-- Receive -->
                <button
                    v-if="
                      receipt.status === 'draft' &&
                      hasPermission('products.update')
                    "
                    type="button"
                    class="action-button receive"
                    :disabled="isBusy('receive', receipt)"
                    @click="receiveGoodsReceipt(receipt)"
                >
                  {{ isBusy('receive', receipt) ? 'Receiving...' : 'Receive' }}
                </button>

                <!-- Activate (cancelled receipts) -->
                <button
                    v-if="
                      receipt.status === 'cancelled' &&
                      hasPermission('products.update')
                    "
                    type="button"
                    class="action-button receive"
                    :disabled="isBusy('activate', receipt)"
                    @click="activateGoodsReceipt(receipt)"
                >
                  {{ isBusy('activate', receipt) ? 'Activating...' : 'Activate' }}
                </button>

                <!-- Cancel -->
                <button
                    v-if="
                      receipt.status === 'draft' &&
                      hasPermission('products.update')
                    "
                    type="button"
                    class="action-button delete"
                    :disabled="isBusy('cancel', receipt)"
                    @click="cancelGoodsReceipt(receipt)"
                >
                  {{ isBusy('cancel', receipt) ? 'Cancelling...' : 'Cancel' }}
                </button>

                <!-- Delete -->
                <button
                    v-if="
                      receipt.status === 'draft' &&
                      hasPermission('products.delete')
                    "
                    type="button"
                    class="action-button delete"
                    :disabled="isBusy('delete', receipt)"
                    @click="deleteGoodsReceipt(receipt)"
                >
                  {{ isBusy('delete', receipt) ? 'Deleting...' : 'Delete' }}
                </button>

              </div>

            </td>

          </tr>

          </tbody>

        </table>

      </div>

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
  flex-wrap: wrap;
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
  transition:
      background var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);
}

.action-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.action-button.edit:hover:not(:disabled),
.action-button.receive:hover:not(:disabled) {
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

/* =========================
   Filters
   ========================= */

.filter-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.search-box {
  flex: 1;
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
  transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
}

.search-box input {
  width: 100%;
  padding: 0 var(--spacing-lg);
}

.search-box input::placeholder {
  color: var(--color-text-muted);
}

.filter-card select {
  min-width: 160px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-box input:focus,
.filter-card select:focus {
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

.table-container {
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

/* Cancelled receipts are dimmed but still readable */
tbody tr.row-cancelled td:not(:last-child) {
  opacity: 0.6;
}

.nowrap {
  white-space: nowrap;
}

.table-link {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.table-link:hover {
  text-decoration: underline;
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
  white-space: nowrap;
}

.status-badge.draft {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.status-badge.received {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.cancelled {
  background: var(--color-danger-bg);
  color: var(--color-danger);
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

.empty-state .primary-button {
  margin-top: var(--spacing-md);
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
}
</style>
