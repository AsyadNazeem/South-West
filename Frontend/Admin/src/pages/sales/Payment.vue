<script setup>
import { computed, onMounted, ref } from 'vue'

import paymentApi from '../../api/paymentApi'
import { hasPermission } from '../../auth/authorization.js'


// ==========================================
// Routes
// ==========================================


// ==========================================
// State
// ==========================================

const payments = ref([])
const selectedPayment = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const search = ref('')
const statusFilter = ref('')
const methodFilter = ref('')

const deletingId = ref(null)

// ==========================================
// Permissions
// ==========================================

// ==========================================
// Load Payments
// ==========================================

const loadPayments = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await paymentApi.getPayments()

    payments.value =
        response?.data?.data ||
        response?.data ||
        []

  } catch (error) {
    console.error('Failed to load payments:', error)

    errorMessage.value =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load payments.'
  } finally {
    loading.value = false
  }
}

// ==========================================
// Filtering
// ==========================================

const filteredPayments = computed(() => {
  const searchText = search.value.trim().toLowerCase()

  return payments.value.filter(payment => {
    const paymentReference =
        payment.payment_reference?.toLowerCase() || ''

    const transactionReference =
        payment.transaction_reference?.toLowerCase() || ''

    const orderNumber =
        payment.order?.order_number?.toLowerCase() || ''

    const paymentMethod =
        payment.payment_method?.toLowerCase() || ''

    const matchesSearch =
        !searchText ||
        paymentReference.includes(searchText) ||
        transactionReference.includes(searchText) ||
        orderNumber.includes(searchText) ||
        paymentMethod.includes(searchText)

    const matchesStatus =
        !statusFilter.value ||
        payment.payment_status === statusFilter.value

    const matchesMethod =
        !methodFilter.value ||
        payment.payment_method === methodFilter.value

    return (
        matchesSearch &&
        matchesStatus &&
        matchesMethod
    )
  })
})

// ==========================================
// Navigation
// ==========================================

const viewPayment = async (id) => {
  errorMessage.value = ''

  try {
    const response = await paymentApi.getPaymentById(id)
    selectedPayment.value = response?.data?.data || response?.data || null
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to load payment details.'
  }
}

const closePaymentDetails = () => {
  selectedPayment.value = null
}


// ==========================================
// Delete Payment
// ==========================================


// ==========================================
// Formatting
// ==========================================

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatDate = (date) => {
  if (!date) {
    return '-'
  }

  return new Date(date).toLocaleDateString('en-LK')
}

const formatDateTime = (date) => {
  if (!date) {
    return '-'
  }

  return new Date(date).toLocaleString('en-LK')
}

const formatStatus = (status) => {
  if (!status) {
    return '-'
  }

  return status
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
}

const formatMethod = (method) => {
  if (!method) {
    return '-'
  }

  return method
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
}

// ==========================================
// Status Class
// ==========================================

const statusClass = (status) => {
  switch (status) {
    case 'paid':
      return 'status-paid'

    case 'partially_paid':
      return 'status-partially-paid'

    case 'unpaid':
      return 'status-unpaid'

    case 'refunded':
      return 'status-refunded'

    case 'partially_refunded':
      return 'status-partially-refunded'

    default:
      return 'status-default'
  }
}

// ==========================================
// Statistics
// ==========================================

const totalPayments = computed(() => {
  return payments.value.length
})

const paidPayments = computed(() => {
  return payments.value.filter(
      payment => payment.payment_status === 'paid'
  ).length
})

const pendingPayments = computed(() => {
  return payments.value.filter(
      payment =>
          payment.payment_status === 'unpaid' ||
          payment.payment_status === 'partially_paid'
  ).length
})

const totalAmount = computed(() => {
  return payments.value.reduce(
      (total, payment) =>
          total + Number(payment.amount || 0),
      0
  )
})

// ==========================================
// Initial Load
// ==========================================

onMounted(loadPayments)
</script>

<template>
  <div class="payment-list-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Payments</h1>
        <p>
          Manage and monitor customer payment transactions.
        </p>
      </div>
</div>

    <!-- Statistics -->
    <div class="stats-grid">

      <div class="stat-card">
        <div class="stat-label">
          Total Payments
        </div>

        <div class="stat-value">
          {{ totalPayments }}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Paid
        </div>

        <div class="stat-value">
          {{ paidPayments }}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Pending
        </div>

        <div class="stat-value">
          {{ pendingPayments }}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">
          Total Amount
        </div>

        <div class="stat-value">
          Rs. {{ formatAmount(totalAmount) }}
        </div>
      </div>

    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Filters -->
    <div class="filters-card">

      <div class="search-box">
        <input
            v-model="search"
            type="text"
            placeholder="Search payment reference, transaction or order..."
        />
      </div>

      <div class="filter-group">

        <select v-model="statusFilter">
          <option value="">
            All Statuses
          </option>

          <option value="unpaid">
            Unpaid
          </option>

          <option value="partially_paid">
            Partially Paid
          </option>

          <option value="paid">
            Paid
          </option>

          <option value="refunded">
            Refunded
          </option>

          <option value="partially_refunded">
            Partially Refunded
          </option>
        </select>

        <select v-model="methodFilter">
          <option value="">
            All Payment Methods
          </option>

          <option value="cash">
            Cash
          </option>

          <option value="card">
            Card
          </option>

          <option value="bank_transfer">
            Bank Transfer
          </option>

          <option value="online">
            Online
          </option>

          <option value="wallet">
            Wallet
          </option>

          <option value="cheque">
            Cheque
          </option>

          <option value="other">
            Other
          </option>
        </select>

        <button
            type="button"
            class="btn-secondary"
            @click="loadPayments"
            :disabled="loading"
        >
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>

      </div>

    </div>

    <!-- Loading -->
    <div
        v-if="loading"
        class="loading-state"
    >
      Loading payments...
    </div>

    <!-- Table -->
    <div
        v-else
        class="table-card"
    >

      <table>

        <thead>
        <tr>
          <th>Payment Reference</th>
          <th>Order</th>
          <th>Method</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Payment Date</th>
          <th>Processed By</th>
          <th>Actions</th>
        </tr>
        </thead>

        <tbody>

        <tr
            v-for="payment in filteredPayments"
            :key="payment.id"
        >

          <!-- Payment Reference -->
          <td>
            <strong>
              {{ payment.payment_reference }}
            </strong>

            <div
                v-if="payment.transaction_reference"
                class="secondary-text"
            >
              TXN:
              {{ payment.transaction_reference }}
            </div>
          </td>

          <!-- Order -->
          <td>
            <button
                v-if="payment.order?.order_number"
                type="button"
                class="link-button"
                @click="viewPayment(payment.id)"
            >
              {{ payment.order.order_number }}
            </button>

            <span v-else>
                                -
                            </span>
          </td>

          <!-- Method -->
          <td>
            {{ formatMethod(payment.payment_method) }}
          </td>

          <!-- Amount -->
          <td class="amount">
            Rs. {{ formatAmount(payment.amount) }}
          </td>

          <!-- Status -->
          <td>
                            <span
                                class="status-badge"
                                :class="statusClass(payment.payment_status)"
                            >
                                {{ formatStatus(payment.payment_status) }}
                            </span>
          </td>

          <!-- Payment Date -->
          <td>
            {{ formatDate(payment.payment_date) }}
          </td>

          <!-- Processor -->
          <td>
                            <span v-if="payment.processor">
                                {{
                                payment.processor.email ||
                                payment.processor.username ||
                                '-'
                              }}
                            </span>

            <span v-else>
                                -
                            </span>
          </td>

          <!-- Actions -->
          <td>
            <div class="actions">

              <button
                  type="button"
                  class="action-button view"
                  @click="viewPayment(payment.id)"
              >
                View
              </button>
</div>
          </td>

        </tr>

        <!-- Empty -->
        <tr v-if="filteredPayments.length === 0">
          <td
              colspan="8"
              class="empty-state"
          >
            <strong>
              No payments found
            </strong>

            <span>
                                Try changing your search or filters.
                            </span>
          </td>
        </tr>

        </tbody>

      </table>

    </div>

  </div>

    <!-- Read-only Payment Details -->
    <div
      v-if="selectedPayment"
      class="payment-detail-overlay"
      @click.self="closePaymentDetails"
    >
      <section
        class="payment-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-detail-title"
      >
        <div class="payment-detail-header">
          <div>
            <h2 id="payment-detail-title">Payment Details</h2>
            <p>{{ selectedPayment.payment_reference || 'Payment' }}</p>
          </div>

          <button
            type="button"
            class="action-button"
            @click="closePaymentDetails"
          >
            Close
          </button>
        </div>

        <dl class="payment-detail-grid">
          <div>
            <dt>Payment Reference</dt>
            <dd>{{ selectedPayment.payment_reference || '-' }}</dd>
          </div>

          <div>
            <dt>Order Number</dt>
            <dd>{{ selectedPayment.order?.order_number || '-' }}</dd>
          </div>

          <div>
            <dt>Amount</dt>
            <dd>Rs. {{ formatAmount(selectedPayment.amount) }}</dd>
          </div>

          <div>
            <dt>Payment Method</dt>
            <dd>{{ formatMethod(selectedPayment.payment_method) }}</dd>
          </div>

          <div>
            <dt>Payment Status</dt>
            <dd>
              <span
                class="status-badge"
                :class="statusClass(selectedPayment.payment_status)"
              >
                {{ formatStatus(selectedPayment.payment_status) }}
              </span>
            </dd>
          </div>

          <div>
            <dt>Transaction Reference</dt>
            <dd>{{ selectedPayment.transaction_reference || '-' }}</dd>
          </div>

          <div>
            <dt>Payment Date</dt>
            <dd>{{ formatDateTime(selectedPayment.payment_date) }}</dd>
          </div>

          <div>
            <dt>Processed By</dt>
            <dd>
              {{
                selectedPayment.processor?.email ||
                selectedPayment.processor?.username ||
                '-'
              }}
            </dd>
          </div>

          <div class="payment-detail-full">
            <dt>Notes</dt>
            <dd>{{ selectedPayment.notes || '-' }}</dd>
          </div>
        </dl>

        <div class="payment-confirmation-actions">
          <p
            v-if="selectedPayment.payment_method === 'cash'"
            class="payment-detail-readonly"
          >
            Cash on delivery payment is automatically marked as Paid when the
            delivery status is changed to Delivered.
          </p>

          <p
            v-else-if="['unpaid', 'partially_paid'].includes(selectedPayment.payment_status)"
            class="payment-detail-readonly"
          >
            Payment status is updated only after verified confirmation from the payment provider.
          </p>
        </div>
      </section>
    </div>

</template>

<style scoped>
.payment-list-page {
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

.btn-primary:disabled,
.btn-secondary:disabled {
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

.filters-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.filter-group select {
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

.search-box input {
  padding: 0 var(--spacing-lg);
}

.search-box input::placeholder {
  color: var(--color-text-muted);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.filter-group select {
  width: 180px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-box input:focus,
.filter-group select:focus {
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
  text-align: left;
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

.secondary-text {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.link-button {
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  font-size: inherit;
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  cursor: pointer;
}

.link-button:hover {
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

.status-paid {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-partially-paid {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status-unpaid {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.status-refunded {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status-partially-refunded {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.status-default {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* =========================
   Actions
   ========================= */

.actions {
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

.loading-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  white-space: normal;
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

@media (max-width: 1000px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filters-card {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .filter-group {
    flex-wrap: wrap;
  }
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .filter-group {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group select,
  .filter-group .btn-secondary {
    width: 100%;
  }
}

.payment-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.45);
}

.payment-detail-panel {
  width: min(620px, 100%);
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-surface, #fff);
  color: var(--color-text-primary, #111827);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
}

.payment-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}

.payment-detail-header h2 {
  margin: 0 0 6px;
}

.payment-detail-header p {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

.payment-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin: 0;
}

.payment-detail-grid > div {
  min-width: 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.payment-detail-grid dt {
  margin-bottom: 6px;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.85rem;
}

.payment-detail-grid dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 500;
}

.payment-detail-grid .payment-detail-full {
  grid-column: 1 / -1;
}

.payment-detail-readonly {
  margin-top: 24px;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-surface-secondary, #f3f4f6);
  font-size: 0.9rem;
}

@media (max-width: 480px) {
  .payment-detail-panel {
    padding: 16px;
  }

  .payment-detail-grid {
    grid-template-columns: 1fr;
  }
}

</style>
