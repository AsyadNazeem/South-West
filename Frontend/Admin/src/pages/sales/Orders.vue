<script setup>
import { computed, onMounted, ref } from 'vue'
import orderApi from '../../api/orderApi'

// Base path of the order pages (change here if your routes differ)
const ORDER_BASE = '/admin/sales/orders'

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'partially_shipped', label: 'Partially Shipped' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' }
]

const paymentStatuses = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially Refunded' }
]

// ==========================================
// State
// ==========================================

const orders = ref([])
const loading = ref(false)
const error = ref('')

const search = ref('')
const statusFilter = ref('')
const paymentFilter = ref('')

// ==========================================
// Load
// ==========================================

const loadOrders = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await orderApi.getOrders()

    orders.value = response.data || []
  } catch (err) {
    console.error('Failed to load orders:', err)

    error.value =
        err.response?.data?.message ||
        'Failed to load orders.'
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)

// ==========================================
// Search & Filters
// ==========================================

const filteredOrders = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return orders.value.filter(order => {
    const matchesSearch =
        !keyword ||
        [
          order.order_number,
          order.customer?.name
        ].some(value =>
            String(value || '').toLowerCase().includes(keyword)
        )

    const matchesStatus =
        !statusFilter.value ||
        order.status === statusFilter.value

    const matchesPayment =
        !paymentFilter.value ||
        order.payment_status === paymentFilter.value

    return matchesSearch && matchesStatus && matchesPayment
  })
})

const resetFilters = () => {
  search.value = ''
  statusFilter.value = ''
  paymentFilter.value = ''
}

// ==========================================
// Formatting
// ==========================================

const formatDate = (date) => {
  if (!date) return '-'

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleDateString('en-GB')
}

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatStatus = (status) => {
  if (!status) return '-'

  return status
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
}

const formatType = (type) => {
  if (!type) return '-'

  return type.toUpperCase()
}
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Orders</h1>

        <p>Manage customer orders and order status.</p>
      </div>

      <router-link
          :to="`${ORDER_BASE}/create`"
          class="primary-button"
      >
        + Create Order
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
          @click="loadOrders"
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
            placeholder="Search order number, customer..."
        />
      </div>

      <select v-model="statusFilter">
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

      <select v-model="paymentFilter">
        <option value="">
          All Payments
        </option>

        <option
            v-for="payment in paymentStatuses"
            :key="payment.value"
            :value="payment.value"
        >
          {{ payment.label }}
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
        Loading orders...
      </div>


      <!-- Empty -->
      <div
          v-else-if="filteredOrders.length === 0"
          class="empty-state"
      >
        <strong>No orders found</strong>

        <span>There are no orders matching your search.</span>

        <router-link
            :to="`${ORDER_BASE}/create`"
            class="primary-button"
        >
          Create Order
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
            <th>Order No.</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
          </thead>

          <tbody>

          <tr
              v-for="(order, index) in filteredOrders"
              :key="order.id"
              :class="{ 'row-cancelled': order.status === 'cancelled' }"
          >

            <td>{{ index + 1 }}</td>

            <!-- Order Number -->
            <td>
              <strong>{{ order.order_number }}</strong>
            </td>

            <!-- Date -->
            <td class="nowrap">{{ formatDate(order.order_date) }}</td>

            <!-- Customer -->
            <td>{{ order.customer?.name || 'Walk-in Customer' }}</td>

            <!-- Type -->
            <td>
              <span class="type-badge">
                {{ formatType(order.order_type) }}
              </span>
            </td>

            <!-- Status -->
            <td>
              <span
                  class="status-badge"
                  :class="`status-${order.status}`"
              >
                {{ formatStatus(order.status) }}
              </span>
            </td>

            <!-- Payment -->
            <td>
              <span
                  class="status-badge"
                  :class="`payment-${order.payment_status}`"
              >
                {{ formatStatus(order.payment_status) }}
              </span>
            </td>

            <!-- Total -->
            <td class="nowrap">
              <strong>Rs. {{ formatAmount(order.total_amount) }}</strong>
            </td>

            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <!-- View -->
                <router-link
                    :to="`${ORDER_BASE}/${order.id}`"
                    class="action-button"
                >
                  View
                </router-link>

                <!-- Edit -->
                <router-link
                    :to="`${ORDER_BASE}/edit/${order.id}`"
                    class="action-button edit"
                >
                  Edit
                </router-link>

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

.action-button.edit:hover:not(:disabled) {
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

/* Cancelled orders are dimmed but still readable */
tbody tr.row-cancelled td:not(:last-child) {
  opacity: 0.6;
}

.nowrap {
  white-space: nowrap;
}

/* =========================
   Badges
   ========================= */

.type-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.type-badge {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* Neutral / in progress */
.status-pending,
.payment-partially_paid,
.payment-partially_refunded {
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning, #92400e);
}

.status-confirmed,
.status-processing,
.status-partially_shipped,
.status-shipped,
.payment-refunded {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

/* Success */
.status-delivered,
.payment-paid {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* Problem */
.status-cancelled,
.status-returned,
.payment-unpaid {
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
