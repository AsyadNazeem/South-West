<script setup>
import { productPathFor } from '@/utils/productSeo.js'
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
import { accountFeedback } from '@/utils/accountFeedback'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import OrderThumbnail from '@/components/account/OrderThumbnail.vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

const orders = ref([])
const loading = ref(true)
const errorMessage = ref('')
const orderDetails = ref({})
const loadingDetails = ref({})
const activeFilter = ref('all')
const searchText = ref('')
const copiedTracking = ref('')
const visibleCount = ref(10)

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

const TRACKING_STEPS = ['Placed', 'Processing', 'Shipped', 'Delivered']

// One icon per step (done steps show a tick instead)
const STEP_ICONS = [
  'M9 4h6l1 2h3v14H5V6h3z M9 12h6 M9 16h4',
  'M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11',
  'M3 6h11v10H3z M14 9h4l3 3v4h-7 M7.5 19a1.5 1.5 0 1 0 .01 0 M17.5 19a1.5 1.5 0 1 0 .01 0',
  'M4 12l5 5L20 6',
]

const STATUS_MESSAGES = [
  'Your order has been placed. We will confirm it shortly.',
  'We are getting your order ready.',
  'Your order is on its way to you.',
  'Your order was delivered. Thank you for shopping with us!',
]

const STATUS_STEP = {
  pending: 0, placed: 0, confirmed: 0,
  processing: 1, packed: 1, ready: 1,
  shipped: 2, dispatched: 2, 'in-transit': 2, 'out-for-delivery': 2,
  delivered: 3, completed: 3,
}

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash on Delivery',
  cod: 'Cash on Delivery',
  card: 'Credit / Debit Card',
  koko: 'KOKO',
  mintpay: 'Mintpay',
}

const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (date) => {
  if (!date) return 'Not available'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime())
    ? 'Not available'
    : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatStatus = (status) =>
  String(status || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())

const statusClass = (status) =>
  String(status || 'unknown').toLowerCase().replaceAll('_', '-')

const paymentMethodLabel = (method) =>
  PAYMENT_METHOD_LABELS[String(method || '').toLowerCase()] || formatStatus(method)

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

const currentStep = (order) => STATUS_STEP[statusClass(order.status)] ?? 0

function stepState(order, index) {
  const current = currentStep(order)
  const last = TRACKING_STEPS.length - 1
  if (index < current || (current === last && index === last)) return 'done'
  if (index === current) return 'current'
  return 'upcoming'
}

const statusMessage = (order) => STATUS_MESSAGES[currentStep(order)] || ''

// Details helpers (the details come from the second API call)
const firstPayment = (id) => orderDetails.value[id]?.payments?.[0] || null
const firstDelivery = (id) => orderDetails.value[id]?.deliveries?.[0] || null

function shipTo(id) {
  const list = orderDetails.value[id]?.addresses || []
  return list.find(a => a.address_type === 'shipping') || list[0] || null
}

const addressText = (a) =>
  [a.address_line_1, a.address_line_2, a.city, a.state, a.postal_code].filter(Boolean).join(', ')

function deliveryLine(d) {
  if (d.delivered_at) return `Delivered ${formatDate(d.delivered_at)}`
  if (d.expected_delivery_date) return `Expected ${formatDate(d.expected_delivery_date)}`
  if (d.dispatched_at) return `Dispatched ${formatDate(d.dispatched_at)}`
  return ''
}

const filterCounts = computed(() => {
  const counts = { all: orders.value.length, active: 0, delivered: 0, cancelled: 0 }
  for (const order of orders.value) counts[orderGroup(order)]++
  return counts
})

const filteredOrders = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  return orders.value.filter(order => {
    const matchesFilter = activeFilter.value === 'all' || orderGroup(order) === activeFilter.value
    const matchesSearch = !query || String(order.order_number || '').toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  })
})

const visibleOrders = computed(() => filteredOrders.value.slice(0, visibleCount.value))

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
    // Clipboard can be blocked; the number is still visible to copy by hand.
  }
}

async function loadOrders() {
  loading.value = true
  errorMessage.value = ''

  if (!sessionStorage.getItem('customerToken')) {
    router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }

  try {
    const response = await api.get('/customer-orders', { params: { page: 1, limit: 50 } })
    orders.value = response.data?.data || []
  } catch (error) {
    errorMessage.value = accountFeedback(error, 'Unable to load your orders.')
    if (error.response?.status === 401) {
      sessionStorage.removeItem('customerToken')
      sessionStorage.removeItem('customerProfile')
      router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    }
  } finally {
    loading.value = false
  }
}

async function ensureDetails(order) {
  const id = order.id
  if (loadingDetails.value[id]) return
  if (orderDetails.value[id] && !orderDetails.value[id]._error) return

  loadingDetails.value = { ...loadingDetails.value, [id]: true }

  try {
    const response = await api.get(`/customer-orders/${id}`)
    const body = response.data
    orderDetails.value = { ...orderDetails.value, [id]: body?.data?.data ?? body?.data ?? body }
  } catch (error) {
    orderDetails.value = {
      ...orderDetails.value,
      [id]: { _error: accountFeedback(error, 'Unable to load order details.') },
    }
  } finally {
    loadingDetails.value = { ...loadingDetails.value, [id]: false }
  }
}

function retryDetails(order) {
  const next = { ...orderDetails.value }
  delete next[order.id]
  orderDetails.value = next
  ensureDetails(order)
}

// Load details for whichever orders are on screen
watch(visibleOrders, (list) => list.forEach(ensureDetails), { immediate: true })
watch([activeFilter, searchText], () => { visibleCount.value = 10 })

onMounted(async () => {
  await loadOrders()
  const id = router.currentRoute.value.query.orderId
  if (id) {
    const index = filteredOrders.value.findIndex(order => String(order.id) === String(id))
    if (index >= visibleCount.value) visibleCount.value = index + 1
    await nextTick()
    document.getElementById(`order-${id}`)?.scrollIntoView({ block: 'center' })
  }
})
</script>

<template>
  <section class="orders-page">

    <AccountPageHeader title="My orders" description="Browse purchases, payment details and delivery updates.">
      <button class="btn" type="button" :disabled="loading" @click="loadOrders">
        <svg class="refresh-icon" :class="{ spinning: loading }" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Refresh
      </button>
    </AccountPageHeader>

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
        >{{ filter.label }}<span class="tab-count">{{ filterCounts[filter.key] }}</span></button>
      </div>

      <label class="search">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.5" stroke="currentColor" stroke-width="1.9" />
          <path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
        <input v-model="searchText" type="search" autocomplete="off" placeholder="Search order number" aria-label="Search orders by order number" />
      </label>
    </div>

    <div v-if="loading" class="order-list" aria-busy="true" aria-label="Loading your orders">
      <div v-for="n in 3" :key="n" class="order-card skeleton" aria-hidden="true">
        <div class="col"><div class="skeleton-line short"></div><div class="skeleton-line"></div><div class="skeleton-line wide"></div></div>
        <div class="col details-col"><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>
      </div>
    </div>

    <div v-else-if="errorMessage" class="state" role="alert">
      <h3>Something went wrong</h3>
      <p class="muted">{{ errorMessage }}</p>
      <button class="btn" type="button" @click="loadOrders">Try again</button>
    </div>

    <div v-else-if="orders.length === 0" class="state">
      <h3>No orders yet</h3>
      <p class="muted">When you place an order, you can follow it here.</p>
      <RouterLink to="/" class="btn primary">Start shopping</RouterLink>
    </div>

    <div v-else-if="filteredOrders.length === 0" class="state">
      <h3>No matching orders</h3>
      <p class="muted">Try a different status or order number.</p>
      <button class="btn" type="button" @click="clearFilters">Clear filters</button>
    </div>

    <template v-else>
      <div class="order-list">
        <article v-for="order in visibleOrders" :id="`order-${order.id}`" :key="order.id" class="order-card">

          <!-- Left: order and progress -->
          <div class="col status-col">
            <header class="order-top">
              <div class="order-id">
                <h3 class="order-number">{{ order.order_number }}</h3>
                <span class="muted">{{ formatDate(order.order_date) }}</span>
              </div>
              <span class="status" :class="`tone-${tone(order.status)}`">{{ formatStatus(order.status) }}</span>
            </header>

            <div v-if="order.items?.length" class="order-preview">
              <OrderThumbnail :item="order.items[0].item" />
              <span class="preview-name">
                {{ order.items[0].item?.item_name || 'Purchased product' }}
                <small v-if="order.items.length > 1">+{{ order.items.length - 1 }} more</small>
              </span>
            </div>

           <div v-if="orderGroup(order) !== 'cancelled'" class="progress">
  <ol class="steps" aria-label="Order progress">
    <li
      v-for="(label, index) in TRACKING_STEPS"
      :key="label"
      class="step"
      :class="[stepState(order, index), { 'line-done': index <= currentStep(order) }]"
      :aria-current="stepState(order, index) === 'current' ? 'step' : undefined"
    >
      <span class="step-node" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path :d="stepState(order, index) === 'done' ? STEP_ICONS[3] : STEP_ICONS[index]" />
        </svg>
      </span>
      <span class="step-label">{{ label }}</span>
    </li>
  </ol>
  <p class="status-message">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01 M11 12h1v5" /></svg>
    {{ statusMessage(order) }}
  </p>
</div>
            <p v-else class="cancel-note">This order was cancelled.</p>
          </div>

          <!-- Right: details -->
          <div class="col details-col">

            <template v-if="orderDetails[order.id]?._error">
              <p class="error">{{ orderDetails[order.id]._error }}</p>
              <button type="button" class="link-button" @click="retryDetails(order)">Try again</button>
            </template>

            <div v-else-if="!orderDetails[order.id]" class="details-loading" aria-busy="true">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
            </div>

            <template v-else>
              <ul v-if="(orderDetails[order.id].items || []).length" class="items">
                <li v-for="item in orderDetails[order.id].items" :key="item.id">
                  <RouterLink
                    v-if="productPathFor(item.item)"
                    :to="productPathFor(item.item)"
                    class="item-name"
                  >{{ item.item.item_name || 'Product' }}</RouterLink>
                  <span v-else class="item-name">{{ item.item?.item_name || 'Product' }}</span>
                  <span class="item-qty">× {{ item.quantity }}</span>
                  <span class="item-price">LKR {{ formatAmount(item.line_total) }}</span>
                </li>
              </ul>

              <dl class="rows">
                <div v-if="firstPayment(order.id)">
                  <dt>Payment</dt>
                  <dd>
                    {{ paymentMethodLabel(firstPayment(order.id).payment_method) }}
                    <span class="dot-status" :class="`tone-${tone(firstPayment(order.id).payment_status)}`">{{ formatStatus(firstPayment(order.id).payment_status) }}</span>
                  </dd>
                </div>
                <div v-else>
                  <dt>Payment</dt>
                  <dd><span class="dot-status" :class="`tone-${tone(order.payment_status)}`">{{ formatStatus(order.payment_status) }}</span></dd>
                </div>

                <div v-if="shipTo(order.id)">
                  <dt>Ship to</dt>
                  <dd>{{ shipTo(order.id).recipient_name }}<small>{{ addressText(shipTo(order.id)) }}</small></dd>
                </div>

                <div>
                  <dt>Delivery</dt>
                  <dd v-if="firstDelivery(order.id)">
                    {{ firstDelivery(order.id).courier_name || 'Courier not assigned yet' }}
                    <small v-if="deliveryLine(firstDelivery(order.id))">{{ deliveryLine(firstDelivery(order.id)) }}</small>
                    <small v-if="firstDelivery(order.id).tracking_number" class="tracking">
                      {{ firstDelivery(order.id).tracking_number }}
                      <button type="button" class="link-button" @click="copyTracking(firstDelivery(order.id).tracking_number)">
                        {{ copiedTracking === String(firstDelivery(order.id).tracking_number) ? 'Copied' : 'Copy' }}
                      </button>
                    </small>
                  </dd>
                  <dd v-else class="muted-dd">Not shipped yet</dd>
                </div>
              </dl>

              <p
                v-if="firstPayment(order.id) && ['cash', 'cod'].includes(String(firstPayment(order.id).payment_method).toLowerCase()) && tone(firstPayment(order.id).payment_status) !== 'success'"
                class="note"
              >Please pay the delivery person when your order arrives.</p>
            </template>

            <dl class="totals">
              <div><dt>Shipping</dt><dd>LKR {{ formatAmount(order.shipping_amount) }}</dd></div>
              <div class="grand-total"><dt>Total</dt><dd>LKR {{ formatAmount(order.total_amount) }}</dd></div>
            </dl>
          </div>

        </article>
      </div>

      <div v-if="visibleCount < filteredOrders.length" class="more">
        <button type="button" class="btn" @click="visibleCount += 10">
          Show more ({{ filteredOrders.length - visibleCount }} left)
        </button>
      </div>
    </template>

  </section>
</template>

<style scoped>
.orders-page { min-width: 0; color: var(--color-text); }
.muted { color: var(--color-text-muted); font-size: 12px; overflow-wrap: anywhere; }
button:disabled { cursor: not-allowed; opacity: .55; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; padding: 0 14px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); text-decoration: none; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.btn.primary:hover { background: var(--color-primary-hover); color: var(--color-on-primary); }
.link-button { padding: 0; background: none; border: 0; color: var(--color-primary); font: 600 12px var(--font-family-base); cursor: pointer; }
.link-button:hover { text-decoration: underline; }
.refresh-icon { width: 15px; height: 15px; }
.refresh-icon.spinning { animation: spin .9s linear infinite; }

/* Toolbar */
.toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--color-border-soft); }
.tabs { display: flex; gap: 22px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab { display: inline-flex; align-items: center; gap: 6px; padding: 10px 0; margin-bottom: -1px; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--color-text-muted); font: 600 13px/1 var(--font-family-base); white-space: nowrap; cursor: pointer; }
.tab:hover:not(.active) { color: var(--color-text); }
.tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.tab-count { font-size: 11px; font-weight: 500; opacity: .75; }
.search { display: flex; align-items: center; gap: 8px; flex: 0 1 230px; min-width: 0; height: 34px; margin-bottom: 6px; padding: 0 10px; background: var(--color-surface); color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.search svg { width: 15px; height: 15px; flex-shrink: 0; }
.search:focus-within { border-color: var(--color-primary); }
.search input { flex: 1; min-width: 0; background: transparent; color: var(--color-text); border: 0; outline: 0; font: 400 13px var(--font-family-base); }
.search input::placeholder { color: var(--color-text-muted); }

/* States */
.state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 20px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); }
.state h3 { margin: 0; font-family: var(--font-family-display); font-size: 16px; }
.state .muted { margin-bottom: 10px; font-size: 13px; }
.error { margin: 0 0 6px; color: #b42318; font-size: 13px; }

/* Card: two halves */
.order-list { display: grid; gap: 12px; }
.order-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-width: 0; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.col { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px 18px; }
.details-col { background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); border-left: 1px solid var(--color-border); }

/* Left half */
.order-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.order-id { display: grid; gap: 1px; min-width: 0; }
.order-number { margin: 0; font-family: var(--font-family-display); font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.status { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; font-size: 12px; font-weight: 600; white-space: nowrap; }
.status::before, .dot-status::before { content: ''; width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: currentColor; }
.tone-neutral { color: var(--color-text-muted); }
.tone-warning { color: #b45309; }
.tone-info, .tone-progress { color: var(--color-primary); }
.tone-success { color: #15803d; }
.tone-danger { color: #b42318; }

.order-preview { display: flex; align-items: center; gap: 10px; }
.preview-name { min-width: 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.preview-name small { margin-left: 4px; color: var(--color-text-muted); font-size: 12px; font-weight: 500; }

/* Progress */
.progress { margin-top: auto; }
.steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.step { position: relative; display: grid; justify-items: center; gap: 7px; }
.step:not(:first-child)::before { content: ''; position: absolute; top: 12px; right: 50%; width: 100%; height: 2px; background: var(--color-border); }
.step.line-done::before { background: var(--color-primary); }
.step-node { position: relative; z-index: 1; display: grid; place-items: center; width: 26px; height: 26px; box-sizing: border-box; background: var(--color-surface); color: var(--color-text-muted); border: 2px solid var(--color-border); border-radius: 50%; }
.step-node svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.step.done .step-node { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.step.current .step-node { color: var(--color-primary); border-color: var(--color-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 16%, transparent); }
.step-label { color: var(--color-text-muted); font-size: 11px; }
.step.done .step-label { color: var(--color-text); }
.step.current .step-label { color: var(--color-primary); font-weight: 700; }
.status-message { display: flex; align-items: flex-start; gap: 8px; margin: 14px 0 0; padding: 9px 11px; background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); color: var(--color-text); border-radius: var(--radius-md); font-size: 12px; line-height: 1.45; }
.status-message svg { flex-shrink: 0; width: 15px; height: 15px; margin-top: 1px; fill: none; stroke: var(--color-primary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cancel-note { margin: auto 0 0; padding: 9px 11px; background: #fef2f2; color: #b42318; border-radius: var(--radius-md); font-size: 12px; font-weight: 600; }

/* Totals as a white box */
.totals { display: grid; gap: 4px; margin: auto 0 0; padding: 10px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }

/* Right half */
.items { display: grid; gap: 6px; margin: 0; padding: 0 0 12px; list-style: none; border-bottom: 1px solid var(--color-border); }
.items li { display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
.item-name { flex: 1; min-width: 0; overflow: hidden; color: var(--color-text); font-weight: 500; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
a.item-name:hover { color: var(--color-primary); text-decoration: underline; }
.item-qty { flex-shrink: 0; color: var(--color-text-muted); font-size: 12px; }
.item-price { flex-shrink: 0; font-weight: 600; font-variant-numeric: tabular-nums; }

.rows { display: grid; gap: 8px; margin: 0; }
.rows > div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; font-size: 13px; }
.rows dt { color: var(--color-text-muted); }
.rows dd { margin: 0; font-weight: 500; overflow-wrap: anywhere; }
.rows dd small { display: block; margin-top: 1px; color: var(--color-text-muted); font-size: 12px; font-weight: 400; line-height: 1.4; }
.rows .muted-dd { color: var(--color-text-muted); font-weight: 400; }
.dot-status { display: inline-flex; align-items: center; gap: 5px; margin-left: 6px; font-size: 12px; font-weight: 600; }
.tracking { display: flex !important; align-items: center; gap: 8px; }
.note { margin: 0; color: var(--color-text-muted); font-size: 12px; }

.totals > div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
.totals dt { color: var(--color-text-muted); }
.totals dd { margin: 0; font-variant-numeric: tabular-nums; }
.totals .grand-total { font-size: 14px; font-weight: 700; }
.totals .grand-total dt { color: var(--color-text); }

.more { display: flex; justify-content: center; margin-top: 16px; }

/* Loading */
.details-loading { display: grid; gap: 10px; }
.skeleton-line { height: 11px; background: var(--color-border); border-radius: 4px; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-line.short { width: 40%; }
.skeleton-line.wide { height: 32px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes spin { to { transform: rotate(360deg); } }

.tab:focus-visible, .btn:focus-visible, .link-button:focus-visible, a.item-name:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

@media (pointer: coarse) { .search input { font-size: 16px; } }

/* Tablet and phone: stack the halves */
@media (max-width: 760px) {
  .order-card { grid-template-columns: minmax(0, 1fr); }
  .details-col { border-left: 0; border-top: 1px solid var(--color-border-soft); }
  .toolbar { flex-direction: column; align-items: stretch; gap: 10px; border-bottom: 0; }
  .tabs { border-bottom: 1px solid var(--color-border-soft); }
  .search { flex-basis: auto; width: 100%; margin-bottom: 0; }
  .col { padding: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line, .refresh-icon.spinning { animation: none; }
}
</style>