<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

const orders = ref([])
const loading = ref(true)
const errorMessage = ref('')
const expandedOrderId = ref(null)
const orderDetails = ref({})
const loadingDetails = ref({})
const activeFilter = ref('all')
const searchText = ref('')
const copiedTracking = ref('')

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

// Progress tracker shown on each order. Add any extra status your
// backend uses to STATUS_STEP (0 = placed ... 3 = delivered).
const TRACKING_STEPS = ['Placed', 'Processing', 'Shipped', 'Delivered']

const STATUS_MESSAGES = [
  'Your order has been placed. We will confirm it shortly.',
  'We are getting your order ready.',
  'Your order is on its way to you.',
  'Your order was delivered. Thank you for shopping with us!',
]

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

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash on Delivery',
  cod: 'Cash on Delivery',
  card: 'Credit / Debit Card',
  koko: 'KOKO',
  mintpay: 'Mintpay',
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

const paymentMethodLabel = (method) =>
  PAYMENT_METHOD_LABELS[String(method || '').toLowerCase()] ||
  formatStatus(method)

// Colour family for a status badge
function tone(status) {
  const key = statusClass(status)

  if (['delivered', 'completed', 'paid', 'success'].includes(key)) return 'success'
  if (['cancelled', 'failed', 'refunded', 'rejected'].includes(key)) return 'danger'
  if (['shipped', 'dispatched', 'in-transit', 'out-for-delivery'].includes(key)) return 'progress'
  if (['confirmed', 'processing', 'packed', 'ready'].includes(key)) return 'info'
  if (['pending', 'placed', 'unpaid', 'partially-paid'].includes(key)) return 'warning'

  return 'neutral'
}

function orderGroup(order) {
  const status = statusClass(order.status)

  if (status === 'cancelled') return 'cancelled'
  if (status === 'delivered' || status === 'completed') return 'delivered'
  return 'active'
}

function currentStep(order) {
  return STATUS_STEP[statusClass(order.status)] ?? 0
}

function stepState(order, index) {
  const current = currentStep(order)
  const last = TRACKING_STEPS.length - 1

  if (index < current || (current === last && index === last)) return 'done'
  if (index === current) return 'current'
  return 'upcoming'
}

function statusMessage(order) {
  return STATUS_MESSAGES[currentStep(order)] || ''
}

function deliveryEvents(delivery) {
  return [
    {
      label: 'Dispatched',
      date: delivery.dispatched_at,
      done: Boolean(delivery.dispatched_at),
    },
    {
      label: 'Expected delivery',
      date: delivery.expected_delivery_date,
      done: Boolean(delivery.delivered_at),
    },
    {
      label: 'Delivered',
      date: delivery.delivered_at,
      done: Boolean(delivery.delivered_at),
    },
  ]
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

async function copyTracking(number) {
  if (!number) return

  try {
    await navigator.clipboard.writeText(String(number))
    copiedTracking.value = String(number)

    setTimeout(() => {
      if (copiedTracking.value === String(number)) copiedTracking.value = ''
    }, 1800)
  } catch {
    // Clipboard access can be blocked; the number is still visible to copy by hand.
  }
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

    <!-- Heading -->
    <header class="heading">
      <div>
        <h2 class="page-title">My Orders</h2>
        <p class="subtitle">Track your orders, payments and deliveries in one place.</p>
      </div>

      <button
        class="refresh-button"
        type="button"
        :disabled="loading"
        @click="loadOrders"
      >
        <svg
          class="refresh-icon"
          :class="{ spinning: loading }"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Refresh
      </button>
    </header>

    <!-- Filters -->
    <div v-if="!loading && !errorMessage && orders.length" class="toolbar">
      <div class="tabs" role="group" aria-label="Filter orders by status">
        <button
          v-for="filter in FILTERS"
          :key="filter.key"
          type="button"
          class="tab"
          :class="{ active: activeFilter === filter.key }"
          :aria-pressed="activeFilter === filter.key"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }}
          <span class="tab-count">{{ filterCounts[filter.key] }}</span>
        </button>
      </div>

      <label class="search">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.5" stroke="currentColor" stroke-width="1.9" />
          <path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>

        <input
          v-model="searchText"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          placeholder="Search by order number"
          aria-label="Search orders by order number"
        />
      </label>
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

    <!-- Error -->
    <div v-else-if="errorMessage" class="state state-error" role="alert">
      <span class="state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
          <path d="M12 7.5v5.5M12 16.2h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </span>

      <h3>Something went wrong</h3>
      <p class="muted">{{ errorMessage }}</p>

      <button class="secondary-button" type="button" @click="loadOrders">
        Try again
      </button>
    </div>

    <!-- No orders -->
    <div v-else-if="orders.length === 0" class="state">
      <span class="state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M6 8h12l-1 11H7L6 8Z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
          <path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        </svg>
      </span>

      <h3>No orders yet</h3>
      <p class="muted">When you place an order, you can follow it here.</p>

      <RouterLink to="/" class="primary-button">Start shopping</RouterLink>
    </div>

    <!-- No matches -->
    <div v-else-if="filteredOrders.length === 0" class="state">
      <span class="state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="10.8" cy="10.8" r="6.5" stroke="currentColor" stroke-width="1.8" />
          <path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </span>

      <h3>No matching orders</h3>
      <p class="muted">Try a different status or order number.</p>

      <button class="secondary-button" type="button" @click="clearFilters">
        Clear filters
      </button>
    </div>

    <!-- Orders -->
    <template v-else>

      <p class="result-count">
        Showing {{ filteredOrders.length }} of {{ orders.length }}
        order{{ orders.length === 1 ? '' : 's' }}
      </p>

      <div class="order-list">

        <article
          v-for="order in filteredOrders"
          :key="order.id"
          class="order-card"
          :class="`group-${orderGroup(order)}`"
        >

          <!-- Top: order number, date and badges -->
          <header class="order-top">

            <div class="order-id">
              <span class="eyebrow">Order</span>
              <h3 class="order-number">{{ order.order_number }}</h3>
              <span class="muted">Placed on {{ formatDate(order.order_date) }}</span>
            </div>

            <div class="badges">
              <span class="badge" :class="`tone-${tone(order.status)}`">
                {{ formatStatus(order.status) }}
              </span>

              <span class="badge badge-soft" :class="`tone-${tone(order.payment_status)}`">
                Payment: {{ formatStatus(order.payment_status) }}
              </span>
            </div>

          </header>

          <!-- Progress -->
          <div v-if="orderGroup(order) !== 'cancelled'" class="progress">

            <ol class="tracker" aria-label="Order progress">
              <li
                v-for="(label, index) in TRACKING_STEPS"
                :key="label"
                class="tracker-step"
                :class="[
                  stepState(order, index),
                  { 'line-done': index <= currentStep(order) }
                ]"
                :aria-current="stepState(order, index) === 'current' ? 'step' : undefined"
              >
                <span class="tracker-dot" aria-hidden="true">
                  <svg
                    v-if="stepState(order, index) === 'done'"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="m5.5 12.5 4.2 4.2L18.5 8"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>

                <span class="tracker-label">{{ label }}</span>
              </li>
            </ol>

            <p class="status-message">{{ statusMessage(order) }}</p>

          </div>

          <p v-else class="cancel-note">
            This order was cancelled.
          </p>

          <!-- Bottom: total and details button -->
          <footer class="order-bottom">

            <div class="order-total">
              <span class="muted">Order total</span>
              <strong>Rs. {{ formatAmount(order.total_amount) }}</strong>
            </div>

            <button
              type="button"
              class="details-button"
              :aria-expanded="expandedOrderId === order.id"
              :aria-controls="`order-details-${order.id}`"
              @click="toggleDetails(order)"
            >
              <span>
                {{ expandedOrderId === order.id ? 'Hide details' : 'View details' }}
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

          </footer>

          <!-- Details -->
          <div
            v-if="expandedOrderId === order.id"
            :id="`order-details-${order.id}`"
            class="details"
          >

            <div v-if="loadingDetails[order.id]" class="details-loading">
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line wide"></div>
            </div>

            <p v-else-if="orderDetails[order.id]?._error" class="error">
              {{ orderDetails[order.id]._error }}
            </p>

            <template v-else-if="orderDetails[order.id]">

              <!-- Items -->
              <section class="detail-section">
                <h4>Items in this order</h4>

                <p
                  v-if="!(orderDetails[order.id].items || []).length"
                  class="muted"
                >
                  No item details available.
                </p>

                <ul v-else class="item-list">
                  <li
                    v-for="item in orderDetails[order.id].items"
                    :key="item.id"
                    class="item-row"
                  >
                    <span class="item-thumb" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 8h12l-1 11H7L6 8Z"
                          stroke="currentColor"
                          stroke-width="1.6"
                          stroke-linejoin="round"
                        />
                        <path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                      </svg>
                    </span>

                    <span class="item-info">
                      <RouterLink
                        v-if="item.item?.slug && item.item?.public_id"
                        :to="`/product/${item.item.slug}-${item.item.public_id}`"
                        class="item-name link"
                      >
                        {{ item.item.item_name || 'Product' }}
                      </RouterLink>

                      <strong v-else class="item-name">
                        {{ item.item?.item_name || 'Product' }}
                      </strong>

                      <span class="muted">
                        <template v-if="item.item?.item_code">{{ item.item.item_code }} · </template>
                        Qty {{ item.quantity }}
                      </span>
                    </span>

                    <span class="item-price">Rs. {{ formatAmount(item.line_total) }}</span>
                  </li>
                </ul>

                <!-- Totals -->
                <dl class="totals">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>Rs. {{ formatAmount(order.subtotal) }}</dd>
                  </div>
                  <div>
                    <dt>Shipping</dt>
                    <dd>Rs. {{ formatAmount(order.shipping_amount) }}</dd>
                  </div>
                  <div class="grand-total">
                    <dt>Total</dt>
                    <dd>Rs. {{ formatAmount(order.total_amount) }}</dd>
                  </div>
                </dl>
              </section>

              <!-- Payment -->
              <section class="detail-section">
                <h4>Payment</h4>

                <p
                  v-if="!(orderDetails[order.id].payments || []).length"
                  class="muted"
                >
                  No payment records available yet.
                </p>

                <div
                  v-for="(payment, index) in orderDetails[order.id].payments || []"
                  :key="payment.id || index"
                  class="info-card"
                >
                  <div class="info-card-head">
                    <strong>{{ paymentMethodLabel(payment.payment_method) }}</strong>
                    <span class="badge badge-soft" :class="`tone-${tone(payment.payment_status)}`">
                      {{ formatStatus(payment.payment_status) }}
                    </span>
                  </div>

                  <dl class="info-grid">
                    <div>
                      <dt>Amount</dt>
                      <dd>Rs. {{ formatAmount(payment.amount) }}</dd>
                    </div>
                    <div>
                      <dt>Payment date</dt>
                      <dd>{{ formatDate(payment.payment_date) }}</dd>
                    </div>
                    <div class="wide">
                      <dt>Reference</dt>
                      <dd>{{ payment.transaction_reference || 'Not available' }}</dd>
                    </div>
                  </dl>

                  <p
                    v-if="['cash', 'cod'].includes(String(payment.payment_method).toLowerCase()) &&
                      tone(payment.payment_status) !== 'success'"
                    class="info-note"
                  >
                    Please pay the delivery person when your order arrives.
                  </p>
                </div>
              </section>

              <!-- Delivery -->
              <section class="detail-section">
                <h4>Delivery tracking</h4>

                <p
                  v-if="!(orderDetails[order.id].deliveries || []).length"
                  class="muted"
                >
                  Delivery details are not available yet. We will update this
                  once your order is ready to ship.
                </p>

                <div
                  v-for="(delivery, index) in orderDetails[order.id].deliveries || []"
                  :key="delivery.id || delivery.delivery_reference || index"
                  class="info-card"
                >
                  <div class="info-card-head">
                    <strong>{{ delivery.courier_name || 'Courier not assigned yet' }}</strong>
                    <span class="badge badge-soft" :class="`tone-${tone(delivery.delivery_status)}`">
                      {{ formatStatus(delivery.delivery_status) }}
                    </span>
                  </div>

                  <div class="tracking-row">
                    <div>
                      <span class="tracking-label">Tracking number</span>
                      <strong class="tracking-number">
                        {{ delivery.tracking_number || 'Not available yet' }}
                      </strong>
                    </div>

                    <button
                      v-if="delivery.tracking_number"
                      type="button"
                      class="copy-button"
                      @click="copyTracking(delivery.tracking_number)"
                    >
                      {{ copiedTracking === String(delivery.tracking_number) ? 'Copied ✓' : 'Copy' }}
                    </button>
                  </div>

                  <ol class="timeline">
                    <li
                      v-for="event in deliveryEvents(delivery)"
                      :key="event.label"
                      class="timeline-item"
                      :class="{ done: event.done }"
                    >
                      <span class="timeline-dot" aria-hidden="true"></span>
                      <span class="timeline-label">{{ event.label }}</span>
                      <span class="timeline-date">{{ formatDate(event.date) }}</span>
                    </li>
                  </ol>
                </div>
              </section>

            </template>

          </div>

        </article>

      </div>

    </template>

  </section>
</template>

<style scoped>
.orders-page {
  min-width: 0;
  color: var(--color-text);
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

/* =========================
   Heading
   ========================= */

.heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: var(--space-5);
}

.page-title {
  margin: 0 0 4px;
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg, 20px);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.refresh-button:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.refresh-icon {
  width: 16px;
  height: 16px;
}

.refresh-icon.spinning {
  animation: spin 0.9s linear infinite;
}

/* =========================
   Toolbar
   ========================= */

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.tabs {
  display: inline-flex;
  max-width: 100%;
  padding: 4px;
  overflow-x: auto;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  scrollbar-width: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

.tab:hover:not(.active) {
  color: var(--color-text);
}

.tab-count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

.tab.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-sm);
}

.tab.active .tab-count {
  background: rgb(255 255 255 / 22%);
  color: var(--color-on-primary);
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 280px;
  min-width: 0;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.search:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}

.search input::placeholder {
  color: var(--color-text-muted);
}

.result-count {
  margin: 0 0 var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* =========================
   States
   ========================= */

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 44px 20px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  text-align: center;
}

.state h3 {
  margin: 8px 0 0;
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
}

.state .muted {
  margin: 0 0 var(--space-3);
}

.state-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary);
}

.state-icon svg {
  width: 28px;
  height: 28px;
}

.state-error .state-icon {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

/* =========================
   Order cards
   ========================= */

.order-list {
  display: grid;
  gap: var(--space-4);
}

.order-card {
  position: relative;
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

/* Coloured edge shows the state of the order at a glance */
.order-card::before {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 0;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--color-primary);
  content: '';
}

.order-card.group-delivered::before {
  background: var(--color-success, #16a34a);
}

.order-card.group-cancelled::before {
  background: var(--color-danger);
}

@media (hover: hover) {
  .order-card:hover {
    border-color: var(--color-border);
    box-shadow: var(--shadow-sm);
  }
}

/* ---------- Top ---------- */

.order-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
}

.order-id {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.eyebrow {
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.order-number {
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  overflow-wrap: anywhere;
}

/* ---------- Badges ---------- */

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
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

.tone-neutral {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.tone-warning {
  background: #fef3c7;
  color: #92400e;
}

.tone-info {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary);
}

.tone-progress {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.tone-success {
  background: var(--color-success-bg, #dcfce7);
  color: var(--color-success, #166534);
}

.tone-danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* The payment badge is quieter than the main status badge */
.badge-soft.tone-progress {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary);
}

/* ---------- Progress ---------- */

.progress {
  margin-top: 26px;
}

.tracker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.tracker-step {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  text-align: center;
}

/* Line coming from the previous step */
.tracker-step:not(:first-child)::before {
  position: absolute;
  top: 12px;
  right: 50%;
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background: var(--color-border-soft);
  content: '';
}

.tracker-step.line-done::before {
  background: var(--color-primary);
}

.tracker-dot {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  box-sizing: border-box;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-on-primary);
}

.tracker-dot svg {
  width: 14px;
  height: 14px;
}

.tracker-step.done .tracker-dot {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.tracker-step.done .tracker-label {
  color: var(--color-text);
}

.tracker-step.current .tracker-dot {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.tracker-step.current .tracker-dot::after {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-primary);
  content: '';
}

.tracker-step.current .tracker-label {
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.status-message {
  margin: 16px 0 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  text-align: center;
}

.cancel-note {
  margin: 20px 0 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

/* ---------- Bottom ---------- */

.order-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-soft);
}

.order-total {
  display: grid;
  gap: 2px;
}

.order-total strong {
  color: var(--color-text);
  font-size: var(--font-size-lg, 18px);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}

.details-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.details-button:hover,
.details-button[aria-expanded='true'] {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.details-chevron {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-fast);
}

.details-button[aria-expanded='true'] .details-chevron {
  transform: rotate(180deg);
}

/* =========================
   Expanded details
   ========================= */

.details {
  display: grid;
  gap: var(--space-5);
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-soft);
  min-width: 0;
}

.details-loading {
  display: grid;
  gap: 12px;
}

.detail-section h4 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-section h4::after {
  flex: 1;
  height: 1px;
  background: var(--color-border-soft);
  content: '';
}

/* ---------- Items ---------- */

.item-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-soft);
}

.item-thumb {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.item-thumb svg {
  width: 22px;
  height: 22px;
}

.item-info {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.item-name {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

.item-name.link {
  text-decoration: none;
}

.item-name.link:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.item-price {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.totals {
  display: grid;
  gap: 8px;
  margin: 14px 0 0 auto;
  max-width: 320px;
}

.totals > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: var(--font-size-sm);
}

.totals dt {
  color: var(--color-text-muted);
}

.totals dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.totals .grand-total {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-soft);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.totals .grand-total dt {
  color: var(--color-text);
}

/* ---------- Payment / delivery cards ---------- */

.info-card {
  margin-bottom: 12px;
  padding: 16px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.info-card:last-child {
  margin-bottom: 0;
}

.info-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 14px;
}

.info-card-head strong {
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin: 0;
}

.info-grid .wide {
  grid-column: 1 / -1;
}

.info-grid dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.info-grid dd {
  margin: 2px 0 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

.info-note {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--color-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

/* ---------- Tracking number ---------- */

.tracking-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.tracking-label {
  display: block;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.tracking-number {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

.copy-button {
  flex-shrink: 0;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  transition: border-color var(--transition-fast);
}

.copy-button:hover {
  border-color: var(--color-primary);
}

/* ---------- Delivery timeline ---------- */

.timeline {
  display: grid;
  gap: 0;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Vertical line between the dots */
.timeline-item:not(:last-child)::before {
  position: absolute;
  top: 24px;
  bottom: -8px;
  left: 7px;
  width: 2px;
  background: var(--color-border-soft);
  content: '';
}

.timeline-dot {
  position: relative;
  z-index: 1;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
}

.timeline-item.done {
  color: var(--color-text);
}

.timeline-item.done .timeline-dot {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.timeline-label {
  font-weight: var(--font-weight-semibold);
}

.timeline-date {
  font-variant-numeric: tabular-nums;
}

/* =========================
   Buttons
   ========================= */

.secondary-button,
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 22px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.secondary-button {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.secondary-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.primary-button {
  border: 1px solid transparent;
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.primary-button:hover {
  background: var(--color-primary-hover);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.tab:focus-visible,
.refresh-button:focus-visible,
.details-button:focus-visible,
.copy-button:focus-visible,
.secondary-button:focus-visible,
.primary-button:focus-visible,
.item-name.link:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

/* =========================
   Loading skeleton
   ========================= */

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
  height: 40px;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =========================
   Touch devices
   ========================= */

@media (pointer: coarse) {
  .tab,
  .refresh-button,
  .details-button {
    min-height: 44px;
  }

  .search {
    height: 46px;
  }

  .search input {
    font-size: 16px; /* stops iOS zooming into the field */
  }
}

/* =========================
   Phones
   ========================= */

@media (max-width: 600px) {
  .order-card {
    padding: 16px 14px 16px 18px;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search {
    flex-basis: auto;
    width: 100%;
  }

  .order-bottom {
    flex-direction: column;
    align-items: stretch;
  }

  .details-button {
    justify-content: center;
    width: 100%;
  }

  .totals {
    max-width: none;
  }
}

/* =========================
   Small phones and fold cover screens
   ========================= */

@media (max-width: 420px) {
  .heading {
    flex-wrap: wrap;
  }

  .refresh-button {
    width: 100%;
    justify-content: center;
  }

  .tracker-step {
    font-size: 10px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .tracking-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .timeline-item {
    grid-template-columns: 20px minmax(0, 1fr);
  }

  .timeline-date {
    grid-column: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line,
  .refresh-icon.spinning {
    animation: none;
  }

  .order-card,
  .tab,
  .details-chevron,
  .details-button,
  .search,
  .copy-button {
    transition: none;
  }
}
</style>