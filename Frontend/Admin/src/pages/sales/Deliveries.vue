<script setup>
import {computed, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'

import deliveryApi from '@/api/deliveryApi'
import {hasPermission} from '@/auth/authorization.js'

const router = useRouter()

const DETAIL_ROUTE = '/admin/sales/deliveries'

const deliveries = ref([])
const loading = ref(false)
const error = ref('')

const search = ref('')
const statusFilter = ref('')
const methodFilter = ref('')

const deletingId = ref(null)

// ==========================================
// Permissions
// ==========================================

const canUpdate = computed(() =>
    hasPermission('deliveries.update')
)

const canDelete = computed(() =>
    hasPermission('deliveries.delete')
)

// ==========================================
// Load Deliveries
// ==========================================

const loadDeliveries = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await deliveryApi.getDeliveries()

    deliveries.value =
        response?.data?.data ||
        response?.data ||
        []

  } catch (err) {
    console.error('Failed to load deliveries:', err)

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load deliveries.'
  } finally {
    loading.value = false
  }
}

// ==========================================
// Filtered Deliveries
// ==========================================

const filteredDeliveries = computed(() => {
  const keyword = search.value
      .trim()
      .toLowerCase()

  return deliveries.value.filter(delivery => {
    const orderNumber =
        delivery.order?.order_number ||
        ''

    const deliveryReference =
        delivery.delivery_reference ||
        ''

    const recipientName =
        delivery.recipient_name ||
        ''

    const recipientPhone =
        delivery.recipient_phone ||
        ''

    const trackingNumber =
        delivery.tracking_number ||
        ''

    const courierName =
        delivery.courier_name ||
        ''

    const matchesSearch =
        !keyword ||
        deliveryReference
            .toLowerCase()
            .includes(keyword) ||
        orderNumber
            .toLowerCase()
            .includes(keyword) ||
        recipientName
            .toLowerCase()
            .includes(keyword) ||
        recipientPhone
            .toLowerCase()
            .includes(keyword) ||
        trackingNumber
            .toLowerCase()
            .includes(keyword) ||
        courierName
            .toLowerCase()
            .includes(keyword)

    const matchesStatus =
        !statusFilter.value ||
        delivery.delivery_status ===
        statusFilter.value

    const matchesMethod =
        !methodFilter.value ||
        delivery.delivery_method ===
        methodFilter.value

    return (
        matchesSearch &&
        matchesStatus &&
        matchesMethod
    )
  })
})

// ==========================================
// Statistics
// ==========================================

const totalDeliveries = computed(() =>
    deliveries.value.length
)

const pendingDeliveries = computed(() =>
    deliveries.value.filter(
        delivery =>
            delivery.delivery_status === 'pending'
    ).length
)

const inTransitDeliveries = computed(() =>
    deliveries.value.filter(
        delivery =>
            [
              'dispatched',
              'in_transit',
              'out_for_delivery'
            ].includes(delivery.delivery_status)
    ).length
)

const deliveredDeliveries = computed(() =>
    deliveries.value.filter(
        delivery =>
            delivery.delivery_status === 'delivered'
    ).length
)

// ==========================================
// Status
// ==========================================

const formatStatus = status => {
  if (!status) {
    return '-'
  }

  return status
      .replaceAll('_', ' ')
      .replace(
          /\b\w/g,
          char => char.toUpperCase()
      )
}

const getStatusClass = status => {
  return {
    pending: 'status-pending',
    processing: 'status-processing',
    ready_for_dispatch: 'status-ready',
    dispatched: 'status-dispatched',
    in_transit: 'status-transit',
    out_for_delivery: 'status-out',
    delivered: 'status-delivered',
    failed: 'status-failed',
    cancelled: 'status-cancelled',
    returned: 'status-returned'
  }[status] || 'status-default'
}

// ==========================================
// Delivery Method
// ==========================================

const formatMethod = method => {
  if (!method) {
    return '-'
  }

  return method
      .replaceAll('_', ' ')
      .replace(
          /\b\w/g,
          char => char.toUpperCase()
      )
}

// ==========================================
// Date Formatting
// ==========================================

const formatDate = date => {
  if (!date) {
    return '-'
  }

  return new Date(date).toLocaleDateString(
      'en-LK',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
  )
}

// ==========================================
// Date + Time Formatting
// ==========================================

const formatDateTime = date => {
  if (!date) {
    return '-'
  }

  return new Date(date).toLocaleString(
      'en-LK',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
  )
}

// ==========================================
// Currency
// ==========================================

const formatAmount = amount => {
  return Number(amount || 0).toLocaleString(
      'en-LK',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
  )
}

// ==========================================
// Navigation
// ==========================================

const viewDelivery = id => {
  router.push(`${DETAIL_ROUTE}/${id}`)
}

const editDelivery = id => {
  router.push(`${DETAIL_ROUTE}/edit/${id}`)
}

// ==========================================
// Delete
// ==========================================

const deleteDelivery = async delivery => {
  if (!canDelete.value) {
    return
  }

  const confirmed = window.confirm(
      `Are you sure you want to delete delivery "${delivery.delivery_reference}"?`
  )

  if (!confirmed) {
    return
  }

  deletingId.value = delivery.id

  try {
    await deliveryApi.deleteDelivery(
        delivery.id
    )

    deliveries.value =
        deliveries.value.filter(
            item => item.id !== delivery.id
        )

  } catch (err) {
    console.error(
        'Failed to delete delivery:',
        err
    )

    error.value =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete delivery.'
  } finally {
    deletingId.value = null
  }
}

// ==========================================
// Reset Filters
// ==========================================

const resetFilters = () => {
  search.value = ''
  statusFilter.value = ''
  methodFilter.value = ''
}

// ==========================================
// Initial Load
// ==========================================

onMounted(() => {
  loadDeliveries()
})
</script>

<template>
  <div class="delivery-list-page">

    <!-- Header -->

    <div class="page-header">

      <div>
        <h1>Deliveries</h1>

        <p>
          Manage order deliveries, tracking,
          couriers and delivery status.
        </p>
      </div>

    </div>

    <!-- Error -->

    <div
        v-if="error"
        class="error-message"
    >
      {{ error }}
    </div>

    <!-- Statistics -->

    <div class="stats-grid">

      <div class="stat-card">

        <div class="stat-label">
          Total Deliveries
        </div>

        <div class="stat-value">
          {{ totalDeliveries }}
        </div>

      </div>

      <div class="stat-card">

        <div class="stat-label">
          Pending
        </div>

        <div class="stat-value">
          {{ pendingDeliveries }}
        </div>

      </div>

      <div class="stat-card">

        <div class="stat-label">
          In Transit
        </div>

        <div class="stat-value">
          {{ inTransitDeliveries }}
        </div>

      </div>

      <div class="stat-card">

        <div class="stat-label">
          Delivered
        </div>

        <div class="stat-value">
          {{ deliveredDeliveries }}
        </div>

      </div>

    </div>

    <!-- Filters -->

    <div class="filter-card">

      <div class="filter-row">

        <!-- Search -->

        <div class="search-wrapper">

          <input
              v-model="search"
              type="text"
              placeholder="Search delivery, order, recipient, tracking..."
              class="search-input"
          />

        </div>

        <!-- Status -->

        <select
            v-model="statusFilter"
            class="filter-select"
        >

          <option value="">
            All Statuses
          </option>

          <option value="pending">
            Pending
          </option>

          <option value="processing">
            Processing
          </option>

          <option value="ready_for_dispatch">
            Ready for Dispatch
          </option>

          <option value="dispatched">
            Dispatched
          </option>

          <option value="in_transit">
            In Transit
          </option>

          <option value="out_for_delivery">
            Out for Delivery
          </option>

          <option value="delivered">
            Delivered
          </option>

          <option value="failed">
            Failed
          </option>

          <option value="cancelled">
            Cancelled
          </option>

          <option value="returned">
            Returned
          </option>

        </select>

        <!-- Method -->

        <select
            v-model="methodFilter"
            class="filter-select"
        >

          <option value="">
            All Methods
          </option>

          <option value="standard">
            Standard
          </option>

          <option value="express">
            Express
          </option>

          <option value="pickup">
            Pickup
          </option>

          <option value="courier">
            Courier
          </option>

        </select>

        <button
            type="button"
            class="btn-reset"
            @click="resetFilters"
        >
          Reset
        </button>

      </div>

    </div>

    <!-- Table -->

    <div class="table-card">

      <div
          v-if="loading"
          class="loading-state"
      >
        Loading deliveries...
      </div>

      <div
          v-else-if="filteredDeliveries.length === 0"
          class="empty-state"
      >
        <div class="empty-title">
          No deliveries found
        </div>

        <div class="empty-text">
          {{
            search ||
            statusFilter ||
            methodFilter
                ? 'Try changing your search or filters.'
                : 'No deliveries have been created yet.'
          }}
        </div>
      </div>

      <div
          v-else
          class="table-wrapper"
      >

        <table>

          <thead>

          <tr>

            <th>
              Delivery
            </th>

            <th>
              Order
            </th>

            <th>
              Recipient
            </th>

            <th>
              Method
            </th>

            <th>
              Courier
            </th>

            <th>
              Expected
            </th>

            <th>
              Delivery Charge
            </th>

            <th>
              Status
            </th>

            <th class="actions-column">
              Actions
            </th>

          </tr>

          </thead>

          <tbody>

          <tr
              v-for="delivery in filteredDeliveries"
              :key="delivery.id"
          >

            <!-- Delivery -->

            <td>

              <div class="primary-text">
                {{
                  delivery.delivery_reference
                }}
              </div>

              <div class="secondary-text">
                ID #{{ delivery.id }}
              </div>

            </td>

            <!-- Order -->

            <td>

              <div
                  v-if="delivery.order"
                  class="primary-text"
              >
                {{
                  delivery.order.order_number
                }}
              </div>

              <div
                  v-else
                  class="secondary-text"
              >
                Order #{{ delivery.order_id }}
              </div>

            </td>

            <!-- Recipient -->

            <td>

              <div class="primary-text">
                {{
                  delivery.recipient_name
                }}
              </div>

              <div
                  v-if="delivery.recipient_phone"
                  class="secondary-text"
              >
                {{
                  delivery.recipient_phone
                }}
              </div>

              <div class="secondary-text">
                {{
                  delivery.city
                }},
                {{
                  delivery.country
                }}
              </div>

            </td>

            <!-- Method -->

            <td>

                                <span class="method-badge">
                                    {{
                                    formatMethod(
                                        delivery.delivery_method
                                    )
                                  }}
                                </span>

            </td>

            <!-- Courier -->

            <td>

              <div
                  v-if="delivery.courier_name"
                  class="primary-text"
              >
                {{
                  delivery.courier_name
                }}
              </div>

              <div
                  v-else
                  class="secondary-text"
              >
                Not assigned
              </div>

              <div
                  v-if="delivery.tracking_number"
                  class="tracking-number"
              >
                {{
                  delivery.tracking_number
                }}
              </div>

            </td>

            <!-- Expected Date -->

            <td>

              <div
                  v-if="delivery.expected_delivery_date"
                  class="date-text"
              >
                {{
                  formatDate(
                      delivery.expected_delivery_date
                  )
                }}
              </div>

              <div
                  v-else
                  class="secondary-text"
              >
                -
              </div>

            </td>

            <!-- Delivery Charge -->

            <td>

              <div class="amount-text">
                Rs.
                {{
                  formatAmount(
                      delivery.delivery_charge
                  )
                }}
              </div>

            </td>

            <!-- Status -->

            <td>

                                <span
                                    class="status-badge"
                                    :class="
                                        getStatusClass(
                                            delivery.delivery_status
                                        )
                                    "
                                >
                                    {{
                                    formatStatus(
                                        delivery.delivery_status
                                    )
                                  }}
                                </span>

            </td>

            <!-- Actions -->

            <td class="actions-column">

              <div class="action-buttons">

                <!-- View -->

                <button
                    v-if="hasPermission('deliveries.view')"
                    type="button"
                    class="action-button view"
                    @click="
                                            viewDelivery(
                                                delivery.id
                                            )
                                        "
                >
                  View
                </button>

                <!-- Edit -->

                <button
                    v-if="canUpdate"
                    type="button"
                    class="action-button edit"
                    @click="
                                            editDelivery(
                                                delivery.id
                                            )
                                        "
                >
                  Edit
                </button>

                <!-- Delete -->

                <button
                    v-if="canDelete"
                    type="button"
                    class="action-button delete"
                    :disabled="
                                            deletingId ===
                                            delivery.id
                                        "
                    @click="
                                            deleteDelivery(
                                                delivery
                                            )
                                        "
                >
                  {{
                    deletingId ===
                    delivery.id
                        ? 'Deleting...'
                        : 'Delete'
                  }}
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
.delivery-list-page {
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
.btn-secondary,
.btn-reset {
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

.btn-secondary,
.btn-reset {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled),
.btn-reset:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled,
.btn-reset:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Statistics
   ========================= */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
  white-space: nowrap;
}

/* =========================
   Filters
   ========================= */

.filter-card {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.search-wrapper {
  flex: 1;
  max-width: 420px;
}

.search-input,
.filter-select {
  width: 100%;
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

.search-input {
  padding: 0 var(--spacing-lg);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.filter-select {
  width: 190px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-input:focus,
.filter-select:focus {
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
   Text
   ========================= */

.primary-text {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.secondary-text {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.date-text {
  white-space: nowrap;
  color: var(--color-text-secondary);
}

.amount-text {
  white-space: nowrap;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.tracking-number {
  margin-top: 4px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

/* =========================
   Method
   ========================= */

.method-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
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

.status-pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status-processing,
.status-out {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status-ready,
.status-dispatched,
.status-transit {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.status-delivered {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-failed,
.status-returned {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.status-cancelled,
.status-default {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* =========================
   Actions
   ========================= */

.actions-column {
  min-width: 210px;
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
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button.view:hover:not(:disabled) {
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

/* =========================
   States
   ========================= */

.loading-state,
.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-title {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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
   Responsive
   ========================= */

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-row {
    flex-wrap: wrap;
  }

  .search-wrapper {
    flex: 1 1 100%;
    max-width: none;
  }

  .filter-select {
    flex: 1;
    width: auto;
  }
}

@media (max-width: 768px) {
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

  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrapper,
  .filter-select,
  .btn-reset {
    width: 100%;
  }

  .actions-column {
    min-width: 180px;
  }
}
</style>
