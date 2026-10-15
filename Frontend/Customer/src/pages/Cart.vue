
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()

const cart = ref(null)
const loading = ref(true)
const error = ref('')
const updatingIds = ref([])
const removingIds = ref([])
const notice = ref('')

const BACKEND_URL = (
    import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
).replace(/\/api\/?$/, '')

const cartItems = computed(() => {
  const value = cart.value?.items ??
      cart.value?.cart_items ??
      cart.value?.CartItems ??
      []

  return Array.isArray(value) ? value : []
})

function getProduct(item) {
  return item.item ?? item.Item ?? item.product ?? item.Product ?? {}
}

function getItemId(item) {
  return item.id ?? item.cart_item_id ?? item.cartItemId
}

function getProductId(item) {
  const product = getProduct(item)
  return product.id ?? item.item_id ?? item.product_id
}

function getName(item) {
  const product = getProduct(item)
  return product.item_name ??
      product.name ??
      product.product_name ??
      item.item_name ??
      'Product'
}

function getBrand(item) {
  const product = getProduct(item)
  return product.brand?.brand_name ??
      product.brand?.name ??
      product.Brand?.brand_name ??
      product.Brand?.name ??
      product.brand_name ??
      ''
}

function getImage(item) {
  const product = getProduct(item)
  const images = product.images ?? product.ItemImages ?? []
  const primary = Array.isArray(images)
      ? images.find(image => image.is_primary)?.url ??
      images.find(image => image.is_primary)?.file_path ??
      images[0]?.url ??
      images[0]?.file_path
      : ''

  const value = product.image ??
      product.image_url ??
      primary ??
      ''

  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value

  return `${BACKEND_URL}/${String(value).replace(/^\/+/, '')}`
}

function getQuantity(item) {
  return Number(item.quantity ?? item.cart_quantity ?? 1)
}

function getUnitPrice(item) {
  const product = getProduct(item)
  const value = item.unit_price ??
      item.price ??
      item.selling_price ??
      item.ItemPrice?.price ??
      product.price ??
      product.selling_price ??
      0

  return Number(value) || 0
}

function getLineTotal(item) {
  return getUnitPrice(item) * getQuantity(item)
}

const subtotal = computed(() =>
    cartItems.value.reduce((total, item) => total + getLineTotal(item), 0)
)

const totalQuantity = computed(() =>
    cartItems.value.reduce((total, item) => total + getQuantity(item), 0)
)

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function setCartResponse(payload) {
  const result = payload?.data ?? payload
  cart.value = result?.cart ?? result
}

async function loadCart() {
  loading.value = true
  error.value = ''
  notice.value = ''

  if (!sessionStorage.getItem('customerToken')) {
    loading.value = false
    router.replace({
      path: '/login',
      query: { redirect: '/cart' },
    })
    return
  }

  try {
    const response = await api.get('/customer-cart/')
    setCartResponse(response.data)
  } catch (err) {
    error.value =
        err.response?.data?.message ??
        'Unable to load your cart. Please try again.'
  } finally {
    loading.value = false
  }
}

async function updateQuantity(item, nextQuantity) {
  const id = getItemId(item)

  if (id == null || nextQuantity < 1) return
  if (updatingIds.value.includes(id)) return

  updatingIds.value = [...updatingIds.value, id]
  error.value = ''
  notice.value = ''

  try {
    await api.patch(`/customer-cart/items/${encodeURIComponent(id)}`, {
      quantity: nextQuantity,
    })

    await loadCart()
  } catch (err) {
    error.value =
        err.response?.data?.message ??
        'Unable to update the quantity. Please try again.'
  } finally {
    updatingIds.value = updatingIds.value.filter(value => value !== id)
  }
}

async function removeItem(item) {
  const id = getItemId(item)

  if (id == null || removingIds.value.includes(id)) return

  removingIds.value = [...removingIds.value, id]
  error.value = ''
  notice.value = ''

  try {
    await api.delete(`/customer-cart/items/${encodeURIComponent(id)}`)
    await loadCart()
    notice.value = 'Item removed from your cart.'
  } catch (err) {
    error.value =
        err.response?.data?.message ??
        'Unable to remove this item. Please try again.'
  } finally {
    removingIds.value = removingIds.value.filter(value => value !== id)
  }
}

function openProduct(item) {
  const id = getProductId(item)
  if (id == null) return

  router.push(`/product/${encodeURIComponent(id)}`)
}

function continueShopping() {
  router.push('/')
}

function proceedToCheckout() {
  // The checkout page will be connected in the next step.
  router.push('/checkout')
}

onMounted(loadCart)
</script>

<template>
  <main class="cart-page">
    <div class="cart-container">
      <nav class="breadcrumbs">
        <RouterLink to="/">Home</RouterLink>
        <span>/</span>
        <span>Shopping Cart</span>
      </nav>

      <header class="page-heading">
        <div>
          <p class="eyebrow">SOUTH WEST STORE</p>
          <h1>Your shopping cart</h1>
          <p class="muted">
            Review your items before continuing to checkout.
          </p>
        </div>

        <button
            class="continue-button"
            type="button"
            @click="continueShopping"
        >
          Continue shopping
        </button>
      </header>

      <div v-if="loading" class="state-card">
        <div class="spinner"></div>
        <p>Loading your cart...</p>
      </div>

      <div v-else-if="error && !cart" class="state-card">
        <p class="error-text">{{ error }}</p>
        <button class="primary-button" type="button" @click="loadCart">
          Try again
        </button>
      </div>

      <div v-else-if="cartItems.length === 0" class="empty-cart">
        <div class="empty-icon">🛒</div>
        <h2>Your cart is empty</h2>
        <p class="muted">
          Looks like you haven't added anything to your cart yet.
        </p>
        <button class="primary-button" type="button" @click="continueShopping">
          Explore products
        </button>
      </div>

      <template v-else>
        <p v-if="error" class="message error-text">{{ error }}</p>
        <p v-if="notice" class="message success-text">{{ notice }}</p>

        <div class="cart-layout">
          <section class="cart-items">
            <div class="section-heading">
              <h2>Cart items</h2>
              <span>{{ totalQuantity }} item(s)</span>
            </div>

            <article
                v-for="item in cartItems"
                :key="getItemId(item) ?? getProductId(item)"
                class="cart-item"
            >
              <button
                  class="product-image"
                  type="button"
                  :aria-label="`View ${getName(item)}`"
                  @click="openProduct(item)"
              >
                <img
                    v-if="getImage(item)"
                    :src="getImage(item)"
                    :alt="getName(item)"
                />
                <span v-else>SW</span>
              </button>

              <div class="item-info">
                <p v-if="getBrand(item)" class="brand">
                  {{ getBrand(item) }}
                </p>

                <button
                    class="item-name"
                    type="button"
                    @click="openProduct(item)"
                >
                  {{ getName(item) }}
                </button>

                <p class="unit-price">
                  {{ formatPrice(getUnitPrice(item)) }} each
                </p>

                <button
                    class="remove-button"
                    type="button"
                    :disabled="removingIds.includes(getItemId(item))"
                    @click="removeItem(item)"
                >
                  {{ removingIds.includes(getItemId(item)) ? 'Removing...' : 'Remove' }}
                </button>
              </div>

              <div class="item-actions">
                <div class="quantity-control">
                  <button
                      type="button"
                      aria-label="Decrease quantity"
                      :disabled="getQuantity(item) <= 1 || updatingIds.includes(getItemId(item))"
                      @click="updateQuantity(item, getQuantity(item) - 1)"
                  >−</button>

                  <span>{{ getQuantity(item) }}</span>

                  <button
                      type="button"
                      aria-label="Increase quantity"
                      :disabled="updatingIds.includes(getItemId(item))"
                      @click="updateQuantity(item, getQuantity(item) + 1)"
                  >+</button>
                </div>

                <strong class="line-total">
                  {{ formatPrice(getLineTotal(item)) }}
                </strong>
              </div>
            </article>
          </section>

          <aside class="order-summary">
            <h2>Order summary</h2>

            <div class="summary-row">
              <span>Items ({{ totalQuantity }})</span>
              <strong>{{ formatPrice(subtotal) }}</strong>
            </div>

            <div class="summary-row">
              <span>Delivery</span>
              <span class="muted">Calculated at checkout</span>
            </div>

            <div class="summary-total">
              <span>Subtotal</span>
              <strong>{{ formatPrice(subtotal) }}</strong>
            </div>

            <p class="summary-note">
              Delivery charges and final stock availability are
              confirmed during checkout.
            </p>

            <button
                class="checkout-button"
                type="button"
                @click="proceedToCheckout"
            >
              Proceed to checkout
              <span>→</span>
            </button>

            <div class="secure-note">
              <span>✓</span>
              Secure checkout
            </div>

            <button
                class="back-button"
                type="button"
                @click="continueShopping"
            >
              Continue shopping
            </button>
          </aside>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.cart-page {
  min-height: 100vh;
  padding: 28px 0 64px;
  background: var(--color-store-bg, #f3f5f8);
  color: var(--color-text, #172033);
}

.cart-container {
  width: min(1240px, 94%);
  margin: 0 auto;
}

.breadcrumbs {
  display: flex;
  gap: 9px;
  margin-bottom: 25px;
  color: var(--color-text-muted, #718096);
  font-size: 13px;
}

.breadcrumbs a {
  color: inherit;
  text-decoration: none;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 28px;
}

.eyebrow {
  margin: 0 0 7px;
  color: var(--color-primary, #1f4a8a);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.page-heading h1 {
  margin: 0;
  font-size: clamp(27px, 3vw, 36px);
}

.muted {
  color: var(--color-text-muted, #718096);
  font-size: 13px;
  line-height: 1.6;
}

.page-heading .muted {
  margin-bottom: 0;
}

.continue-button,
.back-button {
  border: 1px solid var(--color-border-soft, #dce3ed);
  border-radius: 7px;
  padding: 11px 15px;
  background: #fff;
  color: var(--color-text, #172033);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.cart-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 24px;
}

.cart-items,
.order-summary,
.empty-cart,
.state-card {
  border: 1px solid var(--color-border-soft, #e1e7ef);
  border-radius: 12px;
  background: #fff;
}

.cart-items {
  padding: 22px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--color-border-soft, #e8edf3);
}

.section-heading h2,
.order-summary h2 {
  margin: 0;
  font-size: 19px;
}

.section-heading span {
  color: var(--color-text-muted, #718096);
  font-size: 12px;
}

.cart-item {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 22px 0;
  border-bottom: 1px solid var(--color-border-soft, #e8edf3);
}

.cart-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.product-image {
  display: grid;
  place-items: center;
  width: 112px;
  height: 112px;
  padding: 8px;
  border: 1px solid var(--color-border-soft, #e8edf3);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.product-image span {
  color: var(--color-primary, #1f4a8a);
  font-size: 30px;
  font-weight: 800;
}

.item-info {
  min-width: 0;
}

.brand {
  margin: 0 0 6px;
  color: var(--color-text-muted, #718096);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.item-name {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text, #172033);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
}

.item-name:hover {
  color: var(--color-primary, #1f4a8a);
}

.unit-price {
  margin: 8px 0;
  color: var(--color-text-muted, #718096);
  font-size: 12px;
}

.remove-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #c34444;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.remove-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
}

.quantity-control {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border-soft, #e1e7ef);
  border-radius: 6px;
  overflow: hidden;
}

.quantity-control button {
  width: 32px;
  height: 34px;
  border: 0;
  background: #f5f7fa;
  font-size: 18px;
  cursor: pointer;
}

.quantity-control button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.quantity-control span {
  min-width: 34px;
  text-align: center;
  font-size: 13px;
}

.line-total {
  white-space: nowrap;
  font-size: 15px;
}

.order-summary {
  position: sticky;
  top: 20px;
  padding: 22px;
}

.order-summary h2 {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border-soft, #e8edf3);
}

.summary-row,
.summary-total {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 15px 0;
  font-size: 13px;
}

.summary-row > span:first-child,
.summary-total > span {
  color: var(--color-text-muted, #718096);
}

.summary-row strong {
  white-space: nowrap;
}

.summary-row .muted {
  max-width: 125px;
  text-align: right;
  font-size: 11px;
}

.summary-total {
  margin-top: 5px;
  border-top: 1px solid var(--color-border-soft, #e8edf3);
  font-size: 15px;
}

.summary-total strong {
  color: var(--color-primary, #1f4a8a);
  font-size: 19px;
  white-space: nowrap;
}

.summary-note {
  margin: 0 0 18px;
  color: var(--color-text-muted, #718096);
  font-size: 11px;
  line-height: 1.7;
}

.checkout-button,
.primary-button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 46px;
  padding: 12px;
  border: 0;
  border-radius: 7px;
  background: var(--color-primary, #1f4a8a);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.checkout-button:hover,
.primary-button:hover {
  filter: brightness(1.08);
}

.secure-note {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  margin: 17px 0;
  color: var(--color-text-muted, #718096);
  font-size: 11px;
}

.secure-note span {
  color: #16845b;
  font-weight: 800;
}

.back-button {
  width: 100%;
  background: #fff;
}

.empty-cart,
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 35px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
}

.empty-cart h2 {
  margin-bottom: 0;
  font-size: 23px;
}

.empty-cart .primary-button,
.state-card .primary-button {
  width: auto;
  min-width: 180px;
  margin-top: 12px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #e1e7ef;
  border-top-color: var(--color-primary, #1f4a8a);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.message {
  margin: 0 0 16px;
  padding: 12px 15px;
  border-radius: 7px;
  font-size: 13px;
}

.error-text {
  color: #b42318;
}

.success-text {
  color: #176c49;
  background: #e9f8f0;
}

@media (max-width: 900px) {
  .cart-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-summary {
    position: static;
  }
}

@media (max-width: 560px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .cart-items {
    padding: 15px;
  }

  .cart-item {
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 12px;
  }

  .product-image {
    width: 78px;
    height: 78px;
  }

  .item-actions {
    grid-column: 2;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .line-total {
    font-size: 14px;
  }
}
</style>
