<script setup>
import { computed, onMounted, ref } from 'vue'
import orderApi from '../../api/orderApi'

// Base path of the order pages (change here if your routes differ)
const ORDER_BASE = '/admin/sales/orders'

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Order Confirmed' },
  { value: 'processing', label: 'Order Ready to Deliver' },
  { value: 'partially_shipped', label: 'Partially Shipped' },
  { value: 'shipped', label: 'Order Handed Over to Courier' },
  { value: 'delivered', label: 'Order Completed' },
  { value: 'cancelled', label: 'Order Cancelled' },
  { value: 'returned', label: 'Order Returned' }
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

const savingOrderId = ref(null)
const statusDrafts = ref({})
const statusMessage = ref('')
const statusError = ref('')

const transitionMap = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  partially_shipped: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: []
}

const availableStatuses = (order) => {
  const allowed = transitionMap[order.status] || []

  return statuses.filter(status =>
    status.value === order.status || allowed.includes(status.value)
  )
}

const statusDialogOpen = ref(false)
const selectedOrder = ref(null)
const modalStatus = ref('')
const statusReason = ref('')
const courierName = ref('')
const trackingNumber = ref('')
const expectedDeliveryDate = ref('')

const resetStatusDialog = () => {
  statusDialogOpen.value = false
  selectedOrder.value = null
  modalStatus.value = ''
  statusReason.value = ''
  courierName.value = ''
  trackingNumber.value = ''
  expectedDeliveryDate.value = ''
}

const saveOrderStatus = (order) => {
  statusMessage.value = ''
  statusError.value = ''

  const nextStatus = statusDrafts.value[order.id] ?? order.status

  if (nextStatus === order.status) return

  const allowed = transitionMap[order.status] || []

  if (!allowed.includes(nextStatus)) {
    statusError.value = 'This status transition is not allowed.'
    statusDrafts.value[order.id] = order.status
    return
  }

  selectedOrder.value = order
  modalStatus.value = nextStatus
  statusReason.value = ''
  courierName.value = ''
  trackingNumber.value = ''
  expectedDeliveryDate.value = ''
  statusDialogOpen.value = true
}

const confirmOrderStatus = async () => {
  const order = selectedOrder.value
  if (!order) return

  statusMessage.value = ''
  statusError.value = ''

  const payload = { status: modalStatus.value }

  if (['cancelled', 'returned'].includes(modalStatus.value)) {
    if (!statusReason.value.trim()) {
      statusError.value = 'Enter a reason before continuing.'
      return
    }
    payload.reason = statusReason.value.trim()
  }

  if (modalStatus.value === 'shipped') {
    if (!courierName.value.trim() || !trackingNumber.value.trim()) {
      statusError.value = 'Courier name and tracking number are required.'
      return
    }

    payload.courier_name = courierName.value.trim()
    payload.tracking_number = trackingNumber.value.trim()

    if (expectedDeliveryDate.value) {
      payload.expected_delivery_date = expectedDeliveryDate.value
    }
  }

  savingOrderId.value = order.id

  try {
    const response = await orderApi.updateOrderStatus(order.id, payload)

    order.status = modalStatus.value
    statusDrafts.value[order.id] = modalStatus.value

    const emailStatus = response?.email_status

    statusMessage.value = emailStatus === 'failed'
      ? `Order ${order.order_number} updated, but the customer email failed.`
      : emailStatus === 'skipped_missing_customer_email'
        ? `Order ${order.order_number} updated, but the customer has no email address.`
        : `Order ${order.order_number} status updated successfully.`

    resetStatusDialog()
  } catch (err) {
    statusError.value =
      err?.response?.data?.message ||
      `Failed to update order ${order.order_number}.`
  } finally {
    savingOrderId.value = null
  }
}

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


    <div v-if="statusMessage" class="success-message">
      {{ statusMessage }}
    </div>

    <div v-if="statusError" class="error-state">
      {{ statusError }}
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

            <!-- Order status: payment status remains separate -->
            <td>
              <div class="order-status-editor">
                <select
                  :value="statusDrafts[order.id] ?? order.status"
                  :disabled="savingOrderId === order.id"
                  @change="statusDrafts[order.id] = $event.target.value"
                  aria-label="Order status"
                >
                  <option
                    v-for="status in availableStatuses(order)"
                    :key="status.value"
                    :value="status.value"
                  >
                    {{ status.label }}
                  </option>
                </select>
                <button
                  type="button"
                  class="action-button"
                  :disabled="savingOrderId === order.id || (statusDrafts[order.id] ?? order.status) === order.status"
                  @click="saveOrderStatus(order)"
                >
                  {{ savingOrderId === order.id ? 'Saving...' : 'Save' }}
                </button>
              </div>
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

              </div>

            </td>

          </tr>

          </tbody>

        </table>

      </div>

    </div>

    <!-- Status update dialog -->
    <div
      v-if="statusDialogOpen"
      class="status-modal-backdrop"
      @click.self="resetStatusDialog"
    >
      <section
        class="status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
      >
        <h2 id="status-modal-title">
          Update {{ selectedOrder?.order_number }}
        </h2>

        <p class="modal-description">
          New status:
          <strong>
            {{ statuses.find(s => s.value === modalStatus)?.label || modalStatus }}
          </strong>
        </p>

        <div
          v-if="['cancelled', 'returned'].includes(modalStatus)"
          class="modal-field"
        >
          <label for="status-reason">Reason *</label>
          <textarea
            id="status-reason"
            v-model="statusReason"
            rows="4"
            maxlength="2000"
            required
            placeholder="Enter the reason"
          />
        </div>

        <template v-if="modalStatus === 'shipped'">
          <div class="modal-field">
            <label for="courier-name">Courier name *</label>
            <input
              id="courier-name"
              v-model="courierName"
              type="text"
              maxlength="150"
              required
              placeholder="Enter courier name"
            />
          </div>

          <div class="modal-field">
            <label for="tracking-number">Tracking number *</label>
            <input
              id="tracking-number"
              v-model="trackingNumber"
              type="text"
              maxlength="150"
              required
              placeholder="Enter tracking number"
            />
          </div>

          <div class="modal-field">
            <label for="expected-delivery-date">Expected delivery date</label>
            <input
              id="expected-delivery-date"
              v-model="expectedDeliveryDate"
              type="date"
            />
          </div>
        </template>

        <p v-if="statusError" class="modal-error">
          {{ statusError }}
        </p>

        <div class="modal-actions">
          <button
            type="button"
            class="action-button"
            :disabled="savingOrderId === selectedOrder?.id"
            @click="resetStatusDialog"
          >
            Cancel
          </button>

          <button
            type="button"
            class="primary-button"
            :disabled="savingOrderId === selectedOrder?.id"
            @click="confirmOrderStatus"
          >
            {{ savingOrderId === selectedOrder?.id ? 'Saving...' : 'Confirm Status' }}
          </button>
        </div>
      </section>
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

.order-status-editor {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 250px;
}

.order-status-editor select {
  min-width: 145px;
  padding: 8px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-md, 6px);
  background-color: #ffffff;
  color: #1f2937;
  font-family: inherit;
  font-size: var(--font-size-sm, 13px);
  -webkit-text-fill-color: #1f2937;
  cursor: pointer;
}

.order-status-editor select option {
  background-color: #ffffff;
  color: #1f2937;
}
.order-status-editor button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.success-message {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid #86efac;
  border-radius: 8px;
  color: #166534;
  background: #f0fdf4;
}


.status-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.55);
}

.status-modal {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.status-modal h2 {
  margin: 0 0 12px;
  font-size: var(--font-size-xl);
}

.modal-description {
  margin-bottom: 20px;
  color: var(--color-text-secondary);
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 16px;
}

.modal-field label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.modal-field input,
.modal-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font: inherit;
}

.modal-field input:focus,
.modal-field textarea:focus {
  outline: 2px solid var(--color-primary-light);
  border-color: var(--color-primary);
}

.modal-error {
  margin: 12px 0;
  color: #b91c1c;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

</style>
