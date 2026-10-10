<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import invoiceApi from '../../api/invoiceApi'
import { hasPermission } from '../../auth/authorization.js'

const router = useRouter()

// ==========================================
// Routes
// ==========================================

const CREATE_ROUTE = '/admin/sales/invoices/create'
const DETAIL_ROUTE = '/admin/sales/invoices'

// ==========================================
// State
// ==========================================

const invoices = ref([])

const loading = ref(false)
const errorMessage = ref('')

const search = ref('')
const statusFilter = ref('')

const deletingId = ref(null)

// ==========================================
// Permissions
// ==========================================

const canCreate = computed(() =>
    hasPermission('invoices.create')
)

const canUpdate = computed(() =>
    hasPermission('invoices.update')
)

const canDelete = computed(() =>
    hasPermission('invoices.delete')
)

// ==========================================
// Load Invoices
// ==========================================

const loadInvoices = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await invoiceApi.getInvoices()

    invoices.value =
        response?.data?.data ||
        response?.data ||
        []

  } catch (error) {
    console.error('Failed to load invoices:', error)

    errorMessage.value =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load invoices.'
  } finally {
    loading.value = false
  }
}

// ==========================================
// Filtering
// ==========================================

const filteredInvoices = computed(() => {
  const searchText = search.value
      .trim()
      .toLowerCase()

  return invoices.value.filter(invoice => {

    const invoiceNumber =
        invoice.invoice_number
            ?.toLowerCase() || ''

    const orderNumber =
        invoice.order?.order_number
            ?.toLowerCase() || ''

    /*
     * Customer name structure depends on your
     * Customer model. We check several common
     * fields without breaking if one is missing.
     */
    const customerName =
        invoice.customer?.name
            ?.toLowerCase() ||
        invoice.customer?.customer_name
            ?.toLowerCase() ||
        `${invoice.customer?.first_name || ''} ${invoice.customer?.last_name || ''}`
            .trim()
            .toLowerCase()

    const matchesSearch =
        !searchText ||
        invoiceNumber.includes(searchText) ||
        orderNumber.includes(searchText) ||
        customerName.includes(searchText)

    const matchesStatus =
        !statusFilter.value ||
        invoice.status === statusFilter.value

    return (
        matchesSearch &&
        matchesStatus
    )
  })
})

// ==========================================
// Navigation
// ==========================================

const goToCreate = () => {
  router.push(CREATE_ROUTE)
}

const viewInvoice = (id) => {
  router.push(`${DETAIL_ROUTE}/${id}`)
}

const editInvoice = (id) => {
  router.push(`${DETAIL_ROUTE}/${id}/edit`)
}

// ==========================================
// Delete Invoice
// ==========================================

const deleteInvoice = async (id) => {
  const confirmed = confirm(
      'Are you sure you want to delete this invoice?'
  )

  if (!confirmed) {
    return
  }

  deletingId.value = id

  try {
    await invoiceApi.deleteInvoice(id)

    invoices.value = invoices.value.filter(
        invoice => invoice.id !== id
    )

  } catch (error) {
    console.error(
        'Failed to delete invoice:',
        error
    )

    errorMessage.value =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to delete invoice.'

  } finally {
    deletingId.value = null
  }
}

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

const formatStatus = (status) => {
  if (!status) {
    return '-'
  }

  return status
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
}

// ==========================================
// Status Class
// ==========================================

const statusClass = (status) => {
  switch (status) {

    case 'draft':
      return 'status-draft'

    case 'issued':
      return 'status-issued'

    case 'partially_paid':
      return 'status-partially-paid'

    case 'paid':
      return 'status-paid'

    case 'overdue':
      return 'status-overdue'

    case 'cancelled':
      return 'status-cancelled'

    case 'refunded':
      return 'status-refunded'

    default:
      return 'status-default'
  }
}

// ==========================================
// Statistics
// ==========================================

const totalInvoices = computed(() => {
  return invoices.value.length
})

const draftInvoices = computed(() => {
  return invoices.value.filter(
      invoice => invoice.status === 'draft'
  ).length
})

const paidInvoices = computed(() => {
  return invoices.value.filter(
      invoice => invoice.status === 'paid'
  ).length
})

const overdueInvoices = computed(() => {
  return invoices.value.filter(
      invoice => invoice.status === 'overdue'
  ).length
})

const totalInvoicedAmount = computed(() => {
  return invoices.value.reduce(
      (total, invoice) => {
        return total +
            Number(invoice.total_amount || 0)
      },
      0
  )
})

const totalPaidAmount = computed(() => {
  return invoices.value.reduce(
      (total, invoice) => {
        return total +
            Number(invoice.paid_amount || 0)
      },
      0
  )
})

const totalBalanceAmount = computed(() => {
  return invoices.value.reduce(
      (total, invoice) => {
        return total +
            Number(invoice.balance_amount || 0)
      },
      0
  )
})

// ==========================================
// Initial Load
// ==========================================

onMounted(() => {
  loadInvoices()
})
</script>

<template>
  <div class="invoice-list-page">

    <!-- =====================================
         Header
    ====================================== -->

    <div class="page-header">

      <div>
        <h1>Invoices</h1>

        <p>
          Manage customer invoices and payment balances.
        </p>
      </div>

      <button
          v-if="canCreate"
          type="button"
          class="btn-primary"
          @click="goToCreate"
      >
        + Create Invoice
      </button>

    </div>


    <!-- =====================================
         Statistics
    ====================================== -->

    <div class="stats-grid">

      <div class="stat-card">

        <div class="stat-label">
          Total Invoices
        </div>

        <div class="stat-value">
          {{ totalInvoices }}
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Draft
        </div>

        <div class="stat-value">
          {{ draftInvoices }}
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Paid
        </div>

        <div class="stat-value">
          {{ paidInvoices }}
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Overdue
        </div>

        <div class="stat-value">
          {{ overdueInvoices }}
        </div>

      </div>

    </div>


    <!-- =====================================
         Financial Summary
    ====================================== -->

    <div class="financial-summary">

      <div class="financial-card">

                <span>
                    Total Invoiced
                </span>

        <strong>
          Rs.
          {{ formatAmount(totalInvoicedAmount) }}
        </strong>

      </div>


      <div class="financial-card">

                <span>
                    Total Paid
                </span>

        <strong>
          Rs.
          {{ formatAmount(totalPaidAmount) }}
        </strong>

      </div>


      <div class="financial-card">

                <span>
                    Outstanding Balance
                </span>

        <strong>
          Rs.
          {{ formatAmount(totalBalanceAmount) }}
        </strong>

      </div>

    </div>


    <!-- =====================================
         Error
    ====================================== -->

    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>


    <!-- =====================================
         Filters
    ====================================== -->

    <div class="filters-card">

      <div class="search-box">

        <input
            v-model="search"
            type="text"
            placeholder="Search invoice, order or customer..."
        />

      </div>


      <div class="filter-group">

        <select v-model="statusFilter">

          <option value="">
            All Statuses
          </option>

          <option value="draft">
            Draft
          </option>

          <option value="issued">
            Issued
          </option>

          <option value="partially_paid">
            Partially Paid
          </option>

          <option value="paid">
            Paid
          </option>

          <option value="overdue">
            Overdue
          </option>

          <option value="cancelled">
            Cancelled
          </option>

          <option value="refunded">
            Refunded
          </option>

        </select>


        <button
            type="button"
            class="btn-secondary"
            @click="loadInvoices"
            :disabled="loading"
        >
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>

      </div>

    </div>


    <!-- =====================================
         Loading
    ====================================== -->

    <div
        v-if="loading"
        class="loading-state"
    >
      Loading invoices...
    </div>


    <!-- =====================================
         Table
    ====================================== -->

    <div
        v-else
        class="table-card"
    >

      <table>

        <thead>

        <tr>

          <th>
            Invoice
          </th>

          <th>
            Order
          </th>

          <th>
            Customer
          </th>

          <th>
            Invoice Date
          </th>

          <th>
            Due Date
          </th>

          <th>
            Total
          </th>

          <th>
            Paid
          </th>

          <th>
            Balance
          </th>

          <th>
            Status
          </th>

          <th>
            Actions
          </th>

        </tr>

        </thead>


        <tbody>

        <tr
            v-for="invoice in filteredInvoices"
            :key="invoice.id"
        >

          <!-- Invoice -->

          <td>

            <strong>
              {{ invoice.invoice_number }}
            </strong>

          </td>


          <!-- Order -->

          <td>

                            <span
                                v-if="invoice.order?.order_number"
                                class="order-number"
                            >
                                {{ invoice.order.order_number }}
                            </span>

            <span v-else>
                                -
                            </span>

          </td>


          <!-- Customer -->

          <td>

                            <span
                                v-if="invoice.customer"
                            >
                                {{
                                invoice.customer.name ||
                                invoice.customer.customer_name ||
                                (
                                    invoice.customer.first_name +
                                    ' ' +
                                    invoice.customer.last_name
                                )
                              }}
                            </span>

            <span v-else>
                                Walk-in Customer
                            </span>

          </td>


          <!-- Invoice Date -->

          <td>
            {{ formatDate(invoice.invoice_date) }}
          </td>


          <!-- Due Date -->

          <td>
            {{ formatDate(invoice.due_date) }}
          </td>


          <!-- Total -->

          <td class="amount">

            Rs.
            {{ formatAmount(invoice.total_amount) }}

          </td>


          <!-- Paid -->

          <td class="amount paid-amount">

            Rs.
            {{ formatAmount(invoice.paid_amount) }}

          </td>


          <!-- Balance -->

          <td class="amount balance-amount">

            Rs.
            {{ formatAmount(invoice.balance_amount) }}

          </td>


          <!-- Status -->

          <td>

                            <span
                                class="status-badge"
                                :class="statusClass(invoice.status)"
                            >
                                {{ formatStatus(invoice.status) }}
                            </span>

          </td>


          <!-- Actions -->

          <td>

            <div class="actions">

              <button
                  type="button"
                  class="action-button view"
                  @click="viewInvoice(invoice.id)"
              >
                View
              </button>


              <button
                  v-if="canUpdate"
                  type="button"
                  class="action-button edit"
                  @click="editInvoice(invoice.id)"
              >
                Edit
              </button>


              <button
                  v-if="canDelete"
                  type="button"
                  class="action-button delete"
                  :disabled="
                                        deletingId === invoice.id
                                    "
                  @click="
                                        deleteInvoice(invoice.id)
                                    "
              >
                {{
                  deletingId === invoice.id
                      ? 'Deleting...'
                      : 'Delete'
                }}
              </button>

            </div>

          </td>

        </tr>


        <!-- Empty -->

        <tr
            v-if="filteredInvoices.length === 0"
        >

          <td
              colspan="10"
              class="empty-state"
          >

            <strong>
              No invoices found
            </strong>

            <span>
                                Try changing your search or status filter.
                            </span>

          </td>

        </tr>

        </tbody>

      </table>

    </div>

  </div>
</template>


<style scoped>
.invoice-list-page {
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
  margin-bottom: var(--spacing-lg);
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
   Financial Summary
   ========================= */

.financial-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.financial-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.financial-card span {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.financial-card strong {
  font-size: var(--font-size-lg, 18px);
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

.paid-amount {
  color: var(--color-success);
}

.balance-amount {
  color: var(--color-warning);
}

.order-number {
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
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

.status-draft,
.status-cancelled,
.status-default {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

.status-issued {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status-partially-paid {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status-paid {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-overdue {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.status-refunded {
  background: var(--color-primary-light);
  color: var(--color-primary);
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

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .financial-summary {
    grid-template-columns: 1fr;
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
</style>
