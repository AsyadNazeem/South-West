<script setup>
import {
  getResponsiveImageSrcSet,
  getResponsiveImageUrl,
} from '@/utils/mediaUrl'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { analyticsItem, trackEvent } from '@/services/analytics'

const router = useRouter()

const cart = ref(null)
const loading = ref(true)
const error = ref('')
const updatingIds = ref([])
const removingIds = ref([])
const notice = ref('')
// Products whose image failed to load fall back to the "SW" tile.
const failedImages = reactive({})


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

function getVariantId(item) {
  return item.variant_id ??
    item.variant?.id ??
    item.Variant?.id ??
    null
}

function getGuestToken() {
  return sessionStorage.getItem('guestCheckoutToken')
}

function getGuestHeaders() {
  return {
    'x-guest-checkout-token': getGuestToken()
  }
}

function getCartItemKey(item) {
  const id = getItemId(item)

  if (id != null) return `registered-${id}`

  return `guest-${getProductId(item)}-${getVariantId(item) ?? 'null'}`
}

function getProductId(item) {
  const product = getProduct(item)
  return product.id ?? item.item_id ?? item.product_id
}

function itemKey(item) {
  return getCartItemKey(item)
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
  const variant = getVariant(item)
  const images = product.images ?? product.ItemImages ?? item.images ?? item.ItemImages ?? []

  const primaryImage = Array.isArray(images)
    ? images.find(image => image.is_primary) || images[0]
    : null

  const imageValue = [
    variant.image,
    variant.image_url,
    product.image,
    product.image_url,
    product.thumbnail,
    primaryImage?.url,
    primaryImage?.file_path,
    item.image,
    item.image_url,
  ].find(Boolean)
  const matchingGalleryImage = typeof imageValue === 'string'
    ? (Array.isArray(images) ? images : []).find(image => [
        image?.url,
        image?.image_url,
        image?.file_path,
      ].some(candidate =>
        typeof candidate === 'string' &&
        getResponsiveImageUrl(candidate) === getResponsiveImageUrl(imageValue)
      ))
    : null
  const imageRecord = matchingGalleryImage || imageValue

  return {
    src: imageRecord ? getResponsiveImageUrl(imageRecord) : '',
    srcset: imageRecord?.responsive_images
      ? getResponsiveImageSrcSet(imageRecord.responsive_images)
      : '',
  }
}

// Empty once an image has failed, so the fallback tile shows.
function imageFor(item) {
  return failedImages[itemKey(item)] ? { src: '', srcset: '' } : getImage(item)
}

function getQuantity(item) {
  return Number(item.quantity ?? item.cart_quantity ?? 1)
}

function getOriginalPrice(item) {
  return Number(
    item.original_price ??
    item.unit_price ??
    item.price ??
    item.selling_price ??
    getProduct(item).price ??
    getProduct(item).selling_price ??
    0
  ) || 0
}

function getUnitPrice(item) {
  return Number(
    item.discounted_price ??
    item.discounted_unit_price ??
    getOriginalPrice(item)
  ) || 0
}

function getLineTotal(item) {
  return Number(
    item.discounted_line_total ??
    getUnitPrice(item) * getQuantity(item)
  ) || 0
}

function getOriginalLineTotal(item) {
  return getOriginalPrice(item) * getQuantity(item)
}

function hasDiscount(item) {
  return getUnitPrice(item) < getOriginalPrice(item)
}

function discountPercent(item) {
  const given = Number(item.discount_percentage)
  if (given > 0) return Math.round(given)

  const original = getOriginalPrice(item)
  return original > 0
    ? Math.round((1 - getUnitPrice(item) / original) * 100)
    : 0
}

function isBusy(item) {
  const key = itemKey(item)

  return updatingIds.value.includes(key) ||
    removingIds.value.includes(key)
}
const totalDiscount = computed(() =>
  cartItems.value.reduce(
    (total, item) =>
      total + Number(
        item.total_discount_amount ??
        (getOriginalPrice(item) - getUnitPrice(item)) * getQuantity(item)
      ),
    0
  )
)

const subtotal = computed(() =>
  cartItems.value.reduce(
    (total, item) => total + getLineTotal(item),
    0
  )
)

// Items total before campaign discounts, so the summary adds up:
// items total - discount = subtotal.
const originalSubtotal = computed(() => subtotal.value + totalDiscount.value)

function getVariant(item) {
    return item.variant ?? item.Variant ?? {}
}

function getVariantName(item) {
  const variant = getVariant(item)
  return variant.variant_name || item.variant_name || ''
}

function getVariantSku(item) {
    const variant = getVariant(item)

    return variant.variant_sku || ''
}


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

  const customerToken = sessionStorage.getItem('customerToken')

  if (!customerToken && !getGuestToken()) {
    cart.value = { items: [] }
    loading.value = false
    return
  }

  try {
    const response = customerToken
      ? await api.get('/customer-cart/')
      : await api.get('/guest-checkout/session', {
          headers: getGuestHeaders()
        })

    setCartResponse(response.data)
    try {
      const items = cartItems.value.map(item => analyticsItem(getProduct(item), getQuantity(item)))
      trackEvent('view_cart', { currency: 'LKR', value: cartItems.value.reduce((total, item) => total + (Number(getProduct(item).price ?? getProduct(item).selling_price) || 0) * getQuantity(item), 0), items })
    } catch { /* Analytics must not affect cart loading. */ }
  } catch (err) {
    if (
      !customerToken &&
      [401, 403].includes(err.response?.status)
    ) {
      sessionStorage.removeItem('guestCheckoutToken')
      cart.value = { items: [] }
      notice.value = 'Your guest cart session expired. Please add your items again.'
    } else {
      error.value =
        err.response?.data?.message ??
        'Unable to load your cart. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

async function updateQuantity(item, nextQuantity) {
  const customerToken = sessionStorage.getItem('customerToken')
  const id = itemKey(item)

  if (nextQuantity < 1 || updatingIds.value.includes(id)) return

  if (!customerToken && !getGuestToken()) return

  updatingIds.value = [...updatingIds.value, id]
  error.value = ''
  notice.value = ''

  try {
    if (customerToken) {
      const cartItemId = getItemId(item)

      if (cartItemId == null) return

      await api.patch(
        `/customer-cart/items/${encodeURIComponent(cartItemId)}`,
        { quantity: nextQuantity }
      )
    } else {
      await api.patch(
        '/guest-checkout/session/items',
        {
          item_id: getProductId(item),
          variant_id: getVariantId(item),
          quantity: nextQuantity
        },
        { headers: getGuestHeaders() }
      )
    }

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
  const customerToken = sessionStorage.getItem('customerToken')
  const id = itemKey(item)

  if (removingIds.value.includes(id)) return

  removingIds.value = [...removingIds.value, id]
  error.value = ''
  notice.value = ''

  try {
    if (customerToken) {
      const cartItemId = getItemId(item)

      if (cartItemId == null) return

      await api.delete(
        `/customer-cart/items/${encodeURIComponent(cartItemId)}`
      )
    } else {
      await api.delete('/guest-checkout/session/items', {
        data: {
          item_id: getProductId(item),
          variant_id: getVariantId(item)
        },
        headers: getGuestHeaders()
      })
    }

    const removedProduct = getProduct(item)
    try {
      trackEvent('remove_from_cart', { currency: 'LKR', value: (Number(removedProduct.price ?? removedProduct.selling_price) || 0) * getQuantity(item), items: [analyticsItem(removedProduct, getQuantity(item))] })
    } catch { /* Analytics must not affect cart updates. */ }
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
  const product = getProduct(item)

  if (!product.slug || !product.public_id) {
    error.value = 'Unable to open this product. Please refresh your cart.'
    return
  }

  const productSlug = `${product.slug}-${product.public_id}`

  router.push(`/product/${encodeURIComponent(productSlug)}`)
}

function continueShopping() {
  router.push('/')
}

function proceedToCheckout() {
  const customerToken = sessionStorage.getItem('customerToken')

  // Registered customers keep the existing checkout flow.
  if (customerToken) {
    router.push('/checkout')
    return
  }

  // Guests reuse their existing cart session.
  const guestToken = getGuestToken()

  if (!/^[a-f0-9]{64}$/i.test(guestToken || '')) {
    error.value = 'Your guest cart session could not be identified. Please refresh your cart.'
    return
  }

  router.push(`/checkout/address/${guestToken}`)
}

onMounted(loadCart)
</script>

<template>
  <main class="cart-page" :class="{ 'has-bar': cartItems.length }">
    <header class="cart-hero">
      <div class="cart-container">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <RouterLink to="/">Home</RouterLink>
          <span aria-hidden="true">/</span>
          <span>Shopping Cart</span>
        </nav>

        <div class="page-heading">
          <div>
            <p class="eyebrow">SOUTH WEST STORE</p>
            <h1>Your shopping cart</h1>
            <p class="hero-text">
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
        </div>

        <ol class="stepper" aria-label="Checkout progress">
          <li class="step current" aria-current="step">
            <span class="step-number" aria-hidden="true">1</span>
            <span class="step-label">Cart</span>
          </li>
          <li class="step">
            <span class="step-number" aria-hidden="true">2</span>
            <span class="step-label">Checkout</span>
          </li>
          <li class="step">
            <span class="step-number" aria-hidden="true">3</span>
            <span class="step-label">Confirmation</span>
          </li>
        </ol>
      </div>
    </header>

    <div class="cart-container cart-body">
      <!-- Loading -->
      <div
          v-if="loading && !cart"
          class="cart-layout"
          aria-busy="true"
          aria-label="Loading your cart"
      >
        <section class="cart-items" aria-hidden="true">
          <div v-for="n in 3" :key="n" class="skeleton-item">
            <div class="skeleton-block image"></div>
            <div class="skeleton-lines">
              <div class="skeleton-block short"></div>
              <div class="skeleton-block"></div>
              <div class="skeleton-block short"></div>
            </div>
          </div>
        </section>

        <aside class="order-summary" aria-hidden="true">
          <div class="skeleton-block short"></div>
          <div class="skeleton-block"></div>
          <div class="skeleton-block"></div>
          <div class="skeleton-block tall"></div>
        </aside>
      </div>

      <div v-else-if="error && !cart" class="state-card" role="alert">
        <p class="error-text">{{ error }}</p>
        <button class="primary-button" type="button" @click="loadCart">
          Try again
        </button>
      </div>

      <div v-else-if="cartItems.length === 0" class="empty-cart">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
                d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 8H6"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <circle cx="10" cy="20" r="1.4" fill="currentColor" />
            <circle cx="18" cy="20" r="1.4" fill="currentColor" />
          </svg>
        </div>
        <h2>Your cart is empty</h2>
        <p class="muted">
          Looks like you haven't added anything to your cart yet.
        </p>
        <button class="primary-button" type="button" @click="continueShopping">
          Explore products
        </button>
      </div>

      <template v-else>
        <p v-if="error" class="message error-text" role="alert">{{ error }}</p>
        <p v-if="notice" class="message success-text" role="status">{{ notice }}</p>

        <div class="cart-layout">
          <section class="cart-items">
            <div class="section-heading">
              <h2>Cart items</h2>
              <span>{{ totalQuantity }} item(s)</span>
            </div>

            <ul class="item-list">
              <li
                  v-for="item in cartItems"
                  :key="itemKey(item)"
                  class="cart-item"
                  :class="{ 'is-busy': isBusy(item) }"
              >
                <button
                    class="product-image"
                    type="button"
                    :aria-label="`View ${getName(item)}`"
                    @click="openProduct(item)"
                >
                  <img
                      v-if="imageFor(item).src"
                      :src="imageFor(item).src"
                      :srcset="imageFor(item).srcset || undefined"
                      sizes="(max-width: 340px) 94vw, (max-width: 560px) 88px, 112px"
                      :alt="getName(item)"
                      loading="lazy"
                      decoding="async"
                      @error="failedImages[itemKey(item)] = true"
                  />
                  <span v-else class="image-fallback" aria-hidden="true">SW</span>

                  <span v-if="hasDiscount(item)" class="image-badge">
                    -{{ discountPercent(item) }}%
                  </span>
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

                  <ul
                      v-if="getVariantName(item) || getVariantSku(item)"
                      class="item-meta"
                  >
                    <li v-if="getVariantName(item)" class="variant-detail">
                      Option: <strong>{{ getVariantName(item) }}</strong>
                    </li>
                    <li v-if="getVariantSku(item)" class="variant-detail">
                      SKU: <strong>{{ getVariantSku(item) }}</strong>
                    </li>
                  </ul>

                  <div class="unit-price">
                    <template v-if="hasDiscount(item)">
                      <span class="original-price">
                        {{ formatPrice(getOriginalPrice(item)) }}
                      </span>
                      <strong class="discounted-price">
                        {{ formatPrice(getUnitPrice(item)) }} each
                      </strong>
                      <span class="discount-label">
                        {{ discountPercent(item) }}% OFF
                      </span>
                      <p v-if="item.discount_campaign?.name" class="campaign-name">
                        {{ item.discount_campaign.name }}
                      </p>
                    </template>

                    <template v-else>
                      <strong class="regular-price">
                        {{ formatPrice(getUnitPrice(item)) }}
                      </strong>
                      <span> each</span>
                    </template>
                  </div>

                  <button
                      class="remove-button"
                      type="button"
                      :disabled="removingIds.includes(getItemId(item))"
                      @click="removeItem(item)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                          d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                      />
                    </svg>
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

                    <span aria-live="polite">{{ getQuantity(item) }}</span>

                    <button
                        type="button"
                        aria-label="Increase quantity"
                        :disabled="updatingIds.includes(getItemId(item))"
                        @click="updateQuantity(item, getQuantity(item) + 1)"
                    >+</button>
                  </div>

                  <div class="line-price">
                    <s v-if="hasDiscount(item)" class="original-line">
                      {{ formatPrice(getOriginalLineTotal(item)) }}
                    </s>
                    <strong class="line-total">
                      {{ formatPrice(getLineTotal(item)) }}
                    </strong>
                  </div>
                </div>
              </li>
            </ul>
          </section>

          <aside class="order-summary">
            <h2>Order summary</h2>

            <div class="summary-row">
              <span>Items ({{ totalQuantity }})</span>
              <strong>{{ formatPrice(originalSubtotal) }}</strong>
            </div>

            <div v-if="totalDiscount > 0" class="summary-row">
              <span>Campaign discount</span>
              <strong class="discounted-price">
                − {{ formatPrice(totalDiscount) }}
              </strong>
            </div>

            <div class="summary-row">
              <span>Delivery</span>
              <span class="muted">Calculated at checkout</span>
            </div>

            <div class="summary-total">
              <span>Subtotal</span>
              <strong>{{ formatPrice(subtotal) }}</strong>
            </div>

            <p v-if="totalDiscount > 0" class="savings-note">
              You are saving {{ formatPrice(totalDiscount) }} on this order.
            </p>

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
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <ul class="trust-list">
              <li>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
                Secure checkout
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 7h18v10H3z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Cash on Delivery available
              </li>
            </ul>

            <button
                class="back-button"
                type="button"
                @click="continueShopping"
            >
              Continue shopping
            </button>
          </aside>
        </div>

        <!-- Phones and tablets: total and checkout stay within reach -->
        <div class="checkout-bar">
          <div class="checkout-bar-total">
            <span>Subtotal</span>
            <strong>{{ formatPrice(subtotal) }}</strong>
          </div>

          <button
              class="checkout-button"
              type="button"
              @click="proceedToCheckout"
          >
            Checkout
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.cart-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: var(--space-16);
  background: var(--color-store-bg);
  color: var(--color-text);
}

.cart-container {
  box-sizing: border-box;
  width: min(var(--container-store), 1240px, 94%);
  margin: 0 auto;
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

/* ---------- Hero and progress (same band as checkout) ---------- */
.cart-hero {
  padding: var(--space-6) 0 var(--space-8);
  background: var(--gradient-metal);
  color: var(--color-on-primary);
  box-shadow: inset 0 -1px 0 rgb(0 0 0 / 45%);
}

.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  color: rgb(255 255 255 / 60%);
  font-size: var(--font-size-xs);
}

.breadcrumbs a {
  color: inherit;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.breadcrumbs a:hover {
  color: var(--color-on-primary);
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-5);
}

.eyebrow {
  margin: 0;
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.14em;
}

.page-heading h1 {
  margin: var(--space-2) 0 0;
  font-family: var(--font-family-display);
  font-size: clamp(26px, 4.5vw, 36px);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
}

.hero-text {
  margin: var(--space-2) 0 0;
  color: rgb(255 255 255 / 72%);
  font-size: var(--font-size-sm);
}

.continue-button {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 var(--space-5);
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-on-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.continue-button:hover {
  border-color: var(--color-on-primary);
  background: var(--color-on-primary);
  color: var(--color-primary);
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
.cart-body {
  padding-top: var(--space-6);
}

.cart-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: start;
  gap: var(--space-6);
}

.cart-items,
.order-summary,
.empty-cart,
.state-card {
  min-width: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.cart-items {
  padding: var(--space-6);
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
}

.section-heading h2,
.order-summary h2 {
  margin: 0;
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.section-heading span {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

/* ---------- Cart items ---------- */
.item-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cart-item {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) auto;
  gap: var(--space-5);
  align-items: center;
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--color-border-soft);
  transition: opacity var(--transition-fast);
}

.cart-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

/* Updating or removing: dimmed and not clickable */
.cart-item.is-busy {
  opacity: 0.55;
  pointer-events: none;
}

/* Product image tile */
.product-image {
  position: relative;
  display: grid;
  place-items: center;
  width: 112px;
  height: 112px;
  padding: var(--space-2);
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  mix-blend-mode: multiply;
  transition: transform var(--transition-base);
}

.image-fallback {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: 800;
}

.image-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 1.5;
}

@media (hover: hover) {
  .product-image:hover {
    border-color: var(--color-border);
    box-shadow: var(--shadow-sm);
  }

  .product-image:hover img {
    transform: scale(1.05);
  }
}

.product-image:focus-visible,
.item-name:focus-visible,
.remove-button:focus-visible,
.quantity-control button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.item-info {
  min-width: 0;
}

.brand {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.item-name {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
  text-align: left;
  overflow-wrap: anywhere;
  transition: color var(--transition-fast);
}

.item-name:hover {
  color: var(--color-primary);
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.variant-detail {
  padding: 2px 8px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.variant-detail strong {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.unit-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--space-2);
  margin: var(--space-3) 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.regular-price {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.original-price {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  text-decoration: line-through;
}

.discounted-price {
  color: #15803d;
  font-weight: var(--font-weight-bold);
}

.discount-label {
  padding: 2px 6px;
  border-radius: 4px;
  background: #dcfce7;
  color: #166534;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
}

.campaign-name {
  flex-basis: 100%;
  margin: 2px 0 0;
  color: #15803d;
  font-size: 11px;
}

.remove-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  transition: color var(--transition-fast);
}

.remove-button svg {
  width: 15px;
  height: 15px;
}

.remove-button:hover {
  color: var(--color-danger);
}

.remove-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-4);
}

.quantity-control {
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.quantity-control button {
  width: 38px;
  height: 38px;
  border: 0;
  background: var(--color-surface-muted);
  color: var(--color-text);
  cursor: pointer;
  font-size: 18px;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.quantity-control button:hover:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.quantity-control button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.quantity-control span {
  min-width: 40px;
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.line-price {
  display: grid;
  justify-items: end;
  gap: 2px;
}

.original-line {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.line-total {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
}

/* ---------- Order summary ---------- */
.order-summary {
  position: sticky;
  /* Clears the sticky site header */
  top: calc(72px + var(--space-5));
  padding: var(--space-6);
}

.order-summary h2 {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
}

.summary-row,
.summary-total {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  font-size: var(--font-size-sm);
}

.summary-row > span:first-child,
.summary-total > span {
  color: var(--color-text-muted);
}

.summary-row strong {
  white-space: nowrap;
}

.summary-row .muted {
  max-width: 140px;
  text-align: right;
  font-size: var(--font-size-xs);
}

.summary-total {
  align-items: baseline;
  margin-top: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-soft);
}

.summary-total > span {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.summary-total strong {
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  white-space: nowrap;
}

.savings-note {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: #dcfce7;
  color: #166534;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.summary-note {
  margin: var(--space-4) 0 var(--space-5);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.7;
}

.checkout-button,
.primary-button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 12px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  transition: background var(--transition-fast);
}

.checkout-button svg {
  width: 18px;
  height: 18px;
}

.checkout-button:hover,
.primary-button:hover {
  background: var(--color-primary-hover);
}

.checkout-button:focus-visible,
.primary-button:focus-visible,
.back-button:focus-visible,
.continue-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.trust-list {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-4) 0;
  padding: 0;
  list-style: none;
}

.trust-list li {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.trust-list svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #16845b;
}

.back-button {
  width: 100%;
  min-height: 44px;
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

.back-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* ---------- Empty, error and messages ---------- */
.empty-cart,
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: var(--space-8) var(--space-5);
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin-bottom: var(--space-4);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary);
}

.empty-icon svg {
  width: 40px;
  height: 40px;
}

.empty-cart h2 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
}

.empty-cart .muted {
  margin: 0;
}

.empty-cart .primary-button,
.state-card .primary-button {
  width: auto;
  min-width: 200px;
  margin-top: var(--space-5);
}

.message {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.error-text {
  color: var(--color-danger);
}

.message.error-text {
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  background: var(--color-danger-bg);
}

.success-text {
  background: #e9f8f0;
  color: #176c49;
}

/* ---------- Loading skeleton ---------- */
.skeleton-item {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: var(--space-5);
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--color-border-soft);
}

.skeleton-item:last-child {
  border-bottom: 0;
}

.skeleton-lines {
  display: grid;
  align-content: center;
  gap: var(--space-3);
}

.order-summary .skeleton-block + .skeleton-block {
  margin-top: var(--space-3);
}

.skeleton-block {
  height: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  animation: pulse 1.4s ease-in-out infinite;
}

.skeleton-block.image {
  width: 112px;
  height: 112px;
  border-radius: var(--radius-md);
}

.skeleton-block.short {
  width: 40%;
}

.skeleton-block.tall {
  height: 48px;
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

/* ---------- Mobile checkout bar (hidden on desktop) ---------- */
.checkout-bar {
  display: none;
}

/* ---------- Tablet and below: single column ---------- */
@media (max-width: 900px) {
  .cart-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-summary {
    position: static;
  }

  /* The bar below replaces the summary button */
  .order-summary .checkout-button {
    display: none;
  }

  .order-summary .summary-note {
    margin-bottom: var(--space-4);
  }

  .cart-page.has-bar {
    padding-bottom: 104px;
  }

  .checkout-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 150;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom));
    padding-left: max(var(--space-4), env(safe-area-inset-left));
    padding-right: max(var(--space-4), env(safe-area-inset-right));
    border-top: 1px solid var(--color-border-soft);
    background: var(--color-surface);
    box-shadow: 0 -6px 20px rgb(0 0 0 / 8%);
  }

  .checkout-bar-total {
    display: grid;
    min-width: 0;
  }

  .checkout-bar-total span {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  .checkout-bar-total strong {
    color: var(--color-primary);
    font-family: var(--font-family-display);
    font-size: var(--font-size-md);
    white-space: nowrap;
  }

  .checkout-bar .checkout-button {
    width: auto;
    min-width: 160px;
    padding: 12px var(--space-5);
  }
}

/* ---------- Phones ---------- */
@media (max-width: 560px) {
  .cart-hero {
    padding: var(--space-5) 0 var(--space-6);
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
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

  .cart-items,
  .order-summary {
    padding: var(--space-4);
  }

  .cart-item {
    grid-template-columns: 88px minmax(0, 1fr);
    gap: var(--space-3);
    align-items: start;
  }

  .product-image {
    width: 88px;
    height: 88px;
  }

  .skeleton-item {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  .skeleton-block.image {
    width: 88px;
    height: 88px;
  }

  .item-actions {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-3);
    border-top: 1px dashed var(--color-border-soft);
  }

  .line-price {
    justify-items: end;
  }

  .line-total {
    font-size: var(--font-size-sm);
  }

  .checkout-bar .checkout-button {
    min-width: 0;
  }
}

/* ---------- Fold cover screens ---------- */
@media (max-width: 340px) {
  .cart-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .product-image {
    width: 100%;
    height: 140px;
  }

  .checkout-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .checkout-bar .checkout-button {
    width: 100%;
  }

  .cart-page.has-bar {
    padding-bottom: 140px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block {
    animation: none;
  }

  .cart-item,
  .product-image,
  .product-image img,
  .quantity-control button,
  .checkout-button,
  .primary-button,
  .back-button,
  .continue-button {
    transition: none;
  }
}
</style>
