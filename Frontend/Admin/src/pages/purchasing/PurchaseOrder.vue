<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import {
  getPurchaseOrders,
  deletePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder
} from '@/api/purchaseOrderApi.js'

import { hasPermission } from '@/auth/authorization.js'

const router = useRouter()

const CREATE_ROUTE = '/admin/purchasing/purchase-orders/create'
const DETAIL_ROUTE = '/admin/purchasing/purchase-orders'

const orders = ref([])
const loading = ref(false)
const errorMessage = ref('')

const search = ref('')
const statusFilter = ref('')

const busyAction = ref(null)
const busyId = ref(null)

const canCreate = computed(() =>
    hasPermission('products.create')
)

const canUpdate = computed(() =>
    hasPermission('products.update')
)

const canDelete = computed(() =>
    hasPermission('products.delete')
)

const fetchOrders = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getPurchaseOrders()

    orders.value = response?.data?.data || []
  } catch (error) {
    console.error('Failed to load purchase orders:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load purchase orders.'
  } finally {
    loading.value = false
  }
}

const filteredOrders = computed(() => {
  const searchText = search.value.trim().toLowerCase()

  return orders.value.filter(order => {
    const matchesSearch =
        !searchText ||
        order.purchase_order_number
            ?.toLowerCase()
            .includes(searchText) ||
        order.supplier?.company_name
            ?.toLowerCase()
            .includes(searchText)

    const matchesStatus =
        !statusFilter.value ||
        order.status === statusFilter.value

    return matchesSearch && matchesStatus
  })
})

const goToCreate = () => {
  router.push(CREATE_ROUTE)
}

const viewOrder = id => {
  router.push(`${DETAIL_ROUTE}/${id}`)
}

const editOrder = id => {
  router.push(`${DETAIL_ROUTE}/edit/${id}`)
}

const isBusy = (action, order) => {
  return (
      busyAction.value === action &&
      busyId.value === order.id
  )
}

const runAction = async (action, order, apiFunction, message) => {
  if (isBusy(action, order)) return

  busyAction.value = action
  busyId.value = order.id

  try {
    await apiFunction(order.id)

    await fetchOrders()

    alert(message)
  } catch (error) {
    console.error(`${action} purchase order error:`, error)

    alert(
        error.response?.data?.message ||
        `Failed to ${action} purchase order.`
    )
  } finally {
    busyAction.value = null
    busyId.value = null
  }
}

const submitOrder = order => {
  if (!confirm(
      `Submit purchase order ${order.purchase_order_number}?`
  )) return

  runAction(
      'submit',
      order,
      submitPurchaseOrder,
      'Purchase order submitted successfully.'
  )
}

const approveOrder = order => {
  if (!confirm(
      `Approve purchase order ${order.purchase_order_number}?`
  )) return

  runAction(
      'approve',
      order,
      approvePurchaseOrder,
      'Purchase order approved successfully.'
  )
}

const cancelOrder = order => {
  if (!confirm(
      `Cancel purchase order ${order.purchase_order_number}?`
  )) return

  runAction(
      'cancel',
      order,
      cancelPurchaseOrder,
      'Purchase order cancelled successfully.'
  )
}

const deleteOrder = async order => {
  if (!confirm(
      `Delete purchase order ${order.purchase_order_number}?`
  )) return

  busyAction.value = 'delete'
  busyId.value = order.id

  try {
    await deletePurchaseOrder(order.id)

    await fetchOrders()

    alert('Purchase order deleted successfully.')
  } catch (error) {
    console.error('Delete purchase order error:', error)

    alert(
        error.response?.data?.message ||
        'Failed to delete purchase order.'
    )
  } finally {
    busyAction.value = null
    busyId.value = null
  }
}

const formatDate = date => {
  if (!date) return '-'

  return new Date(date).toLocaleDateString()
}

const formatCurrency = value => {
  return Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatStatus = status => {
  if (!status) return '-'

  return status
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
}

onMounted(fetchOrders)
</script>

<template>
  <div class="po-list-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Purchase Orders</h1>

        <p>
          Manage supplier purchase orders.
        </p>
      </div>

      <button
          v-if="canCreate"
          type="button"
          class="btn-primary"
          @click="goToCreate"
      >
        + Create Purchase Order
      </button>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Filters -->
    <section class="card filters">

      <input
          v-model="search"
          type="text"
          placeholder="Search by PO number or supplier..."
          class="form-control search-input"
      />

      <select
          v-model="statusFilter"
          class="form-control"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
        <option value="partially_received">Partially Received</option>
        <option value="received">Received</option>
        <option value="cancelled">Cancelled</option>
      </select>

    </section>

    <!-- Table -->
    <section class="card table-card">

      <div
          v-if="loading"
          class="loading-message"
      >
        Loading purchase orders...
      </div>

      <div
          v-else-if="filteredOrders.length === 0"
          class="empty-message"
      >
        No purchase orders found.
      </div>

      <div
          v-else
          class="table-wrapper"
      >
        <table class="data-table">
          <thead>
          <tr>
            <th>PO Number</th>
            <th>Supplier</th>
            <th>Order Date</th>
            <th>Expected Date</th>
            <th class="align-right">Items</th>
            <th class="align-right">Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="order in filteredOrders"
              :key="order.id"
          >
            <td class="po-number">
              {{ order.purchase_order_number }}
            </td>

            <td>
              {{ order.supplier?.company_name || '-' }}
            </td>

            <td>
              {{ formatDate(order.order_date) }}
            </td>

            <td>
              {{ formatDate(order.expected_date) }}
            </td>

            <td class="align-right">
              {{ order.items?.length || 0 }}
            </td>

            <td class="align-right">
              {{ formatCurrency(order.total_amount) }}
            </td>

            <td>
              <span
                  class="status"
                  :class="`status-${order.status}`"
              >
                {{ formatStatus(order.status) }}
              </span>
            </td>

            <td>
              <div class="action-buttons">

                <!-- View -->
                <button
                    type="button"
                    class="action-button"
                    @click="viewOrder(order.id)"
                >
                  View
                </button>

                <!-- Edit Draft -->
                <router-link
                    v-if="
      order.status === 'draft' &&
      canUpdate
    "
                    :to="`${DETAIL_ROUTE}/edit/${order.id}`"
                    class="action-button edit"
                >
                  Edit
                </router-link>

                <!-- Submit Draft -->
                <button
                    v-if="
      order.status === 'draft' &&
      canUpdate
    "
                    type="button"
                    class="action-button submit"
                    :disabled="isBusy('submit', order)"
                    @click="submitOrder(order)"
                >
                  {{ isBusy('submit', order) ? 'Submitting...' : 'Submit' }}
                </button>

                <!-- Approve Submitted -->
                <button
                    v-if="
      order.status === 'submitted' &&
      canUpdate
    "
                    type="button"
                    class="action-button approve"
                    :disabled="isBusy('approve', order)"
                    @click="approveOrder(order)"
                >
                  {{ isBusy('approve', order) ? 'Approving...' : 'Approve' }}
                </button>

                <!-- Cancel -->
                <button
                    v-if="
      ['draft', 'submitted', 'approved'].includes(order.status) &&
      canUpdate
    "
                    type="button"
                    class="action-button delete"
                    :disabled="isBusy('cancel', order)"
                    @click="cancelOrder(order)"
                >
                  {{ isBusy('cancel', order) ? 'Cancelling...' : 'Cancel' }}
                </button>

                <!-- Delete Draft -->
                <button
                    v-if="
      order.status === 'draft' &&
      canDelete
    "
                    type="button"
                    class="action-button delete"
                    :disabled="isBusy('delete', order)"
                    @click="deleteOrder(order)"
                >
                  {{ isBusy('delete', order) ? 'Deleting...' : 'Delete' }}
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

<style scoped>
.po-list-page {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Header
   ========================= */

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
   Cards / Filters
   ========================= */

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.filters {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-xl);
}

.form-control {
  box-sizing: border-box;
  height: 40px;
  min-width: 220px;
  padding: 0 var(--spacing-lg);
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
  flex: 1;
}

.form-control::placeholder {
  color: var(--color-text-muted);
}

.form-control:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* =========================
   Table
   ========================= */

.table-card {
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-md);
}

.data-table th,
.data-table td {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
  text-align: left;
  white-space: nowrap;
}

.data-table th {
  background: var(--color-hover-bg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.data-table td {
  color: var(--color-text-primary);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: var(--color-hover-bg);
}

.data-table .align-right {
  text-align: right;
}

.po-number {
  font-weight: var(--font-weight-semibold);
}

/* =========================
   Status badges
   ========================= */

.status {
  display: inline-block;
  padding: 4px var(--spacing-md);
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.status-draft {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

.status-submitted {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status-approved {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-partially_received {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.status-received {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-cancelled {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* =========================
   States
   ========================= */

.error-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.loading-message,
.empty-message {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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
  padding: 0 var(--spacing-xl);
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

.btn-sm {
  height: 32px;
  padding: 0 var(--spacing-lg);
  font-size: var(--font-size-sm);
}

/* ================================
   Purchase Order Action Buttons
================================ */

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


/* Loading button */
.action-button.loading {
  opacity: 0.7;
  cursor: wait;
}

/* Mobile */
@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .filters {
    flex-direction: column;
  }

  .form-control {
    width: 100%;
    min-width: 0;
  }
}
</style>
