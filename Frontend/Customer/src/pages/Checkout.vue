<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const notice = ref('')
const addresses = ref([])
const selectedAddressId = ref('')
const cart = ref(null)
const order = ref(null)
const idempotencyKey = ref('')

// Server-calculated price and delivery estimate
const quote = ref(null)
const quoteLoading = ref(false)
const quoteError = ref('')
let quoteRequestNumber = 0

const confirmationItems = ref([])
const confirmationAddress = ref(null)

const promoCodeInput = ref('')
const appliedPromoCode = ref('')
const promoMessage = ref('')
const promoError = ref('')
const promoBusy = ref(false)

// --------------------------------------------------
// Payment methods
// Set `available: true` to switch a method on. `value` is the
// payment_method string sent to the backend.
// Logos live in public/images/payments/
// --------------------------------------------------

const PAYMENT_METHODS = [
  {
    id: 'cod',
    value: 'cash',
    group: 'Pay on delivery',
    name: 'Cash on Delivery',
    description: 'Pay in cash when your order is delivered.',
    note: 'You will pay the courier when your order arrives. Please keep the exact amount ready if possible.',
    logo: '/images/payments/cod.svg',
    available: true,
  },
  {
    id: 'card',
    value: 'card',
    group: 'Pay online',
    name: 'Credit / Debit Card',
    description: 'Select to preview the card price.',
    note: '',
    logo: '/images/payments/card.svg',
    available: true,
  },
  {
    id: 'koko',
    value: 'koko',
    group: 'Buy now, pay later',
    name: 'KOKO',
    description: 'Select to preview the KOKO price.',
    note: '',
    logo: '/images/payments/koko.svg',
    available: true,
  },
  {
    id: 'mintpay',
    value: 'mintpay',
    group: 'Buy now, pay later',
    name: 'Mintpay',
    description: 'Select to preview the Mintpay price.',
    note: '',
    logo: '/images/payments/mintpay.svg',
    available: true,
  },
]
const paymentGroups = [...new Set(PAYMENT_METHODS.map(method => method.group))]
  .map(title => ({
    title,
    methods: PAYMENT_METHODS.filter(method => method.group === title),
  }))

const selectedPaymentId = ref('cod')
const failedLogos = reactive({})

// The chosen method, only if it can currently be used.
const paymentMethod = computed(() =>
  PAYMENT_METHODS.find(
    method => method.id === selectedPaymentId.value && method.available
  ) || null
)

// --------------------------------------------------
// Checkout data
// --------------------------------------------------


const checkoutToken = computed(() => {
  const token = route.params.token
  return typeof token === 'string' &&
    /^[a-f0-9]{64}$/i.test(token)
    ? token
    : ''
})

const directPurchase = computed(() => Boolean(route.params.token))

const validDirectPurchase = computed(() =>
  Boolean(checkoutToken.value)
)


const shippingAddresses = computed(() =>
  addresses.value.filter(address => address.address_type === 'shipping')
)

const cartItems = computed(() => {
  const items = cart.value?.items ??
    cart.value?.cart_items ??
    cart.value?.CartItems ??
    []
  return Array.isArray(items) ? items : []
})

const cartReady = computed(() =>
  directPurchase.value
    ? validDirectPurchase.value
    : Boolean(cart.value?.id) && cartItems.value.length > 0
)

const canPlaceOrder = computed(() =>
  !submitting.value &&
  !quoteLoading.value &&
  Boolean(quote.value) &&
  !quoteError.value &&
  cartReady.value &&
  Boolean(selectedAddressId.value) &&
  Boolean(paymentMethod.value) &&
  selectedPaymentId.value === 'cod' &&
  Number(quote.value.address_id) === Number(selectedAddressId.value)
)

const steps = computed(() => [
  { label: directPurchase.value ? 'Buy Now' : 'Cart', state: 'done' },
  { label: 'Checkout', state: order.value ? 'done' : 'current' },
  { label: 'Confirmation', state: order.value ? 'done' : 'upcoming' },
])

// --------------------------------------------------
// Formatting and order summary helpers
// --------------------------------------------------

function getData(response) {
  const body = response?.data
  return body?.data ?? body
}

function formatPrice(value) {
  return `Rs. ${Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function addressBody(address) {
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country
  ].filter(Boolean).join(', ')
}

function toNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue

    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function lineName(line) {
  return (
    line.item?.item_name ||
    line.item_name ||
    line.item?.name ||
    line.name ||
    line.product_name ||
    'Product'
  )
}

function lineQuantity(line) {
  return toNumber(line.quantity) ?? 1
}

function lineMeta(line) {
  const variant = line.variant?.variant_name || line.variant_name || ''

  return [variant, `Qty ${lineQuantity(line)}`].filter(Boolean).join(' · ')
}

function lineTotal(line) {
  const total = toNumber(line.line_total, line.total_price, line.total)
  if (total !== null) return total

  const unit = toNumber(
    line.unit_price,
    line.price,
    line.selling_price,
    line.variant?.selling_price,
    line.item?.price
  )

  return unit === null ? null : unit * lineQuantity(line)
}

const subtotal = computed(() => {
  const fromCart = toNumber(
    cart.value?.subtotal,
    cart.value?.total_amount,
    cart.value?.total
  )
  if (fromCart !== null) return fromCart

  const totals = cartItems.value.map(lineTotal)

  return totals.length && totals.every(total => total !== null)
    ? totals.reduce((sum, total) => sum + total, 0)
    : null
})


async function refreshQuote() {
  const requestNumber = ++quoteRequestNumber

  quote.value = null
  quoteError.value = ''

  if (!selectedAddressId.value || !cartReady.value) {
    return
  }

  quoteLoading.value = true

  const payload = {
    address_id: Number(selectedAddressId.value)
  }

payload.payment_method = paymentMethod.value.value;

  if (appliedPromoCode.value) {
    payload.promo_code = appliedPromoCode.value
}

if (directPurchase.value) {
  payload.checkout_token = checkoutToken.value
} else {
  payload.cart_id = Number(cart.value.id)
}

  try {
    const response = await api.post('/customer-checkout/quote', payload)
    const data = getData(response)
    const result = data?.quote ?? data

    // Ignore an older response if the user has selected another address.
    if (requestNumber !== quoteRequestNumber) return

    if (
      !Number.isFinite(Number(result?.subtotal)) ||
      !Number.isFinite(Number(result?.shipping_amount)) ||
      !Number.isFinite(Number(result?.total_amount))
    ) {
      throw new Error('The server returned an invalid checkout quote.')
    }

    quote.value = result
  } catch (err) {
    if (requestNumber !== quoteRequestNumber) return

    quoteError.value =
      err.response?.data?.message ||
      err.message ||
      'Unable to calculate delivery and order total.'
  } finally {
    if (requestNumber === quoteRequestNumber) {
      quoteLoading.value = false
    }
  }
}

async function applyPromoCode() {
    const code = promoCodeInput.value.trim().toUpperCase()

    promoError.value = ''
    promoMessage.value = ''

    if (!code) {
        promoError.value = 'Enter a promo code.'
        return
    }

    if (promoBusy.value || quoteLoading.value) return

    promoBusy.value = true
    appliedPromoCode.value = code

    try {
        await refreshQuote()

        if (quoteError.value || !quote.value) {
            const message =
                quoteError.value || 'Unable to validate this promo code.'

            appliedPromoCode.value = ''
            await refreshQuote()

            promoError.value = message
            return
        }

        promoCodeInput.value = code
        promoMessage.value = `Promo code ${code} applied successfully.`
    } finally {
        promoBusy.value = false
    }
}

async function removePromoCode() {
    appliedPromoCode.value = ''
    promoCodeInput.value = ''
    promoMessage.value = ''
    promoError.value = ''

    await refreshQuote()
}


// --------------------------------------------------
// Load checkout and place order
// --------------------------------------------------

async function loadCheckout() {
  loading.value = true
  error.value = ''

  if (!sessionStorage.getItem('customerToken')) {
    router.replace({
      path: '/login',
      query: { redirect: route.fullPath }
    })
    return
  }

if (route.params.token && !validDirectPurchase.value) {
  await router.replace('/cart')
  return
}

  try {
    const addressResponse = await api.get('/customer/addresses')
    const addressData = getData(addressResponse)

    addresses.value = Array.isArray(addressData)
      ? addressData
      : Array.isArray(addressData?.addresses)
        ? addressData.addresses
        : []

    const defaultAddress = addresses.value.find(
      address =>
        address.address_type === 'shipping' &&
        address.is_default
    )

    const firstShippingAddress = addresses.value.find(
      address => address.address_type === 'shipping'
    )

    selectedAddressId.value = String(
      defaultAddress?.id ?? firstShippingAddress?.id ?? ''
    )

    if (!directPurchase.value) {
      const cartResponse = await api.get('/customer-cart/')
      const cartData = getData(cartResponse)
      cart.value = cartData?.cart ?? cartData
if (!cart.value?.id || !cartItems.value.length) {
  await router.replace('/cart')
  return
}
    }
    await refreshQuote()
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to load checkout details. Please try again.'
  } finally {
    loading.value = false
  }
}

async function placeOrder() {
  error.value = ''
  notice.value = ''

  if (!selectedAddressId.value) {
    error.value = 'Please select a saved shipping address.'
    return
  }

  if (selectedPaymentId.value !== 'cod') {
  error.value =
    'Only Cash on Delivery is currently enabled for placing orders.';
  return;
}

  if (!quote.value || quoteLoading.value || quoteError.value) {
  error.value = 'Please wait for the delivery charge and total to be calculated.'
  return

  
}

  if (!paymentMethod.value) {
    error.value = 'Please choose an available payment method.'
    return
  }

  if (!directPurchase.value && !cart.value?.id) {
    error.value = 'Your active cart could not be identified.'
    return
  }

  if (submitting.value) return

  submitting.value = true

  // Keep the same key for a retry after an uncertain network result.
  if (!idempotencyKey.value) {
    idempotencyKey.value =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }

  const payload = {
    address_id: Number(selectedAddressId.value),
    payment_method: paymentMethod.value.value
  }

  if (appliedPromoCode.value) {
    payload.promo_code = appliedPromoCode.value
}

if (directPurchase.value) {
  payload.checkout_token = checkoutToken.value
} else {
  payload.cart_id = Number(cart.value.id)
}

  try {
    const response = await api.post('/customer-checkout', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey.value
      }
    })

   const responseData = getData(response)
const createdOrder = responseData?.order

if (!createdOrder?.id && !createdOrder?.order_number) {
  throw new Error(
    'The order response could not be confirmed. Please check My Orders before retrying.'
  )
}

// Save the details for the confirmation page before clearing the cart.
confirmationAddress.value = {
  ...(
    shippingAddresses.value.find(
      address => Number(address.id) === Number(selectedAddressId.value)
    ) || {}
  )
}

confirmationItems.value = (
  quote.value?.items?.length
    ? quote.value.items
    : cartItems.value
).map(item => ({ ...item }))

order.value = {
  ...createdOrder,
  subtotal: createdOrder.subtotal ?? quote.value?.subtotal,
  shipping_amount:
    createdOrder.shipping_amount ?? quote.value?.shipping_amount,
  total_amount:
    createdOrder.total_amount ?? quote.value?.total_amount,
}

notice.value =
  responseData?.message || 'Your order was placed successfully.'

idempotencyKey.value = ''

if (!directPurchase.value) {
  cart.value = { ...cart.value, items: [] }
}
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'We could not complete your order. You can safely retry.'
  } finally {
    submitting.value = false
  }
}

function goBack() {
  if (!directPurchase.value) {
    router.push('/cart')
    return
  }

  // The token intentionally contains no product slug or public ID.
  // Return to the cart if the product page cannot be identified.
  router.push('/cart')
}

function returnToShopping() {
  router.push('/')
}

function viewOrders() {
  router.push('/account/orders')
}

function manageAddresses() {
  router.push('/account/addresses')
}

watch(selectedAddressId, () => {
  if (!loading.value && !order.value) {
    refreshQuote()
  }
})

watch(
  () => paymentMethod.value?.value,
  () => {
    if (!loading.value && !order.value && selectedAddressId.value) {
      refreshQuote();
    }
  }
)

onBeforeUnmount(() => {
  quoteRequestNumber++
})

onMounted(loadCheckout)
</script>

<template>
  <main class="checkout-page">
    <header class="checkout-hero">
      <div class="checkout-container">
        <p class="eyebrow">SOUTH WEST STORE</p>
        <h1>{{ order ? 'Order confirmed' : 'Checkout' }}</h1>

        <ol class="stepper" aria-label="Checkout progress">
          <li
            v-for="(step, index) in steps"
            :key="step.label"
            class="step"
            :class="step.state"
            :aria-current="step.state === 'current' ? 'step' : undefined"
          >
            <span class="step-number" aria-hidden="true">
              {{ step.state === 'done' ? '✓' : index + 1 }}
            </span>
            <span class="step-label">{{ step.label }}</span>
          </li>
        </ol>
      </div>
    </header>

    <div class="checkout-container checkout-body">
      <!-- Loading -->
      <div
        v-if="loading"
        class="checkout-layout"
        aria-busy="true"
        aria-label="Loading checkout details"
      >
        <div class="checkout-main">
          <div v-for="n in 2" :key="n" class="panel skeleton-panel" aria-hidden="true">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line tall"></div>
            <div class="skeleton-line tall"></div>
          </div>
        </div>

        <div class="panel skeleton-panel" aria-hidden="true">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line tall"></div>
        </div>
      </div>

      <!-- Order confirmed -->

<section v-else-if="order" class="panel confirmation">
  <div class="confirmation-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>

  <h2>Thank you for your order!</h2>
  <p class="muted">
    Your order has been placed successfully. You can pay in cash when it is delivered.
  </p>

  <div class="cod-banner">
    <strong>Cash on Delivery</strong>
    <span>Please pay the delivery person when your order arrives.</span>
  </div>

  <section class="confirmation-section">
    <h3>Order details</h3>

    <dl class="confirmation-details">
      <div>
        <dt>Order number</dt>
        <dd>{{ order.order_number || `#${order.id}` }}</dd>
      </div>
      <div>
        <dt>Order status</dt>
        <dd>{{ order.status || 'Pending' }}</dd>
      </div>
      <div>
        <dt>Payment method</dt>
        <dd>Cash on Delivery</dd>
      </div>
      <div>
        <dt>Payment status</dt>
        <dd>Unpaid</dd>
      </div>
    </dl>
  </section>

  <section class="confirmation-section">
    <h3>Items ordered</h3>

    <div
      v-for="(item, index) in confirmationItems"
      :key="item.variant_id || item.item_id || index"
      class="confirmation-item"
    >
      <div class="confirmation-item-info">
        <strong>
          {{ item.item_name || item.item?.item_name || item.name || 'Product' }}
        </strong>
        <span class="muted">
          <template v-if="item.variant_name || item.variant?.variant_name">
            {{ item.variant_name || item.variant?.variant_name }} ·
          </template>
          Qty: {{ item.quantity || 1 }}
        </span>
        <span v-if="item.unit_price != null" class="muted">
          Unit price: {{ formatPrice(item.unit_price) }}
        </span>
      </div>

      <strong>
        {{
          item.line_total != null
            ? formatPrice(item.line_total)
            : item.unit_price != null
              ? formatPrice(Number(item.unit_price) * Number(item.quantity || 1))
              : '—'
        }}
      </strong>
    </div>

    <dl class="confirmation-totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{{ formatPrice(order.subtotal) }}</dd>
      </div>
      <div>
        <dt>Delivery charge</dt>
        <dd>{{ formatPrice(order.shipping_amount) }}</dd>
      </div>
      <div class="confirmation-grand-total">
        <dt>Total to pay on delivery</dt>
        <dd>{{ formatPrice(order.total_amount) }}</dd>
      </div>
    </dl>
  </section>

  <section class="confirmation-section" v-if="confirmationAddress">
    <h3>Delivery address</h3>
    <div class="delivery-address">
      <strong>{{ confirmationAddress.recipient_name || 'Recipient' }}</strong>
      <p v-if="confirmationAddress.phone">
        {{ confirmationAddress.phone }}
      </p>
      <p>{{ addressBody(confirmationAddress) }}</p>
    </div>
  </section>

  <p class="muted">
    Keep your order number for reference. You can check the latest order status
    in My Orders.
  </p>

  <div class="actions">
    <button type="button" class="primary-button" @click="viewOrders">
      View my orders
    </button>
    <button type="button" class="secondary-button" @click="returnToShopping">
      Continue shopping
    </button>
  </div>
</section>


      <!-- Checkout form -->
      <div v-else class="checkout-layout">
        <div class="checkout-main">
          <p v-if="error" class="alert" role="alert">
            {{ error }}
          </p>

          <!-- 1. Delivery address -->
          <section class="panel">
            <header class="panel-head">
              <span class="panel-number" aria-hidden="true">1</span>
              <h2>Delivery address</h2>
              <button
                v-if="shippingAddresses.length"
                type="button"
                class="link-button"
                @click="manageAddresses"
              >
                Manage addresses
              </button>
            </header>

            <div
              v-if="shippingAddresses.length"
              class="choice-list"
              role="radiogroup"
              aria-label="Delivery address"
            >
              <label
                v-for="address in shippingAddresses"
                :key="address.id"
                class="choice"
              >
                <input
                  v-model="selectedAddressId"
                  type="radio"
                  name="shipping-address"
                  class="choice-input"
                  :value="String(address.id)"
                />

                <span class="choice-body">
                  <span class="choice-radio" aria-hidden="true"></span>

                  <span class="choice-content">
                    <span class="choice-title">
                      {{ address.recipient_name || 'Delivery address' }}
                      <span v-if="address.is_default" class="pill default">Default</span>
                    </span>
                    <span v-if="address.phone" class="choice-text">{{ address.phone }}</span>
                    <span class="choice-text">{{ addressBody(address) }}</span>
                  </span>
                </span>
              </label>
            </div>

            <div v-else class="empty-address">
              <h3>No saved shipping address</h3>
              <p class="muted">Please add a shipping address before placing your order.</p>
              <button type="button" class="primary-button" @click="manageAddresses">
                Add an address
              </button>
            </div>
          </section>

          <!-- 2. Payment method -->
          <section class="panel">
            <header class="panel-head">
              <span class="panel-number" aria-hidden="true">2</span>
              <h2>Payment method</h2>
            </header>

            <div role="radiogroup" aria-label="Payment method">
              <div
                v-for="group in paymentGroups"
                :key="group.title"
                class="method-group"
              >
                <h3 class="group-title">{{ group.title }}</h3>

                <div class="choice-list">
                  <label
                    v-for="method in group.methods"
                    :key="method.id"
                    class="choice"
                  >
                    <input
                      v-model="selectedPaymentId"
                      type="radio"
                      name="payment-method"
                      class="choice-input"
                      :value="method.id"
                      :disabled="!method.available"
                    />

                    <span class="choice-body">
                      <span class="choice-radio" aria-hidden="true"></span>

                      <span class="method-logo">
                        <img
                          v-if="!failedLogos[method.id]"
                          :src="method.logo"
                          alt=""
                          loading="lazy"
                          @error="failedLogos[method.id] = true"
                        />
                        <span v-else class="method-logo-fallback" aria-hidden="true">
                          {{ method.name.charAt(0) }}
                        </span>
                      </span>

                      <span class="choice-content">
                        <span class="choice-title">
                          {{ method.name }}
                          <span v-if="!method.available" class="pill">Coming soon</span>
                        </span>
                        <span class="choice-text">{{ method.description }}</span>
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <p v-if="paymentMethod?.note" class="method-note">
              {{ paymentMethod.note }}
            </p>

            <p
  v-if="selectedPaymentId !== 'cod'"
  class="method-note"
  role="status"
>
  Price preview only. Online payments are not enabled yet.
  Select Cash on Delivery to place your order.
</p>
          </section>
        </div>

        <!-- Order summary -->
        <aside class="panel summary">
          <h2>Order summary</h2>

 <ul v-if="directPurchase" class="summary-items">
  <li class="summary-item">
    <div class="summary-item-info">
      <strong>
        {{ quote?.items?.[0]?.item_name || 'Buy Now item' }}
      </strong>
      <span class="muted">
        Qty {{ quote?.items?.[0]?.quantity ?? '—' }}
      </span>
    </div>

    <span
      v-if="quote?.items?.[0]?.line_total != null"
      class="summary-item-total"
    >
      {{ formatPrice(quote.items[0].line_total) }}
    </span>
  </li>
</ul>

          <ul v-else-if="cartItems.length" class="summary-items">
            <li
              v-for="(line, index) in cartItems"
              :key="line.id ?? index"
              class="summary-item"
            >
              <div class="summary-item-info">
                <strong>{{ lineName(line) }}</strong>
                <span class="muted">{{ lineMeta(line) }}</span>
              </div>

              <span v-if="lineTotal(line) !== null" class="summary-item-total">
                {{ formatPrice(lineTotal(line)) }}
              </span>
            </li>
          </ul>


<div class="promo-section">
  <label for="promo-code">Promo code</label>

  <div class="promo-input-row">
    <input
      id="promo-code"
      v-model="promoCodeInput"
      type="text"
      maxlength="100"
      placeholder="Enter promo code"
      :disabled="promoBusy || quoteLoading || Boolean(appliedPromoCode)"
      @keyup.enter="applyPromoCode"
    />

    <button
      v-if="!appliedPromoCode"
      type="button"
      :disabled="promoBusy || quoteLoading"
      @click="applyPromoCode"
    >
      {{ promoBusy ? 'Checking…' : 'Apply' }}
    </button>

    <button
      v-else
      type="button"
      :disabled="promoBusy"
      @click="removePromoCode"
    >
      Remove
    </button>
  </div>

  <p v-if="promoMessage" class="promo-success">
    {{ promoMessage }}
  </p>

  <p v-if="promoError" class="promo-error">
    {{ promoError }}
  </p>
</div>

<div
  v-if="Number(quote?.promo_discount_amount || 0) > 0"
  class="summary-row"
>
  <span>Promo discount</span>
  <span>
    − {{ formatPrice(quote.promo_discount_amount) }}
  </span>
</div>


<dl class="totals">
  <div>
    <dt>Subtotal</dt>
    <dd>
      {{ quote ? formatPrice(quote.subtotal) : '—' }}
    </dd>
  </div>
<div v-if="quote && Number(quote.discount_amount) > 0">
  <dt>Campaign discount</dt>
  <dd class="discount-value">
    − {{ formatPrice(quote.discount_amount) }}
  </dd>
</div>

  <div>
    <dt>Delivery</dt>
    <dd>
      <span v-if="quoteLoading">Calculating…</span>
      <span v-else-if="quote">
        {{ formatPrice(quote.shipping_amount) }}
      </span>
      <span v-else>—</span>
    </dd>
  </div>

  <div>
    <dt>Payment</dt>
    <dd>{{ paymentMethod?.name || 'Not selected' }}</dd>
  </div>

  <div class="total-row">
    <dt>Estimated total</dt>
    <dd>
      {{ quote ? formatPrice(quote.total_amount) : '—' }}
    </dd>
  </div>
</dl>

<p v-if="quoteError" class="alert" role="alert">
  {{ quoteError }}
</p>

          <button
            type="button"
            class="primary-button place-order"
            :disabled="!canPlaceOrder"
            @click="placeOrder"
          >
            {{ submitting ? 'Placing order...' : 'Place order' }}
          </button>

          <button
            type="button"
            class="secondary-button back-button"
            :disabled="submitting"
            @click="goBack"
          >
            Back
          </button>

          <p class="secure-note">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <span>
              Final prices, delivery charges and stock availability are
              recalculated by the server when you place your order.
            </span>
          </p>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.checkout-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: var(--space-16);
  background: var(--color-store-bg);
  color: var(--color-text);
}

.checkout-container {
  width: min(var(--container-store), 1120px, 94%);
  margin: 0 auto;
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

/* ---------- Hero and progress ---------- */
.checkout-hero {
  padding: var(--space-8) 0;
  background: var(--gradient-metal);
  color: var(--color-on-primary);
  box-shadow: inset 0 -1px 0 rgb(0 0 0 / 45%);
}

.eyebrow {
  margin: 0;
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.14em;
}

.checkout-hero h1 {
  margin: var(--space-2) 0 0;
  font-family: var(--font-family-display);
  font-size: clamp(26px, 4.5vw, 36px);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
}

.stepper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-5) 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-xs);
}
.discount-value {
  color: #15803d;
  font-weight: 600;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgb(255 255 255 / 60%);
}

.step + .step::before {
  width: 28px;
  height: 1px;
  margin-right: 4px;
  background: rgb(255 255 255 / 30%);
  content: '';
}

.step-number {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1.5px solid rgb(255 255 255 / 45%);
  border-radius: 50%;
  font-weight: var(--font-weight-semibold);
}

.step.done {
  color: rgb(255 255 255 / 85%);
}

.step.done .step-number {
  border-color: transparent;
  background: rgb(255 255 255 / 90%);
  color: var(--color-primary);
}

.step.current {
  color: var(--color-on-primary);
  font-weight: var(--font-weight-semibold);
}

.step.current .step-number {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-black);
}

/* ---------- Layout ---------- */
.checkout-body {
  padding-top: var(--space-6);
}

.checkout-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--space-6);
  align-items: start;
}

.checkout-main {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.panel {
  min-width: 0;
  padding: var(--space-6);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.panel-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.panel-head h2 {
  margin: 0;
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.panel-number {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.link-button {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-decoration: underline;
}

/* ---------- Selectable cards (addresses and payment methods) ---------- */
.choice-list {
  display: grid;
  gap: var(--space-3);
}

.choice {
  position: relative;
  display: block;
}

/* The native radio sits invisibly over the whole card: full tap area,
   arrow-key navigation and screen reader support come for free. */
.choice-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.choice-input:disabled {
  cursor: not-allowed;
}

.choice-body {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 64px;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
}

@media (hover: hover) {
  .choice-input:not(:disabled):not(:checked):hover + .choice-body {
    border-color: var(--color-text-muted);
  }
}

.choice-input:checked + .choice-body {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
  box-shadow: 0 0 0 1px var(--color-primary);
}

.choice-input:focus-visible + .choice-body {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.choice-input:disabled + .choice-body {
  border-style: dashed;
  background: var(--color-surface-muted);
}

.choice-radio {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  box-sizing: border-box;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}

.choice-input:checked + .choice-body .choice-radio {
  border-color: var(--color-primary);
  background: var(--color-primary);
  box-shadow: inset 0 0 0 3px var(--color-surface);
}

.choice-content {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.choice-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.choice-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.choice-input:disabled + .choice-body .choice-title,
.choice-input:disabled + .choice-body .choice-text {
  color: var(--color-text-muted);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
}

.pill.default {
  border-color: transparent;
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary);
}

/* ---------- Payment methods ---------- */
.method-group + .method-group {
  margin-top: var(--space-5);
}

.group-title {
  margin: 0 0 var(--space-3);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.method-logo {
  display: grid;
  place-items: center;
  width: 64px;
  height: 44px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.method-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.method-logo-fallback {
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

/* Methods that are not available yet */
.choice-input:disabled + .choice-body .method-logo {
  filter: grayscale(1);
  opacity: 0.55;
}

.method-note {
  margin: var(--space-5) 0 0;
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--color-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

/* ---------- Empty address and alerts ---------- */
.empty-address {
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  text-align: center;
}

.empty-address h3 {
  margin: 0 0 6px;
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
}

.empty-address .muted {
  margin: 0 0 var(--space-4);
}

.alert {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  border-radius: var(--radius-md);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

/* ---------- Order summary ---------- */
.summary {
  position: sticky;
  /* Clears the sticky site header */
  top: calc(72px + var(--space-5));
}

.summary h2 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.summary-items {
  display: grid;
  max-height: 280px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}

.summary-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-soft);
  font-size: var(--font-size-sm);
}

.summary-item-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.summary-item-info strong {
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

.summary-item-total {
  flex-shrink: 0;
  font-weight: var(--font-weight-semibold);
}

.totals {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-4) 0 var(--space-5);
}

.totals > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
}

.totals dt {
  color: var(--color-text-muted);
}

.totals dd {
  margin: 0;
  font-weight: var(--font-weight-semibold);
  text-align: right;
  overflow-wrap: anywhere;
}

.place-order,
.back-button {
  width: 100%;
}

.back-button {
  margin-top: var(--space-3);
}

.secure-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: var(--space-4) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.secure-note svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* ---------- Buttons ---------- */
.primary-button,
.secondary-button {
  min-height: 48px;
  padding: 10px 20px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.primary-button {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.primary-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.secondary-button {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.secondary-button:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
.link-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

/* ---------- Order confirmed ---------- */
.confirmation {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
  text-align: center;
}

.confirmation h2 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.confirmation > .muted {
  margin: 0;
}

.confirmation-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 0 auto var(--space-4);
  border-radius: 50%;
  background: #dcfce7;
  color: #166534;
}

.confirmation-icon svg {
  width: 32px;
  height: 32px;
}

.confirmation-details {
  margin: var(--space-6) 0 0;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  text-align: left;
}

.confirmation-details > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
  font-size: var(--font-size-sm);
}

.confirmation-details > div:last-child {
  border-bottom: 0;
}

.confirmation-details dt {
  color: var(--color-text-muted);
}

.confirmation-details dd {
  margin: 0;
  font-weight: var(--font-weight-semibold);
  text-align: right;
  overflow-wrap: anywhere;
}

.next-steps {
  display: grid;
  gap: var(--space-4);
  margin: var(--space-6) 0 0;
  padding: 0;
  list-style: none;
  counter-reset: next-step;
  text-align: left;
}

.next-steps li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  column-gap: var(--space-3);
  font-size: var(--font-size-sm);
  counter-increment: next-step;
}

.next-steps li::before {
  display: grid;
  grid-row: span 2;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  content: counter(next-step);
}

.next-steps span {
  color: var(--color-text-muted);
}

.confirmation .actions {
  justify-content: center;
}

/* ---------- Loading skeleton ---------- */
.skeleton-panel {
  display: grid;
  gap: var(--space-3);
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

.skeleton-line.tall {
  height: 64px;
}


.cod-banner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  margin: 22px 0;
  border: 1px solid var(--color-border, #d8d8d8);
  border-radius: 12px;
}

.cod-banner strong {
  font-size: 1.05rem;
}

.cod-banner span {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.confirmation-section {
  padding: 20px 0;
  border-top: 1px solid var(--color-border, #e2e2e2);
}

.confirmation-section h3 {
  margin: 0 0 16px;
}

.confirmation-details,
.confirmation-totals {
  display: grid;
  gap: 12px;
  margin: 0;
}

.confirmation-details > div,
.confirmation-totals > div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.confirmation-details dt,
.confirmation-totals dt {
  color: var(--color-text-muted);
}

.confirmation-details dd,
.confirmation-totals dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.confirmation-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border, #e2e2e2);
}

.confirmation-item-info {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.confirmation-item > strong {
  text-align: right;
  white-space: nowrap;
}

.confirmation-totals {
  padding-top: 18px;
}

.confirmation-totals .confirmation-grand-total {
  padding-top: 14px;
  margin-top: 4px;
  border-top: 1px solid var(--color-border, #d8d8d8);
  font-weight: 700;
  font-size: 1.08rem;
}

.delivery-address p {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

.promo-section {
  margin: 18px 0;
  padding: 16px 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

.promo-section > label {
  display: block;
  margin-bottom: 9px;
  font-size: 14px;
  font-weight: 600;
}

.promo-input-row {
  display: flex;
  gap: 8px;
}

.promo-input-row input {
  flex: 1;
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  text-transform: uppercase;
}

.promo-input-row button {
  padding: 10px 15px;
  border: 0;
  border-radius: 7px;
  background: #172033;
  color: white;
  cursor: pointer;
}

.promo-input-row button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.promo-success {
  color: #15803d;
  font-size: 13px;
}

.promo-error {
  color: #b91c1c;
  font-size: 13px;
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

/* ---------- Tablet and below: single column ---------- */
@media (max-width: 960px) {
  .checkout-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary {
    position: static;
  }

  .summary-items {
    max-height: none;
  }
}

/* ---------- Phones ---------- */
@media (max-width: 520px) {
  .checkout-hero {
    padding: var(--space-6) 0;
  }

  /* Only the current step keeps its label */
  .step + .step::before {
    display: none;
  }

  .step:not(.current) .step-label {
    display: none;
  }

  .stepper {
    gap: var(--space-2);
  }

  .panel {
    padding: var(--space-4);
  }

  .choice-body {
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .method-logo {
    width: 52px;
    height: 36px;
  }

  .actions {
    flex-direction: column;
  }

  .actions button {
    width: 100%;
  }
}

/* ---------- Fold cover screens ---------- */
@media (max-width: 340px) {
  .method-logo {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
  }

  .choice-body,
  .choice-radio,
  .primary-button,
  .secondary-button {
    transition: none;
  }
}
</style>