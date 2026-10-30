<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const router = useRouter()

const orders = ref([])
const loading = ref(true)
const errorMessage = ref('')
const expandedOrderId = ref(null)
const orderDetails = ref({})
const loadingDetails = ref({})
const activeFilter = ref('all')
const searchText = ref('')

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

// Progress tracker shown on each order. Add any extra status your
// backend uses to STATUS_STEP (0 = placed ... 3 = delivered).
const TRACKING_STEPS = ['Placed', 'Processing', 'Shipped', 'Delivered']

const STATUS_STEP = {
  pending: 0,
  placed: 0,
  confirmed: 0,
  processing: 1,
  packed: 1,
  ready: 1,
  shipped: 2,
  dispatched: 2,
  'in-transit': 2,
  'out-for-delivery': 2,
  delivered: 3,
  completed: 3,
}

const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatDate = (date) => {
  if (!date) return 'Not available'

  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime())
    ? 'Not available'
    : parsed.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
}

const formatStatus = (status) =>
  String(status || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, char => char.toUpperCase())

const statusClass = (status) =>
  String(status || 'unknown').toLowerCase().replaceAll('_', '-')

function orderGroup(order) {
  const status = statusClass(order.status)

  if (status === 'cancelled') return 'cancelled'
  if (status === 'delivered' || status === 'completed') return 'delivered'
  return 'active'
}

function currentStep(order) {
  return STATUS_STEP[statusClass(order.status)] ?? 0
}

const filterCounts = computed(() => {
  const counts = { all: orders.value.length, active: 0, delivered: 0, cancelled: 0 }

  for (const order of orders.value) {
    counts[orderGroup(order)]++
  }

  return counts
})

const filteredOrders = computed(() => {
  const query = searchText.value.trim().toLowerCase()

  return orders.value.filter(order => {
    const matchesFilter =
      activeFilter.value === 'all' || orderGroup(order) === activeFilter.value

    const matchesSearch =
      !query || String(order.order_number || '').toLowerCase().includes(query)

    return matchesFilter && matchesSearch
  })
})

function clearFilters() {
  activeFilter.value = 'all'
  searchText.value = ''
}

async function loadOrders() {
  loading.value = true
  errorMessage.value = ''

  if (!sessionStorage.getItem('customerToken')) {
    router.replace({
      path: '/login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
    return
  }

  try {
    const response = await api.get('/customer-orders', {
      params: { page: 1, limit: 50 },
    })

    orders.value = response.data?.data || []
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message || 'Unable to load your orders.'

    if (error.response?.status === 401) {
      sessionStorage.removeItem('customerToken')
      sessionStorage.removeItem('customerProfile')

      router.replace({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath },
      })
    }
  } finally {
    loading.value = false
  }
}

async function toggleDetails(order) {
  if (expandedOrderId.value === order.id) {
    expandedOrderId.value = null
    return
  }

  expandedOrderId.value = order.id

  if (orderDetails.value[order.id]) return

  loadingDetails.value = {
    ...loadingDetails.value,
    [order.id]: true,
  }

  try {
    const response = await api.get(`/customer-orders/${order.id}`)
    const body = response.data

    orderDetails.value = {
      ...orderDetails.value,
      [order.id]: body?.data?.data ?? body?.data ?? body,
    }
  } catch (error) {
    orderDetails.value = {
      ...orderDetails.value,
      [order.id]: {
        _error:
          error.response?.data?.message ||
          'Unable to load order details. Please try again.',
      },
    }
  } finally {
    loadingDetails.value = {
      ...loadingDetails.value,
      [order.id]: false,
    }
  }
}

onMounted(loadOrders)
</script>

<template>
  <section class="orders-page">
    <div class="heading">
      <div>
        <h2 class="section-title">My Orders</h2>
        <p class="muted">View your orders, payments and delivery tracking.</p>
      </div>

      <button
        class="secondary-button"
        type="button"
        :disabled="loading"
        @click="loadOrders"
      >
        Refresh
      </button>
    </div>

    <!-- Filters -->
    <div v-if="!loading && !errorMessage && orders.length" class="toolbar">
      <div class="filter-chips" role="group" aria-label="Filter orders by status">
        <button
          v-for="filter in FILTERS"
          :key="filter.key"
          type="button"
          class="chip"
          :class="{ active: activeFilter === filter.key }"
          :aria-pressed="activeFilter === filter.key"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }}
          <span class="chip-count">{{ filterCounts[filter.key] }}</span>
        </button>
      </div>

      <input
        v-model="searchText"
        class="order-search"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        placeholder="Search by order number"
        aria-label="Search orders by order number"
      />
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="order-list"
      aria-busy="true"
      aria-label="Loading your orders"
    >
      <div v-for="n in 3" :key="n" class="order-card skeleton" aria-hidden="true">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line wide"></div>
      </div>
    </div>

    <div v-else-if="errorMessage" class="state error" role="alert">
      <p>{{ errorMessage }}</p>
      <button class="secondary-button" type="button" @click="loadOrders">
        Try again
      </button>
    </div>

    <div v-else-if="orders.length === 0" class="empty-state">
      <h3>No orders yet</h3>
      <p class="muted">Your online purchases will appear here.</p>
      <RouterLink to="/" class="primary-button">Start shopping</RouterLink>
    </div>

    <div v-else-if="filteredOrders.length === 0" class="empty-state">
      <h3>No matching orders</h3>
      <p class="muted">Try a different status or order number.</p>
      <button class="secondary-button" type="button" @click="clearFilters">
        Clear filters
      </button>
    </div>

    <div v-else class="order-list">
      <article
        v-for="order in filteredOrders"
        :key="order.id"
        class="order-card"
      >
        <div class="order-header">
          <div class="order-number">
            <span class="muted">Order number</span>
            <strong>{{ order.order_number }}</strong>
            <span class="muted">Placed on {{ formatDate(order.order_date) }}</span>
          </div>

          <div class="order-total">
            <span class="muted">Order total</span>
            <strong>Rs. {{ formatAmount(order.total_amount) }}</strong>
          </div>
        </div>

        <div class="badges">
          <span class="badge" :class="`status-${statusClass(order.status)}`">
            {{ formatStatus(order.status) }}
          </span>

          <span
            class="badge"
            :class="`payment-${statusClass(order.payment_status)}`"
          >
            Payment: {{ formatStatus(order.payment_status) }}
          </span>
        </div>

        <!-- Progress at a glance (not shown for cancelled orders) -->
        <ol
          v-if="orderGroup(order) !== 'cancelled'"
          class="tracker"
          aria-label="Order progress"
        >
          <li
            v-for="(label, index) in TRACKING_STEPS"
            :key="label"
            class="tracker-step"
            :class="{
              reached: index <= currentStep(order),
              current: index === currentStep(order) && index < TRACKING_STEPS.length - 1,
            }"
            :aria-current="
              index === currentStep(order) ? 'step' : undefined
            "
          >
            <span class="tracker-dot" aria-hidden="true"></span>
            <span class="tracker-label">{{ label }}</span>
          </li>
        </ol>

        <div class="order-summary">
          <span>Subtotal: Rs. {{ formatAmount(order.subtotal) }}</span>
          <span>Shipping: Rs. {{ formatAmount(order.shipping_amount) }}</span>
        </div>

        <button
          type="button"
          class="details-button"
          :aria-expanded="expandedOrderId === order.id"
          :aria-controls="`order-details-${order.id}`"
          @click="toggleDetails(order)"
        >
          <span>
            {{ expandedOrderId === order.id ? 'Hide details' : 'View order & tracking details' }}
          </span>

          <svg class="details-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div
          v-if="expandedOrderId === order.id"
          :id="`order-details-${order.id}`"
          class="details"
        >
          <p v-if="loadingDetails[order.id]" class="muted">
            Loading order details…
          </p>

          <p v-else-if="orderDetails[order.id]?._error" class="error">
            {{ orderDetails[order.id]._error }}
          </p>

          <template v-else-if="orderDetails[order.id]">
            <h3>Items</h3>

            <div
              v-if="!(orderDetails[order.id].items || []).length"
              class="muted"
            >
              No item details available.
            </div>

            <div
              v-for="item in orderDetails[order.id].items || []"
              :key="item.id"
              class="detail-row"
            >
              <div>
<RouterLink
  v-if="item.item?.slug && item.item?.public_id"
  :to="`/product/${item.item.slug}-${item.item.public_id}`"
  class="order-product-link"
>
  {{ item.item.item_name || 'Product' }}
</RouterLink>

<strong v-else>
  {{ item.item?.item_name || 'Product' }}
</strong>
                <div class="muted">
                  {{ item.item?.item_code || '' }}
                  · Qty: {{ item.quantity }}
                </div>
              </div>
              <span>Rs. {{ formatAmount(item.line_total) }}</span>
            </div>

            <h3>Payment details</h3>

            <div
              v-if="!(orderDetails[order.id].payments || []).length"
              class="muted"
            >
              No payment records available yet.
            </div>

            <div
              v-for="(payment, index) in orderDetails[order.id].payments || []"
              :key="payment.id || index"
              class="information-block"
            >
              <div class="detail-row">
                <span>Method</span>
                <strong>{{ formatStatus(payment.payment_method) }}</strong>
              </div>
              <div class="detail-row">
                <span>Payment status</span>
                <strong>{{ formatStatus(payment.payment_status) }}</strong>
              </div>
              <div class="detail-row">
                <span>Amount</span>
                <strong>Rs. {{ formatAmount(payment.amount) }}</strong>
              </div>
              <div class="detail-row">
                <span>Transaction reference</span>
                <strong>{{ payment.transaction_reference || 'Not available' }}</strong>
              </div>
              <div class="detail-row">
                <span>Payment date</span>
                <strong>{{ formatDate(payment.payment_date) }}</strong>
              </div>
            </div>

            <h3>Delivery tracking</h3>

            <div
              v-if="!(orderDetails[order.id].deliveries || []).length"
              class="muted"
            >
              Delivery details are not available yet.
            </div>

            <div
              v-for="(delivery, index) in orderDetails[order.id].deliveries || []"
              :key="delivery.id || delivery.delivery_reference || index"
              class="information-block"
            >
              <div class="detail-row">
                <span>Delivery status</span>
                <strong>{{ formatStatus(delivery.delivery_status) }}</strong>
              </div>
              <div class="detail-row">
                <span>Courier</span>
                <strong>{{ delivery.courier_name || 'Not assigned yet' }}</strong>
              </div>
              <div class="detail-row">
                <span>Tracking number</span>
                <strong>{{ delivery.tracking_number || 'Not available yet' }}</strong>
              </div>
              <div class="detail-row">
                <span>Expected delivery</span>
                <strong>{{ formatDate(delivery.expected_delivery_date) }}</strong>
              </div>
              <div class="detail-row">
                <span>Dispatched</span>
                <strong>{{ formatDate(delivery.dispatched_at) }}</strong>
              </div>
              <div class="detail-row">
                <span>Delivered</span>
                <strong>{{ formatDate(delivery.delivered_at) }}</strong>
              </div>
            </div>
          </template>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.orders-page {
  min-width: 0;
  color: var(--color-text);
}

.heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: var(--space-5);
}

.section-title {
  margin: 0 0 6px;
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.heading .muted {
  margin: 0;
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

/* ---------- Filters ---------- */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.chip-count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

.chip.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.chip.active .chip-count {
  background: rgb(255 255 255 / 20%);
  color: var(--color-on-primary);
}

.order-search {
  box-sizing: border-box;
  flex: 0 1 260px;
  min-width: 0;
  height: 40px;
  padding: 0 14px;
  border: var(--border-width-field, 1px) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.order-search::placeholder {
  color: var(--color-text-muted);
}

.order-search:focus {
  outline: none;
  border-color: var(--color-focus, var(--color-primary));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus-outline) 40%, transparent);
}

/* ---------- States ---------- */
.state,
.empty-state {
  padding: 36px 16px;
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.empty-state h3 {
  margin: 0 0 6px;
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
}

.empty-state .muted {
  margin: 0 0 var(--space-4);
}

.error {
  color: var(--color-danger, #b42318);
  overflow-wrap: anywhere;
}

/* ---------- Order cards ---------- */
.order-list {
  display: grid;
  gap: 18px;
}

.order-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

@media (hover: hover) {
  .order-card:hover {
    border-color: var(--color-border);
    box-shadow: var(--shadow-sm);
  }
}

.order-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border-soft);
}

.order-number,
.order-total {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.order-number strong {
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  overflow-wrap: anywhere;
}

.order-total {
  text-align: right;
}

.order-total strong {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

/* ---------- Status badges ---------- */
.badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--color-store-bg);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

.badge::before {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: currentColor;
  content: '';
}

/* Waiting */
.status-pending,
.payment-pending {
  color: #92400e;
  background: #fef3c7;
}

/* Being prepared */
.status-confirmed,
.status-processing {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
}

/* On its way */
.status-shipped {
  color: var(--color-on-primary);
  background: var(--color-primary);
}

/* Done */
.status-delivered,
.payment-paid {
  color: #166534;
  background: #dcfce7;
}

/* Problem */
.status-cancelled,
.payment-refunded,
.payment-failed {
  color: #991b1b;
  background: #fee2e2;
}

/* ---------- Progress tracker ---------- */
.tracker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 22px 0 6px;
  padding: 0;
  list-style: none;
}

.tracker-step {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 11px;
  text-align: center;
}

/* Line from the previous step to this one */
.tracker-step:not(:first-child)::before {
  position: absolute;
  top: 7px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--color-border);
  content: '';
}

.tracker-dot {
  position: relative;
  z-index: 1;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
}

.tracker-step.reached {
  color: var(--color-text);
}

.tracker-step.reached::before {
  background: var(--color-primary);
}

.tracker-step.reached .tracker-dot {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.tracker-step.current .tracker-dot {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.tracker-step.current .tracker-label {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.order-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 16px;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* ---------- Buttons ---------- */
.details-button,
.secondary-button {
  padding: 9px 13px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.secondary-button {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.details-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: 18px;
  width: 100%;
  min-height: 44px;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-align: left;
}

.details-chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.details-button[aria-expanded='true'] .details-chevron {
  transform: rotate(180deg);
}

.details-button:hover,
.secondary-button:hover {
  border-color: var(--color-text-muted);
}

.secondary-button:hover {
  color: var(--color-primary);
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 22px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition: background var(--transition-fast);
}

.primary-button:hover {
  background: var(--color-primary-hover);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.chip:focus-visible,
.details-button:focus-visible,
.secondary-button:focus-visible,
.primary-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

/* ---------- Expanded details ---------- */
.details {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border-soft);
  min-width: 0;
}

.details h3 {
  margin: 24px 0 12px;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.details h3:first-child {
  margin-top: 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid var(--color-border-soft);
  font-size: var(--font-size-sm);
}

.detail-row > * {
  min-width: 0;
  overflow-wrap: anywhere;
}

.detail-row > :last-child {
  text-align: right;
}

.detail-row > span:first-child:not(:only-child) {
  color: var(--color-text-muted);
}

.information-block {
  margin-bottom: 14px;
  padding: 4px 14px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.information-block .detail-row:last-child {
  border-bottom: 0;
}

/* ---------- Loading skeleton ---------- */
.order-card.skeleton {
  display: grid;
  gap: 12px;
}

.skeleton-line {
  height: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  animation: pulse 1.4s ease-in-out infinite;
}

.skeleton-line.short {
  width: 35%;
}

.skeleton-line.wide {
  height: 36px;
}

.order-product-link {
  color: inherit;
  text-decoration: none;
}

.order-product-link:hover {
  text-decoration: underline;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

/* ---------- Touch devices ---------- */
@media (pointer: coarse) {
  .chip,
  .secondary-button {
    min-height: 44px;
  }

  .order-search {
    height: 44px;
    font-size: 16px; /* stops iOS zooming into the field */
  }
}

/* ---------- Phones ---------- */
@media (max-width: 600px) {
  .order-total {
    text-align: left;
  }

  .order-card {
    padding: 14px;
  }

  /* Chips scroll sideways in one row instead of wrapping */
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .filter-chips::-webkit-scrollbar {
    display: none;
  }

  .order-search {
    flex-basis: auto;
    width: 100%;
  }
}

/* ---------- Small phones and fold cover screens ---------- */
@media (max-width: 420px) {
  .heading {
    flex-wrap: wrap;
  }

  /* Label above value so long references get the full width */
  .information-block .detail-row {
    flex-direction: column;
    gap: 2px;
  }

  .information-block .detail-row > :last-child {
    text-align: left;
  }

  .tracker-step {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
  }

  .chip,
  .order-card,
  .details-chevron,
  .details-button,
  .secondary-button,
  .order-search {
    transition: none;
  }
}
</style>